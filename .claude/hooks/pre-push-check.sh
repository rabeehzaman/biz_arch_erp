#!/bin/bash
# Pre-push hook: blocks git push if /whats-new hasn't been run
# Reads tool input from stdin (JSON), checks if command is git push

INPUT=$(cat)
COMMAND=$(echo "$INPUT" | jq -r '.tool_input.command // empty' 2>/dev/null)

if echo "$COMMAND" | grep -q 'git push'; then
  # Check if whats-new.json was modified in the staged/recent commits
  LAST_WHATS_NEW_COMMIT=$(cd "$CLAUDE_PROJECT_DIR" && git log -1 --format=%H -- src/data/whats-new.json 2>/dev/null)
  LAST_ANY_COMMIT=$(cd "$CLAUDE_PROJECT_DIR" && git rev-parse HEAD 2>/dev/null)

  if [ "$LAST_WHATS_NEW_COMMIT" != "$LAST_ANY_COMMIT" ]; then
    echo "BLOCKED: Run /whats-new first to update the changelog before pushing. After that, retry the push." >&2
    exit 2
  fi
fi

exit 0
