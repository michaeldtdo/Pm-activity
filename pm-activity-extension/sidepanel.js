// PM Activity Tracker - Side Panel Script
// Manages activity staging, editing, and synthesis

// State
let activities = [];
let editingId = null;
let currentContext = null;
let currentFilename = null;
let currentTab = 'manual'; // 'manual' or 'distill'

// DOM Elements
const feedContainer = document.getElementById('activities-container');
const emptyState = document.getElementById('empty-state');
const statDraft = document.getElementById('stat-draft');
const statEdited = document.getElementById('stat-edited');
const statTotal = document.getElementById('stat-total');

// Buttons
const addManualBtn = document.getElementById('add-manual-btn');
const processBtn = document.getElementById('process-btn');
const clearProcessedBtn = document.getElementById('clear-processed-btn');

// Manual Entry Modal
const manualEntryModal = document.getElementById('manual-entry-modal');
const manualType = document.getElementById('manual-type');
const manualTitle = document.getElementById('manual-title');
const manualDetails = document.getElementById('manual-details');
const manualTimestamp = document.getElementById('manual-timestamp');
const manualSaveBtn = document.getElementById('manual-save');
const manualCancelBtn = document.getElementById('manual-cancel');

// Quick Distill Elements
const distillContent = document.getElementById('distill-content');
const distillBtn = document.getElementById('distill-btn');
const distilledResult = document.getElementById('distilled-result');
const distillType = document.getElementById('distill-type');
const distillTitle = document.getElementById('distill-title');
const distillDetails = document.getElementById('distill-details');
const distillTimestamp = document.getElementById('distill-timestamp');

// Synthesis Modal
const synthesisModal = document.getElementById('synthesis-modal');
const synthesisLoading = document.getElementById('synthesis-loading');
const synthesisResult = document.getElementById('synthesis-result');
const contextPreview = document.getElementById('context-preview');
const activityCount = document.getElementById('activity-count');
const wordCount = document.getElementById('word-count');
const synthesisExportBtn = document.getElementById('synthesis-export');
const synthesisCancelBtn = document.getElementById('synthesis-cancel');
const successMsg = document.getElementById('success-msg');
const errorMsg = document.getElementById('error-msg');

// Initialize
init();

async function init() {
  console.log('[Side Panel] Initializing...');

  // Load activities
  await loadActivities();

  // Set up event listeners
  setupEventListeners();

  // Listen for real-time updates
  listenForUpdates();
}

function setupEventListeners() {
  addManualBtn.addEventListener('click', showManualEntryModal);
  processBtn.addEventListener('click', processWithAI);
  clearProcessedBtn.addEventListener('click', clearProcessed);

  manualSaveBtn.addEventListener('click', saveManualEntry);
  manualCancelBtn.addEventListener('click', hideManualEntryModal);

  synthesisExportBtn.addEventListener('click', exportContext);
  synthesisCancelBtn.addEventListener('click', hideSynthesisModal);

  // Tab switching
  document.querySelectorAll('.tab').forEach(tab => {
    tab.addEventListener('click', () => switchTab(tab.dataset.tab));
  });

  // Distill button
  distillBtn.addEventListener('click', distillConversation);

  // Close modals on escape
  document.addEventListener('keydown', (e) => {
    if (e.key === 'Escape') {
      hideManualEntryModal();
      hideSynthesisModal();
    }
  });

  // Close modals on background click
  manualEntryModal.addEventListener('click', (e) => {
    if (e.target === manualEntryModal) {
      hideManualEntryModal();
    }
  });

  synthesisModal.addEventListener('click', (e) => {
    if (e.target === synthesisModal) {
      hideSynthesisModal();
    }
  });
}

// Load activities from background
async function loadActivities() {
  try {
    const response = await chrome.runtime.sendMessage({ type: 'GET_STAGING' });
    activities = response.activities || [];
    console.log(`[Side Panel] Loaded ${activities.length} activities`);

    renderActivities();
    updateStats();
  } catch (error) {
    console.error('[Side Panel] Error loading activities:', error);
  }
}

// Render all activities
function renderActivities() {
  if (activities.length === 0) {
    feedContainer.innerHTML = '';
    emptyState.style.display = 'block';
    return;
  }

  emptyState.style.display = 'none';

  // Sort by timestamp (newest first)
  const sorted = [...activities].sort((a, b) =>
    new Date(b.timestamp) - new Date(a.timestamp)
  );

  feedContainer.innerHTML = sorted.map(activity =>
    renderActivityCard(activity)
  ).join('');

  // Attach event listeners to buttons
  sorted.forEach(activity => {
    const card = document.getElementById(`activity-${activity.id}`);
    if (!card) return;

    // Edit button
    const editBtn = card.querySelector('.edit-btn');
    if (editBtn) {
      editBtn.addEventListener('click', () => editActivity(activity.id));
    }

    // Delete button
    const deleteBtn = card.querySelector('.delete-btn');
    if (deleteBtn) {
      deleteBtn.addEventListener('click', () => deleteActivity(activity.id));
    }

    // Edit form buttons (if in edit mode)
    const saveBtn = card.querySelector('.save-btn');
    if (saveBtn) {
      saveBtn.addEventListener('click', () => saveActivity(activity.id));
    }

    const cancelBtn = card.querySelector('.cancel-btn');
    if (cancelBtn) {
      cancelBtn.addEventListener('click', () => cancelEdit());
    }
  });
}

// Render a single activity card
function renderActivityCard(activity) {
  const isEditing = editingId === activity.id;
  const statusClass = activity.manual ? 'manual' : activity.status;
  const icon = getActivityIcon(activity.type);
  const time = formatTime(activity.timestamp);
  const title = getActivityTitle(activity);
  const details = getActivityDetails(activity);

  if (isEditing) {
    return `
      <div class="activity-card editing" id="activity-${activity.id}">
        <div class="edit-form">
          <div class="form-group">
            <label class="form-label">Title</label>
            <input type="text" class="form-input edit-title" value="${escapeHtml(title)}">
          </div>
          <div class="form-group">
            <label class="form-label">Details</label>
            <textarea class="form-textarea edit-details">${escapeHtml(details)}</textarea>
          </div>
          <div class="form-actions">
            <button class="btn btn-secondary btn-small cancel-btn">Cancel</button>
            <button class="btn btn-primary btn-small save-btn">Save</button>
          </div>
        </div>
      </div>
    `;
  }

  // Check if auto-generated
  const isAutoGen = activity.data.autoGenerated;
  const autoGenClass = isAutoGen ? 'auto-generated' : '';

  return `
    <div class="activity-card ${statusClass} ${autoGenClass}" id="activity-${activity.id}">
      <div class="activity-header">
        <div class="activity-time">${time}</div>
        <div class="activity-badges">
          <span class="tool-badge ${activity.tool}">${activity.tool.toUpperCase()}</span>
          ${isAutoGen ? '<span class="auto-badge">🤖 AUTO</span>' : ''}
          <span class="status-badge ${activity.status}">${activity.status}</span>
        </div>
      </div>
      <div class="activity-content">
        <div class="activity-title">
          <span class="activity-icon">${icon}</span>
          ${escapeHtml(title)}
        </div>
        ${details ? `<div class="activity-details">${escapeHtml(details)}</div>` : ''}
        ${isAutoGen && activity.data.summary ? `<div class="activity-summary">${escapeHtml(activity.data.summary)}</div>` : ''}
        ${isAutoGen && activity.data.keyPoints ? renderKeyPoints(activity.data.keyPoints) : ''}
        ${activity.snippet ? `<div class="activity-snippet">${escapeHtml(activity.snippet)}</div>` : ''}
      </div>
      ${activity.status !== 'processed' ? `
        <div class="activity-actions">
          <button class="btn btn-secondary btn-small edit-btn">Edit</button>
          <button class="btn btn-danger btn-small delete-btn">Delete</button>
        </div>
      ` : ''}
    </div>
  `;
}

// Get icon for activity type
function getActivityIcon(type) {
  const icons = {
    doc_open: '📄',
    doc_edit: '✏️',
    doc_close: '📄',
    slack_channel_view: '💬',
    slack_message: '💬',
    jira_issue_view: '🎫',
    jira_issue_update: '✅',
    teams_meeting_join: '📞',
    teams_meeting_end: '📞',
    teams_chat_view: '💬',
    teams_message_sent: '💬',
    claude_conversation_start: '🤖',
    claude_user_message: '🤖',
    claude_response: '🤖',
    meeting: '📞',
    decision: '⚡',
    task: '✅',
    other: '📝'
  };
  return icons[type] || '📝';
}

// Get activity title
function getActivityTitle(activity) {
  if (activity.data.title) return activity.data.title;
  if (activity.data.doc_title) return activity.data.doc_title;
  if (activity.data.meeting_title) return activity.data.meeting_title;
  if (activity.data.issue_summary) return `${activity.data.issue_key}: ${activity.data.issue_summary}`;

  // Generate title from type
  const titles = {
    doc_open: 'Document Opened',
    doc_edit: 'Document Edited',
    doc_close: 'Document Closed',
    slack_channel_view: `Slack: ${activity.data.channel || 'Channel'}`,
    slack_message: `Slack Message in ${activity.data.channel || 'Channel'}`,
    jira_issue_view: `Jira: ${activity.data.issue_key || 'Issue'}`,
    jira_issue_update: `Updated ${activity.data.issue_key || 'Issue'}`,
    teams_meeting_join: 'Teams Meeting',
    teams_meeting_end: 'Teams Meeting Ended',
    teams_chat_view: `Teams: ${activity.data.chat_name || 'Chat'}`,
    teams_message_sent: `Teams Message`,
    claude_conversation_start: 'Claude Conversation',
    claude_user_message: 'Claude Message',
    claude_response: 'Claude Response'
  };

  return titles[activity.type] || activity.type.replace(/_/g, ' ');
}

// Get activity details
function getActivityDetails(activity) {
  const parts = [];

  if (activity.data.duration_seconds) {
    const minutes = Math.floor(activity.data.duration_seconds / 60);
    parts.push(`Duration: ${minutes} min`);
  }

  if (activity.data.channel) {
    parts.push(`Channel: ${activity.data.channel}`);
  }

  if (activity.data.chat_name) {
    parts.push(`Chat: ${activity.data.chat_name}`);
  }

  if (activity.data.workspace) {
    parts.push(`Workspace: ${activity.data.workspace}`);
  }

  if (activity.data.project_name) {
    parts.push(`Project: ${activity.data.project_name}`);
  }

  if (activity.data.details && activity.manual) {
    parts.push(activity.data.details);
  }

  return parts.join(' • ');
}

// Format time
function formatTime(timestamp) {
  const date = new Date(timestamp);
  const now = new Date();
  const diffMs = now - date;
  const diffMins = Math.floor(diffMs / 60000);

  if (diffMins < 1) return 'Just now';
  if (diffMins < 60) return `${diffMins} min ago`;

  const diffHours = Math.floor(diffMins / 60);
  if (diffHours < 24) {
    return date.toLocaleTimeString('en-US', {
      hour: 'numeric',
      minute: '2-digit',
      hour12: true
    });
  }

  return date.toLocaleDateString('en-US', {
    month: 'short',
    day: 'numeric',
    hour: 'numeric',
    minute: '2-digit',
    hour12: true
  });
}

// Render key points for auto-generated cards
function renderKeyPoints(keyPoints) {
  if (!keyPoints || keyPoints.length === 0) return '';

  const pointsHtml = keyPoints.map(point =>
    `<li>${escapeHtml(point)}</li>`
  ).join('');

  return `<div class="activity-key-points"><ul>${pointsHtml}</ul></div>`;
}

// Update stats
function updateStats() {
  const draft = activities.filter(a => a.status === 'draft').length;
  const edited = activities.filter(a => a.status === 'edited').length;
  const total = activities.length;

  statDraft.textContent = draft;
  statEdited.textContent = edited;
  statTotal.textContent = total;
}

// Edit activity
function editActivity(id) {
  editingId = id;
  renderActivities();
}

// Cancel edit
function cancelEdit() {
  editingId = null;
  renderActivities();
}

// Save activity
async function saveActivity(id) {
  const card = document.getElementById(`activity-${id}`);
  const title = card.querySelector('.edit-title').value;
  const details = card.querySelector('.edit-details').value;

  try {
    await chrome.runtime.sendMessage({
      type: 'UPDATE_ACTIVITY',
      id,
      updates: {
        data: {
          ...activities.find(a => a.id === id).data,
          title,
          details
        }
      }
    });

    editingId = null;
    await loadActivities();
  } catch (error) {
    console.error('[Side Panel] Error saving activity:', error);
    alert('Failed to save activity');
  }
}

// Delete activity
async function deleteActivity(id) {
  if (!confirm('Delete this activity?')) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'DELETE_ACTIVITY',
      id
    });

    await loadActivities();
  } catch (error) {
    console.error('[Side Panel] Error deleting activity:', error);
    alert('Failed to delete activity');
  }
}

// Show manual entry modal
function showManualEntryModal() {
  // Reset to manual tab
  switchTab('manual');

  // Set default timestamp to now
  const now = new Date();
  now.setMinutes(now.getMinutes() - now.getTimezoneOffset());
  manualTimestamp.value = now.toISOString().slice(0, 16);
  distillTimestamp.value = now.toISOString().slice(0, 16);

  // Reset manual fields
  manualType.value = 'meeting';
  manualTitle.value = '';
  manualDetails.value = '';

  // Reset distill fields
  distillContent.value = '';
  distilledResult.style.display = 'none';
  distillType.value = 'meeting';
  distillTitle.value = '';
  distillDetails.value = '';

  manualEntryModal.classList.add('active');
  manualTitle.focus();
}

// Hide manual entry modal
function hideManualEntryModal() {
  manualEntryModal.classList.remove('active');
}

// Switch tabs in manual entry modal
function switchTab(tabName) {
  currentTab = tabName;

  // Update tab buttons
  document.querySelectorAll('.tab').forEach(tab => {
    if (tab.dataset.tab === tabName) {
      tab.classList.add('active');
    } else {
      tab.classList.remove('active');
    }
  });

  // Update tab content
  document.querySelectorAll('.tab-content').forEach(content => {
    content.classList.remove('active');
  });

  if (tabName === 'manual') {
    document.getElementById('manual-tab').classList.add('active');
  } else if (tabName === 'distill') {
    document.getElementById('distill-tab').classList.add('active');
  }
}

// Distill conversation using AI
async function distillConversation() {
  const content = distillContent.value.trim();

  if (!content) {
    alert('Please paste a conversation first');
    return;
  }

  // Get API key
  const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
  if (!response || !response.apiKey) {
    alert('Please configure your Claude API key in the extension popup');
    return;
  }

  // Show loading state
  distillBtn.classList.add('distilling');
  distillBtn.textContent = '⏳ Distilling...';

  try {
    // Call Claude API
    const apiResponse = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: {
        'Content-Type': 'application/json',
        'x-api-key': response.apiKey,
        'anthropic-version': '2023-06-01'
      },
      body: JSON.stringify({
        model: 'claude-sonnet-4-5-20250929',
        max_tokens: 1024,
        messages: [{
          role: 'user',
          content: `You are helping a PM distill a conversation into a structured activity entry.

Conversation:
${content}

Extract and provide in JSON format:
{
  "type": "meeting" | "decision" | "task" | "other",
  "title": "Brief 5-8 word summary",
  "details": "2-3 sentences covering: key points, decisions made, action items, outcomes"
}

Focus on extracting actionable information. Be concise but capture the essence.`
        }]
      })
    });

    if (!apiResponse.ok) {
      const errorData = await apiResponse.json();
      throw new Error(errorData.error?.message || 'API request failed');
    }

    const data = await apiResponse.json();
    const resultText = data.content[0].text;

    // Parse the JSON response
    const jsonMatch = resultText.match(/\{[\s\S]*\}/);
    if (!jsonMatch) {
      throw new Error('Could not parse AI response');
    }

    const distilled = JSON.parse(jsonMatch[0]);

    // Populate the form
    distillType.value = distilled.type || 'other';
    distillTitle.value = distilled.title || '';
    distillDetails.value = distilled.details || '';

    // Show the result form
    distilledResult.style.display = 'block';

    // Scroll to result
    distilledResult.scrollIntoView({ behavior: 'smooth', block: 'nearest' });

  } catch (error) {
    console.error('[Side Panel] Distill error:', error);
    alert('Failed to distill conversation: ' + error.message);
  } finally {
    // Reset button
    distillBtn.classList.remove('distilling');
    distillBtn.textContent = '✨ Distill with AI';
  }
}

// Save manual entry
async function saveManualEntry() {
  let type, title, details, timestamp;

  // Get values based on current tab
  if (currentTab === 'manual') {
    type = manualType.value;
    title = manualTitle.value.trim();
    details = manualDetails.value.trim();
    timestamp = new Date(manualTimestamp.value).toISOString();
  } else if (currentTab === 'distill') {
    // Check if distilled result is shown
    if (distilledResult.style.display === 'none') {
      alert('Please distill the conversation first');
      return;
    }

    type = distillType.value;
    title = distillTitle.value.trim();
    details = distillDetails.value.trim();
    timestamp = new Date(distillTimestamp.value).toISOString();
  }

  if (!title) {
    alert('Please enter a title');
    return;
  }

  try {
    await chrome.runtime.sendMessage({
      type: 'ADD_MANUAL_ACTIVITY',
      activity: {
        type,
        title,
        details,
        timestamp
      }
    });

    hideManualEntryModal();
    await loadActivities();
  } catch (error) {
    console.error('[Side Panel] Error adding manual activity:', error);
    alert('Failed to add activity');
  }
}

// Process with AI
async function processWithAI() {
  if (activities.length === 0) {
    alert('No activities to process');
    return;
  }

  // Show modal with loading state
  synthesisModal.classList.add('active');
  synthesisLoading.style.display = 'flex';
  synthesisResult.style.display = 'none';

  try {
    const response = await chrome.runtime.sendMessage({
      type: 'SYNTHESIZE_CONTEXT',
      timeRange: 'today'
    });

    if (!response.success) {
      throw new Error(response.error);
    }

    // Show result
    currentContext = response.context;
    currentFilename = `context-update-${new Date().toISOString().split('T')[0]}.md`;

    contextPreview.textContent = response.context;
    activityCount.textContent = response.activityCount;
    wordCount.textContent = response.context.split(/\s+/).length;

    synthesisLoading.style.display = 'none';
    synthesisResult.style.display = 'block';
  } catch (error) {
    console.error('[Side Panel] Synthesis error:', error);
    synthesisLoading.style.display = 'none';
    synthesisResult.style.display = 'block';
    contextPreview.textContent = '';

    errorMsg.textContent = error.message || 'Failed to synthesize context';
    errorMsg.classList.add('active');

    setTimeout(() => {
      errorMsg.classList.remove('active');
    }, 5000);
  }
}

// Export context
async function exportContext() {
  if (!currentContext) return;

  try {
    // Download file
    const blob = new Blob([currentContext], { type: 'text/markdown' });
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = currentFilename;
    a.click();
    URL.revokeObjectURL(url);

    // Send to native host
    const response = await chrome.runtime.sendMessage({
      type: 'CONFIRM_AND_EXPORT',
      context: currentContext,
      filename: currentFilename
    });

    if (response.success) {
      successMsg.textContent = `Exported to ${response.path}`;
      successMsg.classList.add('active');

      setTimeout(() => {
        successMsg.classList.remove('active');
        hideSynthesisModal();
        loadActivities();
      }, 2000);
    } else {
      throw new Error(response.error);
    }
  } catch (error) {
    console.error('[Side Panel] Export error:', error);
    errorMsg.textContent = 'Export successful locally, but failed to send to PM agent';
    errorMsg.classList.add('active');

    setTimeout(() => {
      errorMsg.classList.remove('active');
    }, 5000);
  }
}

// Hide synthesis modal
function hideSynthesisModal() {
  synthesisModal.classList.remove('active');
  currentContext = null;
  currentFilename = null;
}

// Clear processed activities
async function clearProcessed() {
  const processedCount = activities.filter(a => a.status === 'processed').length;

  if (processedCount === 0) {
    alert('No processed activities to clear');
    return;
  }

  if (!confirm(`Clear ${processedCount} processed activities?`)) return;

  try {
    await chrome.runtime.sendMessage({
      type: 'CLEAR_PROCESSED'
    });

    await loadActivities();
  } catch (error) {
    console.error('[Side Panel] Error clearing processed:', error);
    alert('Failed to clear processed activities');
  }
}

// Listen for real-time updates
function listenForUpdates() {
  chrome.runtime.onMessage.addListener((message) => {
    if (message.type !== 'SIDEPANEL_UPDATE') return;

    console.log('[Side Panel] Received update:', message.updateType);

    switch (message.updateType) {
      case 'ACTIVITY_ADDED':
        // Reload to show new activity
        loadActivities();
        break;

      case 'ACTIVITY_UPDATED':
        // Reload to show updated activity
        loadActivities();
        break;

      case 'ACTIVITY_DELETED':
        // Reload to remove deleted activity
        loadActivities();
        break;

      case 'STAGING_CLEARED':
        // Reload after clearing
        loadActivities();
        break;
    }
  });
}

// Utility: Escape HTML
function escapeHtml(text) {
  const div = document.createElement('div');
  div.textContent = text;
  return div.innerHTML;
}
