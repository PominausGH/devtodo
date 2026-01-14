# DevTodo Market Readiness Plan

**Date:** 2026-01-14
**Status:** Draft
**Goal:** Transform DevTodo from working prototype to market-ready product

---

## Current State Assessment

DevTodo is an infrastructure-aware task manager with a strong value proposition:
- Auto-complete tasks based on Docker container events
- Parse Claude/Claude Code chats for action items
- Sync with Google Calendar and Gmail
- Export daily reports to Markdown

**What exists:**
- React frontend (single `App.jsx`) with polished UI
- Express backend with Docker, Google Calendar/Gmail integrations
- Claude chat parsing logic
- Docker Compose deployment config

**Critical gaps:**
| Issue | Impact |
|-------|--------|
| Tasks stored in localStorage only | Data lost on browser clear; no sync between devices |
| Frontend uses mock data | Docker/Calendar/Gmail integration doesn't work in UI |
| No authentication | Anyone can access the app |
| Missing build files | No package.json, vite.config.js, Dockerfiles |
| Google tokens stored as plain JSON | Security vulnerability |
| Zero tests | Can't safely refactor or add features |

**Verdict:** Working prototype/demo, not a deployable product.

---

## Phase 1: Make It Work (Foundation)

Priority: **Critical** - App cannot be used without these.

### 1.1 Add SQLite Database for Task Persistence
- Replace localStorage with server-side storage
- Schema: tasks, user_preferences, sync_state
- SQLite for simplicity; migrate to PostgreSQL later if needed
- Backend endpoints: full CRUD for tasks

### 1.2 Connect Frontend to Real Backend APIs
- Replace mock data arrays with `fetch()` calls
- Add loading states and error handling
- Endpoints already exist - just need to be called:
  - `GET /api/docker/containers`
  - `GET /api/calendar/events`
  - `GET /api/gmail/actions`
  - `GET /api/claude/actions`

### 1.3 Create Missing Build Infrastructure
```
devtodo/
├── package.json          # Frontend dependencies (react, vite, lucide-react)
├── vite.config.js        # Build configuration
├── index.html            # HTML entry point
├── src/
│   ├── main.jsx          # React entry point
│   └── App.jsx           # (exists)
├── server/
│   ├── package.json      # Backend dependencies
│   ├── Dockerfile        # Backend container
│   └── index.js          # (exists)
├── Dockerfile.frontend   # Build and serve frontend
└── nginx.conf            # Serve built frontend, proxy API
```

### 1.4 Add Basic Authentication
- Option A: Single-user with environment variable password (simplest)
- Option B: Magic link email auth (no password management)
- Store session in HTTP-only cookie
- Protect all API endpoints

---

## Phase 2: Security & Reliability

Priority: **High** - Prevents data loss and security incidents.

### 2.1 Secure Token Storage
- Encrypt Google OAuth tokens at rest
- Use encryption key from environment variable
- Consider: node `crypto` module with AES-256-GCM

### 2.2 Input Validation & Sanitization
- Sanitize task titles/notes (prevent XSS)
- Validate all API inputs:
  - Task IDs must be valid format
  - Container names must exist
  - File paths must be within allowed directories
- Use `express-validator` or `zod`

### 2.3 Rate Limiting
- Add `express-rate-limit` middleware
- Stricter limits on destructive endpoints (Docker restart/stop)
- Example: 100 requests/minute general, 10/minute for Docker actions

### 2.4 React Error Boundaries
- Wrap main app in error boundary component
- Display user-friendly error message
- Log errors for debugging

### 2.5 Environment Validation
- Check required env vars on server startup
- Validate Docker socket is accessible
- Test Google OAuth credentials format
- Exit with clear error message if misconfigured

### 2.6 Request Logging
- Add `morgan` middleware for HTTP logs
- Structured error logging with context
- Log format: timestamp, method, path, status, duration

---

## Phase 3: Testing & Quality

Priority: **Medium** - Enables confident shipping of updates.

### 3.1 Backend API Tests
- Framework: Jest + Supertest
- Test coverage targets:
  - Task CRUD operations
  - Docker endpoint validation
  - Auth flows (login, session, logout)
  - Error responses
- Mock external services (Docker, Google APIs)

### 3.2 Frontend Component Tests
- Framework: React Testing Library + Vitest
- Focus areas:
  - TaskItem: toggle, edit, delete interactions
  - Task filtering logic
  - Form validation
- Don't test implementation details

### 3.3 End-to-End Test
- Framework: Playwright
- Single happy path: create task → complete it → export markdown
- Run against Docker Compose environment
- Catches integration issues

### 3.4 CI Pipeline (GitHub Actions)
```yaml
name: CI
on: [push, pull_request]
jobs:
  test:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - uses: actions/setup-node@v4
      - run: npm ci
      - run: npm test
      - run: npm run test:ui
  build:
    runs-on: ubuntu-latest
    steps:
      - uses: actions/checkout@v4
      - run: docker compose build
```

---

## Phase 4: Launch Readiness

Priority: **Medium** - Required to put in front of users.

### 4.1 Landing Page
- Simple static page (can be separate repo)
- Content:
  - Value proposition: "Infrastructure-aware task manager for developers"
  - Key differentiator: Auto-completion from Docker events
  - Screenshot or demo GIF
  - "Self-host" or "Try it" CTA
- Tech: plain HTML or Astro/11ty

### 4.2 Onboarding Flow
- First-run detection (no tasks, no integrations)
- Step-by-step guide:
  1. Create your first task (manual)
  2. Connect Docker (show container list)
  3. Connect Google (optional)
  4. Set Claude chats path (optional)
- Progressive: don't require all integrations upfront

### 4.3 Deployment
- Target: VPS at daintytrading.com
- Domain: todo.daintytrading.com
- SSL: Let's Encrypt via nginx-proxy-manager
- Process:
  1. Clone repo to VPS
  2. Copy .env.example to .env, fill values
  3. `docker compose up -d`
  4. Configure nginx-proxy-manager

### 4.4 Feedback Mechanism
- Add "Feedback" link in app header
- Options:
  - Link to GitHub issues (simplest)
  - Mailto link with template
  - Embedded widget (Canny, Fider)

### 4.5 Analytics
- Self-hosted: Umami or Plausible
- Track:
  - Daily/weekly active users
  - Feature usage (which integrations enabled)
  - Export frequency
- Privacy-respecting, no personal data

---

## Phase 5: Growth & Differentiation

Priority: **Low** - Post-launch improvements.

### 5.1 Demo Content
- Record GIF/video showing:
  - Add task "restart litellm container"
  - Run `docker restart litellm` in terminal
  - Task auto-completes in DevTodo
- Use for landing page, GitHub README, social

### 5.2 Git Commit Integration
- Watch `.git/logs/HEAD` or use post-commit hook
- Match commit messages to task titles
- Auto-complete on match
- Example: "fix(auth): resolve login bug" matches task "fix login bug"

### 5.3 Webhook Export
- Add Slack incoming webhook support
- Daily digest: "Here's what I completed yesterday"
- Format: same as Markdown export but for Slack blocks
- Extend to Discord, Teams

### 5.4 Claude Code MCP Server
- Package as MCP server for Claude Code
- Commands:
  - `add_task` - create task from conversation
  - `list_tasks` - show pending tasks
  - `complete_task` - mark done
- Unique integration opportunity

### 5.5 Pricing Model
- **Option A: Open Source Only**
  - Free self-hosted
  - Community contributions
  - No revenue, but goodwill and portfolio piece

- **Option B: Open Core**
  - Free self-hosted (core features)
  - Paid hosted version ($5-10/month)
  - Paid team features (shared tasks, team reports)

- **Option C: Hosted Only**
  - Free tier (limited tasks/integrations)
  - Paid tier (unlimited)
  - Simpler but less community appeal

---

## Recommended Execution Order

```
Week 1-2: Phase 1 (Foundation)
├── 1.1 SQLite database
├── 1.2 Connect frontend to backend
├── 1.3 Build infrastructure
└── 1.4 Basic auth

Week 3: Phase 2 (Security)
├── 2.1-2.6 All security items
└── (Parallel with testing setup)

Week 4: Phase 3 (Testing)
├── 3.1 Backend tests
├── 3.4 CI pipeline
└── 3.2-3.3 Frontend/E2E tests

Week 5: Phase 4 (Launch)
├── 4.3 Deploy to VPS
├── 4.2 Onboarding flow
├── 4.1 Landing page
└── 4.4-4.5 Feedback + analytics

Post-launch: Phase 5 (Growth)
└── Prioritize based on user feedback
```

---

## Success Metrics

**Launch (Phase 4 complete):**
- App runs reliably on VPS
- One user (you) uses it daily for 2 weeks without issues
- All integrations work (Docker, Calendar, Gmail, Claude)

**Traction (1 month post-launch):**
- 10+ GitHub stars
- 3+ users besides yourself
- Positive feedback on unique features

**Growth (3 months post-launch):**
- 50+ GitHub stars or 20+ active users
- Feature requests coming in
- Clear signal on whether to pursue paid version

---

## Open Questions

1. **Target audience:** Solo devs? Small teams? Both?
2. **Monetization:** Open source only, or pursue paid hosted version?
3. **Scope:** Focus on Docker integration, or build out all integrations equally?
4. **Timeline:** What's your availability to work on this?

---

*Generated during brainstorming session, 2026-01-14*
