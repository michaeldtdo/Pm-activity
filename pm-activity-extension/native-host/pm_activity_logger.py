#!/usr/bin/env python3
"""
PM Activity Logger - Native Messaging Host
Receives activity logs from Chrome extension and writes to ~/.pm-agent/activity.jsonl
"""

import sys
import json
import struct
import os
from pathlib import Path
from datetime import datetime


def get_message():
    """Read a message from stdin using Chrome native messaging protocol."""
    # Read the message length (first 4 bytes)
    raw_length = sys.stdin.buffer.read(4)

    if not raw_length:
        sys.exit(0)

    message_length = struct.unpack('=I', raw_length)[0]

    # Read the message content
    message = sys.stdin.buffer.read(message_length).decode('utf-8')

    return json.loads(message)


def send_message(message_dict):
    """Send a message to stdout using Chrome native messaging protocol."""
    message_json = json.dumps(message_dict)
    message_bytes = message_json.encode('utf-8')

    # Write message length (4 bytes)
    sys.stdout.buffer.write(struct.pack('=I', len(message_bytes)))

    # Write message content
    sys.stdout.buffer.write(message_bytes)
    sys.stdout.buffer.flush()


def ensure_pm_agent_dir():
    """Ensure ~/.pm-agent directory exists."""
    pm_agent_dir = Path.home() / '.pm-agent'
    pm_agent_dir.mkdir(exist_ok=True)
    return pm_agent_dir


def log_activities(activities):
    """Write activities to ~/.pm-agent/activity.jsonl."""
    pm_agent_dir = ensure_pm_agent_dir()
    activity_file = pm_agent_dir / 'activity.jsonl'

    logged_count = 0

    try:
        with open(activity_file, 'a') as f:
            for activity in activities:
                # Ensure timestamp is present
                if 'timestamp' not in activity:
                    activity['timestamp'] = datetime.utcnow().isoformat() + 'Z'

                # Write as JSON line
                f.write(json.dumps(activity) + '\n')
                logged_count += 1

        return True, logged_count, None

    except Exception as e:
        return False, 0, str(e)


def main():
    """Main loop for native messaging host."""
    # Log to a debug file for troubleshooting
    debug_file = Path.home() / '.pm-agent' / 'native_host_debug.log'

    try:
        ensure_pm_agent_dir()

        with open(debug_file, 'a') as debug:
            debug.write(f"\n[{datetime.now().isoformat()}] Native host started\n")

        while True:
            # Read message from extension
            message = get_message()

            with open(debug_file, 'a') as debug:
                debug.write(f"[{datetime.now().isoformat()}] Received: {json.dumps(message)}\n")

            # Handle message
            if message.get('action') == 'log_activities':
                activities = message.get('activities', [])

                success, logged_count, error = log_activities(activities)

                # Send response
                response = {
                    'success': success,
                    'logged': logged_count
                }

                if error:
                    response['error'] = error

                send_message(response)

                with open(debug_file, 'a') as debug:
                    debug.write(f"[{datetime.now().isoformat()}] Logged {logged_count} activities\n")

            else:
                # Unknown action
                send_message({
                    'success': False,
                    'error': f"Unknown action: {message.get('action')}"
                })

    except Exception as e:
        with open(debug_file, 'a') as debug:
            debug.write(f"[{datetime.now().isoformat()}] Error: {str(e)}\n")

        # Try to send error response
        try:
            send_message({
                'success': False,
                'error': str(e)
            })
        except:
            pass


if __name__ == '__main__':
    main()
