# Git Commit Auto-Completion Design

**Date:** 2026-01-15
**Status:** Approved
**Goal:** Auto-complete tasks when git commits match task titles

---

## Overview

When you commit code, a git post-commit hook sends the commit details to DevTodo. DevTodo checks if the commit message contains any pending task title (case-insensitive substring match). All matching tasks are marked complete with a reference to the commit.

## Design Decisions

| Decision | Choice |
|----------|--------|
| Detection method | Git post-commit hook |
| Matching algorithm | Case-insensitive substring match |
| Multiple matches | Complete all matching tasks |
| Authentication | Bearer token via `DEVTODO_TOKEN` env var |
| Hook payload | message, repo, branch, hash, author |
| UI display | Git icon + completion details |
| Hook installation | API endpoint + in-app UI with copyable command |
| Repo tracking | Track repos (name, first seen, last commit) — no full history |

---

## Flow

```
1. User commits: git commit -m "fix login validation"
                          │
2. Post-commit hook fires │
                          ▼
3. Hook POSTs to DevTodo: POST /api/git/commit
   {
     "message": "fix login validation",
     "repo": "myapp",
     "branch": "main",
     "hash": "a1b2c3d",
     "author": "andrew"
   }
                          │
4. DevTodo searches:      │  SELECT * FROM tasks
                          │  WHERE completed = false
                          │  AND LOWER(message) LIKE LOWER('%' || title || '%')
                          ▼
5. Matching tasks auto-complete with git metadata attached
                          │
6. UI shows: ✓ fix login validation 🔀
             └─ Completed by commit a1b2c3d on main (myapp)
```

---

## Database Schema

### New table: `git_repos`

```sql
CREATE TABLE git_repos (
  id TEXT PRIMARY KEY,
  name TEXT NOT NULL UNIQUE,
  first_seen_at TEXT NOT NULL DEFAULT (datetime('now')),
  last_commit_at TEXT NOT NULL DEFAULT (datetime('now'))
);
```

### Modify `tasks` table

```sql
ALTER TABLE tasks ADD COLUMN completed_by TEXT DEFAULT NULL;
-- Values: 'manual', 'docker', 'git', null (for pending)

ALTER TABLE tasks ADD COLUMN git_commit_hash TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN git_commit_repo TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN git_commit_branch TEXT DEFAULT NULL;
ALTER TABLE tasks ADD COLUMN git_commit_message TEXT DEFAULT NULL;
```

---

## API Endpoints

### POST `/api/git/commit`

Receives commit from hook.

```
Headers: Authorization: Bearer <token>
Body: {
  "message": "fix login validation",
  "repo": "myapp",
  "branch": "main",
  "hash": "a1b2c3d",
  "author": "andrew"
}

Response 200: {
  "matched": 2,
  "tasks": ["abc123", "def456"]
}

Response 401: { "error": "Invalid token" }
```

### GET `/api/git/repos`

List connected repos.

```
Headers: Authorization: Bearer <token>

Response 200: {
  "repos": [
    { "name": "myapp", "lastCommitAt": "2026-01-15T10:30:00Z" },
    { "name": "devtodo", "lastCommitAt": "2026-01-14T16:00:00Z" }
  ]
}
```

### GET `/api/git/hook-script`

Returns installable hook script. No auth required.

```
Response 200: (shell script content)
Content-Type: text/plain
```

### DELETE `/api/git/repos/:name`

Remove a repo from tracking.

```
Headers: Authorization: Bearer <token>

Response 200: { "deleted": true }
```

---

## Hook Script

```bash
#!/bin/sh
# DevTodo post-commit hook
# Sends commit info to DevTodo for task auto-completion

DEVTODO_URL="${DEVTODO_URL:-http://localhost:3001}"

# Check for token
if [ -z "$DEVTODO_TOKEN" ]; then
  exit 0  # Silently skip if not configured
fi

# Gather commit info
MESSAGE=$(git log -1 --pretty=%s)
HASH=$(git log -1 --pretty=%h)
BRANCH=$(git rev-parse --abbrev-ref HEAD)
REPO=$(basename "$(git rev-parse --show-toplevel)")
AUTHOR=$(git log -1 --pretty=%an)

# Send to DevTodo (fire and forget, don't block commit)
curl -s -X POST "$DEVTODO_URL/api/git/commit" \
  -H "Authorization: Bearer $DEVTODO_TOKEN" \
  -H "Content-Type: application/json" \
  -d "{
    \"message\": \"$(echo "$MESSAGE" | sed 's/"/\\"/g')\",
    \"repo\": \"$REPO\",
    \"branch\": \"$BRANCH\",
    \"hash\": \"$HASH\",
    \"author\": \"$AUTHOR\"
  }" > /dev/null 2>&1 &

exit 0
```

---

## Frontend Changes

### Task display

```jsx
{task.completed && task.completed_by === 'git' && (
  <div className="task-completion-info">
    <GitBranch size={14} className="git-icon" />
    <span className="completion-detail">
      Completed by commit {task.git_commit_hash} on {task.git_commit_branch} ({task.git_commit_repo})
    </span>
  </div>
)}
```

### Settings panel — Git Integration section

```
┌─────────────────────────────────────────────────┐
│ Git Integration                                 │
├─────────────────────────────────────────────────┤
│ Connected Repositories                          │
│                                                 │
│   myapp          last commit 2 hours ago    ✕  │
│   devtodo        last commit yesterday      ✕  │
│                                                 │
├─────────────────────────────────────────────────┤
│ Add Repository                                  │
│                                                 │
│ Run this command in your repo:                  │
│ ┌─────────────────────────────────────────────┐ │
│ │ curl -s http://localhost:3001/api/git/hook- │ │
│ │ script > .git/hooks/post-commit && chmod +x │ │
│ │ .git/hooks/post-commit                [📋]  │ │
│ └─────────────────────────────────────────────┘ │
│                                                 │
│ Then add to your shell profile:                 │
│ ┌─────────────────────────────────────────────┐ │
│ │ export DEVTODO_TOKEN=your-token-here  [📋]  │ │
│ └─────────────────────────────────────────────┘ │
└─────────────────────────────────────────────────┘
```

---

## Installation Flow

1. User opens DevTodo settings, clicks "Git Integration"
2. UI displays connected repos list and installation instructions
3. User adds token to shell profile (`~/.bashrc` or `~/.zshrc`):
   ```
   export DEVTODO_TOKEN=abc123
   export DEVTODO_URL=http://localhost:3001  # optional
   ```
4. User runs install command in their repo:
   ```
   curl -s http://localhost:3001/api/git/hook-script > .git/hooks/post-commit && chmod +x .git/hooks/post-commit
   ```
5. User makes a commit, hook fires, tasks auto-complete

## Error Handling

| Scenario | Behavior |
|----------|----------|
| Token missing | Hook exits silently, commit proceeds |
| DevTodo unreachable | Hook times out in background, commit proceeds |
| No matching tasks | Returns `{ "matched": 0, "tasks": [] }` |
| Invalid token | Returns 401, hook ignores |

---

## Implementation Summary

### Backend

| File | Changes |
|------|---------|
| `server/src/db.js` | Add `git_repos` table, alter `tasks` table |
| `server/src/routes/git.js` | New — all git endpoints |
| `server/src/index.js` | Register git routes |

### Frontend

| File | Changes |
|------|---------|
| `src/App.jsx` | Git Integration settings, git completion display |
| `src/api.js` | Add `getGitRepos()`, `deleteGitRepo()` |

---

*Generated during brainstorming session, 2026-01-15*
