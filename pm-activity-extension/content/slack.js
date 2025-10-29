// PM Activity Tracker - Slack Content Script
// Tracks channel views and message sends

(function() {
  'use strict';

  console.log('[PM Activity] Slack tracker initialized');

  let currentChannel = null;
  let currentChannelId = null;
  let workspace = null;
  let lastUrl = window.location.href;
  let messageCount = 0;

  // Extract workspace from hostname
  function extractWorkspace() {
    const hostname = window.location.hostname;
    const match = hostname.match(/^([^.]+)\.slack\.com$/);
    return match ? match[1] : hostname;
  }

  // Extract channel info from page
  function extractChannelInfo() {
    // Try to get channel name from various elements
    let channelName = null;
    let channelId = null;

    // Method 1: data-qa attribute
    const channelElement = document.querySelector('[data-qa="channel_name"]');
    if (channelElement) {
      channelName = channelElement.textContent.trim();
    }

    // Method 2: header title
    if (!channelName) {
      const headerElement = document.querySelector('[data-qa="channel-header-name"]');
      if (headerElement) {
        channelName = headerElement.textContent.trim();
      }
    }

    // Method 3: URL parsing
    if (!channelName) {
      const urlMatch = window.location.pathname.match(/\/archives\/([A-Z0-9]+)/);
      if (urlMatch) {
        channelId = urlMatch[1];
      }
    }

    // Method 4: Look for any channel identifier in URL
    if (!channelId && !channelName) {
      const pathMatch = window.location.pathname.match(/\/client\/[^/]+\/([A-Z0-9]+)/);
      if (pathMatch) {
        channelId = pathMatch[1];
      }
    }

    return { channelName, channelId };
  }

  // Send activity event to background
  function sendActivityEvent(type, data = {}) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_EVENT',
      event: {
        type,
        tool: 'slack',
        workspace,
        channel: currentChannel,
        channel_id: currentChannelId,
        ...data
      }
    }).catch(err => {
      console.error('[PM Activity] Error sending event:', err);
    });
  }

  // Handle channel view
  function handleChannelView() {
    const channelInfo = extractChannelInfo();

    // Only log if we have new channel info
    if (channelInfo.channelName !== currentChannel || channelInfo.channelId !== currentChannelId) {
      currentChannel = channelInfo.channelName;
      currentChannelId = channelInfo.channelId;

      if (currentChannel || currentChannelId) {
        console.log('[PM Activity] Channel viewed:', currentChannel || currentChannelId);
        sendActivityEvent('slack_channel_view');
      }
    }
  }

  // Handle message send
  function handleMessageSend() {
    messageCount++;
    console.log('[PM Activity] Message sent in channel:', currentChannel || currentChannelId);

    sendActivityEvent('slack_message', {
      message_count: messageCount
    });
  }

  // Detect message composition
  function setupMessageDetection() {
    let lastComposerContent = '';
    let composerCheckTimer = null;

    const checkComposer = () => {
      // Look for the message composer
      const composer = document.querySelector('[data-qa="message_input"]') ||
                       document.querySelector('[role="textbox"][data-qa*="composer"]') ||
                       document.querySelector('.ql-editor[role="textbox"]');

      if (composer) {
        const currentContent = composer.textContent || composer.innerText || '';

        // If content went from something to empty, likely a message was sent
        if (lastComposerContent.trim().length > 0 && currentContent.trim().length === 0) {
          console.log('[PM Activity] Detected message send (composer cleared)');
          handleMessageSend();
        }

        lastComposerContent = currentContent;
      }
    };

    // Check composer periodically
    composerCheckTimer = setInterval(checkComposer, 500);

    // Also listen for Enter key in composer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        if (target.matches('[data-qa="message_input"]') ||
            target.matches('[role="textbox"]') ||
            target.matches('.ql-editor')) {
          // Message might be sent, check after a delay
          setTimeout(checkComposer, 100);
        }
      }
    }, true);
  }

  // Watch for URL changes (channel switches)
  function watchUrlChanges() {
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[PM Activity] URL changed, checking for channel change');
        lastUrl = currentUrl;

        // Wait a bit for content to load
        setTimeout(handleChannelView, 1000);
      }
    }, 1000);
  }

  // Watch for DOM changes to detect channel info
  function watchDomChanges() {
    const observer = new MutationObserver(() => {
      handleChannelView();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check
    setTimeout(handleChannelView, 2000);
  }

  // Initialize
  function init() {
    workspace = extractWorkspace();
    console.log('[PM Activity] Workspace:', workspace);

    setupMessageDetection();
    watchUrlChanges();
    watchDomChanges();
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000); // Give Slack a moment to load
  }
})();
