# DevTodo ⚡

**Infrastructure-Aware Task Manager for Developers**

A unique todo list application that automatically detects completed tasks by monitoring your Docker containers and git commits, parses Claude/Claude Code chat histories for action items, syncs with Google Calendar, imports tasks from Gmail, and exports daily reports to Markdown.

![DevTodo Screenshot](screenshot.png)

## 🚀 Features

### Core Features
- ✅ **Manual Task Management** - Add, edit, complete, and delete tasks
- 📊 **Task Statistics** - Real-time stats on total, active, completed, and today's tasks
- 🎨 **Dark/Light Mode** - Beautiful UI with theme switching
- 📱 **Responsive Design** - Works on desktop and mobile

### Unique Automation Features

#### 🐳 Docker Container Monitoring
- Real-time container status display
- One-click task creation for container actions (restart, stop, update, check logs)
- **Auto-completion detection**: Tasks like "restart cv-matcher container" automatically complete when Docker detects the container was restarted
- Container health monitoring and stats

#### 🔀 Git Commit Auto-Completion
- Install a post-commit hook in any git repository
- Tasks auto-complete when commit messages match task titles
- Case-insensitive substring matching (commit "Fix login bug" completes task "fix login bug")
- Multiple tasks can match a single commit
- Tracks connected repositories with last commit timestamps
- Shows commit details (hash, branch, repo) on completed tasks

#### 🤖 Claude Chat Parsing
- Scans your Claude and Claude Code saved chats folder
- Extracts action items from conversations (TODO:, ACTION:, NEXT STEP:, etc.)
- Watches folder for new chats in real-time
- Deduplicates and presents unique action items

#### 📅 Google Calendar Sync
- View upcoming calendar events
- Import events as tasks with one click
- Preserves event dates as due dates

#### 📧 Gmail Task Import
- Scans for actionable emails (flagged, starred, urgent)
- Extracts action items from subject lines
- One-click import to task list

#### 📝 Daily Markdown Export
- One-click export to `.md` file
- Includes summary statistics
- Separates completed and pending tasks
- Shows task sources with emoji indicators
- Perfect for daily standups or journaling

## 📋 Requirements

- Node.js 18+
- Docker (for container monitoring)
- Google Cloud Project (optional, for Calendar/Gmail)

## 🛠️ Installation

### Option 1: Docker Compose (Recommended)

1. Clone the repository:
```bash
git clone https://github.com/PominausGH/devtodo.git
cd devtodo
```

2. Create environment file:
```bash
cp .env.example .env
```

3. Edit `.env` with your settings:
```env
# Google OAuth (optional - for Calendar/Gmail)
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
GOOGLE_REDIRECT_URI=http://localhost:3001/auth/google/callback

# Path to Claude chats
CLAUDE_CHATS_PATH=/home/youruser/.config/claude/chats
```

4. Start the application:
```bash
docker-compose up -d
```

5. Open http://localhost:3000

### Option 2: Manual Installation

**Backend:**
```bash
cd server
npm install
npm start
```

**Frontend:**
```bash
npm install
npm run dev
```

## ⚙️ Configuration

### Docker Integration

The backend automatically connects to the Docker socket. Ensure the socket is accessible:

```bash
# Local Docker
DOCKER_SOCKET=/var/run/docker.sock

# Remote Docker (e.g., your VPS)
DOCKER_HOST=tcp://your-vps.com:2375
```

For remote Docker, enable the Docker API on your VPS:
```bash
# /etc/docker/daemon.json
{
  "hosts": ["unix:///var/run/docker.sock", "tcp://0.0.0.0:2375"]
}
```

⚠️ **Security Note**: Use TLS certificates for remote Docker access in production.

### Claude Chats Integration

Set the path to your Claude saved chats:

```env
CLAUDE_CHATS_PATH=/home/youruser/.config/claude/chats
```

Common paths:
- **Claude Desktop**: `~/.config/claude/chats`
- **Claude Code**: `~/.config/claude-code/chats`
- **Custom**: Any folder containing `.json`, `.md`, or `.txt` chat exports

### Git Commit Integration

Enable auto-completion of tasks when you make git commits:

1. Add the API token to your shell profile (`~/.bashrc` or `~/.zshrc`):
```bash
export DEVTODO_TOKEN=your-api-token
export DEVTODO_URL=http://localhost:3001  # optional, defaults to localhost
```

2. Install the post-commit hook in your repository:
```bash
cd /path/to/your/repo
curl -s http://localhost:3001/api/git/hook-script > .git/hooks/post-commit
chmod +x .git/hooks/post-commit
```

3. Create a task and make a commit with matching text:
```bash
# Task: "fix login validation"
git commit -m "fix login validation and add tests"
# Task auto-completes!
```

The hook runs asynchronously and won't slow down your commits. If DevTodo is unavailable, commits proceed normally.

### Google Calendar & Gmail

1. Create a Google Cloud Project
2. Enable Calendar API and Gmail API
3. Create OAuth 2.0 credentials
4. Add redirect URI: `http://localhost:3001/auth/google/callback`
5. Set environment variables:
```env
GOOGLE_CLIENT_ID=your-client-id
GOOGLE_CLIENT_SECRET=your-client-secret
```

6. Visit the app and click "Connect Google" to authenticate

## 🔄 Auto-Completion Detection

DevTodo automatically marks tasks as complete based on real-world actions:

### Docker Auto-Completion

| Task Title Contains | Auto-completes When |
|---------------------|---------------------|
| "restart [container]" | Container restart detected |
| "stop [container]" | Container status is "stopped" |
| "start [container]" | Container status is "running" |
| "update [container]" | Container image update detected |
| "deploy [container]" | New deployment detected |
| "ssl" | SSL certificate renewal detected |

Example:
1. You add task: "restart litellm container"
2. You run `docker restart litellm`
3. DevTodo detects the restart and auto-completes the task

### Git Auto-Completion

Any task whose title appears in a commit message (case-insensitive) will auto-complete.

Example:
1. You add task: "fix login validation"
2. You commit: `git commit -m "fix login validation and add unit tests"`
3. DevTodo auto-completes the task with commit metadata (hash, branch, repo)

## 📊 Markdown Export Format

Daily exports include:

```markdown
# Daily Task Report - Mon, 5 Jan

Generated: 5/01/2026, 10:30:00 AM

---

## Summary

- **Total Tasks:** 12
- **Completed:** 8
- **Pending:** 4
- **Completion Rate:** 67%

## Completed Tasks ✓

- [x] 🐳 restart litellm container _(completed 09:15)_
- [x] 🤖 Review CV matcher improvements
- [x] 📅 Code review session
- [x] ✏️ Update documentation

## Pending Tasks

- [ ] 🔴 📧 Respond to: Automation consulting proposal
- [ ] 🟡 🐳 update nginx-proxy-manager container
- [ ] 🟢 ✏️ Research Elliott Wave integration

---

_Generated by DevTodo - Your Infrastructure-Aware Task Manager_
```

## 🏗️ Project Structure

```
devtodo/
├── src/
│   ├── App.jsx          # Main React application
│   └── main.jsx         # React entry point
├── server/
│   ├── index.js         # Express API server
│   ├── package.json
│   └── Dockerfile
├── docker-compose.yml
├── Dockerfile.frontend
├── nginx.conf
├── package.json
├── vite.config.js
└── README.md
```

## 🔧 API Endpoints

### Docker
- `GET /api/docker/containers` - List all containers
- `GET /api/docker/containers/:id/logs` - Get container logs
- `GET /api/docker/containers/:id/stats` - Get container stats
- `POST /api/docker/containers/:id/:action` - Perform action (start/stop/restart)
- `GET /api/docker/actions` - Get recorded container actions

### Claude
- `GET /api/claude/actions` - Get action items from chats
- `POST /api/claude/watch` - Start watching chats folder
- `GET /api/claude/pending` - Get new actions from watcher

### Google
- `GET /api/calendar/auth` - Get OAuth URL
- `GET /api/calendar/events` - Get calendar events
- `GET /api/gmail/actions` - Get actionable emails

### Git
- `POST /api/git/commit` - Receive commit from hook (matches tasks, marks complete)
- `GET /api/git/repos` - List connected repositories
- `GET /api/git/hook-script` - Get installable post-commit hook (public, no auth)
- `DELETE /api/git/repos/:name` - Remove a repository from tracking

### Export
- `POST /api/export/markdown` - Generate markdown export

## 🚢 Deployment to VPS

For deploying to your VPS (e.g., daintytrading.com):

1. SSH into your VPS:
```bash
ssh user@daintytrading.com
```

2. Clone and deploy:
```bash
git clone https://github.com/PominausGH/devtodo.git
cd devtodo
docker-compose up -d
```

3. Configure Nginx Proxy Manager:
- Add proxy host for `todo.daintytrading.com`
- Forward to `devtodo-frontend:80`
- Enable SSL with Let's Encrypt

## 🔐 Security Considerations

- Docker socket access is read-only by default
- Google tokens are stored locally (consider encrypting in production)
- Use HTTPS in production
- Consider adding authentication for multi-user scenarios

## 🛣️ Roadmap

- [x] Git commit integration (auto-complete coding tasks)
- [ ] n8n workflow trigger integration
- [ ] Mobile app (React Native)
- [ ] Team collaboration features
- [ ] Recurring tasks
- [ ] Time tracking
- [ ] Pomodoro timer integration
- [ ] Webhook support for external integrations

## 📄 License

MIT License - feel free to use and modify for your own projects.

## 🤝 Contributing

Contributions welcome! Please open an issue or PR.

---

Built with ❤️ for developers who live in the terminal.
