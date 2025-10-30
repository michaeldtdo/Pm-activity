# Troubleshooting Guide

## Side Panel Not Opening

If the activity panel doesn't open when you click "Open Activity Panel", try these steps:

### 1. Check Chrome Version
- Open `chrome://version`
- Side Panel API requires Chrome 114 or higher
- Update Chrome if needed

### 2. Reload the Extension
- Go to `chrome://extensions`
- Find "PM Activity Tracker"
- Click the refresh icon (🔄)
- Try opening the panel again

### 3. Check Background Service Worker
- Go to `chrome://extensions`
- Find "PM Activity Tracker"
- Click "service worker" link under "Inspect views"
- Check Console tab for errors
- Look for message: `[PM Activity] Side panel configured on startup`

### 4. Check Popup Console
- Right-click the extension icon
- Select "Inspect popup"
- Click "Open Activity Panel" button
- Check Console tab for any errors

### 5. Try Keyboard Shortcut
- Press `Ctrl+Shift+P` (Windows/Linux)
- Press `Cmd+Shift+P` (Mac)
- This bypasses the popup and opens the panel directly

### 6. Verify Manifest Permissions
- Check that manifest.json includes:
  ```json
  "permissions": ["sidePanel"]
  ```
- And side_panel configuration:
  ```json
  "side_panel": {
    "default_path": "sidepanel.html"
  }
  ```

### 7. Check for File Issues
Verify these files exist in the extension directory:
- `sidepanel.html`
- `sidepanel.js`
- `popup.html`
- `popup.js`
- `background.js`
- `manifest.json`

### 8. Common Errors and Solutions

#### Error: "Side Panel not supported"
**Solution**: Update Chrome to version 114 or higher

#### Error: "Cannot read properties of undefined"
**Solution**:
1. Reload the extension
2. Check that all files are present
3. Verify manifest.json has correct permissions

#### Error: "Failed to open side panel"
**Solution**:
1. Try keyboard shortcut instead
2. Check background service worker console
3. Ensure `openPanelOnActionClick` is set correctly

#### Panel opens but shows blank
**Solution**:
1. Right-click in the panel → Inspect
2. Check Console for JavaScript errors
3. Verify sidepanel.js is loading
4. Check that Chrome storage permissions are granted

### 9. Clean Reinstall
If nothing works:
1. Go to `chrome://extensions`
2. Remove the extension completely
3. Close all Chrome windows
4. Reopen Chrome
5. Load the extension again
6. Try opening the panel

### 10. Development Mode Issues
Some Chrome policies restrict extensions in Developer Mode:
- Check your organization's Chrome policies
- Try on a personal Chrome profile
- Ensure "Developer mode" is enabled in `chrome://extensions`

## Native Messaging Issues

If activities aren't being saved to `~/.pm-agent/activity.jsonl`:

### Check Native Host Installation
```bash
# Linux/Mac
ls -la ~/.pm-agent/native-host/

# Windows
dir %USERPROFILE%\.pm-agent\native-host\
```

### Check Python Script
```bash
# Test Python script directly
python3 ~/.pm-agent/native-host/pm_activity_logger.py
```

### Check Debug Log
```bash
# Linux/Mac
tail -f ~/.pm-agent/native_host_debug.log

# Windows
type %USERPROFILE%\.pm-agent\native_host_debug.log
```

### Verify Registry (Windows Only)
```cmd
REG QUERY "HKCU\Software\Google\Chrome\NativeMessagingHosts\com.pm_agent.activity_logger"
```

## API Key Issues

### Claude API Key Not Saving
1. Check popup console for errors
2. Verify key format: must start with `sk-ant-`
3. Try re-entering the key

### Synthesis/Distill Fails
1. Verify API key is saved (check popup)
2. Check background service worker console
3. Verify internet connectivity
4. Check Claude API status: https://status.anthropic.com/

## Getting Help

If you're still having issues:

1. Check background service worker console:
   - Go to `chrome://extensions`
   - Click "service worker" under your extension
   - Copy any error messages

2. Check popup console:
   - Right-click extension icon → Inspect popup
   - Copy any error messages

3. Check side panel console (if it opens):
   - Right-click in the panel → Inspect
   - Copy any error messages

4. Include this information:
   - Chrome version (`chrome://version`)
   - Operating system
   - Extension version (from manifest.json)
   - All error messages from consoles
