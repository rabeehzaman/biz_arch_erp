---
name: neon
description: Manage Neon database branches — create dev branches, switch environments, ensure production safety
disable-model-invocation: true
argument-hint: <action> [branch-name]
allowed-tools: Bash(neonctl *), Bash(sed *), Bash(cp *), Bash(cat *), Bash(rm *), Grep, Read
---

# Neon Branch Dev Workflow

Manage Neon Postgres branches to safely develop against a copy of production data without touching the live database.

## Connection Details

- **Project ID:** `soft-sunset-90825916`
- **Org ID:** `org-odd-flower-52792740`
- **Role:** `neondb_owner`
- **API Key:** Read from `NEON_API_KEY` in the project `.env` file

## Setup

Before running any neonctl command, export the API key:

```bash
export NEON_API_KEY="$(grep NEON_API_KEY .env | cut -d'"' -f2)"
```

Always include `--project-id soft-sunset-90825916 --org-id org-odd-flower-52792740` in every neonctl command.

## State Tracking

- **`.neon-branch`** — Marker file at project root. Contains the active dev branch name. If this file does NOT exist, we are on PRODUCTION.
- **`.env.production`** — Backup of production `.env`. Created automatically on first `create`. Used by `prod` to restore.

## Safety Rules

**MANDATORY — Before ANY prisma command (`db push`, `migrate dev`, `migrate deploy`, `studio`, `generate`) or any schema change:**

1. Check if `.neon-branch` exists by reading it
2. If it does NOT exist → **you are on PRODUCTION**:
   - **REFUSE** to run `prisma db push` or `prisma migrate dev`
   - Tell the user: "You are connected to PRODUCTION. Shall I create a dev branch first?"
   - Only proceed with prisma commands if the user explicitly says to run against production
3. If it exists → you are on a dev branch, proceed freely

## Actions

Parse the user's intent from: `$ARGUMENTS`

### `status` — Show current environment

1. Check if `.neon-branch` file exists at the project root
2. If it exists, read the branch name from it
3. Read `DATABASE_URL` from `.env` and extract the hostname
4. Report:
   - If on branch: "**DEV BRANCH:** `<name>` (host: `<hostname>`)"
   - If on production: "**⚠ PRODUCTION** (host: `<hostname>`)"

### `create <branch-name>` — Create and switch to a new dev branch

1. If `.env.production` does NOT exist, back up production credentials:
   ```bash
   cp .env .env.production
   ```
2. Create the branch:
   ```bash
   neonctl branches create --name <branch-name> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
   ```
3. Get the pooled connection string (for `DATABASE_URL`):
   ```bash
   neonctl connection-string <branch-name> --role-name neondb_owner --pooled --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
   ```
4. Get the direct connection string (for `DIRECT_URL`):
   ```bash
   neonctl connection-string <branch-name> --role-name neondb_owner --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
   ```
5. Update `.env` — replace the DATABASE_URL and DIRECT_URL values using `sed`:
   ```bash
   sed -i '' 's|^DATABASE_URL=.*|DATABASE_URL="<pooled-url>"|' .env
   sed -i '' 's|^DIRECT_URL=.*|DIRECT_URL="<direct-url>"|' .env
   ```
6. Write the branch name to the marker file:
   ```bash
   echo "<branch-name>" > .neon-branch
   ```
7. Confirm: "Switched to dev branch **<branch-name>**. Production is safe."

### `switch <branch-name>` — Switch to an existing branch

1. If `.env.production` does NOT exist, error: "No production backup found. Run `create` first."
2. Get pooled and direct connection strings (same as steps 3-4 in `create`)
3. Update `.env` with `sed` (same as step 5 in `create`)
4. Update the marker file:
   ```bash
   echo "<branch-name>" > .neon-branch
   ```
5. Confirm: "Switched to dev branch **<branch-name>**."

### `prod` — Switch back to production

1. If `.env.production` does NOT exist, error: "No production backup found."
2. Restore production credentials:
   ```bash
   cp .env.production .env
   ```
3. Remove the branch marker:
   ```bash
   rm -f .neon-branch
   ```
4. Confirm: "Switched back to **PRODUCTION**."

### `delete <branch-name>` — Delete a branch

1. Check if `.neon-branch` exists and contains `<branch-name>`
   - If yes: "You are currently on this branch. Run `/neon prod` first to switch back to production."
   - Stop here.
2. Confirm with the user before deleting — this is destructive
3. Delete the branch:
   ```bash
   neonctl branches delete <branch-name> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
   ```
4. Run `list` to verify

### `list` — List all branches

1. List branches:
   ```bash
   neonctl branches list --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
   ```
2. If `.neon-branch` exists, read it and note: "Currently on: **<branch-name>**"
3. If not, note: "Currently on: **PRODUCTION**"

## Default Behavior

If no action is specified or `$ARGUMENTS` is empty, run `status`.
