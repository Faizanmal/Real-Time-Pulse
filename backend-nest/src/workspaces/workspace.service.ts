import {
  Injectable,
  NotFoundException,
  ConflictException,
  ForbiddenException,
  BadRequestException,
  Logger,
} from '@nestjs/common';
import { PrismaService } from '../prisma/prisma.service';
import { S3Service } from '../common/services/s3.service';
import { EncryptionService } from '../common/services/encryption.service';
import { EmailService } from '../email/email.service';
import {
  UpdateWorkspaceDto,
  WorkspaceResponseDto,
  InviteMemberDto,
  WorkspaceMemberResponseDto,
  WorkspaceStatsDto,
} from './dto/workspace.dto';

@Injectable()
export class WorkspaceService {
  private readonly logger = new Logger(WorkspaceService.name);

  constructor(
    private readonly prisma: PrismaService,
    private readonly s3Service: S3Service,
    private readonly encryptionService: EncryptionService,
    private readonly emailService: EmailService,
  ) {}

  /**
   * Get workspace by ID
   */
  async getWorkspace(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Verify user belongs to workspace
    await this.verifyUserInWorkspace(userId, workspaceId);

    return this.mapToResponseDto(workspace);
  }

  /**
   * Update workspace details
   */
  async updateWorkspace(
    workspaceId: string,
    userId: string,
    dto: UpdateWorkspaceDto,
  ): Promise<WorkspaceResponseDto> {
    // Verify user has permission (must be OWNER or ADMIN)
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // If slug is being updated, check if it's available
    if (dto.slug) {
      const existingWorkspace = await this.prisma.workspace.findUnique({
        where: { slug: dto.slug },
      });

      if (existingWorkspace && existingWorkspace.id !== workspaceId) {
        throw new ConflictException('Workspace slug is already taken');
      }
    }

    const updatedWorkspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: dto,
    });

    return this.mapToResponseDto(updatedWorkspace);
  }

  /**
   * Upload workspace logo
   */
  async uploadLogo(
    workspaceId: string,
    userId: string,
    file: Express.Multer.File,
  ): Promise<WorkspaceResponseDto> {
    // Verify user has permission
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // Validate file
    if (!this.s3Service.validateImageFile(file)) {
      throw new BadRequestException(
        'Invalid file type. Only images are allowed.',
      );
    }

    if (!this.s3Service.validateFileSize(file, 5)) {
      throw new BadRequestException('File size must not exceed 5MB');
    }

    // Get current workspace to delete old logo if exists
    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    // Upload new logo
    const logoUrl = await this.s3Service.uploadFile(file, 'workspace-logos');

    // Delete old logo if exists
    if (workspace.logo) {
      try {
        await this.s3Service.deleteFile(workspace.logo);
      } catch (error) {
        // Log error but don't fail the request
        console.error('Failed to delete old logo:', error);
      }
    }

    // Update workspace with new logo URL
    const updatedWorkspace = await this.prisma.workspace.update({
      where: { id: workspaceId },
      data: { logo: logoUrl },
    });

    return this.mapToResponseDto(updatedWorkspace);
  }

  /**
   * Delete workspace logo
   */
  async deleteLogo(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceResponseDto> {
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
    });

    if (!workspace) {
      throw new NotFoundException('Workspace not found');
    }

    if (workspace.logo) {
      try {
        await this.s3Service.deleteFile(workspace.logo);
      } catch (error) {
        console.error('Failed to delete logo:', error);
      }

      const updatedWorkspace = await this.prisma.workspace.update({
        where: { id: workspaceId },
        data: { logo: null },
      });

      return this.mapToResponseDto(updatedWorkspace);
    }

    return this.mapToResponseDto(workspace);
  }

  /**
   * Get workspace members
   */
  async getMembers(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceMemberResponseDto[]> {
    await this.verifyUserInWorkspace(userId, workspaceId);

    const members = await this.prisma.user.findMany({
      where: { workspaceId },
      orderBy: { createdAt: 'asc' },
    });

    return members.map((member) => ({
      id: member.id,
      email: member.email,
      firstName: member.firstName,
      lastName: member.lastName,
      avatar: member.avatar,
      role: member.role,
      createdAt: member.createdAt,
      lastLoginAt: member.lastLoginAt,
    }));
  }

  /**
   * Invite a new member to workspace
   */
  async inviteMember(
    workspaceId: string,
    userId: string,
    dto: InviteMemberDto,
  ): Promise<WorkspaceMemberResponseDto> {
    // Verify user has permission
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // Check if user already exists
    const existingUser = await this.prisma.user.findUnique({
      where: { email: dto.email },
    });

    if (existingUser) {
      if (existingUser.workspaceId === workspaceId) {
        throw new ConflictException(
          'User is already a member of this workspace',
        );
      } else {
        throw new ConflictException(
          'User already has an account in another workspace',
        );
      }
    }

    // Check workspace subscription limits
    const subscription = await this.prisma.subscription.findUnique({
      where: { workspaceId },
    });

    if (!subscription) {
      throw new NotFoundException('Workspace subscription not found');
    }

    const currentMemberCount = await this.prisma.user.count({
      where: { workspaceId },
    });

    if (currentMemberCount >= subscription.maxUsers) {
      throw new ForbiddenException(
        'Workspace has reached maximum user limit. Please upgrade your plan.',
      );
    }

    // Generate temporary password for new member
    const tempPassword = this.encryptionService.generateToken(16);
    const hashedPassword =
      await this.encryptionService.hashPassword(tempPassword);

    const inviter = await this.prisma.user.findUnique({
      where: { id: userId },
      select: { firstName: true, lastName: true, email: true },
    });

    const workspace = await this.prisma.workspace.findUnique({
      where: { id: workspaceId },
      select: { name: true },
    });

    // Create user
    const newUser = await this.prisma.user.create({
      data: {
        email: dto.email,
        password: hashedPassword,
        firstName: dto.firstName,
        lastName: dto.lastName,
        workspaceId,
        role: dto.role || 'MEMBER',
        emailVerified: false,
      },
    });

    const inviterName = inviter
      ? `${inviter.firstName || ''} ${inviter.lastName || ''}`.trim() ||
        inviter.email
      : 'Workspace Admin';

    const emailSent = await this.emailService.sendWorkspaceInvitationEmail({
      to: newUser.email,
      inviterName,
      workspaceName: workspace?.name || 'Your Workspace',
      tempPassword,
    });

    if (!emailSent) {
      this.logger.warn(`Invitation email failed for ${newUser.email}`);
    }

    return {
      id: newUser.id,
      email: newUser.email,
      firstName: newUser.firstName,
      lastName: newUser.lastName,
      avatar: newUser.avatar,
      role: newUser.role,
      createdAt: newUser.createdAt,
      lastLoginAt: newUser.lastLoginAt,
    };
  }

  /**
   * Remove a member from workspace
   */
  async removeMember(
    workspaceId: string,
    userId: string,
    memberIdToRemove: string,
  ): Promise<void> {
    // Verify user has permission
    await this.verifyUserPermission(userId, workspaceId, ['OWNER', 'ADMIN']);

    // Cannot remove yourself
    if (userId === memberIdToRemove) {
      throw new BadRequestException('Cannot remove yourself from workspace');
    }

    const memberToRemove = await this.prisma.user.findUnique({
      where: { id: memberIdToRemove },
    });

    if (!memberToRemove || memberToRemove.workspaceId !== workspaceId) {
      throw new NotFoundException('Member not found in this workspace');
    }

    // Cannot remove workspace owner
    if (memberToRemove.role === 'OWNER') {
      throw new ForbiddenException('Cannot remove workspace owner');
    }

    // Admin can only remove members, not other admins
    const currentUser = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (
      currentUser &&
      currentUser.role === 'ADMIN' &&
      memberToRemove.role === 'ADMIN'
    ) {
      throw new ForbiddenException('Admins cannot remove other admins');
    }

    await this.prisma.user.delete({
      where: { id: memberIdToRemove },
    });
  }

  /**
   * Get workspace statistics
   */
  async getStats(
    workspaceId: string,
    userId: string,
  ): Promise<WorkspaceStatsDto> {
    await this.verifyUserInWorkspace(userId, workspaceId);

    // Run counts/lookup in parallel and handle as untyped result first
    const _results = await Promise.all([
      (this.prisma.portal as any).count({ where: { workspaceId } }),

      (this.prisma.user as any).count({ where: { workspaceId } }),

      (this.prisma.integration as any).count({ where: { workspaceId } }),

      (this.prisma.subscription as any).findUnique({
        where: { workspaceId },
      }),
    ] as const);

    const totalPortals = _results[0] as unknown as number;
    const totalMembers = _results[1] as unknown as number;
    const totalIntegrations = _results[2] as unknown as number;
    const subscription = _results[3] as unknown;

    // Ensure the counts are numbers
    const totalPortalsNum = Number(totalPortals);
    const totalMembersNum = Number(totalMembers);
    const totalIntegrationsNum = Number(totalIntegrations);

    let subscriptionDto: WorkspaceStatsDto['subscription'] | undefined;
    if (subscription) {
      const sub = subscription as unknown as {
        plan: string;
        status: string;
        maxPortals: number;
        maxUsers: number;
        trialEndsAt: Date | null;
      };

      subscriptionDto = {
        plan: sub.plan,
        status: sub.status,
        maxPortals: sub.maxPortals,
        maxUsers: sub.maxUsers,
        trialEndsAt: sub.trialEndsAt,
      };
    }

    return {
      totalMembers: totalMembersNum,
      totalPortals: totalPortalsNum,
      totalIntegrations: totalIntegrationsNum,
      subscription: subscriptionDto,
    };
  }

  /**
   * Verify user belongs to workspace
   */
  private async verifyUserInWorkspace(
    userId: string,
    workspaceId: string,
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }
  }

  /**
   * Verify user has required role in workspace
   */
  private async verifyUserPermission(
    userId: string,
    workspaceId: string,
    allowedRoles: string[],
  ): Promise<void> {
    const user = await this.prisma.user.findUnique({
      where: { id: userId },
    });

    if (!user || user.workspaceId !== workspaceId) {
      throw new ForbiddenException('Access denied to this workspace');
    }

    if (!allowedRoles.includes(user.role)) {
      throw new ForbiddenException(
        'You do not have permission to perform this action',
      );
    }
  }

  /**
   * Map Prisma workspace to response DTO
   */

  private mapToResponseDto(workspace: any): WorkspaceResponseDto {
    return {
      id: workspace.id,
      name: workspace.name,
      slug: workspace.slug,
      logo: workspace.logo,
      primaryColor: workspace.primaryColor,
      contactEmail: workspace.contactEmail,
      website: workspace.website,
      createdAt: workspace.createdAt,
      updatedAt: workspace.updatedAt,
    };
  }
}
