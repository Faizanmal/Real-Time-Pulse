import { registerAs } from '@nestjs/config';

export default registerAs('email', () => ({
  host: process.env.EMAIL_HOST || 'smtp.sendgrid.net',
  port: parseInt(process.env.EMAIL_PORT || '587', 10),
  secure: process.env.EMAIL_SECURE === 'true', // true for 465, false for other ports
  auth: {
    user: process.env.EMAIL_USER || 'apikey',
    pass: process.env.EMAIL_PASSWORD,
  },
  from: {
    name: process.env.EMAIL_FROM_NAME || 'Portal',
    address: process.env.EMAIL_FROM_ADDRESS || 'noreply@portal.example.com',
  },
  templates: {
    dir: process.env.EMAIL_TEMPLATES_DIR || 'src/email/templates',
  },
}));
