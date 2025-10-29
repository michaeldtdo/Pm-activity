// PM Activity Tracker - Microsoft Teams Content Script
// Tracks chat views, meetings, and message sends

(function() {
  'use strict';

  console.log('[PM Activity] Teams tracker initialized');

  let currentChatName = null;
  let currentChatId = null;
  let inMeeting = false;
  let meetingStartTime = null;
  let meetingTitle = null;
  let lastUrl = window.location.href;
  let messageCount = 0;

  // Extract chat information
  function extractChatInfo() {
    let chatName = null;
    let chatId = null;

    // Try various selectors for chat name/title
    const selectors = [
      '[data-tid="chat-pane-header"]',
      '[data-tid="channel-header-title"]',
      '.ts-calling-thread-header',
      'h2[role="heading"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        chatName = element.textContent.trim();
        break;
      }
    }

    // Extract chat ID from URL
    const urlMatch = window.location.pathname.match(/\/conversations\/([^/]+)/);
    if (urlMatch) {
      chatId = urlMatch[1];
    }

    return { chatName, chatId };
  }

  // Check if in a meeting/call
  function checkMeetingStatus() {
    const meetingSelectors = [
      '[data-tid="calling-screen"]',
      '.calling-stage',
      '[data-tid="callingStage"]',
      '.ts-calling-screen'
    ];

    for (const selector of meetingSelectors) {
      if (document.querySelector(selector)) {
        return true;
      }
    }

    return false;
  }

  // Get meeting title
  function getMeetingTitle() {
    const selectors = [
      '[data-tid="calling-thread-title"]',
      '.calling-thread-header h2',
      '[data-tid="callingHeader"] h2'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Send activity event to background
  function sendActivityEvent(type, data = {}) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_EVENT',
      event: {
        type,
        tool: 'teams',
        chat_name: currentChatName,
        chat_id: currentChatId,
        ...data
      }
    }).catch(err => {
      console.error('[PM Activity] Error sending event:', err);
    });
  }

  // Handle chat view
  function handleChatView() {
    const chatInfo = extractChatInfo();

    // Only log if we have new chat info
    if (chatInfo.chatName !== currentChatName || chatInfo.chatId !== currentChatId) {
      currentChatName = chatInfo.chatName;
      currentChatId = chatInfo.chatId;

      if (currentChatName || currentChatId) {
        console.log('[PM Activity] Chat viewed:', currentChatName || currentChatId);
        sendActivityEvent('teams_chat_view');
      }
    }
  }

  // Handle meeting join
  function handleMeetingJoin() {
    if (!inMeeting) {
      inMeeting = true;
      meetingStartTime = Date.now();
      meetingTitle = getMeetingTitle() || currentChatName;

      console.log('[PM Activity] Meeting joined:', meetingTitle);
      sendActivityEvent('teams_meeting_join', {
        meeting_title: meetingTitle
      });
    }
  }

  // Handle meeting end
  function handleMeetingEnd() {
    if (inMeeting) {
      inMeeting = false;
      const duration = Math.floor((Date.now() - meetingStartTime) / 1000);

      console.log('[PM Activity] Meeting ended, duration:', duration, 'seconds');
      sendActivityEvent('teams_meeting_end', {
        meeting_title: meetingTitle,
        duration_seconds: duration
      });

      meetingTitle = null;
    }
  }

  // Handle message send
  function handleMessageSend() {
    messageCount++;
    console.log('[PM Activity] Message sent in chat:', currentChatName || currentChatId);

    sendActivityEvent('teams_message_sent', {
      message_count: messageCount
    });
  }

  // Detect message composition and sending
  function setupMessageDetection() {
    let lastComposerContent = '';

    const checkComposer = () => {
      // Look for the message composer
      const composer = document.querySelector('[data-tid="ckeditor-input"]') ||
                       document.querySelector('[role="textbox"][data-tid*="composer"]') ||
                       document.querySelector('.cke_editable');

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
    setInterval(checkComposer, 500);

    // Also listen for send button clicks
    document.addEventListener('click', (e) => {
      const target = e.target;
      if (target.matches('[data-tid="send-button"]') ||
          target.matches('[aria-label*="Send"]') ||
          target.closest('[data-tid="send-button"]')) {
        setTimeout(checkComposer, 100);
      }
    }, true);

    // Listen for Enter key in composer
    document.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && !e.shiftKey) {
        const target = e.target;
        if (target.matches('[data-tid="ckeditor-input"]') ||
            target.matches('[role="textbox"]') ||
            target.matches('.cke_editable')) {
          setTimeout(checkComposer, 100);
        }
      }
    }, true);
  }

  // Watch for meeting status changes
  function watchMeetingStatus() {
    setInterval(() => {
      const isInMeeting = checkMeetingStatus();

      if (isInMeeting && !inMeeting) {
        handleMeetingJoin();
      } else if (!isInMeeting && inMeeting) {
        handleMeetingEnd();
      }
    }, 2000);
  }

  // Watch for URL changes
  function watchUrlChanges() {
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[PM Activity] URL changed, checking for chat change');
        lastUrl = currentUrl;

        // Wait a bit for content to load
        setTimeout(handleChatView, 1000);
      }
    }, 1000);
  }

  // Watch for DOM changes
  function watchDomChanges() {
    const observer = new MutationObserver(() => {
      handleChatView();
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Initial check
    setTimeout(handleChatView, 2000);
  }

  // Handle page unload (meeting end)
  function handlePageUnload() {
    if (inMeeting) {
      handleMeetingEnd();
    }
  }

  // Initialize
  function init() {
    setupMessageDetection();
    watchMeetingStatus();
    watchUrlChanges();
    watchDomChanges();

    window.addEventListener('beforeunload', handlePageUnload);
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000); // Give Teams a moment to load
  }
})();
