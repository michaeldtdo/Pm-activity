// PM Activity Tracker - Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  const openPanelBtn = document.getElementById('open-panel-btn');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const successMsg = document.getElementById('success-msg');
  const statStaging = document.getElementById('stat-staging');
  const statToday = document.getElementById('stat-today');

  // Load and display stats
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

      if (response && response.stats) {
        const stats = response.stats;
        statStaging.textContent = stats.stagingTotal || 0;
        statToday.textContent = stats.todayActivities || 0;
      }
    } catch (error) {
      console.error('Error loading stats:', error);
    }
  }

  // Load existing API key
  async function loadApiKey() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_API_KEY' });
      if (response && response.apiKey) {
        apiKeyInput.value = response.apiKey;
      }
    } catch (error) {
      console.error('Error loading API key:', error);
    }
  }

  // Open side panel
  openPanelBtn.addEventListener('click', async () => {
    try {
      await chrome.sidePanel.open({ windowId: chrome.windows.WINDOW_ID_CURRENT });
      window.close(); // Close popup after opening side panel
    } catch (error) {
      console.error('Error opening side panel:', error);
      // Fallback for older Chrome versions
      chrome.sidePanel.open().catch(() => {
        alert('Side panel feature not available. Please update Chrome.');
      });
    }
  });

  // Save API key
  saveApiKeyBtn.addEventListener('click', async () => {
    const apiKey = apiKeyInput.value.trim();

    if (!apiKey) {
      showMessage('Please enter an API key', false);
      return;
    }

    if (!apiKey.startsWith('sk-ant-')) {
      showMessage('Invalid API key format', false);
      return;
    }

    try {
      await chrome.runtime.sendMessage({
        type: 'SAVE_API_KEY',
        apiKey
      });

      showMessage('API key saved successfully', true);
    } catch (error) {
      console.error('Error saving API key:', error);
      showMessage('Failed to save API key', false);
    }
  });

  // Show message
  function showMessage(message, isSuccess) {
    successMsg.textContent = message;
    successMsg.className = isSuccess ? 'success-message active' : 'error-message active';

    setTimeout(() => {
      successMsg.classList.remove('active');
    }, 3000);
  }

  // Initialize
  await loadStats();
  await loadApiKey();
});
