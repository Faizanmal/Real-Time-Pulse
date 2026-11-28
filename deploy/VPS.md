# Single VPS deployment

This deployment serves the app from `pulse.faizanmalik.me` and the API from
`pulse-api.faizanmalik.me`. It does not change the DNS or hosting for the bare
`faizanmalik.me` portfolio, `www.faizanmalik.me`, or the existing
`api.faizanmalik.me` service.

## Before starting

- A Linux VPS with Docker Engine and the Docker Compose plugin installed.
- DNS `A` records for `pulse` and `pulse-api` under `faizanmalik.me`, both
  pointing to the VPS public IPv4 address. Add `AAAA` records only if the VPS
  has working public IPv6. Leave the bare-domain, `www`, and existing `api`
  records as they are.
- Allow inbound TCP ports 80 and 443 in the VPS firewall and provider firewall.
  UDP 443 is optional for HTTP/3. Keep ports 3000, 5432, and 6379 private;
  Compose does not publish them.
- A working email address for certificate notices.

## Configure and start

From the repository root on the VPS:

1. For a new install, copy `.env.example` to `.env`. If upgrading the already
   started stack, copy the existing `.env.production` to `.env` instead so its
   passwords and encryption key remain the same. Keep `.env` private with
   `chmod 600 .env`.
2. Replace the example email and generate a different 64-character hex value
   for `POSTGRES_PASSWORD`, `REDIS_PASSWORD`, `JWT_SECRET`, `ENCRYPTION_KEY`,
   and `ONBOARDING_FUNNEL_HMAC_KEY`. Generate each separately with
   `openssl rand -hex 32`. Keep these values in a password manager. Back up the
   encryption key securely; existing encrypted integration credentials cannot
   be read if that key is lost.
3. Confirm `APP_DOMAIN=pulse.faizanmalik.me` and
   `API_DOMAIN=pulse-api.faizanmalik.me`. Do not change the bare domain or the
   existing `api.faizanmalik.me` record.
4. Build and start the services:

   ```sh
   docker compose up -d --build
   ```

The stack waits for Postgres and Redis, runs checked-in Prisma migrations, then
starts the API and frontend. Caddy requests and renews HTTPS certificates after
both DNS records resolve to the VPS. The frontend embeds its API and WebSocket
subdomains at build time; rebuild it after changing those domain values.

## Check the deployment

```sh
docker compose ps
docker compose logs --tail=100 caddy migrate backend frontend
curl -fsS https://pulse-api.faizanmalik.me/api/v1/health/ready
```

Open `https://pulse.faizanmalik.me` in a browser and check account creation,
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

To update, pull the desired commit and rerun `docker compose up -d --build`.
The migration service runs before the API is restarted.
Review migration compatibility before deploying schema changes to an existing
database. Do not remove the `postgres_data` volume when updating.

The repository supplies deployment configuration, but cannot verify the VPS,
DNS records, provider firewall, certificate issuance, off-site backup, or OAuth
provider settings. Confirm those on the server before treating the deployment
as live.

## Stop the stack

From the repository root, run `docker compose down`. This stops and removes the
containers and network while keeping the named database, Redis, Caddy, and
backup volumes. Do not add `-v` unless you intentionally want to delete the
stored data.
