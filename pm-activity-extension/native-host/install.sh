#!/bin/bash
# PM Activity Tracker - Native Host Installation Script
# This script installs the native messaging host for Chrome

set -e

echo "PM Activity Tracker - Native Host Installer"
echo "============================================"
echo ""

# Get the directory where this script is located
SCRIPT_DIR="$( cd "$( dirname "${BASH_SOURCE[0]}" )" && pwd )"
NATIVE_HOST_SCRIPT="$SCRIPT_DIR/pm_activity_logger.py"
MANIFEST_TEMPLATE="$SCRIPT_DIR/com.pm_agent.activity_logger.json"

# Ensure ~/.pm-agent directory exists
PM_AGENT_DIR="$HOME/.pm-agent"
NATIVE_HOST_DIR="$PM_AGENT_DIR/native-host"

echo "Creating directories..."
mkdir -p "$NATIVE_HOST_DIR"

# Copy native host script
echo "Installing native host script..."
cp "$NATIVE_HOST_SCRIPT" "$NATIVE_HOST_DIR/pm_activity_logger.py"
chmod +x "$NATIVE_HOST_DIR/pm_activity_logger.py"

# Create manifest with correct path
MANIFEST_FILE="$NATIVE_HOST_DIR/com.pm_agent.activity_logger.json"
echo "Creating native host manifest..."

# Read template and replace path placeholder
sed "s|PLACEHOLDER_PATH|$NATIVE_HOST_DIR|g" "$MANIFEST_TEMPLATE" > "$MANIFEST_FILE"

echo ""
echo "Native host installed to: $NATIVE_HOST_DIR"
echo ""
echo "IMPORTANT: You need to complete the installation:"
echo ""
echo "1. Load the extension in Chrome (chrome://extensions)"
echo "   - Enable 'Developer mode'"
echo "   - Click 'Load unpacked'"
echo "   - Select: $SCRIPT_DIR/.."
echo ""
echo "2. Copy the Extension ID from Chrome"
echo ""
echo "3. Update the manifest with your Extension ID:"
echo "   Edit: $MANIFEST_FILE"
echo "   Replace 'EXTENSION_ID_PLACEHOLDER' with your actual Extension ID"
echo ""
echo "4. Create a symlink for Chrome to find the native host:"
echo ""

# Detect OS and provide appropriate instructions
if [[ "$OSTYPE" == "linux-gnu"* ]]; then
    CHROME_NATIVE_DIR="$HOME/.config/google-chrome/NativeMessagingHosts"
    echo "   For Linux:"
    echo "   mkdir -p $CHROME_NATIVE_DIR"
    echo "   ln -sf $MANIFEST_FILE $CHROME_NATIVE_DIR/com.pm_agent.activity_logger.json"
elif [[ "$OSTYPE" == "darwin"* ]]; then
    CHROME_NATIVE_DIR="$HOME/Library/Application Support/Google/Chrome/NativeMessagingHosts"
    echo "   For macOS:"
    echo "   mkdir -p \"$CHROME_NATIVE_DIR\""
    echo "   ln -sf $MANIFEST_FILE \"$CHROME_NATIVE_DIR/com.pm_agent.activity_logger.json\""
else
    echo "   For your OS, consult Chrome's native messaging documentation"
fi

echo ""
echo "5. Restart Chrome completely"
echo ""
echo "6. Test the connection by:"
echo "   - Opening the extension popup"
echo "   - Visiting a supported site (Google Docs, Slack, etc.)"
echo "   - Clicking 'Flush to PM Agent' in the popup"
echo "   - Check ~/.pm-agent/activity.jsonl for logged activities"
echo ""
echo "Debug logs will be written to: ~/.pm-agent/native_host_debug.log"
echo ""
