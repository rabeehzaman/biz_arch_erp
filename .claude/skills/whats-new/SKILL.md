---
name: whats-new
description: Generate What's New changelog entries from recent git commits before pushing. Run this before every git push.
allowed-tools: Bash(git *), Read, Edit, Write
---

# Generate What's New Patch

Analyze recent git commits and update the What's New changelog before pushing.

## Steps

1. Read `src/data/whats-new.json` and find the `lastCommit` hash from the first (most recent) entry.

2. Run `git log --oneline <lastCommit>..HEAD` to get all new commits since the last What's New entry. If the file is empty (`[]`), use `git log --oneline -20` instead.

3. **Skip these commits** — do NOT include them in the changelog:
   - Commits that only update `src/data/whats-new.json` (the what's-new data file itself)
   - Merge commits
   - Commits with message `chore: update what's new changelog`

4. For each remaining commit, categorize based on its conventional-commit prefix:
   - `feat(scope):` → type: `"feature"`
   - `fix(scope):` → type: `"fix"`
   - `chore(scope):` → type: `"chore"`
   - Anything else → type: `"improvement"`
   - Extract the `scope` from parentheses if present (e.g., `feat(pos):` → scope: `"pos"`)

5. For each entry, write:
   - `title`: A concise, user-friendly summary (rewrite the commit message to be clear and non-technical). Do NOT just copy the commit message verbatim.
   - `description`: A one-sentence explanation of why this matters or what changed, written for end users. Skip if the title is self-explanatory.
   - `scope`: The area of the app affected (e.g., "pos", "reports", "admin", "pdf", "transfers")

6. Create a new version object at the **beginning** of the JSON array:
   ```json
   {
     "version": "YYYY-MM-DD",
     "date": "YYYY-MM-DD",
     "lastCommit": "<short-hash-of-HEAD>",
     "entries": [ ... ]
   }
   ```
   Use today's date for the version and date fields. Get the HEAD short hash via `git rev-parse --short HEAD`.

7. Write the updated JSON back to `src/data/whats-new.json` (keep the file pretty-printed with 2-space indentation).

8. Stage the file: `git add src/data/whats-new.json`

9. Commit with message: `chore: update what's new changelog`

## Important

- Write titles and descriptions from the **user's perspective** — they should understand what changed without knowing the codebase.
- Group related commits if they address the same feature/fix (e.g., multiple POS fixes → one "POS improvements" entry with a combined description).
- If there are no new commits to process, tell the user "What's New is already up to date" and skip.
