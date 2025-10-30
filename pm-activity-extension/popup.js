// PM Activity Tracker - Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  const openPanelBtn = document.getElementById('open-panel-btn');
  const apiKeyInput = document.getElementById('api-key-input');
  const saveApiKeyBtn = document.getElementById('save-api-key-btn');
  const autoCardEnabled = document.getElementById('auto-card-enabled');
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

  // Load auto-card settings
  async function loadAutoCardSettings() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTO_CARD_SETTINGS' });
      if (response && response.settings) {
        autoCardEnabled.checked = response.settings.enabled !== false; // Default to true
      }
    } catch (error) {
      console.error('Error loading auto-card settings:', error);
    }
  }

  // Open side panel
  openPanelBtn.addEventListener('click', async () => {
    try {
      // Check if sidePanel API exists
      if (!chrome.sidePanel) {
        alert('Side Panel not supported. Please update Chrome to version 114 or higher.\n\nCurrent version: ' + (navigator.userAgent.match(/Chrome\/(\d+)/)?.[1] || 'unknown'));
        return;
      }

      // Try to get current window
      const windows = await chrome.windows.getCurrent();
      await chrome.sidePanel.open({ windowId: windows.id });
      window.close(); // Close popup after opening side panel
    } catch (error) {
      console.error('Error opening side panel:', error);

      // Try fallback without windowId
      try {
        await chrome.sidePanel.open();
        window.close();
      } catch (fallbackError) {
        console.error('Fallback also failed:', fallbackError);
        alert('Failed to open side panel.\n\nError: ' + error.message + '\n\nPlease try:\n1. Update Chrome to latest version\n2. Reload the extension (chrome://extensions)\n3. Use keyboard shortcut: Ctrl+Shift+P');
      }
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

  // Toggle auto-card generation
  autoCardEnabled.addEventListener('change', async () => {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_AUTO_CARD_SETTINGS' });
      const currentSettings = response?.settings || { enabled: true };

      const newSettings = {
        ...currentSettings,
        enabled: autoCardEnabled.checked
      };

      await chrome.runtime.sendMessage({
        type: 'SAVE_AUTO_CARD_SETTINGS',
        settings: newSettings
      });

      showMessage(
        autoCardEnabled.checked ? 'Auto-card generation enabled' : 'Auto-card generation disabled',
        true
      );
    } catch (error) {
      console.error('Error saving auto-card settings:', error);
      showMessage('Failed to save settings', false);
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
  await loadAutoCardSettings();
});
