import {
  Injectable,
  ConflictException,
  UnauthorizedException,
  BadRequestException,
} from '@nestjs/common';
import { JwtService } from '@nestjs/jwt';
import { PrismaService } from '../prisma/prisma.service';
import { EncryptionService } from '../common/services/encryption.service';
import { SignUpDto, SignInDto, AuthResponseDto } from './dto/auth.dto';
import type { JwtPayload } from '../common/interfaces/auth.interface';

@Injectable()
export class AuthService {
  constructor(
    private readonly prisma: PrismaService,
    private readonly jwtService: JwtService,
    private readonly encryptionService: EncryptionService,
  ) {}

  /**
   * Sign up a new user with email/password
   * Creates workspace automatically
   */
  async signUp(dto: SignUpDto): Promise<AuthResponseDto> {
    // Check if user exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      throw new ConflictException('User with this email already exists');
    }

    // Generate workspace slug
    const workspaceSlug =
      dto.workspaceSlug ||
      dto.workspaceName
        .toLowerCase()
        .replace(/[^a-z0-9]+/g, '-')
        .replace(/(^-|-$)/g, '');

    // Check if workspace slug is taken
    const existingWorkspace = await this.prisma.workspace.findUnique({
      where: { slug: workspaceSlug },
    });

    if (existingWorkspace) {
      throw new ConflictException('Workspace slug is already taken');
    }

    // Hash password
    const hashedPassword = await this.encryptionService.hashPassword(
      dto.password,
    );

    // Create workspace and user in a transaction
    const result = await this.prisma.$transaction(async (tx) => {
      // Create workspace
      const workspace = await tx.workspace.create({
        data: {
          name: dto.workspaceName,
          slug: workspaceSlug,
        },
      });

      // Create subscription with trial
      const trialEndsAt = new Date();
      trialEndsAt.setDate(trialEndsAt.getDate() + 14); // 14-day trial

      await tx.subscription.create({
        data: {
          workspaceId: workspace.id,
          stripeCustomerId: `temp_${workspace.id}`, // Will be updated when Stripe customer is created
          plan: 'TRIAL',
          status: 'TRIALING',
          trialEndsAt,
          maxPortals: 5,
          maxUsers: 1,
        },
      });

      // Create user as owner
      const user = await tx.user.create({
        data: {
          email: dto.email,
          password: hashedPassword,
          firstName: dto.firstName,
          lastName: dto.lastName,
          workspaceId: workspace.id,
          role: 'OWNER',
          emailVerified: false,
        },
      });

      return { user, workspace };
    });

    // Generate JWT
    const accessToken = this.generateToken(result.user);

    return {
      accessToken,
      user: {
        id: result.user.id,
        email: result.user.email,
        firstName: result.user.firstName,
        lastName: result.user.lastName,
        workspaceId: result.user.workspaceId,
        role: result.user.role,
      },
    };
  }

  /**
   * Sign in with email/password
   */
  async signIn(dto: SignInDto): Promise<AuthResponseDto> {
    // Find user
    const user = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (!user || !user.password) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Verify password
    const isPasswordValid = await this.encryptionService.comparePassword(
      dto.password,
      user.password,
    );

    if (!isPasswordValid) {
      throw new UnauthorizedException('Invalid credentials');
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    // Generate JWT
    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        workspaceId: user.workspaceId,
        role: user.role,
      },
    };
  }

  /**
   * Handle Google OAuth sign in/sign up
   */
  async googleAuth(profile: {
    googleId: string;
    email: string;
    firstName: string;
    lastName: string;
    avatar?: string;
  }): Promise<AuthResponseDto> {
    // Check if user exists with this Google ID
    let user = await this.prisma.user.findUnique({
      where: { googleId: profile.googleId },
    });

    if (!user) {
      // Check if user exists with this email
      user = await this.prisma.user.findUnique({
        where: { email: profile.email },
      });

      if (user) {
        // Link Google account to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            googleId: profile.googleId,
            avatar: profile.avatar || user.avatar,
          },
        });
      } else {
        // Create new user and workspace
        const workspaceSlug = profile.email
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-');

        const result = await this.prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: {
              name: `${profile.firstName}'s Workspace`,
              slug: workspaceSlug,
            },
          });

          const trialEndsAt = new Date();
          trialEndsAt.setDate(trialEndsAt.getDate() + 14);

          await tx.subscription.create({
            data: {
              workspaceId: workspace.id,
              stripeCustomerId: `temp_${workspace.id}`,
              plan: 'TRIAL',
              status: 'TRIALING',
              trialEndsAt,
              maxPortals: 5,
              maxUsers: 1,
            },
          });

          const newUser = await tx.user.create({
            data: {
              email: profile.email,
              googleId: profile.googleId,
              firstName: profile.firstName,
              lastName: profile.lastName,
              avatar: profile.avatar,
              workspaceId: workspace.id,
              role: 'OWNER',
              emailVerified: true,
            },
          });

          return newUser;
        });

        user = result;
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    const accessToken = this.generateToken(user);

    return {
      accessToken,
      user: {
        id: user.id,
        email: user.email,
        firstName: user.firstName,
        lastName: user.lastName,
        workspaceId: user.workspaceId,
        role: user.role,
      },
    };
  }

  /**
   * Request password reset
   */
  async requestPasswordReset(email: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { email },
    });

    if (!user) {
      // Don't reveal that user doesn't exist
      return;
    }

    // Generate reset token
    const resetToken = this.encryptionService.generateToken(32);
    const resetTokenExpiry = new Date();
    resetTokenExpiry.setHours(resetTokenExpiry.getHours() + 1); // 1 hour expiry

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        resetToken,
        resetTokenExpiry,
      },
    });

    // TODO: Send email with reset link
    // await this.emailService.sendPasswordResetEmail(user.email, resetToken);
  }

  /**
   * Reset password with token
   */
  async resetPassword(token: string, newPassword: string): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { resetToken: token },
    });

    if (!user || !user.resetTokenExpiry) {
      throw new BadRequestException('Invalid or expired reset token');
    }

    if (new Date() > user.resetTokenExpiry) {
      throw new BadRequestException('Reset token has expired');
    }

    const hashedPassword =
      await this.encryptionService.hashPassword(newPassword);

    await this.prisma.user.update({
      where: { id: user.id },
      data: {
        password: hashedPassword,
        resetToken: null,
        resetTokenExpiry: null,
      },
    });
  }

  /**
   * Generate JWT token
   */
  private generateToken(user: {
    id: string;
    email: string;
    workspaceId: string;
    role: string;
  }): string {
    const payload: JwtPayload = {
      sub: user.id,
      email: user.email,
      workspaceId: user.workspaceId,
      role: user.role,
    };

    return this.jwtService.sign(payload);
  }
}
