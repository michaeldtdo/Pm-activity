// PM Activity Tracker - Popup UI Script

document.addEventListener('DOMContentLoaded', async () => {
  const loading = document.getElementById('loading');
  const content = document.getElementById('content');
  const statusDiv = document.getElementById('status');
  const todayCount = document.getElementById('today-count');
  const totalCount = document.getElementById('total-count');
  const bufferCount = document.getElementById('buffer-count');
  const snippetsCount = document.getElementById('snippets-count');
  const flushBtn = document.getElementById('flush-btn');
  const clearBtn = document.getElementById('clear-btn');

  // Load and display stats
  async function loadStats() {
    try {
      const response = await chrome.runtime.sendMessage({ type: 'GET_STATS' });

      if (response && response.stats) {
        const stats = response.stats;

        todayCount.textContent = stats.todayActivities || 0;
        totalCount.textContent = stats.totalActivities || 0;
        bufferCount.textContent = stats.bufferedActivities || 0;
        snippetsCount.textContent = stats.contentSnippets || 0;

        // Update status
        updateStatus('success', 'Tracking active');
      } else {
        updateStatus('error', 'Failed to load stats');
      }
    } catch (error) {
      console.error('Error loading stats:', error);
      updateStatus('error', 'Connection error');
    }

    // Hide loading, show content
    loading.style.display = 'none';
    content.style.display = 'block';
  }

  // Update status indicator
  function updateStatus(type, message) {
    statusDiv.className = type === 'error' ? 'status error' : 'status';
    statusDiv.querySelector('.status-text').textContent = message;
  }

  // Flush buffer to native host
  async function flushBuffer() {
    flushBtn.disabled = true;
    flushBtn.textContent = 'Flushing...';

    try {
      const response = await chrome.runtime.sendMessage({ type: 'FLUSH_BUFFER' });

      if (response && response.success) {
        updateStatus('success', `Flushed ${response.logged || 0} events`);
        setTimeout(() => {
          updateStatus('success', 'Tracking active');
        }, 2000);
      } else {
        updateStatus('error', response.error || 'Flush failed');
        setTimeout(() => {
          updateStatus('success', 'Tracking active');
        }, 3000);
      }

      // Reload stats
      await loadStats();
    } catch (error) {
      console.error('Error flushing buffer:', error);
      updateStatus('error', 'Flush error: ' + error.message);
      setTimeout(() => {
        updateStatus('success', 'Tracking active');
      }, 3000);
    } finally {
      flushBtn.disabled = false;
      flushBtn.textContent = 'Flush to PM Agent';
    }
  }

  // Clear all data
  async function clearData() {
    if (!confirm('Are you sure you want to clear all activity logs and snippets? This cannot be undone.')) {
      return;
    }

    clearBtn.disabled = true;
    clearBtn.textContent = 'Clearing...';

    try {
      await chrome.runtime.sendMessage({ type: 'CLEAR_BUFFER' });
      updateStatus('success', 'All data cleared');

      setTimeout(() => {
        updateStatus('success', 'Tracking active');
      }, 2000);

      // Reload stats
      await loadStats();
    } catch (error) {
      console.error('Error clearing data:', error);
      updateStatus('error', 'Clear failed');
    } finally {
      clearBtn.disabled = false;
      clearBtn.textContent = 'Clear All Data';
    }
  }

  // Event listeners
  flushBtn.addEventListener('click', flushBuffer);
  clearBtn.addEventListener('click', clearData);

  // Initial load
  await loadStats();

  // Auto-refresh stats every 5 seconds
  setInterval(loadStats, 5000);
});
