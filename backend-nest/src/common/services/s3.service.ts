import { Injectable, InternalServerErrorException } from '@nestjs/common';
import { ConfigService } from '@nestjs/config';
import { S3Client, DeleteObjectCommand } from '@aws-sdk/client-s3';
import { Upload } from '@aws-sdk/lib-storage';
import { v4 as uuidv4 } from 'uuid';

@Injectable()
export class S3Service {
  private readonly s3Client: S3Client;
  private readonly bucket: string;
  private readonly publicUrlBase?: string;

  constructor(private readonly configService: ConfigService) {
    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');
    const accessKeyId = this.configService.get<string>('s3.accessKeyId');
    const secretAccessKey = this.configService.get<string>('s3.secretAccessKey');

    this.bucket = this.configService.get<string>('s3.bucket');
    this.publicUrlBase = this.configService.get<string>('s3.publicUrlBase');

    this.s3Client = new S3Client({
      region,
      endpoint,
      credentials:
        accessKeyId && secretAccessKey
          ? {
              accessKeyId,
              secretAccessKey,
            }
          : undefined,
      forcePathStyle: !!endpoint, // Required for Cloudflare R2
    });
  }

  /**
   * Upload a file to S3/R2
   */
  async uploadFile(file: Express.Multer.File, folder = 'uploads'): Promise<string> {
    const fileExtension = file.originalname.split('.').pop();
    const fileName = `${folder}/${uuidv4()}.${fileExtension}`;

    try {
      const upload = new Upload({
        client: this.s3Client,
        params: {
          Bucket: this.bucket,
          Key: fileName,
          Body: file.buffer,
          ContentType: file.mimetype,
          ACL: 'public-read', // Make file publicly accessible
        },
      });

      await upload.done();

      return this.getPublicUrl(fileName);
    } catch (error) {
      console.error('S3 upload error:', error);
      throw new InternalServerErrorException('Failed to upload file');
    }
  }

  /**
   * Delete a file from S3/R2
   */
  async deleteFile(fileUrl: string): Promise<void> {
    try {
      const key = this.extractKeyFromUrl(fileUrl);

      await this.s3Client.send(
        new DeleteObjectCommand({
          Bucket: this.bucket,
          Key: key,
        }),
      );
    } catch (error) {
      console.error('S3 delete error:', error);
      throw new InternalServerErrorException('Failed to delete file');
    }
  }

  /**
   * Get public URL for a file
   */
  private getPublicUrl(key: string): string {
    if (this.publicUrlBase) {
      return `${this.publicUrlBase}/${key}`;
    }

    const endpoint = this.configService.get<string>('s3.endpoint');
    const region = this.configService.get<string>('s3.region');

    if (endpoint) {
      // Cloudflare R2 or custom endpoint
      return `${endpoint}/${this.bucket}/${key}`;
    }

    // AWS S3
    return `https://${this.bucket}.s3.${region}.amazonaws.com/${key}`;
  }

  /**
   * Extract S3 key from public URL
   */
  private extractKeyFromUrl(url: string): string {
    // Handle different URL formats
    const urlObj = new URL(url);
    const pathname = urlObj.pathname;

    // Remove leading slash and bucket name if present
    let key = pathname.startsWith('/') ? pathname.substring(1) : pathname;

    // If URL contains bucket name, remove it
    if (key.startsWith(`${this.bucket}/`)) {
      key = key.substring(this.bucket.length + 1);
    }

    return key;
  }

  /**
   * Validate file type (images only for logos)
   */
  validateImageFile(file: Express.Multer.File): boolean {
    const allowedMimeTypes = [
      'image/jpeg',
      'image/jpg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
    ];

    return allowedMimeTypes.includes(file.mimetype);
  }

  /**
   * Validate file size (max 5MB for logos)
   */
  validateFileSize(file: Express.Multer.File, maxSizeMB = 5): boolean {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    return file.size <= maxSizeBytes;
  }
}
