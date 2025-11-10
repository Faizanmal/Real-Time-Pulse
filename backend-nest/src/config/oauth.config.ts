import { registerAs } from '@nestjs/config';

export default registerAs('oauth', () => ({
  google: {
    clientId: process.env.GOOGLE_CLIENT_ID,
    clientSecret: process.env.GOOGLE_CLIENT_SECRET,
    callbackUrl: process.env.GOOGLE_CALLBACK_URL,
  },
  asana: {
    clientId: process.env.ASANA_CLIENT_ID,
    clientSecret: process.env.ASANA_CLIENT_SECRET,
  },
  clickup: {
    clientId: process.env.CLICKUP_CLIENT_ID,
    clientSecret: process.env.CLICKUP_CLIENT_SECRET,
  },
  harvest: {
    clientId: process.env.HARVEST_CLIENT_ID,
    clientSecret: process.env.HARVEST_CLIENT_SECRET,
  },
}));
