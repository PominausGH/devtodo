# Claude Parsing Improvements Design

**Date:** 2026-01-10
**Status:** Approved

## Overview

Enhance DevTodo's Claude Code integration with richer task extraction, persistent state, better organization, and bidirectional sync with Claude Code's todo system.

---

## 1. Enhanced Claude Task Display

### Problem
Tasks show minimal info in cramped cards. Titles limited to 80 chars, descriptions often missing.

### Solution

**New card layout:**
```
┌─────────────────────────────────────────────────────────────┐
│ ▼ Implement user authentication with JWT tokens             │
│                                                             │
│ Add login/logout functionality to the API with secure       │
│ token-based auth. Needs password hashing and refresh tokens.│
│                                                             │
│ Context: server/index.js, bcrypt, jsonwebtoken              │
│ Category: feature • Project: devtodo • Jan 7, 2026          │
│                                                             │
│ ┌─ Original Request (click to expand) ────────────────────┐ │
│ │ "Can you add authentication to the devtodo backend?     │ │
│ │ I want users to register and login. Use JWT tokens..."  │ │
│ └─────────────────────────────────────────────────────────┘ │
│                                            [View Chat] [+]  │
└─────────────────────────────────────────────────────────────┘
```

**Changes:**
- Title: 80 → 150 chars max
- Description: full 2-3 sentences, never truncated
- Context: always visible
- Original message: collapsible, up to 1500 chars
- Category badge (feature/bugfix/refactor/config/docs/research)

### Files
- `src/App.jsx`: New `ClaudeTaskCard` component

---

## 2. Improved LLM Extraction

### Problem
LLM prompt is basic, often fails to return proper JSON, falls back to short titles.

### Solution

**New system prompt:**
```javascript
const systemPrompt = `You extract actionable development tasks from chat messages.

Return ONLY valid JSON (no markdown, no explanation):
{
  "title": "Clear actionable title starting with verb (max 150 chars)",
  "description": "2-3 sentences explaining what was requested and why. Include key requirements.",
  "context": "Files, technologies, APIs, or dependencies mentioned",
  "category": "feature|bugfix|refactor|config|docs|research"
}

Rules:
- Title MUST start with action verb (Add, Fix, Update, Implement, Configure, etc.)
- Description should capture the full intent, not just summarize
- Context extracts technical specifics (file paths, package names, API endpoints)
- Omit sensitive data (API keys, passwords, tokens)
- If unclear, set category to "research"`;
```

**Additional improvements:**
- Multiple JSON parsing strategies (strip markdown fences, extract JSON from text)
- Retry logic (max 2 retries) if LLM returns invalid response
- Store new `category` field
- Increase `originalMessage` from 500 → 1500 chars

### Files
- `server/index.js`: `extractTasksFromChats()` function (lines 954-1101)

---

## 3. Task Persistence & State Management

### Problem
Extracted tasks reset every 10 minutes. Dismissed/imported state is lost.

### Solution

**New data structure:**
```json
{
  "tasks": [...],
  "lastUpdated": "2026-01-10T10:00:00Z",
  "taskState": {
    "hash-abc123": {
      "status": "dismissed",
      "dismissedAt": "2026-01-10T09:30:00Z"
    },
    "hash-def456": {
      "status": "imported",
      "importedAt": "2026-01-10T09:45:00Z",
      "linkedTaskId": "task-xxx-yyy"
    }
  }
}
```

**Stable ID generation:**
```javascript
const generateTaskId = (message, project) => {
  const hash = crypto.createHash('md5')
    .update(message.slice(0, 500) + project)
    .digest('hex')
    .slice(0, 12);
  return `claude-${hash}`;
};
```

**New endpoints:**
- `POST /api/claude/tasks/:id/dismiss` - Mark task as dismissed
- `POST /api/claude/tasks/:id/restore` - Restore dismissed task
- `GET /api/claude/tasks/dismissed` - List dismissed tasks

**Frontend changes:**
- "Dismiss" button (X) on each task card
- Collapsible "Dismissed (N)" section at bottom
- "Restore" button on dismissed tasks
- Import button updates state to `imported` with link to created task

### Files
- `server/index.js`: New endpoints, modify `extractTasksFromChats()`
- `src/App.jsx`: Dismiss/restore UI, dismissed section

---

## 4. Better Deduplication

### Problem
Same request appears multiple times across sessions.

### Solution

**Content-based deduplication:**
```javascript
const isDuplicate = (newTask, existingTasks) => {
  // Exact match on hash
  if (existingTasks.some(t => t.id === newTask.id)) return true;

  // Fuzzy match on title (Levenshtein distance < 20% of length)
  const similar = existingTasks.find(t =>
    levenshteinDistance(t.title, newTask.title) < t.title.length * 0.2
  );

  if (similar) {
    similar.similarCount = (similar.similarCount || 1) + 1;
    similar.relatedSessions.push(newTask.sessionId);
    return true;
  }

  return false;
};
```

**Display:**
- Show count badge: "Implement auth (×3)"
- Tooltip shows related sessions/dates

### Files
- `server/index.js`: Deduplication in `extractTasksFromChats()`
- `src/App.jsx`: Similar count badge

---

## 5. View in Context

### Problem
Can't see original conversation or jump to it.

### Solution

**Store additional metadata:**
```javascript
{
  ...task,
  sessionId: "abc123",
  messageIndex: 5,
  conversationPath: "/opt/docker/devtodo/.claude/projects/-opt-docker-devtodo/abc123.jsonl"
}
```

**New endpoint:**
```
GET /api/claude/conversation/:sessionId
Returns: { messages: [...], project: "devtodo" }
```

**Frontend:**
- "View Chat" button on task card
- Modal/drawer showing conversation
- Relevant message highlighted with yellow background
- "Open in VS Code" link: `vscode://file/{path}`

### Files
- `server/index.js`: New endpoint
- `src/App.jsx`: Conversation modal component

---

## 6. Project-Based Grouping

### Problem
Tasks grouped by chatId which isn't meaningful.

### Solution

**New hierarchy:**
```
├─ /opt/docker/devtodo (5 tasks)
│  ├─ Jan 7, 10:30 AM (3 tasks)
│  │  ├─ Implement JWT auth
│  │  ├─ Add password hashing
│  │  └─ Create login endpoint
│  └─ Jan 6, 2:15 PM (2 tasks)
│     ├─ Fix CORS issue
│     └─ Add rate limiting
├─ /opt/docker/meditation (2 tasks)
│  └─ Jan 5, 9:00 AM (2 tasks)
│     ├─ Add meditation timer
│     └─ Implement session history
```

**Implementation:**
```javascript
const groupByProject = (tasks) => {
  const projects = {};
  tasks.forEach(task => {
    if (!projects[task.project]) {
      projects[task.project] = { sessions: {} };
    }
    const sessionKey = `${task.sessionId}-${formatDate(task.timestamp)}`;
    if (!projects[task.project].sessions[sessionKey]) {
      projects[task.project].sessions[sessionKey] = {
        timestamp: task.timestamp,
        tasks: []
      };
    }
    projects[task.project].sessions[sessionKey].tasks.push(task);
  });
  return projects;
};
```

**UI:**
- Collapsible project headers
- Collapsible session headers within projects
- Task counts at each level
- Sort projects by most recent activity

### Files
- `src/App.jsx`: New grouping logic and UI

---

## 7. Claude Code Todo Sync

### Problem
DevTodo doesn't know about Claude Code's built-in todo system.

### Solution

**Read Claude Code todos:**
- Path: `~/.claude/todos/*.json` (already mounted via CLAUDE_DATA_PATH)
- Existing endpoint: `GET /api/claude/todos`

**Cross-reference with extracted tasks:**
```javascript
const matchTodoToTask = (todo, extractedTasks) => {
  return extractedTasks.find(task => {
    const titleMatch = levenshteinDistance(
      todo.content.toLowerCase(),
      task.title.toLowerCase()
    ) < todo.content.length * 0.3;
    return titleMatch;
  });
};
```

**Display status badges:**
- `🔄 In Progress` - matched todo is in_progress
- `✅ Done in Claude` - matched todo is completed
- `🤖 Active Session` - conversation is < 1 hour old

**Auto-completion:**
- When todo status = completed, show prompt: "Mark as complete in DevTodo?"
- Optional setting: "Auto-sync Claude Code completions"

**New section in sidebar:**
```
┌─ Claude Code Active (3) ─────────────────────┐
│ 🔄 Fixing login bug                          │
│ 🔄 Adding unit tests                         │
│ ⏳ Update documentation                       │
└──────────────────────────────────────────────┘
```

### Files
- `server/index.js`: Todo matching logic
- `src/App.jsx`: Status badges, active todos section, auto-complete prompt

---

## Implementation Order

1. **Backend: LLM prompt improvements** (Section 2)
2. **Backend: Persistence & stable IDs** (Section 3)
3. **Backend: Deduplication** (Section 4)
4. **Backend: Conversation endpoint** (Section 5)
5. **Backend: Todo sync logic** (Section 7)
6. **Frontend: Enhanced card layout** (Section 1)
7. **Frontend: Project grouping** (Section 6)
8. **Frontend: Dismiss/restore UI** (Section 3)
9. **Frontend: Conversation modal** (Section 5)
10. **Frontend: Todo sync UI** (Section 7)

---

## API Changes Summary

### Modified Endpoints
- `GET /api/claude/extracted-tasks` - Returns tasks with new fields + taskState

### New Endpoints
- `POST /api/claude/tasks/:id/dismiss`
- `POST /api/claude/tasks/:id/restore`
- `GET /api/claude/tasks/dismissed`
- `GET /api/claude/conversation/:sessionId`

---

## Data Model Changes

### Extracted Task (expanded)
```typescript
interface ExtractedTask {
  id: string;              // hash-based, stable
  title: string;           // max 150 chars
  description: string;     // 2-3 sentences
  context: string;         // technical details
  category: 'feature' | 'bugfix' | 'refactor' | 'config' | 'docs' | 'research';
  originalMessage: string; // up to 1500 chars
  project: string;
  timestamp: string;
  sessionId: string;
  messageIndex: number;
  chatTitle: string;
  similarCount?: number;
  relatedSessions?: string[];
  // Sync status
  claudeTodoMatch?: {
    todoId: string;
    status: 'pending' | 'in_progress' | 'completed';
  };
}
```

### Task State
```typescript
interface TaskState {
  [taskId: string]: {
    status: 'active' | 'dismissed' | 'imported';
    dismissedAt?: string;
    importedAt?: string;
    linkedTaskId?: string;
  };
}
```
