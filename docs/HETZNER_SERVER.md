# Hetzner VPS — erp-prod

## Architecture

```
                    GitHub (main branch)
                         |
                    GitHub Actions
                    /            \
                   v              v
        Vercel (auto)        VPS (SSH deploy)
        + Neon DB            + Local PostgreSQL 17
        erp.bizarch.in       app.bizarch.in
        (existing customers) (new customers)
        |                    |
        +--- Cloudflare R2 (shared) ---+
        +--- Ably (shared) ------------+
        +--- Same AUTH_SECRET ----------+
```

- **Same codebase, same schema, two deployment targets, separate transactional data.**
- Schema sync uses `prisma db push` (NOT migrations) — both Neon and VPS PG are driven from the same `schema.prisma` in Git.
- New customers go to VPS. Existing customers on Vercel/Neon migrate gradually.

---

## Server Details

| Field | Value |
|-------|-------|
| **Name** | erp-prod |
| **Server ID** | 126663597 |
| **IP (IPv4)** | 157.180.86.23 |
| **IPv6** | 2a01:4f9:c012:4a2c::/64 |
| **Type** | cax21 (ARM Ampere Altra) |
| **CPU** | 4 vCPU (shared, ARM) |
| **RAM** | 8 GB |
| **Disk** | 80 GB SSD (68 GB available) |
| **OS** | Ubuntu 24.04.3 LTS (aarch64) |
| **Location** | Helsinki, Finland (hel1-dc2) |
| **Price** | EUR 6.99/month |
| **Created** | 2026-04-12 |

---

## Version Matrix

| Component | Version | Config Location |
|-----------|---------|-----------------|
| PostgreSQL | 17.9 | `/etc/postgresql/17/main/` |
| PgBouncer | 1.25.1 | `/etc/pgbouncer/pgbouncer.ini` |
| Node.js | 24.14.1 LTS | via NodeSource |
| npm | 11.11.0 | - |
| PM2 | 6.0.14 | `/opt/bizarch/ecosystem.config.js` |
| Nginx | 1.24.0 | `/etc/nginx/sites-available/bizarch` |
| tsx | 4.21.0 | Global npm package (Prisma 7 .ts support) |
| Certbot | 2.9.0 | Let's Encrypt for ws.bizarch.in |
| Ubuntu | 24.04.3 LTS | - |

---

## SSH Access

```bash
ssh root@157.180.86.23
```

**SSH Key:** `rabeeh-key` (ED25519)
- Key name in Hetzner: `rabeeh-key` (ID: 110672912)
- Fingerprint: `62:21:c1:de:47:e9:ec:6a:d9:36:e6:09:17:cb:11:24`
- Local key path: `~/.ssh/id_ed25519`

**GitHub Deploy Key:** `vps-erp-prod-deploy` (ED25519)
- Located on VPS at `/root/.ssh/id_ed25519`
- Added to GitHub repo as deploy key with read/write access

> No password required — key-based auth only.

---

## DNS (Cloudflare — bizarch.in)

| Subdomain | Type | Target | Proxy | SSL | Purpose |
|-----------|------|--------|-------|-----|---------|
| `erp.bizarch.in` | - | Vercel | - | Vercel managed | Existing customers (don't touch) |
| `app.bizarch.in` | A | `157.180.86.23` | Proxied (orange) | Cloudflare Origin Cert (15yr) | VPS web app |
| `ws.bizarch.in` | A | `157.180.86.23` | DNS only (gray) | Let's Encrypt (auto-renew) | VPS WebSocket |

**Cloudflare settings:**
- SSL/TLS mode: Full (Strict)
- Always Use HTTPS: ON
- Automatic HTTPS Rewrites: ON
- WebSockets: ON
- Minimum TLS Version: 1.2

---

## Directory Structure

```
/opt/bizarch/
  app/                    # Git repo clone (Next.js + Socket.IO)
    .env                  # Symlink -> .env.production
    .env.production       # Environment variables
    server.mjs            # Entry point (Next.js + Socket.IO)
    prisma/schema.prisma  # Database schema (source of truth)
    .next/                # Next.js build output
  ecosystem.config.js     # PM2 config (fork mode, tsx interpreter)
  backup-db.sh            # Daily pg_dump script
  logs/
    out.log               # PM2 stdout
    error.log             # PM2 stderr
    backup.log            # Backup cron output
  backups/                # pg_dump .sql.gz files (7-day retention)
```

---

## Database

**PostgreSQL 17.9** running locally. App connects via PgBouncer (port 6432).

| Connection | Port | Purpose |
|------------|------|---------|
| PgBouncer | 6432 | App connections (transaction pooling mode) |
| PostgreSQL direct | 5432 | `prisma db push` and CLI operations only |

Both ports are localhost-only (not exposed to internet).

**Connection strings (in .env.production):**
```
DATABASE_URL=postgresql://bizarch:PASSWORD@localhost:6432/bizarch_erp?pgbouncer=true&connection_limit=5
DIRECT_URL=postgresql://bizarch:PASSWORD@localhost:5432/bizarch_erp
```

**DB password:** stored in `/root/.db_password` (chmod 600)

**PostgreSQL Tuning (8GB RAM):**
| Parameter | Value |
|-----------|-------|
| shared_buffers | 2GB |
| effective_cache_size | 6GB |
| work_mem | 64MB |
| maintenance_work_mem | 512MB |
| max_connections | 100 |
| wal_buffers | 64MB |
| min_wal_size | 1GB |
| max_wal_size | 4GB |
| checkpoint_completion_target | 0.9 |
| random_page_cost | 1.1 |
| effective_io_concurrency | 200 |
| log_min_duration_statement | 1000ms |

**PgBouncer Config:**
| Parameter | Value |
|-----------|-------|
| pool_mode | transaction |
| default_pool_size | 20 |
| min_pool_size | 2 |
| max_client_conn | 200 |
| max_db_connections | 50 |
| server_idle_timeout | 30s |

---

## Schema Sync

Uses `prisma db push` (NOT migrations). Both Neon and VPS PG are driven from the same `schema.prisma` in Git.

**Workflow:**
1. Edit `schema.prisma`
2. `prisma db push` locally against Neon (as usual)
3. `git push`
4. GitHub Actions SSHs into VPS -> `git pull` -> `prisma db push --accept-data-loss` -> VPS PG matches Neon

**Why `db push` not migrations:** Migration drift was a recurring issue. `db push` is declarative — it reads `schema.prisma` and makes the DB match. No migration files, no history table, no drift.

**`--accept-data-loss` flag:** Needed in CI (non-interactive) so `db push` doesn't hang if a column is removed. Safe because the same schema was already pushed to Neon locally.

---

## Deployment

**Auto-deploy on every push to `main`** via `.github/workflows/deploy-vps.yml`.

GitHub Actions SSHs into VPS and runs:
```bash
cd /opt/bizarch/app
git pull origin main
npm ci --production=false
npx prisma generate
npx prisma db push --accept-data-loss
NODE_OPTIONS='--max-old-space-size=4096' npx next build
pm2 reload bizarch-erp || pm2 start /opt/bizarch/ecosystem.config.js
```

**GitHub Secret:** `VPS_SSH_KEY` — the private SSH key for root@157.180.86.23

**Manual deploy:**
```bash
ssh root@157.180.86.23
cd /opt/bizarch/app && git pull && npm ci --production=false && npx prisma generate && npx prisma db push --accept-data-loss && NODE_OPTIONS='--max-old-space-size=4096' npx next build && pm2 reload bizarch-erp
```

---

## Process Management (PM2)

PM2 runs `server.mjs` (Next.js + Socket.IO) via `tsx` interpreter.

**Why fork mode (not cluster):** Socket.IO maintains in-memory state for POS order collaboration. Cluster mode would split WebSocket connections across workers, breaking state. Cluster mode requires Redis adapter for Socket.IO — planned for future if needed.

**Why tsx:** Prisma 7 generates TypeScript files. `server.mjs` imports the generated Prisma client which is `.ts`. Node.js can't import `.ts` directly, so `tsx` handles the TypeScript transpilation at runtime.

**Ecosystem config** (`/opt/bizarch/ecosystem.config.js`):
```javascript
module.exports = {
  apps: [{
    name: 'bizarch-erp',
    script: 'server.mjs',
    cwd: '/opt/bizarch/app',
    interpreter: 'tsx',
    instances: 1,
    exec_mode: 'fork',
    env: {
      NODE_ENV: 'production',
      PORT: 3000,
    },
    max_memory_restart: '2G',
    log_date_format: 'YYYY-MM-DD HH:mm:ss Z',
    error_file: '/opt/bizarch/logs/error.log',
    out_file: '/opt/bizarch/logs/out.log',
    merge_logs: true,
    autorestart: true,
    watch: false,
  }]
};
```

**Commands:**
```bash
pm2 list                        # View processes
pm2 logs bizarch-erp            # Stream logs
pm2 logs bizarch-erp --lines 50 # Last 50 lines
pm2 reload bizarch-erp          # Graceful restart
pm2 restart bizarch-erp         # Hard restart
pm2 monit                       # Resource monitor
pm2 save                        # Save process list for auto-start
```

PM2 is configured to auto-start on boot via `pm2 startup systemd`.

---

## SSL Certificates

### app.bizarch.in — Cloudflare Origin Certificate
- **Type:** Cloudflare Origin CA (RSA 2048)
- **Validity:** 15 years (2026-04-12 to 2041-04-08)
- **Hostnames:** `*.bizarch.in`, `bizarch.in`
- **Cert path:** `/etc/ssl/cloudflare/origin.pem`
- **Key path:** `/etc/ssl/cloudflare/origin.key` (chmod 600)
- **Renewal:** Not needed (15-year validity)

### ws.bizarch.in — Let's Encrypt
- **Type:** Let's Encrypt (auto-managed by Certbot)
- **Validity:** 90 days (auto-renews via Certbot systemd timer)
- **Cert path:** `/etc/letsencrypt/live/ws.bizarch.in/fullchain.pem`
- **Key path:** `/etc/letsencrypt/live/ws.bizarch.in/privkey.pem`
- **Renewal:** Automatic (Certbot scheduled task)
- **Manual renewal:** `certbot renew`

---

## Nginx Configuration

**Config file:** `/etc/nginx/sites-available/bizarch` (symlinked to sites-enabled)

- HTTP (port 80) redirects all traffic to HTTPS
- `app.bizarch.in:443` — Cloudflare Origin Cert, proxies to Next.js on localhost:3000
- `ws.bizarch.in:443` — Let's Encrypt cert, proxies `/socket.io/` with WebSocket upgrade headers
- Gzip enabled for text/css/json/js
- Proxy timeouts: 120s (for PDF generation and heavy reports)

```bash
# Test config
nginx -t

# Reload after changes
nginx -t && systemctl reload nginx
```

---

## Backups

**Schedule:** Daily at 2:00 AM UTC via cron
**Script:** `/opt/bizarch/backup-db.sh`
**Retention:** 7 days (older files auto-deleted)
**Storage:** `/opt/bizarch/backups/` (local disk)

**Cron entry:**
```
0 2 * * * /opt/bizarch/backup-db.sh >> /opt/bizarch/logs/backup.log 2>&1
```

**Manual backup:**
```bash
/opt/bizarch/backup-db.sh
```

**Restore from backup:**
```bash
gunzip -c /opt/bizarch/backups/bizarch_erp_YYYY-MM-DD_HHMM.sql.gz | PGPASSWORD=$(cat /root/.db_password) psql -h 127.0.0.1 -U bizarch bizarch_erp
```

---

## Firewall (UFW)

| Port | Action | Purpose |
|------|--------|---------|
| 22/tcp | ALLOW | SSH |
| 80/tcp | ALLOW | HTTP (Nginx, redirects to HTTPS) |
| 443/tcp | ALLOW | HTTPS (Nginx) |
| 5432 | localhost only | PostgreSQL (not exposed) |
| 6432 | localhost only | PgBouncer (not exposed) |

Default: deny incoming, allow outgoing.

---

## Environment Variables

File: `/opt/bizarch/app/.env.production` (symlinked to `.env`, chmod 600)

| Variable | Source | Shared with Vercel? |
|----------|--------|---------------------|
| `DATABASE_URL` | Local PG via PgBouncer | No (Vercel uses Neon) |
| `DIRECT_URL` | Local PG direct | No |
| `AUTH_SECRET` | Same value | Yes |
| `AUTH_URL` | `https://app.bizarch.in` | No (Vercel has its own) |
| `AUTH_TRUST_HOST` | `true` | Yes |
| `ABLY_API_KEY` | Same value | Yes |
| `ZATCA_ENCRYPTION_KEY` | Same value | Yes |
| `R2_ACCOUNT_ID` | Same value | Yes (same bucket) |
| `R2_ACCESS_KEY_ID` | Same value | Yes |
| `R2_SECRET_ACCESS_KEY` | Same value | Yes |
| `R2_BUCKET_NAME` | `bizarcherp` | Yes (same bucket) |
| `R2_PUBLIC_URL` | Same value | Yes |

---

## Shared Services

These services are shared between Vercel and VPS deployments:

| Service | Purpose | Provider |
|---------|---------|----------|
| Cloudflare R2 | File uploads (product images, attachments) | Cloudflare |
| Ably | Real-time POS order sync | Ably |
| Cloudflare DNS | Domain management for bizarch.in | Cloudflare |

---

## Customer Migration (Future)

When ready to move an existing customer from Vercel/Neon to VPS:

1. `pg_dump` the org data from Neon (filtered by organizationId)
2. Import into VPS PostgreSQL
3. Verify (invoice counts, balance totals, stock levels)
4. Switch DNS or update org routing
5. Clean up org data from Neon after confirming VPS is stable

---

## Hetzner Console & API

**Console:** https://console.hetzner.cloud
- Reboot, rebuild, resize, snapshots, resource graphs

**API Base URL:** `https://api.hetzner.cloud/v1`
- Get token: Console -> Security -> API Tokens
- Example: `curl -H "Authorization: Bearer TOKEN" https://api.hetzner.cloud/v1/servers/126663597`

**MCP Integration:** The Hetzner MCP server is configured in Claude Code (`~/.claude/mcp_settings.json`) for managing this server directly from the AI assistant.

---

## Quick Commands

```bash
# SSH in
ssh root@157.180.86.23

# === App ===
pm2 list
pm2 logs bizarch-erp --lines 50
pm2 reload bizarch-erp

# === Database ===
sudo -u postgres psql -d bizarch_erp
sudo -u postgres psql -c "SELECT count(*) FROM pg_stat_activity;"

# === Services ===
systemctl status postgresql
systemctl status pgbouncer
systemctl status nginx

# === Nginx ===
nginx -t && systemctl reload nginx

# === Resource usage ===
htop
df -h /
free -h

# === Manual deploy ===
cd /opt/bizarch/app && git pull && npm ci --production=false && npx prisma generate && npx prisma db push --accept-data-loss && NODE_OPTIONS='--max-old-space-size=4096' npx next build && pm2 reload bizarch-erp

# === Manual backup ===
/opt/bizarch/backup-db.sh

# === Check SSL cert expiry ===
echo | openssl s_client -connect ws.bizarch.in:443 2>/dev/null | openssl x509 -noout -dates

# === View backup files ===
ls -lh /opt/bizarch/backups/
```

---

## Troubleshooting

**App not responding:**
```bash
pm2 list                              # Check if process is online
pm2 logs bizarch-erp --lines 100      # Check recent errors
curl -s http://localhost:3000/login    # Test directly (bypass Nginx)
```

**Database connection issues:**
```bash
systemctl status pgbouncer            # PgBouncer running?
systemctl status postgresql           # PostgreSQL running?
PGPASSWORD=$(cat /root/.db_password) psql -h 127.0.0.1 -p 6432 -U bizarch -d bizarch_erp -c "SELECT 1;"
```

**Disk space:**
```bash
df -h /
du -sh /opt/bizarch/backups/          # Backup size
du -sh /opt/bizarch/app/.next/        # Build output size
du -sh /opt/bizarch/app/node_modules/ # Dependencies size
```

**Nginx errors:**
```bash
nginx -t                              # Config syntax check
tail -50 /var/log/nginx/error.log     # Nginx error log
```
