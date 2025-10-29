// PM Activity Tracker - Claude.ai Content Script
// Tracks conversation starts, messages, and responses

(function() {
  'use strict';

  console.log('[PM Activity] Claude.ai tracker initialized');

  let currentChatId = null;
  let lastMessageCount = 0;
  let conversationActive = false;
  let conversationStartTime = null;
  let userMessageCount = 0;
  let assistantMessageCount = 0;

  // Extract chat ID from URL
  function extractChatId() {
    const match = window.location.pathname.match(/\/chat\/([a-f0-9-]+)/);
    return match ? match[1] : null;
  }

  // Check if on new chat page
  function isNewChatPage() {
    return window.location.pathname === '/new' ||
           window.location.pathname === '/' ||
           window.location.pathname === '/chat';
  }

  // Count messages in conversation
  function countMessages() {
    // Look for message elements
    const messageSelectors = [
      '[data-testid*="message"]',
      '.font-claude-message',
      '[class*="Message"]'
    ];

    for (const selector of messageSelectors) {
      const messages = document.querySelectorAll(selector);
      if (messages.length > 0) {
        return messages.length;
      }
    }

    // Alternative: count message containers
    const main = document.querySelector('main');
    if (main) {
      // Look for alternating message pattern
      const potentialMessages = main.querySelectorAll('[class*="flex"][class*="gap"]');
      return potentialMessages.length;
    }

    return 0;
  }

  // Detect message type (user or assistant)
  function detectNewMessages() {
    const currentMessageCount = countMessages();

    if (currentMessageCount > lastMessageCount) {
      const newMessages = currentMessageCount - lastMessageCount;
      console.log('[PM Activity] New messages detected:', newMessages);

      // Approximate: messages usually alternate user -> assistant
      // If odd number of messages, last is likely user; if even, likely assistant
      if (currentMessageCount % 2 === 1) {
        userMessageCount++;
        console.log('[PM Activity] User message sent');
        sendActivityEvent('claude_user_message');
      } else {
        assistantMessageCount++;
        console.log('[PM Activity] Claude response received');
        sendActivityEvent('claude_response');
      }

      lastMessageCount = currentMessageCount;
    }
  }

  // Send activity event to background
  function sendActivityEvent(type, data = {}) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_EVENT',
      event: {
        type,
        tool: 'claude',
        chat_id: currentChatId,
        ...data
      }
    }).catch(err => {
      console.error('[PM Activity] Error sending event:', err);
    });
  }

  // Handle conversation start
  function handleConversationStart() {
    if (!conversationActive) {
      conversationActive = true;
      conversationStartTime = Date.now();
      userMessageCount = 0;
      assistantMessageCount = 0;
      lastMessageCount = 0;

      console.log('[PM Activity] Conversation started:', currentChatId);
      sendActivityEvent('claude_conversation_start');
    }
  }

  // Handle conversation end
  function handleConversationEnd() {
    if (conversationActive) {
      conversationActive = false;
      const duration = Math.floor((Date.now() - conversationStartTime) / 1000);

      console.log('[PM Activity] Conversation ended, duration:', duration, 'seconds');
      sendActivityEvent('claude_conversation_end', {
        duration_seconds: duration,
        user_messages: userMessageCount,
        assistant_messages: assistantMessageCount
      });
    }
  }

  // Handle URL/chat change
  function handleChatChange() {
    const newChatId = extractChatId();

    // If switching to a different chat
    if (newChatId !== currentChatId) {
      // End previous conversation
      if (currentChatId) {
        handleConversationEnd();
      }

      currentChatId = newChatId;
      lastMessageCount = 0;

      // Start new conversation if we have a chat ID
      if (currentChatId) {
        setTimeout(() => {
          handleConversationStart();
          detectNewMessages(); // Count initial messages
        }, 1000);
      }
    }
  }

  // Watch for new messages
  function watchMessages() {
    setInterval(() => {
      if (conversationActive) {
        detectNewMessages();
      }
    }, 1000);

    // Also watch for DOM changes
    const observer = new MutationObserver(() => {
      if (conversationActive) {
        detectNewMessages();
      }
    });

    const main = document.querySelector('main');
    if (main) {
      observer.observe(main, {
        childList: true,
        subtree: true
      });
    }
  }

  // Watch for URL changes
  function watchUrlChanges() {
    let lastUrl = window.location.href;

    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[PM Activity] URL changed');
        lastUrl = currentUrl;
        setTimeout(handleChatChange, 500);
      }
    }, 1000);
  }

  // Watch for input field activity (indicates user is composing)
  function watchInputActivity() {
    const checkInput = () => {
      const input = document.querySelector('[contenteditable="true"]') ||
                    document.querySelector('textarea[placeholder*="Talk"]');

      if (input && !conversationActive && !isNewChatPage()) {
        // User is typing but conversation not started - they might be starting new
        const chatId = extractChatId();
        if (chatId && chatId !== currentChatId) {
          currentChatId = chatId;
          handleConversationStart();
        }
      }
    };

    setInterval(checkInput, 2000);
  }

  // Handle page unload
  function handlePageUnload() {
    if (conversationActive) {
      handleConversationEnd();
    }
  }

  // Initialize
  function init() {
    // Check if we're on a chat page
    currentChatId = extractChatId();

    if (currentChatId) {
      setTimeout(() => {
        handleConversationStart();
        detectNewMessages();
      }, 2000);
    }

    watchMessages();
    watchUrlChanges();
    watchInputActivity();

    window.addEventListener('beforeunload', handlePageUnload);

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden && conversationActive) {
        // Don't end conversation, but could add logic here if needed
      }
    });
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000); // Give Claude.ai a moment to load
  }
})();
