# PM Activity Tracker - Quick Installation Guide

Follow these steps to get the extension up and running.

## Prerequisites

- Google Chrome browser
- Python 3.6 or higher
- Linux or macOS operating system
- Command line access

## Installation Steps

### 1. Install Native Messaging Host

```bash
cd pm-activity-extension/native-host
./install.sh
```

The installer will:
- Create `~/.pm-agent/` directory
- Copy the Python logging script
- Generate the native host manifest
- Display next steps

### 2. Load Extension in Chrome

1. Open Chrome
2. Go to `chrome://extensions`
3. Enable **Developer mode** (toggle in upper right)
4. Click **Load unpacked**
5. Navigate to and select the `pm-activity-extension` folder
6. **COPY THE EXTENSION ID** (looks like: `abcdefghijklmnopqrstuvwxyz123456`)

### 3. Configure Native Host

Edit the manifest file to add your Extension ID:

```bash
nano ~/.pm-agent/native-host/com.pm_agent.activity_logger.json
```

Replace `EXTENSION_ID_PLACEHOLDER` with the ID you copied in step 2.

**Example:**
```json
{
  "name": "com.pm_agent.activity_logger",
  "description": "PM Activity Logger - Writes activity logs to ~/.pm-agent/activity.jsonl",
  "path": "/home/user/.pm-agent/native-host/pm_activity_logger.py",
  "type": "stdio",
  "allowed_origins": [
    "chrome-extension://abcdefghijklmnopqrstuvwxyz123456/"
  ]
}
```

Save and exit (Ctrl+X, Y, Enter).

### 4. Create Native Host Symlink

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

### 5. Restart Chrome

**Important:** Completely quit and restart Chrome (not just close the window).

- **macOS**: Cmd+Q or Chrome menu → Quit
- **Linux**: Right-click Chrome in dock → Quit, or use `killall chrome`

### 6. Test the Extension

1. Click the extension icon in Chrome toolbar
2. Verify the popup shows "Tracking active"
3. Visit one of these supported sites:
   - Google Docs: https://docs.google.com
   - Slack: https://yourworkspace.slack.com
   - Jira: https://yourcompany.atlassian.net
   - Teams: https://teams.microsoft.com
   - Claude: https://claude.ai

4. Perform some activity (open a doc, view a channel, etc.)
5. Click the extension icon again
6. Click **Flush to PM Agent**
7. Check the output:
   ```bash
   cat ~/.pm-agent/activity.jsonl
   ```

You should see JSON lines with your activity!

## Troubleshooting

### Extension icon shows but stats are all 0

- Make sure you visited a supported site
- Check if content scripts are loaded (F12 → Console, look for "[PM Activity]" messages)
- Reload the extension in chrome://extensions

### "Native host not found" error when flushing

1. Verify symlink:
   ```bash
   ls -la ~/.config/google-chrome/NativeMessagingHosts/  # Linux
   ls -la ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/  # macOS
   ```

2. Check Extension ID matches in manifest:
   ```bash
   cat ~/.pm-agent/native-host/com.pm_agent.activity_logger.json
   ```

3. Verify Python script is executable:
   ```bash
   ls -la ~/.pm-agent/native-host/pm_activity_logger.py
   ```

4. Restart Chrome completely

### No activities appearing in activity.jsonl

1. Check debug log:
   ```bash
   tail -f ~/.pm-agent/native_host_debug.log
   ```

2. Test Python script directly:
   ```bash
   echo '{"action":"log_activities","activities":[{"type":"test"}]}' | \
     ~/.pm-agent/native-host/pm_activity_logger.py
   ```

3. Check if `~/.pm-agent/activity.jsonl` was created

### Need more help?

See the full README.md for detailed troubleshooting and development information.

## What Gets Tracked? (Phase 1)

- **Google Docs**: Opens, edits (with duration), closes
- **Slack**: Channel views, message sends (count only)
- **Jira**: Issue views, updates
- **Teams**: Chat views, meetings (with duration), messages
- **Claude.ai**: Conversation starts, messages, responses

**No content is captured** - only metadata and activity patterns!

## Next Steps

- Review the example output: `EXAMPLE_OUTPUT.jsonl`
- Read the full documentation: `README.md`
- Wait for Phase 2 for content capture with privacy controls

## Uninstalling

1. Remove extension from Chrome (chrome://extensions → Remove)
2. Remove native host:
   ```bash
   rm -rf ~/.pm-agent/native-host
   rm ~/.config/google-chrome/NativeMessagingHosts/com.pm_agent.activity_logger.json  # Linux
   rm ~/Library/Application\ Support/Google/Chrome/NativeMessagingHosts/com.pm_agent.activity_logger.json  # macOS
   ```
3. Optionally remove activity data:
   ```bash
   rm ~/.pm-agent/activity.jsonl
   ```
