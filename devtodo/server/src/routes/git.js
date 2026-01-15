const express = require('express');
const { upsertGitRepo, getGitRepos, deleteGitRepo, findMatchingTasks, updateTask } = require('../db');

function createGitRouter(db) {
  const router = express.Router();

  // POST /api/git/commit - Receive commit from hook
  router.post('/commit', (req, res) => {
    try {
      const { message, repo, branch, hash, author } = req.body;

      if (!message || typeof message !== 'string') {
        return res.status(400).json({ error: 'message is required' });
      }

      // Update/insert repo tracking
      if (repo) {
        upsertGitRepo(db, repo);
      }

      // Find matching tasks
      const matchingTasks = findMatchingTasks(db, message);
      const completedTaskIds = [];

      // Complete all matching tasks
      for (const task of matchingTasks) {
        updateTask(db, task.id, {
          completed: 1,
          completedAt: new Date().toISOString(),
          autoCompleted: 1,
          completedBy: 'git',
          gitCommitHash: hash || null,
          gitCommitRepo: repo || null,
          gitCommitBranch: branch || null,
          gitCommitMessage: message,
        });
        completedTaskIds.push(task.id);
      }

      res.json({
        matched: completedTaskIds.length,
        tasks: completedTaskIds,
      });
    } catch (error) {
      console.error('Error processing git commit:', error);
      res.status(500).json({ error: 'Failed to process commit' });
    }
  });

  // GET /api/git/repos - List connected repos
  router.get('/repos', (req, res) => {
    try {
      const repos = getGitRepos(db);
      res.json({ repos });
    } catch (error) {
      console.error('Error fetching git repos:', error);
      res.status(500).json({ error: 'Failed to fetch repos' });
    }
  });

  // GET /api/git/hook-script - Return installable hook script
  router.get('/hook-script', (req, res) => {
    const script = `#!/bin/sh
# DevTodo post-commit hook
# Sends commit info to DevTodo for task auto-completion

DEVTODO_URL="\${DEVTODO_URL:-http://localhost:3001}"

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
curl -s -X POST "$DEVTODO_URL/api/git/commit" \\
  -H "Authorization: Bearer $DEVTODO_TOKEN" \\
  -H "Content-Type: application/json" \\
  -d "{
    \\"message\\": \\"$(echo "$MESSAGE" | sed 's/"/\\\\"/g')\\",
    \\"repo\\": \\"$REPO\\",
    \\"branch\\": \\"$BRANCH\\",
    \\"hash\\": \\"$HASH\\",
    \\"author\\": \\"$AUTHOR\\"
  }" > /dev/null 2>&1 &

exit 0
`;

    res.type('text/plain').send(script);
  });

  // DELETE /api/git/repos/:name - Remove a repo from tracking
  router.delete('/repos/:name', (req, res) => {
    try {
      const result = deleteGitRepo(db, req.params.name);

      if (result.changes === 0) {
        return res.status(404).json({ error: 'Repo not found' });
      }

      res.json({ deleted: true });
    } catch (error) {
      console.error('Error deleting git repo:', error);
      res.status(500).json({ error: 'Failed to delete repo' });
    }
  });

  return router;
}

module.exports = createGitRouter;
