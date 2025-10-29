// PM Activity Tracker - Background Service Worker
// Orchestrates activity logging, staging, and native messaging

// Activity buffer (for native messaging)
let activityBuffer = [];
const BUFFER_FLUSH_SIZE = 10;
const BUFFER_FLUSH_INTERVAL = 5 * 60 * 1000; // 5 minutes
let flushTimer = null;

// Staging system (NEW)
let stagingActivities = [];
let activityIdCounter = 0;

// Default capture settings
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

  // Initialize staging activities
  const { stagingActivities: storedStaging } = await chrome.storage.local.get('stagingActivities');
  if (storedStaging) {
    stagingActivities = storedStaging;
  } else {
    await chrome.storage.local.set({ stagingActivities: [] });
  }

  // Initialize archive
  const { archive } = await chrome.storage.local.get('archive');
  if (!archive) {
    await chrome.storage.local.set({ archive: [] });
  }

  startFlushTimer();
});

// Listen for messages from content scripts and UI
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  // Original handlers
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
  // New staging handlers
  else if (message.type === 'GET_STAGING') {
    sendResponse({ activities: stagingActivities });
  } else if (message.type === 'UPDATE_ACTIVITY') {
    updateActivity(message.id, message.updates).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'ADD_MANUAL_ACTIVITY') {
    addManualActivity(message.activity).then(activity => {
      sendResponse({ success: true, activity });
    });
    return true;
  } else if (message.type === 'DELETE_ACTIVITY') {
    deleteActivity(message.id).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'SYNTHESIZE_CONTEXT') {
    synthesizeContext(message.timeRange).then(result => {
      sendResponse(result);
    });
    return true;
  } else if (message.type === 'CONFIRM_AND_EXPORT') {
    confirmAndExport(message.context, message.filename).then(result => {
      sendResponse(result);
    });
    return true;
  } else if (message.type === 'CLEAR_PROCESSED') {
    clearProcessed().then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'SAVE_API_KEY') {
    chrome.storage.local.set({ claudeApiKey: message.apiKey }).then(() => {
      sendResponse({ success: true });
    });
    return true;
  } else if (message.type === 'GET_API_KEY') {
    chrome.storage.local.get('claudeApiKey').then(({ claudeApiKey }) => {
      sendResponse({ apiKey: claudeApiKey || null });
    });
    return true;
  }
});

// Handle activity event from content script
async function handleActivityEvent(event, tab) {
  console.log('[PM Activity] Event received:', event.type, 'from', event.tool);

  // Create staging activity
  const activity = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: 'draft',
    manual: false,
    type: event.type,
    tool: event.tool,
    data: event,
    snippet: null,
    lastModified: new Date().toISOString(),
    tab_id: tab?.id,
    tab_url: tab?.url
  };

  // Add to staging
  stagingActivities.push(activity);
  await saveStaging();

  // Notify side panel
  notifySidePanel('ACTIVITY_ADDED', { activity });

  // Also add to legacy buffer for backward compatibility
  const enrichedEvent = {
    ...event,
    timestamp: activity.timestamp,
    tab_id: tab?.id,
    tab_url: tab?.url
  };

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

// Handle content snippet
async function handleContentSnippet(snippet, tab) {
  console.log('[PM Activity] Content snippet received:', snippet.category);

  // Check if capture is enabled
  const { captureSettings = DEFAULT_SETTINGS } = await chrome.storage.local.get('captureSettings');
  if (!captureSettings.enabled) {
    console.log('[PM Activity] Content capture disabled, ignoring snippet');
    return;
  }

  // Create staging activity with snippet
  const activity = {
    id: generateId(),
    timestamp: new Date().toISOString(),
    status: 'draft',
    manual: false,
    type: 'content_snippet',
    tool: snippet.tool || 'unknown',
    data: snippet,
    snippet: snippet.content,
    lastModified: new Date().toISOString(),
    tab_id: tab?.id,
    tab_url: tab?.url
  };

  // Add to staging
  stagingActivities.push(activity);
  await saveStaging();

  // Notify side panel
  notifySidePanel('ACTIVITY_ADDED', { activity });

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

// Generate unique activity ID
function generateId() {
  const timestamp = Date.now();
  const random = Math.random().toString(36).substring(2, 9);
  return `${timestamp}_${random}`;
}

// Save staging to storage
async function saveStaging() {
  await chrome.storage.local.set({
    stagingActivities,
    lastSyncTime: new Date().toISOString()
  });
}

// Update activity
async function updateActivity(id, updates) {
  const index = stagingActivities.findIndex(a => a.id === id);
  if (index === -1) {
    console.error('[PM Activity] Activity not found:', id);
    return;
  }

  // Update activity
  stagingActivities[index] = {
    ...stagingActivities[index],
    ...updates,
    status: 'edited',
    lastModified: new Date().toISOString()
  };

  await saveStaging();

  // Notify side panel
  notifySidePanel('ACTIVITY_UPDATED', { activity: stagingActivities[index] });
}

// Add manual activity
async function addManualActivity(activityData) {
  const activity = {
    id: generateId(),
    timestamp: activityData.timestamp || new Date().toISOString(),
    status: 'draft',
    manual: true,
    type: activityData.type,
    tool: activityData.tool || 'manual',
    data: {
      title: activityData.title,
      details: activityData.details,
      ...activityData.data
    },
    snippet: activityData.snippet || null,
    lastModified: new Date().toISOString()
  };

  stagingActivities.push(activity);
  await saveStaging();

  // Notify side panel
  notifySidePanel('ACTIVITY_ADDED', { activity });

  return activity;
}

// Delete activity
async function deleteActivity(id) {
  const index = stagingActivities.findIndex(a => a.id === id);
  if (index === -1) {
    console.error('[PM Activity] Activity not found:', id);
    return;
  }

  stagingActivities.splice(index, 1);
  await saveStaging();

  // Notify side panel
  notifySidePanel('ACTIVITY_DELETED', { id });
}

// Synthesize context using AI
async function synthesizeContext(timeRange = 'today') {
  console.log('[PM Activity] Synthesizing context for:', timeRange);

  // Get Claude API key
  const { claudeApiKey } = await chrome.storage.local.get('claudeApiKey');
  if (!claudeApiKey) {
    return {
      success: false,
      error: 'Claude API key not configured. Please set it in the extension popup.'
    };
  }

  // Filter activities by time range
  const filteredActivities = filterActivitiesByTimeRange(stagingActivities, timeRange);

  if (filteredActivities.length === 0) {
    return {
      success: false,
      error: 'No activities found for the selected time range.'
    };
  }

  // Format activities for prompt
  const activitiesText = formatActivitiesForPrompt(filteredActivities);

  const prompt = `You are helping a PM synthesize their daily work into structured context updates.

Activities from ${timeRange}:

${activitiesText}

Generate a structured markdown document with these sections:

## 📊 Daily Summary
Brief overview of the day's work (2-3 sentences)

## 🎯 Key Activities

### Meetings
- List meetings with key outcomes and decisions
- Include duration and participants if available

### Documents
- List documents worked on with changes made or topics covered
- Include editing duration if significant

### Team Communication
- Summarize important Slack/Teams discussions
- Note key decisions or action items from messages

### Issue/Project Work
- List Jira issues or project tasks worked on
- Include status changes or updates made

## 💡 Key Decisions
List important decisions made with brief rationale (if evident from activities)

## 📋 Action Items
List follow-up tasks or action items identified (with deadlines if mentioned)

## 📝 Suggested Context Updates
Suggest specific files or documents that should be updated based on today's activities:
- Format as: \`path/to/file.md\` → Brief description of what should be updated

Format as clean, well-structured markdown ready to save.`;

  try {
    // Call Claude API
    const response = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': claudeApiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 4096,
        messages: [{
          role: 'user',
          content: prompt
        }]
      })
    });

    if (!response.ok) {
      const errorData = await response.json();
      throw new Error(errorData.error?.message || 'Claude API request failed');
    }

    const data = await response.json();
    const context = data.content[0].text;

    return {
      success: true,
      context,
      activityCount: filteredActivities.length
    };
  } catch (error) {
    console.error('[PM Activity] Synthesis error:', error);
    return {
      success: false,
      error: error.message || 'Failed to synthesize context'
    };
  }
}

// Filter activities by time range
function filterActivitiesByTimeRange(activities, timeRange) {
  const now = new Date();
  let startTime;

  switch (timeRange) {
    case 'today':
      startTime = new Date(now);
      startTime.setHours(0, 0, 0, 0);
      break;
    case 'last24h':
      startTime = new Date(now.getTime() - 24 * 60 * 60 * 1000);
      break;
    case 'last7d':
      startTime = new Date(now.getTime() - 7 * 24 * 60 * 60 * 1000);
      break;
    default:
      startTime = new Date(0); // All time
  }

  return activities.filter(a => new Date(a.timestamp) >= startTime);
}

// Format activities for AI prompt
function formatActivitiesForPrompt(activities) {
  return activities.map(a => {
    const time = new Date(a.timestamp).toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });

    let entry = `[${time}] ${a.type} - ${a.tool}`;

    // Add type-specific details
    if (a.data.doc_title || a.data.title) {
      entry += `\n  Title: ${a.data.doc_title || a.data.title}`;
    }
    if (a.data.meeting_title) {
      entry += `\n  Meeting: ${a.data.meeting_title}`;
    }
    if (a.data.duration_seconds) {
      const minutes = Math.floor(a.data.duration_seconds / 60);
      entry += `\n  Duration: ${minutes} minutes`;
    }
    if (a.data.issue_key) {
      entry += `\n  Issue: ${a.data.issue_key}`;
    }
    if (a.data.issue_summary) {
      entry += `\n  Summary: ${a.data.issue_summary}`;
    }
    if (a.data.channel) {
      entry += `\n  Channel: ${a.data.channel}`;
    }
    if (a.data.chat_name) {
      entry += `\n  Chat: ${a.data.chat_name}`;
    }
    if (a.snippet) {
      entry += `\n  Content: ${a.snippet.substring(0, 200)}${a.snippet.length > 200 ? '...' : ''}`;
    }
    if (a.manual && a.data.details) {
      entry += `\n  Note: ${a.data.details}`;
    }

    return entry;
  }).join('\n\n');
}

// Confirm and export context
async function confirmAndExport(context, filename) {
  console.log('[PM Activity] Exporting context to:', filename);

  try {
    // Send to native messaging host for export
    const response = await chrome.runtime.sendNativeMessage(
      'com.pm_agent.activity_logger',
      {
        action: 'export_context',
        context,
        filename
      }
    );

    if (response && response.success) {
      // Mark activities as processed
      stagingActivities.forEach(a => {
        if (a.status !== 'processed') {
          a.status = 'processed';
        }
      });

      await saveStaging();

      return { success: true, path: response.path };
    } else {
      throw new Error(response?.error || 'Export failed');
    }
  } catch (error) {
    console.error('[PM Activity] Export error:', error);
    return {
      success: false,
      error: error.message || 'Failed to export context'
    };
  }
}

// Clear processed activities
async function clearProcessed() {
  // Archive processed activities
  const processed = stagingActivities.filter(a => a.status === 'processed');
  if (processed.length > 0) {
    const { archive = [] } = await chrome.storage.local.get('archive');
    archive.push({
      timestamp: new Date().toISOString(),
      activities: processed
    });
    await chrome.storage.local.set({ archive });
  }

  // Remove processed from staging
  stagingActivities = stagingActivities.filter(a => a.status !== 'processed');
  await saveStaging();

  // Notify side panel
  notifySidePanel('STAGING_CLEARED', {});
}

// Notify side panel of updates
function notifySidePanel(type, data) {
  chrome.runtime.sendMessage({
    type: 'SIDEPANEL_UPDATE',
    updateType: type,
    data
  }).catch(() => {
    // Side panel not open, ignore
  });
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

  // Staging stats
  const draftCount = stagingActivities.filter(a => a.status === 'draft').length;
  const editedCount = stagingActivities.filter(a => a.status === 'edited').length;
  const processedCount = stagingActivities.filter(a => a.status === 'processed').length;

  return {
    totalActivities: activityLog.length,
    todayActivities: todayActivities.length,
    bufferedActivities: activityBuffer.length,
    contentSnippets: contentSnippets.length,
    stagingDraft: draftCount,
    stagingEdited: editedCount,
    stagingProcessed: processedCount,
    stagingTotal: stagingActivities.length
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

// Load staging from storage on startup
chrome.storage.local.get('stagingActivities').then(({ stagingActivities: stored }) => {
  if (stored) {
    stagingActivities = stored;
    console.log(`[PM Activity] Loaded ${stagingActivities.length} staging activities`);
  }
});

// Start the flush timer on load
startFlushTimer();

console.log('[PM Activity] Background service worker ready');
