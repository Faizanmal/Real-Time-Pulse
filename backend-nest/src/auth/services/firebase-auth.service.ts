import { Injectable, Logger, UnauthorizedException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { PrismaService } from '../../prisma/prisma.service';
import { EncryptionService } from '../../common/services/encryption.service';
import * as admin from 'firebase-admin';

interface FirebaseUserData {
  uid: string;
  email: string;
  emailVerified: boolean;
  displayName?: string;
  photoURL?: string;
  phoneNumber?: string;
}

interface DecodedIdToken {
  uid: string;
  email?: string;
  email_verified?: boolean;
  name?: string;
  picture?: string;
  phone_number?: string;
  auth_time: number;
  iat: number;
  exp: number;
}

@Injectable()
export class FirebaseAuthService {
  private readonly logger = new Logger(FirebaseAuthService.name);
  private firebaseInitialized = false;

  constructor(
    private readonly configService: ConfigService,
    private readonly prisma: PrismaService,
    private readonly encryptionService: EncryptionService,
  ) {
    this.initializeFirebase();
  }

  private initializeFirebase(): void {
    try {
      const projectId = this.configService.get<string>('firebase.projectId');
      const clientEmail = this.configService.get<string>('firebase.clientEmail');
      const privateKey = this.configService.get<string>('firebase.privateKey');

      if (!projectId || !clientEmail || !privateKey) {
        this.logger.warn('Firebase configuration incomplete - Firebase auth disabled');
        return;
      }

      if (!admin.apps.length) {
        admin.initializeApp({
          credential: admin.credential.cert({
            projectId,
            clientEmail,
            privateKey: privateKey.replace(/\\n/g, '\n'),
          }),
        });
        this.firebaseInitialized = true;
        this.logger.log('Firebase Admin SDK initialized successfully');
      } else {
        this.firebaseInitialized = true;
      }
    } catch (error) {
      this.logger.error('Failed to initialize Firebase Admin SDK', error);
    }
  }

  /**
   * Verify Firebase ID token
   */
  async verifyIdToken(idToken: string): Promise<DecodedIdToken> {
    if (!this.firebaseInitialized) {
      throw new UnauthorizedException('Firebase authentication is not configured');
    }

    try {
      const decodedToken = await admin.auth().verifyIdToken(idToken, true);
      return decodedToken as DecodedIdToken;
    } catch (error: any) {
      this.logger.error('Firebase token verification failed', error);

      if (error.code === 'auth/id-token-expired') {
        throw new UnauthorizedException('Token has expired');
      }
      if (error.code === 'auth/id-token-revoked') {
        throw new UnauthorizedException('Token has been revoked');
      }
      if (error.code === 'auth/argument-error') {
        throw new UnauthorizedException('Invalid token format');
      }

      throw new UnauthorizedException('Invalid Firebase token');
    }
  }

  /**
   * Get Firebase user by UID
   */
  async getFirebaseUser(uid: string): Promise<FirebaseUserData | null> {
    if (!this.firebaseInitialized) {
      return null;
    }

    try {
      const userRecord = await admin.auth().getUser(uid);
      return {
        uid: userRecord.uid,
        email: userRecord.email || '',
        emailVerified: userRecord.emailVerified,
        displayName: userRecord.displayName,
        photoURL: userRecord.photoURL,
        phoneNumber: userRecord.phoneNumber,
      };
    } catch (error) {
      this.logger.error(`Failed to get Firebase user: ${uid}`, error);
      return null;
    }
  }

  /**
   * Revoke refresh tokens for a user
   */
  async revokeRefreshTokens(uid: string): Promise<void> {
    if (!this.firebaseInitialized) {
      return;
    }

    try {
      await admin.auth().revokeRefreshTokens(uid);
      this.logger.log(`Revoked refresh tokens for user: ${uid}`);
    } catch (error) {
      this.logger.error(`Failed to revoke tokens for user: ${uid}`, error);
    }
  }

  /**
   * Create or update user from Firebase authentication
   */
  async createOrUpdateUser(firebaseData: DecodedIdToken): Promise<{
    id: string;
    email: string;
    firstName: string | null;
    lastName: string | null;
    workspaceId: string;
    role: string;
  }> {
    const email = firebaseData.email;

    if (!email) {
      throw new UnauthorizedException('Email is required for authentication');
    }

    // Check if user exists with Firebase UID
    let user = await this.prisma.user.findFirst({
      where: { firebaseUid: firebaseData.uid },
    });

    if (!user) {
      // Check if user exists with email
      user = await this.prisma.user.findUnique({
        where: { email },
      });

      if (user) {
        // Link Firebase account to existing user
        user = await this.prisma.user.update({
          where: { id: user.id },
          data: {
            firebaseUid: firebaseData.uid,
            emailVerified: firebaseData.email_verified || user.emailVerified,
            avatar: firebaseData.picture || user.avatar,
          },
        });
      } else {
        // Create new user with workspace
        const nameParts = (firebaseData.name || email.split('@')[0]).split(' ');
        const firstName = nameParts[0];
        const lastName = nameParts.slice(1).join(' ') || null;

        const workspaceSlug = email
          .split('@')[0]
          .toLowerCase()
          .replace(/[^a-z0-9]+/g, '-')
          .substring(0, 50);

        const result = await this.prisma.$transaction(async (tx) => {
          const workspace = await tx.workspace.create({
            data: {
              name: `${firstName}'s Workspace`,
              slug: `${workspaceSlug}-${Date.now()}`,
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

          return tx.user.create({
            data: {
              email,
              firebaseUid: firebaseData.uid,
              firstName,
              lastName,
              avatar: firebaseData.picture,
              workspaceId: workspace.id,
              role: 'OWNER',
              emailVerified: firebaseData.email_verified || false,
            },
          });
        });

        user = result;
      }
    }

    // Update last login
    await this.prisma.user.update({
      where: { id: user.id },
      data: { lastLoginAt: new Date() },
    });

    return {
      id: user.id,
      email: user.email,
      firstName: user.firstName,
      lastName: user.lastName,
      workspaceId: user.workspaceId,
      role: user.role,
    };
  }

  isEnabled(): boolean {
    return this.firebaseInitialized;
  }
}
