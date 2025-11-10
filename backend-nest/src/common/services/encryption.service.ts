import { Injectable } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import * as crypto from 'crypto';

@Injectable()
export class EncryptionService {
  private readonly algorithm = 'aes-256-gcm';
  private readonly keyLength = 32;
  private readonly ivLength = 16;
  private readonly saltLength = 64;
  private readonly tagLength = 16;
  private readonly tagPosition: number;
  private readonly encryptedPosition: number;

  constructor(private readonly configService: ConfigService) {
    this.tagPosition = this.saltLength + this.ivLength;
    this.encryptedPosition = this.tagPosition + this.tagLength;
  }

  /**
   * Derives a key from the encryption key using PBKDF2
   */
  private getKey(salt: Buffer): Buffer {
    const encryptionKey = this.configService.get<string>('app.encryptionKey');
    if (!encryptionKey) {
      throw new Error('ENCRYPTION_KEY is not set in environment variables');
    }
    return crypto.pbkdf2Sync(
      encryptionKey,
      salt,
      100000,
      this.keyLength,
      'sha512',
    );
  }

  /**
   * Encrypts a string value
   * Returns base64 encoded string: salt + iv + authTag + encrypted
   */
  encrypt(text: string): string {
    const salt = crypto.randomBytes(this.saltLength);
    const iv = crypto.randomBytes(this.ivLength);
    const key = this.getKey(salt);

    const cipher = crypto.createCipheriv(this.algorithm, key, iv);
    const encrypted = Buffer.concat([
      cipher.update(text, 'utf8'),
      cipher.final(),
    ]);
    const tag = cipher.getAuthTag();

    return Buffer.concat([salt, iv, tag, encrypted]).toString('base64');
  }

  /**
   * Decrypts an encrypted string
   */
  decrypt(encryptedData: string): string {
    const buffer = Buffer.from(encryptedData, 'base64');

    const salt = buffer.subarray(0, this.saltLength);
    const iv = buffer.subarray(this.saltLength, this.tagPosition);
    const tag = buffer.subarray(this.tagPosition, this.encryptedPosition);
    const encrypted = buffer.subarray(this.encryptedPosition);

    const key = this.getKey(salt);

    const decipher = crypto.createDecipheriv(this.algorithm, key, iv);
    decipher.setAuthTag(tag);

    return (
      decipher.update(encrypted, undefined, 'utf8') + decipher.final('utf8')
    );
  }

  /**
   * Hashes a password using bcrypt
   */
  async hashPassword(password: string): Promise<string> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.hash(password, 12);
  }

  /**
   * Compares a password with a hash
   */
  async comparePassword(password: string, hash: string): Promise<boolean> {
    const bcrypt = await import('bcryptjs');
    return bcrypt.compare(password, hash);
  }

  /**
   * Generates a random token
   */
  generateToken(length: number = 32): string {
    return crypto.randomBytes(length).toString('hex');
  }
}
