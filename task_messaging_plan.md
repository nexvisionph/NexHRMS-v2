# 📋 NexHRMS – Task Management & Multi-Channel Messaging Plan
### Phase 2 Extension | MVP Simulation (Zustand + localStorage)

> **Client Requirement:** Task management with photo/location proof, multi-channel messaging
> (WhatsApp + Email default + SMS coming soon), customizable announcement permissions.
>
> **MVP Approach:** All channels simulated — no real API integrations yet.
> Production will wire WhatsApp Business API (Meta Cloud), Resend (email), Semaphore (SMS).

---

## Ground Rules (MVP Simulation)

| Production | MVP Simulation |
|------------|----------------|
| WhatsApp Business API (Meta Cloud) | Simulated → logged to `messaging.store` |
| Resend email delivery | Simulated → logged to `messaging.store` |
| Semaphore SMS delivery | **Coming Soon** badge — disabled in UI |
| Real-time WebSocket chat | Zustand store polling (simulated) |
| File/image CDN storage | `photoDataUrl` (base64 in localStorage) |
| Push notifications | In-app notification badge |

---

## 1️⃣ New Types (src/types/index.ts)

### Task System Types

```ts
// ─── Task Management ─────────────────────────────────────────

export type TaskStatus = "open" | "in_progress" | "submitted" | "verified" | "rejected" | "cancelled";
export type TaskPriority = "low" | "medium" | "high" | "urgent";

/** A task group — acts like a project board / channel grouping */
export interface TaskGroup {
  id: string;                  // "TG-xxxx"
  name: string;                // e.g. "Metro Manila Site Inspections"
  description?: string;
  projectId?: string;          // optional link to existing Project
  createdBy: string;           // admin/manager employee ID
  memberEmployeeIds: string[]; // who can see this group
  announcementPermission: AnnouncementPermission;
  createdAt: string;
}

/**
 * Controls who can send announcements within a task group.
 * - "admin_only"    → Only admins/HR can broadcast
 * - "group_leads"   → Admin + designated group leads
 * - "all_members"   → Any group member can announce
 */
export type AnnouncementPermission = "admin_only" | "group_leads" | "all_members";

/** A single assignable task */
export interface Task {
  id: string;                  // "TSK-xxxx"
  groupId: string;             // parent TaskGroup
  title: string;
  description: string;
  priority: TaskPriority;
  status: TaskStatus;
  dueDate?: string;            // ISO date
  assignedTo: string[];        // employee IDs (can be multiple)
  createdBy: string;
  createdAt: string;
  updatedAt: string;
  completionRequired: boolean; // requires photo+location proof
  tags?: string[];
}

/** Photo + location proof when task is completed */
export interface TaskCompletionReport {
  id: string;                  // "TCR-xxxx"
  taskId: string;
  employeeId: string;
  photoDataUrl: string;        // base64 camera capture
  gpsLat: number;
  gpsLng: number;
  gpsAccuracyMeters: number;
  reverseGeoAddress?: string;  // human-readable address
  notes?: string;              // employee notes
  submittedAt: string;
  // Admin verification
  verifiedBy?: string;
  verifiedAt?: string;
  rejectionReason?: string;
}

/** Comment on a task (discussion thread) */
export interface TaskComment {
  id: string;                  // "TC-xxxx"
  taskId: string;
  employeeId: string;
  message: string;
  attachmentUrl?: string;      // optional image attachment (base64)
  createdAt: string;
}
```

### Messaging / Announcement Types

```ts
// ─── Multi-Channel Messaging ─────────────────────────────────

export type MessageChannel = "email" | "whatsapp" | "sms" | "in_app";
export type MessageStatus = "sent" | "delivered" | "read" | "failed" | "simulated";
export type AnnouncementScope = "all_employees" | "selected_employees" | "task_group" | "task_assignees";

/** A broadcast/announcement from admin to employees */
export interface Announcement {
  id: string;                  // "ANN-xxxx"
  subject: string;
  body: string;
  channel: MessageChannel;     // delivery channel
  scope: AnnouncementScope;
  // Targeting
  targetEmployeeIds?: string[];  // if scope = "selected_employees"
  targetGroupId?: string;        // if scope = "task_group"
  targetTaskId?: string;         // if scope = "task_assignees"
  // Metadata
  sentBy: string;              // employee ID of sender
  sentAt: string;
  status: MessageStatus;
  readBy: string[];            // employee IDs who read it
  attachmentUrl?: string;      // optional base64 attachment
}

/** In-app text channel (like Slack #channel) */
export interface TextChannel {
  id: string;                  // "CH-xxxx"
  name: string;                // e.g. "#general", "#site-alpha"
  groupId?: string;            // optional link to TaskGroup
  memberEmployeeIds: string[];
  createdBy: string;
  createdAt: string;
  isArchived: boolean;
}

/** A single message in a text channel */
export interface ChannelMessage {
  id: string;                  // "MSG-xxxx"
  channelId: string;
  employeeId: string;          // sender
  message: string;
  attachmentUrl?: string;
  createdAt: string;
  editedAt?: string;
  readBy: string[];
}
```

### Employee Extension

```ts
// Add to existing Employee interface:
export interface Employee {
  // ... existing fields ...
  whatsappNumber?: string;     // for WhatsApp delivery (defaults to phone)
  preferredChannel?: MessageChannel; // employee's preferred notification channel
}
```

### New Permissions

```ts
// Add to existing Permission union:
export type Permission =
  // ... existing permissions ...
  // Task Management
  | "page:tasks"
  | "tasks:view" | "tasks:create" | "tasks:assign" | "tasks:verify"
  | "tasks:delete" | "tasks:manage_groups"
  // Messaging
  | "page:messages"
  | "messages:send_announcement" | "messages:manage_channels"
  | "messages:send_whatsapp" | "messages:send_email";
```

---

## 2️⃣ New Stores

### A. `tasks.store.ts` (nexhrms-tasks, v1)

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `groups` | `TaskGroup[]` | Task groups/boards |
| `tasks` | `Task[]` | All tasks |
| `completionReports` | `TaskCompletionReport[]` | Photo+location proofs |
| `comments` | `TaskComment[]` | Task discussion threads |

**Actions:**

| Action | Description |
|--------|-------------|
| `addGroup(data)` | Create task group |
| `updateGroup(id, patch)` | Edit group settings |
| `deleteGroup(id)` | Remove group + its tasks |
| `addTask(data)` | Create task, notify assignees |
| `updateTask(id, patch)` | Edit task details |
| `assignTask(taskId, employeeIds)` | Assign/reassign employees |
| `updateTaskStatus(id, status)` | Move task through workflow |
| `submitCompletion(taskId, report)` | Employee submits photo+GPS proof |
| `verifyCompletion(reportId, by)` | Admin verifies the report |
| `rejectCompletion(reportId, reason)` | Admin rejects with reason |
| `addComment(taskId, data)` | Add discussion comment |
| `getTasksByGroup(groupId)` | Filter tasks by group |
| `getTasksByEmployee(empId)` | My assigned tasks |
| `getCompletionReport(taskId)` | Get proof for a task |
| `resetToSeed()` | Reset to seed data |

**Seed Data:**

```
2 task groups:
  - "Field Operations" (linked to existing Project PRJ-xxx)
  - "Office Tasks" (no project link)

6 seed tasks:
  - 2 open, 1 in_progress, 1 submitted (with completion report), 1 verified, 1 rejected
  - Spread across groups, assigned to different employees

2 seed completion reports:
  - With simulated photo (placeholder base64), GPS coords, timestamps

4 seed comments:
  - On various tasks
```

### B. `messaging.store.ts` (nexhrms-messaging, v1)

**State:**

| Field | Type | Description |
|-------|------|-------------|
| `announcements` | `Announcement[]` | All broadcasts |
| `channels` | `TextChannel[]` | In-app text channels |
| `messages` | `ChannelMessage[]` | Channel messages |
| `channelConfig` | `ChannelConfig` | Provider settings |

```ts
interface ChannelConfig {
  defaultChannel: MessageChannel;     // "email" (default)
  whatsappEnabled: boolean;           // true — simulated
  emailEnabled: boolean;              // true — simulated
  smsEnabled: boolean;                // false — "Coming Soon"
  inAppEnabled: boolean;              // true
  whatsappProvider: "simulated" | "meta_cloud" | "twilio";
  emailProvider: "simulated" | "resend";
  smsProvider: "coming_soon" | "semaphore";
}
```

**Actions:**

| Action | Description |
|--------|-------------|
| `sendAnnouncement(data)` | Broadcast to selected employees via chosen channel |
| `markAnnouncementRead(id, empId)` | Employee marks as read |
| `createChannel(data)` | Create text channel |
| `archiveChannel(id)` | Archive channel |
| `addMember(channelId, empId)` | Add member to channel |
| `removeMember(channelId, empId)` | Remove member |
| `sendMessage(channelId, data)` | Send message in channel |
| `editMessage(msgId, text)` | Edit own message |
| `markMessagesRead(channelId, empId)` | Mark all messages read in channel |
| `getUnreadCount(empId)` | Total unread across channels + announcements |
| `updateConfig(patch)` | Update channel config |
| `resetToSeed()` | Reset |

**Seed Data:**

```
3 text channels:
  - "#general" (all employees)
  - "#field-ops" (field team only)
  - "#admin-hr" (admin + HR only)

5 seed announcements:
  - 2 via email, 2 via whatsapp, 1 via in_app
  - Various scopes (all, selected, task_group)

10 seed channel messages:
  - Across 3 channels, from different employees
```

---

## 3️⃣ New Pages & Routes

### Route Structure

```
src/app/[role]/
  tasks/
    page.tsx              → Task board (list + kanban toggle)
  tasks/[id]/
    page.tsx              → Task detail + comments + completion reports
  messages/
    page.tsx              → Messaging hub (channels + announcements)
```

### A. Tasks Page (`/tasks`)

**Layout: 3 sections in tabs**

| Tab | Content |
|-----|---------|
| **Board** | Kanban columns: Open → In Progress → Submitted → Verified |
| **My Tasks** | Employee's assigned tasks (card list) |
| **Groups** | Task group management (admin only) |

**Key UI Components:**

```
TaskBoard
├── TaskGroupSelector (dropdown to filter by group)
├── KanbanView / ListView toggle
├── TaskCard
│   ├── Title, priority badge, due date
│   ├── Assigned avatars
│   ├── Status badge
│   └── Completion indicator (📷 if photo submitted)
├── CreateTaskDialog
│   ├── Title, description, priority
│   ├── Group selector
│   ├── Employee multi-select (assign to)
│   ├── Due date picker
│   ├── Toggle: "Require photo proof"
│   └── Tags input
├── TaskGroupManager (admin)
│   ├── Create/edit groups
│   ├── Member management
│   ├── Announcement permission selector
│   └── Link to existing Project (optional)
└── BulkAssignDialog
    ├── Select task group → auto-fill members
    ├── Or manually pick employees
    └── Or "Select All"
```

### B. Task Detail Page (`/tasks/[id]`)

**Layout: 2-column on desktop**

```
Left Column (70%)                    Right Column (30%)
┌─────────────────────┐              ┌──────────────────┐
│ Task Title & Status │              │ Assignment Panel  │
│ Description         │              │ ├── Assigned to   │
│ Priority / Due Date │              │ ├── Created by    │
│                     │              │ ├── Due date      │
│ ─── Completion ──── │              │ └── Status select │
│ 📷 Submit Report    │              ├──────────────────┤
│ ├── Camera capture  │              │ Completion Report │
│ ├── GPS auto-fill   │              │ ├── 📷 Photo     │
│ ├── Notes field     │              │ ├── 📍 Map pin   │
│ └── Submit button   │              │ ├── Address       │
│                     │              │ └── ✅/❌ Verify  │
│ ─── Discussion ──── │              └──────────────────┘
│ Comment thread      │
│ Add comment box     │
└─────────────────────┘
```

**Admin Completion Review:**
- Photo displayed with lightbox zoom
- Map component showing GPS pin (Leaflet or static image)
- Verify ✅ or Reject ❌ with reason
- Timestamp + address shown

**Employee Completion Submission:**
- Camera opens (front or back)
- GPS auto-captured via `navigator.geolocation`
- Reverse geocode address (simulated in MVP — use coords as text)
- Notes text area
- Submit → status moves to `submitted`

### C. Messages Page (`/messages`)

**Layout: Sidebar + Main**

```
Sidebar (25%)                        Main (75%)
┌──────────────┐                     ┌────────────────────────────┐
│ 📢 Section   │                     │                            │
│ Announcements│ ← broadcasts        │  Channel / Announcement    │
│              │                     │  Content Area              │
│ 💬 Channels  │                     │                            │
│ #general     │                     │  ┌──────────────────────┐  │
│ #field-ops   │                     │  │ Message bubbles       │  │
│ #admin-hr    │                     │  │ (chat-style)          │  │
│              │                     │  └──────────────────────┘  │
│ [+ Channel]  │                     │                            │
│              │                     │  ┌──────────────────────┐  │
│ ⚙️ Settings  │                     │  │ Compose bar           │  │
│ (admin only) │                     │  └──────────────────────┘  │
└──────────────┘                     └────────────────────────────┘
```

**Announcement Composer (Admin):**

```
┌─────────────────────────────────────────────┐
│ 📢 New Announcement                         │
├─────────────────────────────────────────────┤
│ Subject: [________________________]         │
│ Message: [________________________]         │
│          [________________________]         │
│                                             │
│ Send via:                                   │
│ ○ Email (default)  ○ WhatsApp               │
│ ○ In-App           ○ SMS (Coming Soon 🔒)   │
│                                             │
│ Send to:                                    │
│ ○ All Employees                             │
│ ○ Select Employees  [multi-select dropdown] │
│ ○ Task Group        [group selector]        │
│ ○ Task Assignees    [task selector]          │
│                                             │
│ [Attach File]                               │
│                                             │
│         [Cancel]  [📤 Send Announcement]    │
└─────────────────────────────────────────────┘
```

---

## 4️⃣ Permission & RBAC Integration

### New Permissions (added to existing 55+)

| Permission | Description | Default Roles |
|-----------|-------------|---------------|
| `page:tasks` | Access task management page | admin, hr, supervisor, employee |
| `tasks:view` | View tasks assigned to self | employee, supervisor |
| `tasks:create` | Create new tasks | admin, hr, supervisor |
| `tasks:assign` | Assign tasks to employees | admin, hr, supervisor |
| `tasks:verify` | Verify/reject completion reports | admin, hr, supervisor |
| `tasks:delete` | Delete tasks | admin |
| `tasks:manage_groups` | Create/edit/delete task groups | admin |
| `page:messages` | Access messaging hub | admin, hr, supervisor, employee |
| `messages:send_announcement` | Send broadcast announcements | admin, hr |
| `messages:manage_channels` | Create/archive text channels | admin |
| `messages:send_whatsapp` | Use WhatsApp channel | admin |
| `messages:send_email` | Use email channel | admin, hr |

### Customizable Group-Level Announcement Permissions

In addition to system RBAC, each `TaskGroup` has its own `announcementPermission`:

| Setting | Who Can Announce |
|---------|-----------------|
| `admin_only` | Only users with `messages:send_announcement` |
| `group_leads` | Group creator + users with `tasks:assign` |
| `all_members` | Any member of the group |

This lets the admin customize per-group who can broadcast — as the client requested.

---

## 5️⃣ Task Workflow State Machine

```
                  ┌──────────┐
                  │   OPEN   │  ← Admin creates task
                  └────┬─────┘
                       │ Employee starts
                       ▼
               ┌───────────────┐
               │  IN PROGRESS  │
               └───────┬───────┘
                       │ Employee submits photo+GPS
                       ▼
               ┌───────────────┐
          ┌────│   SUBMITTED   │────┐
          │    └───────────────┘    │
          │ Admin verifies          │ Admin rejects
          ▼                         ▼
    ┌──────────┐            ┌──────────┐
    │ VERIFIED │            │ REJECTED │
    │   (done) │            │(redo)    │──→ back to IN_PROGRESS
    └──────────┘            └──────────┘

    At any point:  Admin can → CANCELLED
```

---

## 6️⃣ Task Completion Photo+Location Flow

### Employee Side (Mobile-Friendly)

```
1. Employee opens task → clicks "Submit Report"
2. Camera opens (navigator.mediaDevices.getUserMedia)
   - Capture photo → store as base64 dataURL
3. GPS auto-captured (navigator.geolocation.getCurrentPosition)
   - Latitude, longitude, accuracy
4. (MVP) Reverse geocode: display coords as "14.5995°N, 120.9842°E"
   (Production: use Google Maps Geocoding API for human-readable address)
5. Employee adds notes (optional text field)
6. Submit → creates TaskCompletionReport
7. Task status moves: in_progress → submitted
8. Notification dispatched to admin/supervisor
```

### Admin Side (Review)

```
1. Admin sees task with "📷 Proof Submitted" indicator
2. Opens task detail → Completion Report panel
3. Views:
   - Photo (zoomable)
   - Map pin showing GPS location
   - Timestamp
   - Employee notes
4. Actions:
   - ✅ Verify → task status → verified
   - ❌ Reject (requires reason) → task status → rejected → employee redoes
```

---

## 7️⃣ Multi-Channel Delivery (Simulated)

### Channel Behavior in MVP

| Channel | MVP Behavior | UI |
|---------|-------------|-----|
| **Email** (default) | Log entry in `messaging.store` with `status: "simulated"` | ✉️ icon, shows "Sent via Email (simulated)" |
| **WhatsApp** | Log entry in `messaging.store` with `status: "simulated"` | 💬 icon, shows "Sent via WhatsApp (simulated)" |
| **SMS** | **Disabled** — shows "🔒 Coming Soon" badge, cannot select | 📱 icon grayed out |
| **In-App** | Real delivery — appears in notification center + announcement list | 🔔 icon, shows in-app immediately |

### Production Wiring (Future)

| Channel | Provider | Integration |
|---------|----------|------------|
| Email | Resend API | `POST /api/email/send` with Resend SDK |
| WhatsApp | Meta Cloud API (direct) | `POST /v17.0/{phone_id}/messages` |
| SMS | Semaphore | `POST /api/v4/messages` with Semaphore API key |
| In-App | Zustand store (same as MVP) | Already functional |

### Cost Summary (reference for client)

| Channel | Cost per Message (₱) | Monthly @ 500 msgs | Status |
|---------|---------------------|--------------------|----|
| Email | ₱0 (free under 3k/mo) | ₱0 | ✅ Default |
| WhatsApp | ₱0.71/conversation | ₱355 | ✅ Enabled |
| SMS | ₱0.50–₱1.00/SMS | ₱250–₱500 | 🔒 Coming Soon |
| In-App | ₱0 | ₱0 | ✅ Enabled |

---

## 8️⃣ Announcement Targeting System

### How Admin Selects Recipients

```
Scope: "all_employees"
  → Sends to every active employee

Scope: "selected_employees"
  → Admin picks from employee multi-select dropdown
  → Can search by name, department, role

Scope: "task_group"
  → Admin picks a TaskGroup
  → Auto-targets all memberEmployeeIds of that group

Scope: "task_assignees"
  → Admin picks a specific Task
  → Auto-targets all assignedTo employee IDs
```

### Per-Task Announcements

Admin can also send announcements directly from the task detail page:
- Button: "📢 Notify Assignees"
- Pre-fills scope as `task_assignees` + the task ID
- Admin just writes message + picks channel → send

---

## 9️⃣ Sidebar & Navigation Updates

### New Sidebar Items

```
📋 Tasks          → /[role]/tasks         (page:tasks permission)
💬 Messages       → /[role]/messages      (page:messages permission)
```

Inserted after "Projects" in sidebar order.

### Settings Integration

New sub-tab under Settings:

```
Settings
├── ... existing tabs ...
├── Messaging                    (admin only)
│   ├── Default channel selector (email/whatsapp/in_app)
│   ├── WhatsApp toggle + status ("simulated" badge)
│   ├── Email toggle + status ("simulated" badge)
│   ├── SMS toggle + "Coming Soon" badge
│   └── Provider config (for production)
└── Task Management              (admin only)
    ├── Default completion requirement (photo+GPS on/off)
    ├── Auto-assign notification settings
    └── Task group defaults
```

---

## 🔟 Seed Data Summary

### Task Groups (2)

| ID | Name | Project Link | Members | Announcement Perm |
|----|------|-------------|---------|-------------------|
| TG-001 | Field Operations | PRJ-xxx (existing) | 8 field employees | group_leads |
| TG-002 | Office Tasks | none | All employees | admin_only |

### Tasks (6)

| ID | Group | Title | Status | Assigned | Has Proof |
|----|-------|-------|--------|----------|-----------|
| TSK-001 | TG-001 | Site inspection – Makati | verified | EMP003 | ✅ Photo+GPS |
| TSK-002 | TG-001 | Delivery to BGC office | submitted | EMP005 | ✅ Photo+GPS |
| TSK-003 | TG-001 | Equipment check – Pasig | in_progress | EMP003, EMP007 | ❌ |
| TSK-004 | TG-002 | Prepare monthly report | open | EMP010 | ❌ |
| TSK-005 | TG-002 | Office supply inventory | open | EMP012, EMP015 | ❌ |
| TSK-006 | TG-001 | Safety audit – Taguig | rejected | EMP005 | ✅ (rejected) |

### Text Channels (3)

| ID | Name | Members |
|----|------|---------|
| CH-001 | #general | All employees |
| CH-002 | #field-ops | TG-001 members |
| CH-003 | #admin-hr | Admin + HR |

### Announcements (5)

| Channel | Scope | Subject |
|---------|-------|---------|
| email | all_employees | "March payslip released" |
| whatsapp | task_group (TG-001) | "Weather alert: postpone outdoor tasks" |
| email | selected_employees | "Training schedule update" |
| in_app | task_assignees (TSK-003) | "Equipment list attached" |
| whatsapp | all_employees | "Holiday reminder: March 10" |

---

## 1️⃣1️⃣ Implementation Order

### Step 1 — Types & Permissions
- [ ] Add all new types to `src/types/index.ts`
- [ ] Add new permissions to `Permission` union
- [ ] Add `whatsappNumber`, `preferredChannel` to `Employee` interface
- [ ] Update default role permissions in `roles.store.ts`

### Step 2 — Tasks Store
- [ ] Create `src/store/tasks.store.ts`
- [ ] Full CRUD for groups, tasks, completion reports, comments
- [ ] Task status workflow transitions
- [ ] Seed data (2 groups, 6 tasks, 2 completion reports, 4 comments)

### Step 3 — Messaging Store
- [ ] Create `src/store/messaging.store.ts`
- [ ] Announcements: send, read tracking
- [ ] Text channels: CRUD, messages, read tracking
- [ ] Channel config with defaults (email default, SMS disabled)
- [ ] Seed data (3 channels, 5 announcements, 10 messages)

### Step 4 — Tasks Page
- [ ] `/[role]/tasks/page.tsx` — Task board with kanban/list views
- [ ] Task group selector, create task dialog
- [ ] Bulk assign dialog (select all / specific employees / by group)
- [ ] Employee "My Tasks" view

### Step 5 — Task Detail Page
- [ ] `/[role]/tasks/[id]/page.tsx` — Full task detail
- [ ] Completion submission: camera + GPS + notes
- [ ] Admin review: photo viewer + map pin + verify/reject
- [ ] Comment thread

### Step 6 — Messages Page
- [ ] `/[role]/messages/page.tsx` — Messaging hub
- [ ] Sidebar: announcements section + channel list
- [ ] Announcement composer: subject, body, channel picker, scope selector
- [ ] Text channel chat view with message input
- [ ] SMS "Coming Soon" badge (disabled, grayed out)

### Step 7 — Sidebar & Settings
- [ ] Add Tasks + Messages to sidebar navigation
- [ ] Add Messaging settings tab (channel config, toggles)
- [ ] Add Task Management settings tab

### Step 8 — Integration & Polish
- [ ] Wire notification dispatch on task assignment
- [ ] Wire notification dispatch on completion submission
- [ ] Unread badge on Messages sidebar item
- [ ] Audit log entries for task/messaging actions
- [ ] Build verify (all routes compile)
- [ ] Tests for new stores

---

## 1️⃣2️⃣ File Inventory (New Files)

| File | Purpose |
|------|---------|
| `src/store/tasks.store.ts` | Task management store |
| `src/store/messaging.store.ts` | Messaging & announcements store |
| `src/app/[role]/tasks/page.tsx` | Task board page |
| `src/app/[role]/tasks/[id]/page.tsx` | Task detail page |
| `src/app/[role]/messages/page.tsx` | Messaging hub page |

**Modified files:**
- `src/types/index.ts` — New types + permissions
- `src/data/seed.ts` — Task + messaging seed data
- `src/store/roles.store.ts` — New permission defaults
- `src/store/employees.store.ts` — `whatsappNumber`, `preferredChannel` fields
- `src/components/shell/sidebar.tsx` — New nav items
- `src/app/[role]/settings/page.tsx` — Messaging + task settings tabs

---

## 1️⃣3️⃣ Testing Plan

| Test File | Covers |
|-----------|--------|
| `__tests__/tasks.store.test.ts` | Task CRUD, assignment, status workflow, completion reports |
| `__tests__/messaging.store.test.ts` | Announcements, channels, messages, read tracking |

**Key test scenarios:**

- Create task → assign → submit completion → verify → status = verified
- Create task → submit → reject with reason → status = rejected
- Send announcement to all employees → all marked as recipients
- Send to task group → only group members targeted
- SMS channel → disabled / cannot send
- Group announcement permission: admin_only blocks non-admin
- Unread count calculation across channels

---

> **Ready to build.** This plan covers all client requirements:
> ✅ Task management with groups and assignments
> ✅ Photo + GPS location proof on task completion
> ✅ Admin review/verify/reject workflow
> ✅ Multi-channel (Email default + WhatsApp + SMS coming soon)
> ✅ Customizable announcement permissions (per-group)
> ✅ Flexible targeting (all / selected / group / task assignees)
> ✅ In-app text channels
> ✅ RBAC integration with existing permission system
