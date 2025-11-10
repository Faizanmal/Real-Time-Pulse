import { registerAs } from '@nestjs/config';

export default registerAs('s3', () => ({
  endpoint: process.env.S3_ENDPOINT || undefined, // For Cloudflare R2
  region: process.env.S3_REGION || 'us-east-1',
  bucket: process.env.S3_BUCKET || 'portal-assets',
  accessKeyId: process.env.S3_ACCESS_KEY_ID,
  secretAccessKey: process.env.S3_SECRET_ACCESS_KEY,
  publicUrlBase: process.env.S3_PUBLIC_URL_BASE || undefined,
}));
