# PM Activity Tracker - Chrome Extension

A Chrome extension (Manifest V3) that automatically tracks your PM work activity across multiple tools and integrates with your local PM agent CLI system.

## Current Status: Phase 1 - Core Activity Tracking

Phase 1 implements automatic activity tracking without content capture. Content capture with privacy controls will be added in Phase 2.

## Features (Phase 1)

### Supported Tools
- **Google Docs**: Track document opens, edits, and closes
- **Slack**: Track channel views and messages sent
- **Jira**: Track issue views and updates
- **Microsoft Teams**: Track chat views, meetings, and messages
- **Claude.ai**: Track conversation starts, messages, and responses

### What's Tracked
- Document/page views and switches
- Edit sessions with duration tracking
- Message sends (count only, no content)
- Meeting joins and durations
- Conversation activity

### Privacy
- **No content is captured in Phase 1** - only metadata and activity patterns
- All data stays local on your machine
- Data is written to `~/.pm-agent/activity.jsonl` via native messaging
- You have full control to clear all data at any time

## Architecture

```
┌─────────────────────────────────────────────────────────────┐
│                     Chrome Extension                         │
│                                                              │
│  ┌──────────────┐    ┌────────────────────────────────┐    │
│  │   Content    │───▶│    Background Service Worker   │    │
│  │   Scripts    │    │   - Event buffering (10 items) │    │
│  │              │    │   - Auto-flush (5 min timer)   │    │
│  │ • Docs       │    │   - Storage management         │    │
│  │ • Slack      │    │   - Native messaging           │    │
│  │ • Jira       │    └────────────┬───────────────────┘    │
│  │ • Teams      │                 │                         │
│  │ • Claude     │                 │                         │
│  └──────────────┘                 │                         │
│                                   │                         │
│  ┌──────────────┐                 │                         │
│  │  Popup UI    │◀────────────────┘                         │
│  │  - Stats     │                                           │
│  │  - Controls  │                                           │
│  └──────────────┘                                           │
└────────────────────────┬────────────────────────────────────┘
                         │ Native Messaging
                         ▼
              ┌──────────────────────┐
              │ Python Native Host   │
              │  pm_activity_logger  │
              └──────────┬───────────┘
                         │
                         ▼
              ~/.pm-agent/activity.jsonl
```

## Directory Structure

```
pm-activity-extension/
├── manifest.json                 # Extension manifest (V3)
├── background.js                 # Service worker
├── popup.html                    # Extension popup UI
├── popup.js                      # Popup logic
├── content/                      # Content scripts
│   ├── google-docs.js           # Google Docs tracker
│   ├── slack.js                 # Slack tracker
│   ├── jira.js                  # Jira tracker
│   ├── teams.js                 # Teams tracker
│   └── claude.js                # Claude.ai tracker
├── icons/                        # Extension icons
│   ├── icon16.png
│   ├── icon48.png
│   └── icon128.png
├── native-host/                  # Native messaging host
│   ├── pm_activity_logger.py   # Python script
│   ├── com.pm_agent.activity_logger.json  # Host manifest
│   └── install.sh               # Installation script
└── README.md                     # This file
```

## Installation

### Step 1: Install the Native Messaging Host

```bash
cd pm-activity-extension/native-host
./install.sh
```

This will:
- Copy the Python script to `~/.pm-agent/native-host/`
- Create the native host manifest
- Display instructions for completing the setup

### Step 2: Load the Extension in Chrome

1. Open Chrome and navigate to `chrome://extensions`
2. Enable **Developer mode** (toggle in top right)
3. Click **Load unpacked**
4. Select the `pm-activity-extension` directory
5. Copy the **Extension ID** that appears (you'll need this next)

### Step 3: Configure the Native Host Manifest

Edit `~/.pm-agent/native-host/com.pm_agent.activity_logger.json` and replace `EXTENSION_ID_PLACEHOLDER` with your actual Extension ID from Step 2.

Example:
```json
{
  "name": "com.pm_agent.activity_logger",
  "description": "PM Activity Logger",
  "path": "/home/user/.pm-agent/native-host/pm_activity_logger.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://abcdefghijklmnopqrstuvwxyz123456/"
  ]
}
```

### Step 4: Create Native Host Symlink

Chrome looks for native host manifests in a specific directory. Create a symlink:

**On Linux:**
```bash
mkdir -p ~/.config/google-chrome/NativeMessagingHosts
ln -sf ~/.pm-agent/native-host/com.pm_agent.activity_logger.json \
  ~/.config/google-chrome/NativeMessagingHosts/com.pm_agent.activity_logger.json
```

**On macOS:**
```bash
mkdir -p ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts
ln -sf ~/.pm-agent/native-host/com.pm_agent.activity_logger.json \
  ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.pm_agent.activity_logger.json
```

### Step 5: Restart Chrome

Completely quit and restart Chrome for the native messaging host to be recognized.

## Usage

### Automatic Tracking

Once installed, the extension automatically tracks your activity on supported sites:

1. Visit **Google Docs** - document opens, edits, and closes are logged
2. Use **Slack** - channel views and message sends are tracked
3. View **Jira** issues - issue views and updates are logged
4. Join **Teams** meetings - meetings and chats are tracked
5. Chat with **Claude.ai** - conversations are logged

### Viewing Stats

Click the extension icon to see:
- **Today**: Number of activities logged today
- **Total**: Total activities logged
- **Buffered**: Activities waiting to be flushed
- **Snippets**: Content snippets (Phase 2 only)

### Manual Flush

Activities are automatically flushed every 10 events or 5 minutes. To manually flush:

1. Click the extension icon
2. Click **Flush to PM Agent**

This sends all buffered activities to `~/.pm-agent/activity.jsonl`.

### Clearing Data

To clear all logged data:

1. Click the extension icon
2. Click **Clear All Data**
3. Confirm the action

## Activity Log Format

Activities are logged as JSON lines in `~/.pm-agent/activity.jsonl`:

### Google Docs Example
```json
{
  "timestamp": "2025-10-29T14:30:00.000Z",
  "type": "doc_open",
  "tool": "google_docs",
  "doc_id": "1abc...xyz",
  "doc_title": "Product Roadmap Q4 2025",
  "tab_id": 12345,
  "tab_url": "https://docs.google.com/document/d/1abc...xyz/edit"
}
```

### Slack Example
```json
{
  "timestamp": "2025-10-29T14:35:00.000Z",
  "type": "slack_message",
  "tool": "slack",
  "workspace": "mycompany",
  "channel": "product-team",
  "message_count": 3,
  "tab_id": 12346,
  "tab_url": "https://mycompany.slack.com/..."
}
```

### Teams Meeting Example
```json
{
  "timestamp": "2025-10-29T15:00:00.000Z",
  "type": "teams_meeting_end",
  "tool": "teams",
  "meeting_title": "Bank Connect Planning",
  "duration_seconds": 2700,
  "chat_name": "Product Team",
  "tab_id": 12347
}
```

### Jira Example
```json
{
  "timestamp": "2025-10-29T16:00:00.000Z",
  "type": "jira_issue_view",
  "tool": "jira",
  "issue_key": "PROJ-123",
  "issue_summary": "Implement Bank Connect API",
  "project_name": "Bank Integration",
  "tab_id": 12348
}
```

### Claude.ai Example
```json
{
  "timestamp": "2025-10-29T17:00:00.000Z",
  "type": "claude_user_message",
  "tool": "claude",
  "chat_id": "abc123-def456-...",
  "tab_id": 12349
}
```

## Troubleshooting

### Extension loads but no activity is logged

1. Check that you're on a supported site
2. Open the extension popup to see stats
3. Check Chrome DevTools console for errors
   - Right-click the extension icon → Inspect popup
   - Or visit a supported site and check the page console

### "Native host not found" error

1. Verify the native host is installed: `ls -la ~/.pm-agent/native-host/`
2. Check the symlink exists:
   - Linux: `ls -la ~/.config/google-chrome/NativeMessagingHosts/`
   - macOS: `ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/`
3. Verify the Extension ID in the manifest matches your actual ID
4. Restart Chrome completely

### Activities not appearing in activity.jsonl

1. Check the debug log: `tail -f ~/.pm-agent/native_host_debug.log`
2. Try manually flushing from the popup
3. Verify Python script is executable: `ls -la ~/.pm-agent/native-host/pm_activity_logger.py`
4. Test the Python script manually:
   ```bash
   echo '{"action":"log_activities","activities":[{"type":"test","tool":"manual"}]}' | \
     ~/.pm-agent/native-host/pm_activity_logger.py
   ```

### Content scripts not running

1. Check the site URL matches the permissions in manifest.json
2. Reload the extension in chrome://extensions
3. Hard refresh the webpage (Cmd+Shift+R or Ctrl+Shift+R)
4. Check for JavaScript errors in the page console

## Development

### Testing Content Scripts

Each content script logs to the browser console. To see debug output:

1. Visit a supported site
2. Open DevTools (F12)
3. Check the Console tab for `[PM Activity]` messages

### Testing Background Script

1. Go to `chrome://extensions`
2. Find the extension and click **Service worker**
3. Check console for `[PM Activity]` messages

### Testing Native Messaging

1. Check debug log: `tail -f ~/.pm-agent/native_host_debug.log`
2. Use the popup to manually flush
3. Verify activities appear in `~/.pm-agent/activity.jsonl`

### Modifying Content Scripts

After editing any content script:

1. Go to `chrome://extensions`
2. Click the reload icon on the extension
3. Hard refresh any open tabs with the modified site

## Roadmap: Phase 2 - Content Capture

Phase 2 will add intelligent content capture with full privacy controls:

### Content Capture Scripts
- `teams-capture.js`: Detect decisions, action items, meeting notes
- `google-docs-capture.js`: Capture highlighted sections with @pm-agent comments
- `slack-capture.js`: Detect decision/action patterns

### Enhanced UI
- Master toggle for content capture (OFF by default)
- Individual toggles per tool
- Individual toggles per content type (decisions, actions, meetings)
- Warning indicators when capture is enabled
- Snippets viewer page

### Detection Patterns
- **Decisions**: "we decided to...", "let's go with...", "decision:"
- **Action Items**: "action item:", "@user please", "will follow up by..."
- **Meeting Notes**: Structured notes, summaries

### Privacy Controls
- Capture disabled by default
- Granular per-tool and per-type controls
- Visual warnings when active
- Easy pause/clear options
- Max snippet length limits

## License

MIT License - See LICENSE file for details

## Contributing

This is a personal PM productivity tool. Contributions welcome!

1. Fork the repository
2. Create a feature branch
3. Test thoroughly
4. Submit a pull request

## Support

For issues or questions:
1. Check the Troubleshooting section above
2. Review debug logs in `~/.pm-agent/native_host_debug.log`
3. Open an issue with details about your setup and the problem
