# Single VPS deployment

This deployment serves the app from `app.faizanmalik.me` and the API from
`api.faizanmalik.me`. It does not change the DNS or hosting for the bare
`faizanmalik.me` portfolio or `www.faizanmalik.me`.

## Before starting

- A Linux VPS with Docker Engine and the Docker Compose plugin installed.
- DNS `A` records for `app` and `api` under `faizanmalik.me`, both pointing to
  the VPS public IPv4 address. Add `AAAA` records only if the VPS has working
  public IPv6. Leave the bare-domain and `www` records as they are.
- Allow inbound TCP ports 80 and 443 in the VPS firewall and provider firewall.
  UDP 443 is optional for HTTP/3. Keep ports 3000, 5432, and 6379 private;
  Compose does not publish them.
- A working email address for certificate notices.

## Configure and start

From the repository root on the VPS:

1. Copy `.env.production.example` to `.env.production`.
2. Replace the example email and generate a different 64-character hex value
   for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`,
   and `ONBOARDING_FUNNEL_HMAC_KEY`. Generate each separately with
   `openssl rand -hex 32`. Keep these values in a password manager. Back up the
   encryption key securely; existing encrypted integration credentials cannot
   be read if that key is lost.
3. Confirm `APP_DOMAIN=app.faizanmalik.me` and
   `API_DOMAIN=api.faizanmalik.me`. Do not put the bare domain here.
4. Build and start the services:

   ```sh
   docker compose --env-file .env.production -f compose.production.yaml up -d --build
   ```

The stack waits for Postgres and Redis, runs checked-in Prisma migrations, then
starts the API and frontend. Caddy requests and renews HTTPS certificates after
both DNS records resolve to the VPS. The frontend embeds its API and WebSocket
subdomains at build time; rebuild it after changing those domain values.

## Check the deployment

```sh
docker compose --env-file .env.production -f compose.production.yaml ps
docker compose --env-file .env.production -f compose.production.yaml logs --tail=100 caddy migrate backend frontend
curl -fsS https://api.faizanmalik.me/api/v1/health/ready
```

Open `https://app.faizanmalik.me` in a browser and check account creation,
sign-in, sign-out, and realtime updates. Add the OAuth callback URLs shown by
the provider configuration to the corresponding Google/GitHub app if you
enable those sign-in options. Keep optional integrations disabled until their
provider credentials and webhook URLs are configured.

## Backups and updates

The `backup` service writes a compressed Postgres dump immediately at startup,
then daily, and keeps 14 days in the `postgres_backups` Docker volume. That
volume is on the same VPS disk, so it is not a disaster recovery copy. Configure
provider snapshots or copy backups to a separate storage account, and test a
restore into a disposable database before storing real customer data.

To update, pull the desired commit and rerun the `docker compose ... up -d
--build` command above. The migration service runs before the API is restarted.
Review migration compatibility before deploying schema changes to an existing
database. Do not remove the `postgres_data` volume when updating.

The repository supplies deployment configuration, but cannot verify the VPS,
DNS records, provider firewall, certificate issuance, off-site backup, or OAuth
provider settings. Confirm those on the server before treating the deployment
as live.
