// PM Activity Tracker - Background Service Worker
// Orchestrates activity logging and native messaging

// Activity buffer
let activityBuffer = [];
const BUFFER_FLUSH_SIZE = 10;
const BUFFER_FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let flushTimer = null;

// Default capture settings (Phase 2)
const DEFAULT_SETTINGS = {
  enabled: false,
  tools: { teams: false, google_docs: false, slack: false, jira: false },
  capture_types: { decisions: true, action_items: true, meeting_notes: true },
  max_snippet_length: 500
};

// Initialize on install
chrome.runtime.onInstalled.addListener(async () => {
  console.log('[PM Activity] Extension installed');

  // Initialize settings if not present
  const { captureSettings } = await chrome.storage.local.get('captureSettings');
  if (!captureSettings) {
    await chrome.storage.local.set({ captureSettings: DEFAULT_SETTINGS });
  }

  // Initialize activity log
  const { activityLog } = await chrome.storage.local.get('activityLog');
  if (!activityLog) {
    await chrome.storage.local.set({ activityLog: [] });
  }

  startFlushTimer();
});

// Listen for messages from content scripts
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  if (message.type === 'ACTIVITY_EVENT') {
    handleActivityEvent(message.event, sender.tab);
    sendResponse({ success: true });
  } else if (message.type === 'CONTENT_SNIPPET') {
    handleContentSnippet(message.snippet, sender.tab);
    sendResponse({ success: true });
  } else if (message.type === 'GET_SETTINGS') {
    getSettings().then(settings => sendResponse({ settings }));
    return true; // Async response
  } else if (message.type === 'FLUSH_BUFFER') {
    flushBuffer().then(result => sendResponse(result));
    return true; // Async response
  } else if (message.type === 'CLEAR_BUFFER') {
    clearBuffer().then(() => sendResponse({ success: true }));
    return true; // Async response
  } else if (message.type === 'GET_STATS') {
    getStats().then(stats => sendResponse({ stats }));
    return true; // Async response
  }
});

// Handle activity event from content script
async function handleActivityEvent(event, tab) {
  console.log('[PM Activity] Event received:', event.type, 'from', event.tool);

  // Add metadata
  const enrichedEvent = {
    ...event,
    timestamp: new Date().toISOString(),
    tab_id: tab?.id,
    tab_url: tab?.url
  };

  // Add to buffer
  activityBuffer.push(enrichedEvent);

  // Save to storage (append to activity log)
  const { activityLog = [] } = await chrome.storage.local.get('activityLog');
  activityLog.push(enrichedEvent);
  await chrome.storage.local.set({ activityLog });

  // Check if we should flush
  if (activityBuffer.length >= BUFFER_FLUSH_SIZE) {
    console.log('[PM Activity] Buffer full, flushing...');
    await flushBuffer();
  }
}

// Handle content snippet (Phase 2)
async function handleContentSnippet(snippet, tab) {
  console.log('[PM Activity] Content snippet received:', snippet.category);

  // Check if capture is enabled
  const { captureSettings = DEFAULT_SETTINGS } = await chrome.storage.local.get('captureSettings');
  if (!captureSettings.enabled) {
    console.log('[PM Activity] Content capture disabled, ignoring snippet');
    return;
  }

  // Add metadata
  const enrichedSnippet = {
    ...snippet,
    timestamp: new Date().toISOString(),
    tab_id: tab?.id,
    tab_url: tab?.url
  };

  // Save to snippets storage
  const { contentSnippets = [] } = await chrome.storage.local.get('contentSnippets');
  contentSnippets.push(enrichedSnippet);
  await chrome.storage.local.set({ contentSnippets });

  // Also add to activity buffer for native messaging
  activityBuffer.push(enrichedSnippet);

  if (activityBuffer.length >= BUFFER_FLUSH_SIZE) {
    await flushBuffer();
  }
}

// Flush buffer to native messaging host
async function flushBuffer() {
  if (activityBuffer.length === 0) {
    console.log('[PM Activity] Buffer empty, nothing to flush');
    return { success: true, logged: 0 };
  }

  console.log(`[PM Activity] Flushing ${activityBuffer.length} events to native host...`);

  try {
    // Send to native messaging host
    const response = await chrome.runtime.sendNativeMessage(
      'com.pm_agent.activity_logger',
      {
        action: 'log_activities',
        activities: activityBuffer
      }
    );

    console.log('[PM Activity] Native host response:', response);

    if (response && response.success) {
      // Clear buffer after successful flush
      const flushedCount = activityBuffer.length;
      activityBuffer = [];

      // Reset flush timer
      startFlushTimer();

      return { success: true, logged: flushedCount };
    } else {
      console.error('[PM Activity] Native host returned error:', response);
      return { success: false, error: 'Native host error' };
    }
  } catch (error) {
    console.error('[PM Activity] Error flushing to native host:', error);
    // Keep buffer for retry
    return { success: false, error: error.message };
  }
}

// Start or restart flush timer
function startFlushTimer() {
  if (flushTimer) {
    clearTimeout(flushTimer);
  }

  flushTimer = setTimeout(async () => {
    console.log('[PM Activity] Flush timer triggered');
    await flushBuffer();
  }, BUFFER_FLUSH_INTERVAL);
}

// Get current settings
async function getSettings() {
  const { captureSettings = DEFAULT_SETTINGS } = await chrome.storage.local.get('captureSettings');
  return captureSettings;
}

// Get statistics
async function getStats() {
  const { activityLog = [], contentSnippets = [] } = await chrome.storage.local.get([
    'activityLog',
    'contentSnippets'
  ]);

  // Get today's date boundaries
  const today = new Date();
  today.setHours(0, 0, 0, 0);
  const todayISO = today.toISOString();

  // Count today's activities
  const todayActivities = activityLog.filter(event => event.timestamp >= todayISO);

  return {
    totalActivities: activityLog.length,
    todayActivities: todayActivities.length,
    bufferedActivities: activityBuffer.length,
    contentSnippets: contentSnippets.length
  };
}

// Clear buffer and storage
async function clearBuffer() {
  activityBuffer = [];
  await chrome.storage.local.set({
    activityLog: [],
    contentSnippets: []
  });
  console.log('[PM Activity] Buffer and storage cleared');
}

// Start the flush timer on load
startFlushTimer();

console.log('[PM Activity] Background service worker ready');
