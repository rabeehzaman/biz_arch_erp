---
name: neon
description: Manage Neon database branches — list, create, delete, or get connection info
disable-model-invocation: true
argument-hint: <action> [branch-name]
allowed-tools: Bash(neonctl *), Grep, Read
---

# Neon Branch Management

Manage Neon Postgres branches for this project.

## Connection Details

- **Project ID:** `soft-sunset-90825916`
- **Org ID:** `org-odd-flower-52792740`
- **API Key:** Read from `NEON_API_KEY` in the project `.env` file

## Setup

Before running any neonctl command, export the API key:

```bash
export NEON_API_KEY="$(grep NEON_API_KEY .env | cut -d'"' -f2)"
```

Always include `--project-id soft-sunset-90825916 --org-id org-odd-flower-52792740` in every neonctl command.

## Actions

Parse the user's intent from: `$ARGUMENTS`

### `list` — List all branches
```bash
neonctl branches list --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
```

### `delete <branch-name-or-id>` — Delete a branch
1. First run `list` to show current branches
2. Confirm with the user before deleting — this is destructive
3. Run the delete:
```bash
neonctl branches delete <branch-id> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
```
4. Run `list` again to verify

### `create <branch-name>` — Create a new branch from production
```bash
neonctl branches create --name <branch-name> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
```

### `connection <branch-name>` — Get connection string
```bash
neonctl connection-string <branch-name> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
```

### `info <branch-name>` — Get branch details
```bash
neonctl branches get <branch-id> --project-id soft-sunset-90825916 --org-id org-odd-flower-52792740
```

## Default Behavior

If no action is specified or `$ARGUMENTS` is empty, run `list` to show all branches.
