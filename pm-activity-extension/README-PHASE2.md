# PM Activity Tracker - Phase 2: Live Staging & AI Synthesis

## What's New in Phase 2

Phase 2 transforms the PM Activity Tracker from a simple logger into an intelligent work assistant with:

- **Live Activity Staging**: See all activities in a side panel as they happen
- **Manual Editing**: Review, edit, and enhance auto-captured activities
- **Manual Entry**: Fill gaps with offline meetings, file work, and decisions
- **AI-Powered Synthesis**: Transform raw activities into structured context updates using Claude
- **Export & Download**: Save context updates locally and send to PM agent

## Complete Workflow

```
1. Work across tools → 2. Activities appear in side panel →
3. Review/edit/add entries → 4. Click "Process with AI" →
5. Review generated context → 6. Download & Export →
7. Context sent to PM agent
```

## New Features

### 1. Side Panel Interface

**Open the side panel:**
- Click extension icon → "Open Activity Panel"
- Or use keyboard shortcut: **Ctrl+Shift+P** (Mac: **Cmd+Shift+P**)

**Side panel shows:**
- **Live activity feed**: All captured activities in real-time
- **Color-coded cards**:
  - Blue border = Auto-captured (draft)
  - Yellow border = Manually edited
  - Purple border = Manual entry
  - Green border = Processed
- **Activity stats**: Draft, Edited, and Total counts
- **Quick actions**: Process with AI, Clear Processed

### 2. Activity Management

**Edit Activities:**
1. Click **Edit** on any activity card
2. Modify title and details inline
3. Click **Save** to update

**Delete Activities:**
1. Click **Delete** on any activity card
2. Confirm deletion
3. Activity removed from staging

**Activity Cards Display:**
- Time (e.g., "2:30 PM" or "5 min ago")
- Tool badge (Google Docs, Slack, Jira, Teams, Claude)
- Status badge (Draft, Edited, Processed)
- Title and relevant details
- Content snippets (if captured)

### 3. Manual Entry

**Add Manual Activities:**
1. Click **"Add Manual Entry"** card at top of feed
2. Fill in the modal:
   - **Type**: Meeting, Document Work, Decision, Task, or Other
   - **Title**: Brief description
   - **Details**: Additional notes, outcomes, or context
   - **When**: Date and time (defaults to now)
3. Click **Save**

**Use cases for manual entry:**
- Offline meetings or phone calls
- File work outside tracked tools
- Decisions made in person
- Tasks or action items identified
- Context that wasn't auto-captured

### 4. AI-Powered Context Synthesis

**Prerequisites:**
1. Configure Claude API key in extension popup
2. Have activities in staging (at least 1)

**How to use:**
1. Click **"🤖 Process with AI"** in side panel header
2. Wait for AI to analyze activities (usually 5-10 seconds)
3. Review the generated markdown context in preview modal
4. Click **"Download & Export"** to save and send to PM agent

**What the AI generates:**
```markdown
## 📊 Daily Summary
Brief overview of the day's work

## 🎯 Key Activities
### Meetings
- Listed with outcomes and decisions

### Documents
- Documents worked on with changes

### Team Communication
- Important Slack/Teams discussions

### Issue/Project Work
- Jira issues or project tasks

## 💡 Key Decisions
Important decisions with rationale

## 📋 Action Items
Follow-up tasks with deadlines

## 📝 Suggested Context Updates
Files to update based on today's work
```

### 5. Export & Integration

**When you click "Download & Export":**

1. **Local Download**: Markdown file saved to Downloads folder
   - Filename: `context-update-YYYY-MM-DD.md`
   - Pure markdown, ready to copy/paste

2. **PM Agent Export**: Context sent to `~/.pm-agent/context-updates/`
   - Native messaging sends file to local PM agent
   - PM agent can auto-apply suggested updates
   - Logged for future reference

3. **Activity Processing**: All activities marked as "Processed"
   - Can be cleared later with "Clear Processed" button
   - Archived for history

## Configuration

### Claude API Key Setup

1. Get API key from [Anthropic Console](https://console.anthropic.com/)
2. Click extension icon
3. Paste key in "Claude API Key" field
4. Click "Save API Key"
5. Key is stored locally in extension storage

**API Key Format:**
```
sk-ant-api03-...
```

### Extension Settings

Available in popup:
- **Claude API Key**: Required for AI synthesis
- **Activity Stats**: Staging count and today's activity count
- **Open Panel Button**: Quick access to side panel

## Technical Details

### Activity Data Structure

Each activity in staging:

```javascript
{
  id: "1730304000_abc123",           // Unique ID
  timestamp: "2025-10-30T14:30:00.000Z",
  status: "draft" | "edited" | "processed",
  manual: false,                      // true for manual entries
  type: "doc_edit" | "meeting" | etc.,
  tool: "google_docs" | "slack" | etc.,
  data: {
    title: "Document title",
    duration_seconds: 1800,
    // Tool-specific fields...
  },
  snippet: "Content if captured",   // Optional
  lastModified: "2025-10-30T14:35:00.000Z"
}
```

### Storage Schema

Chrome local storage contains:

```javascript
{
  stagingActivities: [...],          // Activities in staging
  archive: [...],                    // Processed batches
  captureSettings: {...},            // Capture preferences
  claudeApiKey: "sk-ant-...",       // API key for synthesis
  lastSyncTime: "2025-10-30T14:30:00.000Z"
}
```

### AI Synthesis Process

1. **Filter Activities**: Get activities for selected time range (today, last 24h, etc.)
2. **Format for AI**: Convert to structured text with all relevant details
3. **Send to Claude API**: Use Claude Sonnet 4.5 for synthesis
4. **Generate Markdown**: AI creates structured context update
5. **Return to User**: Display in preview modal

**Claude API Call:**
- Model: `claude-sonnet-4-5-20250929`
- Max Tokens: 4096
- Input: Formatted activity list with timestamps and details
- Output: Structured markdown document

### Native Messaging

**New Action: `export_context`**

```javascript
// Request
{
  action: "export_context",
  context: "# Daily Context Update\n...",
  filename: "context-update-2025-10-30.md"
}

// Response
{
  success: true,
  path: "/home/user/.pm-agent/context-updates/context-update-2025-10-30.md"
}
```

**Directory Structure:**
```
~/.pm-agent/
├── activity.jsonl                 # Raw activity log
├── context-updates/               # Synthesized contexts (NEW)
│   ├── context-update-2025-10-30.md
│   ├── context-update-2025-10-31.md
│   └── ...
└── native_host_debug.log          # Debug log
```

## UI Components

### Side Panel Layout

```
┌─────────────────────────────────┐
│ Activity Staging                │
│ ┌───────────────────┐  Today   │
│ │ 0    0    0      │           │
│ │ Draft Edited Total│           │
│ └───────────────────┘           │
│ [🤖 Process] [Clear Processed] │
├─────────────────────────────────┤
│ ┌───────────────────────────┐   │
│ │ ➕ Add Manual Entry       │   │
│ └───────────────────────────┘   │
│                                 │
│ ┌─────────────────┐ 2:30 PM    │
│ │ 📄 Q4 Roadmap   │ DOCS DRAFT │
│ │ Edited for 45min│            │
│ │ [Edit] [Delete] │            │
│ └─────────────────┘            │
│                                 │
│ ┌─────────────────┐ 3:00 PM    │
│ │ 📞 Bank Connect │ TEAMS      │
│ │ Planning        │ MANUAL     │
│ │ Duration: 90min │            │
│ │ [Edit] [Delete] │            │
│ └─────────────────┘            │
│                                 │
│ ...more activities...           │
└─────────────────────────────────┘
```

### Synthesis Modal

```
┌─────────────────────────────────────┐
│ Context Update Preview              │
│                                     │
│ 15 activities processed | 850 words│
│                                     │
│ ┌─────────────────────────────────┐│
│ │ # Daily Context Update          ││
│ │ ## October 30, 2025             ││
│ │                                 ││
│ │ ### 📊 Summary                  ││
│ │ Focused on Bank Connect...      ││
│ │                                 ││
│ │ ### 🎯 Key Activities           ││
│ │ ...                             ││
│ └─────────────────────────────────┘│
│                                     │
│ [Cancel] [Download & Export]       │
└─────────────────────────────────────┘
```

## Keyboard Shortcuts

| Shortcut | Action |
|----------|--------|
| **Ctrl/Cmd+Shift+P** | Open side panel |
| **Escape** | Close modal |
| **Ctrl/Cmd+Enter** | Save (in edit mode) |

## Troubleshooting

### Side panel doesn't open
- **Check Chrome version**: Side Panel API requires Chrome 114+
- **Update Chrome**: `chrome://settings/help`
- **Try keyboard shortcut**: Ctrl+Shift+P

### AI synthesis fails
- **Check API key**: Ensure valid Claude API key is configured
- **Check format**: Key should start with `sk-ant-`
- **Check console**: Open DevTools (F12) and check for errors
- **Try again**: Click "Process with AI" again

### Export fails but synthesis works
- **Check permissions**: Ensure native messaging host is installed
- **Check manifest**: Extension ID must match in native host manifest
- **Check debug log**: `tail -f ~/.pm-agent/native_host_debug.log`
- **Manual download**: The markdown file is still downloaded to Downloads

### Activities not appearing in side panel
- **Reload panel**: Close and reopen side panel
- **Check storage**: DevTools → Application → Storage → Local Storage
- **Check background**: DevTools → Service Workers → Inspect

## Best Practices

### Daily Workflow

**Morning:**
1. Open side panel (Ctrl+Shift+P)
2. Keep it open while working
3. Activities accumulate as you work

**Throughout Day:**
- Add manual entries for offline work
- Edit auto-captured activities for clarity
- Add context to important meetings/decisions

**End of Day:**
1. Review all activities in side panel
2. Edit any that need clarification
3. Click "Process with AI"
4. Review generated context
5. Click "Download & Export"
6. Context saved to PM agent

**Weekly:**
- Clear processed activities to keep panel clean
- Review exported contexts in `~/.pm-agent/context-updates/`

### Manual Entry Tips

**Good manual entry:**
```
Type: Meeting
Title: Bank Connect Launch Planning
Details: Discussed launch date with Sarah. Decided to move to Nov 15 to allow
time for partnership finalization. Action: I'll update stakeholders by EOD.
When: Oct 30, 2025 2:00 PM
```

**Less useful:**
```
Type: Other
Title: Meeting
Details: Talked about stuff
```

### Editing Auto-Captured Activities

**Add context:**
- Original: "Document Edited"
- Better: "Q4 Platform Strategy - Added State Digital integration section"

**Add outcomes:**
- Original: "Teams Meeting Ended"
- Better: "Redis Migration Review - Decided to delay 2 sprints for testing"

## Advanced Usage

### Custom Time Ranges

Currently supports "today" by default. Future versions will add:
- Last 24 hours
- Last 7 days
- Custom date range

### Batch Processing

1. Let activities accumulate over several days
2. Process all at once for weekly summary
3. Export to weekly context update file

### Integration with PM Agent

The PM agent (separate tool) can:
1. Read exported contexts from `~/.pm-agent/context-updates/`
2. Parse suggested file updates
3. Apply updates to context files automatically or with confirmation
4. Maintain history of context changes

## Privacy & Security

### Data Storage

- **Local only**: All data stored in Chrome local storage
- **No cloud**: Activities never sent to external servers except Claude API
- **Claude API**: Only sent when you explicitly click "Process with AI"
- **API key**: Stored locally in extension, never transmitted except to Anthropic

### Data Lifecycle

1. **Capture**: Activity logged to staging and activity.jsonl
2. **Staging**: Kept in local storage until processed
3. **Processing**: Sent to Claude API for synthesis
4. **Export**: Markdown saved locally
5. **Archive**: Processed activities moved to archive
6. **Clear**: User can clear processed activities anytime

### What's Sent to Claude API

Only when you click "Process with AI":
- Activity types (e.g., "doc_edit", "meeting")
- Titles and summaries
- Durations and timestamps
- Tool names (e.g., "Google Docs", "Slack")
- Details you added in edits or manual entries

**NOT sent:**
- Full message contents (unless you manually entered them)
- User names or email addresses
- Private URLs or IDs
- Any data you haven't explicitly added

## Examples

### Example: Full Day Workflow

**9:00 AM** - Open Google Doc "Q4 Platform Strategy"
```
Auto-captured:
📄 Q4 Platform Strategy (Google Docs)
Edited for 45 min
```

**10:00 AM** - Edit activity to add context
```
Edited to:
📄 Q4 Platform Strategy - Added State Digital Integration Section
Added timeline for Q1 2026 deliverables
Duration: 45 min
```

**11:00 AM** - Offline meeting (manual entry)
```
Type: Meeting
Title: Bank Connect Launch Planning
Details: Discussed launch with Sarah. Moving to Nov 15 for partnership time.
When: 11:00 AM
```

**2:00 PM** - Slack discussion (auto-captured)
```
Auto-captured:
💬 Slack: #product channel
8 messages sent
```

**4:00 PM** - Add manual decision
```
Type: Decision
Title: Redis Migration Delay
Details: After engineering review, decided to delay 2 sprints for comprehensive
testing per QA recommendations.
When: 4:00 PM
```

**5:30 PM** - Process with AI
```
Click "Process with AI"
→ AI generates comprehensive context update
→ Click "Download & Export"
→ Saved to ~/.pm-agent/context-updates/context-update-2025-10-30.md
```

### Example: Generated Context

```markdown
# Daily Context Update
## October 30, 2025

### 📊 Summary
Focused on Q4 platform strategy documentation and Bank Connect launch planning.
Made key decision to delay Redis migration for proper testing. Active discussions
in #product channel about State Digital integration.

### 🎯 Key Activities

#### Meetings (1 meeting, 1 hour)
- **Bank Connect Launch Planning** (11:00 AM)
  - Discussed timeline with Sarah
  - Decision: Move launch to Nov 15 for partnership finalization
  - Allows adequate time for partner onboarding

#### Documents Worked On
- **Q4 Platform Strategy** (45 min, 9:00 AM)
  - Added State Digital integration section
  - Updated timeline for Q1 2026 deliverables
  - Outlined technical approach and milestones

#### Team Communication
- **#product Channel** (8 messages throughout day)
  - Discussions about State Digital API integration
  - Reviewed partnership requirements

### 💡 Key Decisions

1. **Bank Connect Launch Date**: Moved to November 15
   - Rationale: Need additional time for partnership finalization
   - Impact: Allows proper partner onboarding and reduces launch risk

2. **Redis Migration Delay**: Postponed by 2 sprints
   - Rationale: QA team needs comprehensive testing coverage
   - Impact: Better quality assurance, reduced production risk

### 📋 Action Items

- [ ] Update stakeholders on Bank Connect Nov 15 launch date (due: today)
- [ ] Create detailed State Digital API integration plan (due: this week)
- [ ] Coordinate with QA on Redis migration test plan (due: Friday)

### 📝 Suggested Context Updates

- `work/bank-connect-epic.md` → Update launch date to November 15
- `work/q4-platform-strategy.md` → Add State Digital integration section
- `decisions/2025-10-30-redis-delay.md` → Document migration delay decision
- `backlog/state-digital-api.md` → Create new integration task breakdown
```

## Roadmap

### Phase 3 (Future)

- **Smart Capture**: Better content detection in Slack/Teams
- **Templates**: Custom context templates for different workflows
- **Integrations**: Export to Notion, Linear, Jira
- **Analytics**: Weekly/monthly activity trends
- **Collaboration**: Share context updates with team
- **Mobile**: Activity capture on mobile browsers

### Requested Features

Vote for features you'd like to see:
- Time range selection (last 24h, last week, custom)
- Activity search and filtering
- Tags and categories for activities
- Recurring manual entries (daily standups, etc.)
- Export formats (JSON, CSV, PDF)
- Integration with calendar for meeting context

## Support

### Getting Help

1. Check this documentation
2. Review troubleshooting section
3. Check debug log: `~/.pm-agent/native_host_debug.log`
4. Open issue on GitHub with:
   - Chrome version
   - Extension version
   - Error messages
   - Steps to reproduce

### Contributing

Contributions welcome! Areas to help:
- Content detection improvements
- UI/UX enhancements
- Additional tool integrations
- Documentation improvements
- Bug fixes

## License

MIT License - See LICENSE file

---

**Version**: 2.0.0 (Phase 2)
**Last Updated**: October 2025
**Requires**: Chrome 114+, Python 3.6+
