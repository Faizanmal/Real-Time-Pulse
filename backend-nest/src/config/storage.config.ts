/**
 * ============================================================================
 * REAL-TIME PULSE - ULTRA-MAX STORAGE CONFIGURATION
 * ============================================================================
 * Multi-cloud storage configuration supporting S3, GCS, Azure Blob,
 * R2, and local storage with intelligent tiering.
 */

import { registerAs } from '@nestjs/config';

export default registerAs('storage', () => ({
  // Default Provider
  defaultProvider: process.env.STORAGE_PROVIDER || 's3', // s3 | gcs | azure | r2 | local | minio

  // AWS S3 Configuration
  s3: {
    enabled: process.env.S3_ENABLED !== 'false',
    region: process.env.AWS_REGION || 'us-east-1',
    credentials: {
      accessKeyId: process.env.AWS_ACCESS_KEY_ID,
      secretAccessKey: process.env.AWS_SECRET_ACCESS_KEY,
      sessionToken: process.env.AWS_SESSION_TOKEN,
    },
    buckets: {
      uploads: process.env.S3_BUCKET_UPLOADS || 'pulse-uploads',
      reports: process.env.S3_BUCKET_REPORTS || 'pulse-reports',
      exports: process.env.S3_BUCKET_EXPORTS || 'pulse-exports',
      backups: process.env.S3_BUCKET_BACKUPS || 'pulse-backups',
      media: process.env.S3_BUCKET_MEDIA || 'pulse-media',
      temp: process.env.S3_BUCKET_TEMP || 'pulse-temp',
    },
    cdn: {
      enabled: process.env.CDN_ENABLED === 'true',
      domain: process.env.CDN_DOMAIN,
      cloudfront: {
        distributionId: process.env.CLOUDFRONT_DISTRIBUTION_ID,
        keyPairId: process.env.CLOUDFRONT_KEY_PAIR_ID,
        privateKey: process.env.CLOUDFRONT_PRIVATE_KEY,
      },
    },
    acceleration: process.env.S3_TRANSFER_ACCELERATION === 'true',
    encryption: {
      enabled: true,
      algorithm: 'AES256', // AES256 | aws:kms
      kmsKeyId: process.env.S3_KMS_KEY_ID,
    },
    lifecycle: {
      enabled: true,
      rules: [
        {
          id: 'archive-old-reports',
          prefix: 'reports/',
          transitions: [{ days: 90, storageClass: 'GLACIER' }],
          expiration: { days: 365 },
        },
        {
          id: 'delete-temp-files',
          prefix: 'temp/',
          expiration: { days: 7 },
        },
      ],
    },
    cors: {
      allowedOrigins: ['*'],
      allowedMethods: ['GET', 'PUT', 'POST', 'DELETE', 'HEAD'],
      allowedHeaders: ['*'],
      exposeHeaders: ['ETag', 'x-amz-meta-*'],
      maxAge: 3600,
    },
  },

  // Google Cloud Storage Configuration
  gcs: {
    enabled: process.env.GCS_ENABLED === 'true',
    projectId: process.env.GOOGLE_CLOUD_PROJECT,
    credentials: process.env.GOOGLE_APPLICATION_CREDENTIALS,
    buckets: {
      uploads: process.env.GCS_BUCKET_UPLOADS || 'pulse-uploads',
      reports: process.env.GCS_BUCKET_REPORTS || 'pulse-reports',
      exports: process.env.GCS_BUCKET_EXPORTS || 'pulse-exports',
      backups: process.env.GCS_BUCKET_BACKUPS || 'pulse-backups',
    },
    cdn: {
      enabled: process.env.GCS_CDN_ENABLED === 'true',
      domain: process.env.GCS_CDN_DOMAIN,
    },
    uniformBucketLevelAccess: true,
  },

  // Azure Blob Storage Configuration
  azure: {
    enabled: process.env.AZURE_STORAGE_ENABLED === 'true',
    accountName: process.env.AZURE_STORAGE_ACCOUNT_NAME,
    accountKey: process.env.AZURE_STORAGE_ACCOUNT_KEY,
    connectionString: process.env.AZURE_STORAGE_CONNECTION_STRING,
    containers: {
      uploads: process.env.AZURE_CONTAINER_UPLOADS || 'pulse-uploads',
      reports: process.env.AZURE_CONTAINER_REPORTS || 'pulse-reports',
      exports: process.env.AZURE_CONTAINER_EXPORTS || 'pulse-exports',
      backups: process.env.AZURE_CONTAINER_BACKUPS || 'pulse-backups',
    },
    cdn: {
      enabled: process.env.AZURE_CDN_ENABLED === 'true',
      endpoint: process.env.AZURE_CDN_ENDPOINT,
    },
  },

  // Cloudflare R2 Configuration
  r2: {
    enabled: process.env.R2_ENABLED === 'true',
    accountId: process.env.R2_ACCOUNT_ID,
    accessKeyId: process.env.R2_ACCESS_KEY_ID,
    secretAccessKey: process.env.R2_SECRET_ACCESS_KEY,
    endpoint: process.env.R2_ENDPOINT,
    buckets: {
      uploads: process.env.R2_BUCKET_UPLOADS || 'pulse-uploads',
      reports: process.env.R2_BUCKET_REPORTS || 'pulse-reports',
      exports: process.env.R2_BUCKET_EXPORTS || 'pulse-exports',
    },
    publicDomain: process.env.R2_PUBLIC_DOMAIN,
  },

  // MinIO Configuration (S3 Compatible)
  minio: {
    enabled: process.env.MINIO_ENABLED === 'true',
    endpoint: process.env.MINIO_ENDPOINT || 'localhost',
    port: parseInt(process.env.MINIO_PORT || '9000', 10),
    useSSL: process.env.MINIO_USE_SSL === 'true',
    accessKey: process.env.MINIO_ACCESS_KEY,
    secretKey: process.env.MINIO_SECRET_KEY,
    region: process.env.MINIO_REGION || 'us-east-1',
    buckets: {
      uploads: process.env.MINIO_BUCKET_UPLOADS || 'pulse-uploads',
      reports: process.env.MINIO_BUCKET_REPORTS || 'pulse-reports',
    },
  },

  // Local File System Configuration
  local: {
    enabled: process.env.LOCAL_STORAGE_ENABLED === 'true',
    basePath: process.env.LOCAL_STORAGE_PATH || './storage',
    directories: {
      uploads: 'uploads',
      reports: 'reports',
      exports: 'exports',
      temp: 'temp',
    },
    maxSize: parseInt(process.env.LOCAL_STORAGE_MAX_SIZE || '10737418240', 10), // 10GB
  },

  // Upload Configuration
  uploads: {
    maxFileSize: parseInt(process.env.MAX_FILE_SIZE || '104857600', 10), // 100MB
    maxFiles: parseInt(process.env.MAX_FILES || '10', 10),
    allowedMimeTypes: [
      // Images
      'image/jpeg',
      'image/png',
      'image/gif',
      'image/webp',
      'image/svg+xml',
      // Documents
      'application/pdf',
      'application/msword',
      'application/vnd.openxmlformats-officedocument.wordprocessingml.document',
      'application/vnd.ms-excel',
      'application/vnd.openxmlformats-officedocument.spreadsheetml.sheet',
      'application/vnd.ms-powerpoint',
      'application/vnd.openxmlformats-officedocument.presentationml.presentation',
      // Text
      'text/plain',
      'text/csv',
      'text/markdown',
      'application/json',
      'application/xml',
      // Archives
      'application/zip',
      'application/x-tar',
      'application/gzip',
    ],
    preserveFilename: false,
    generateThumbnails: true,
    thumbnailSizes: {
      small: { width: 150, height: 150 },
      medium: { width: 300, height: 300 },
      large: { width: 600, height: 600 },
    },
    virusScan: {
      enabled: process.env.VIRUS_SCAN_ENABLED === 'true',
      provider: process.env.VIRUS_SCAN_PROVIDER || 'clamav', // clamav | virustotal
    },
  },

  // Image Processing Configuration
  imageProcessing: {
    enabled: true,
    provider: process.env.IMAGE_PROCESSING_PROVIDER || 'sharp', // sharp | imaginary | cloudinary
    optimization: {
      enabled: true,
      quality: 85,
      formats: ['webp', 'avif'],
      responsive: [320, 640, 960, 1280, 1920],
    },
    cloudinary: {
      cloudName: process.env.CLOUDINARY_CLOUD_NAME,
      apiKey: process.env.CLOUDINARY_API_KEY,
      apiSecret: process.env.CLOUDINARY_API_SECRET,
    },
  },

  // Presigned URLs Configuration
  presignedUrls: {
    uploadExpiration: parseInt(
      process.env.PRESIGNED_UPLOAD_EXPIRATION || '3600',
      10,
    ), // 1 hour
    downloadExpiration: parseInt(
      process.env.PRESIGNED_DOWNLOAD_EXPIRATION || '86400',
      10,
    ), // 24 hours
    multipartThreshold: parseInt(
      process.env.MULTIPART_THRESHOLD || '104857600',
      10,
    ), // 100MB
    partSize: parseInt(process.env.MULTIPART_PART_SIZE || '10485760', 10), // 10MB
  },

  // Backup Configuration
  backup: {
    enabled: process.env.BACKUP_ENABLED === 'true',
    schedule: process.env.BACKUP_SCHEDULE || '0 2 * * *', // Daily at 2 AM
    retention: {
      daily: parseInt(process.env.BACKUP_RETENTION_DAILY || '7', 10),
      weekly: parseInt(process.env.BACKUP_RETENTION_WEEKLY || '4', 10),
      monthly: parseInt(process.env.BACKUP_RETENTION_MONTHLY || '12', 10),
    },
    encryption: {
      enabled: true,
      algorithm: 'aes-256-gcm',
      keyId: process.env.BACKUP_ENCRYPTION_KEY_ID,
    },
    compression: {
      enabled: true,
      algorithm: 'gzip',
      level: 9,
    },
    destinations: {
      primary: process.env.BACKUP_PRIMARY_DESTINATION || 's3',
      secondary: process.env.BACKUP_SECONDARY_DESTINATION, // Cross-region or cross-cloud
    },
  },

  // Intelligent Tiering
  tiering: {
    enabled: process.env.STORAGE_TIERING_ENABLED === 'true',
    rules: {
      hot: {
        maxAge: 7, // days
        storageClass: 'STANDARD',
      },
      warm: {
        maxAge: 30, // days
        storageClass: 'STANDARD_IA',
      },
      cold: {
        maxAge: 90, // days
        storageClass: 'GLACIER',
      },
      archive: {
        maxAge: 365, // days
        storageClass: 'DEEP_ARCHIVE',
      },
    },
  },
}));
