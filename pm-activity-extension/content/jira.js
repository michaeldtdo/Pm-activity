// PM Activity Tracker - Jira Content Script
// Tracks issue views and updates

(function() {
  'use strict';

  console.log('[PM Activity] Jira tracker initialized');

  let currentIssueKey = null;
  let currentIssueSummary = null;
  let lastUrl = window.location.href;
  let lastActivityCount = 0;

  // Extract issue key from URL
  function extractIssueKey() {
    const match = window.location.pathname.match(/([A-Z]+-\d+)/);
    return match ? match[1] : null;
  }

  // Get issue summary
  function getIssueSummary() {
    // Try various selectors for issue summary/title
    const selectors = [
      '[data-test-id="issue.views.issue-base.foundation.summary.heading"]',
      '[data-testid="issue.views.issue-base.foundation.summary.heading"]',
      'h1[data-test-id*="summary"]',
      '#summary-val',
      '.issue-header-content h1',
      '[data-test-id*="issue-title"]'
    ];

    for (const selector of selectors) {
      const element = document.querySelector(selector);
      if (element) {
        return element.textContent.trim();
      }
    }

    return null;
  }

  // Get project name
  function getProjectName() {
    const selectors = [
      '[data-test-id="issue.views.issue-base.foundation.breadcrumbs.project.link"]',
      '[data-testid*="breadcrumb"]',
      '.breadcrumbs-project a'
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
        tool: 'jira',
        issue_key: currentIssueKey,
        issue_summary: currentIssueSummary,
        ...data
      }
    }).catch(err => {
      console.error('[PM Activity] Error sending event:', err);
    });
  }

  // Handle issue view
  function handleIssueView() {
    const issueKey = extractIssueKey();

    if (!issueKey) {
      currentIssueKey = null;
      currentIssueSummary = null;
      return;
    }

    // Check if this is a new issue
    if (issueKey !== currentIssueKey) {
      currentIssueKey = issueKey;

      // Wait for summary to load
      const summaryCheckInterval = setInterval(() => {
        currentIssueSummary = getIssueSummary();
        if (currentIssueSummary) {
          clearInterval(summaryCheckInterval);
          const project = getProjectName();

          console.log('[PM Activity] Issue viewed:', currentIssueKey, '-', currentIssueSummary);
          sendActivityEvent('jira_issue_view', {
            project_name: project
          });

          // Start watching for updates
          watchForUpdates();
        }
      }, 500);

      // Stop checking after 10 seconds
      setTimeout(() => {
        clearInterval(summaryCheckInterval);
        if (!currentIssueSummary) {
          currentIssueSummary = getIssueSummary(); // Get whatever is there
          sendActivityEvent('jira_issue_view', {
            project_name: getProjectName()
          });
          watchForUpdates();
        }
      }, 10000);
    }
  }

  // Watch for issue updates
  function watchForUpdates() {
    // Look for activity module or comment section
    const activitySelectors = [
      '#activitymodule',
      '[data-test-id="issue.activity.comment"]',
      '.activity-stream',
      '[data-testid*="activity"]'
    ];

    for (const selector of activitySelectors) {
      const activityElement = document.querySelector(selector);
      if (activityElement) {
        // Count activity items
        const activityItems = activityElement.querySelectorAll('.activity-item, [data-testid*="activity-item"]');
        const currentActivityCount = activityItems.length;

        if (currentActivityCount > lastActivityCount && lastActivityCount > 0) {
          console.log('[PM Activity] Issue updated, new activity detected');
          sendActivityEvent('jira_issue_update', {
            update_type: 'activity_added'
          });
        }

        lastActivityCount = currentActivityCount;
        break;
      }
    }

    // Watch for status changes
    const statusElement = document.querySelector('#status-val, [data-testid*="status"]');
    if (statusElement) {
      const observer = new MutationObserver(() => {
        console.log('[PM Activity] Issue status may have changed');
        sendActivityEvent('jira_issue_update', {
          update_type: 'status_change'
        });
      });

      observer.observe(statusElement, {
        childList: true,
        characterData: true,
        subtree: true
      });
    }

    // Watch for comment additions
    const commentButton = document.querySelector('#comment-issue, [data-testid*="comment-button"]');
    if (commentButton) {
      commentButton.addEventListener('click', () => {
        console.log('[PM Activity] Comment being added');
        setTimeout(() => {
          sendActivityEvent('jira_issue_update', {
            update_type: 'comment_added'
          });
        }, 1000);
      });
    }
  }

  // Watch for URL changes
  function watchUrlChanges() {
    setInterval(() => {
      const currentUrl = window.location.href;
      if (currentUrl !== lastUrl) {
        console.log('[PM Activity] URL changed, checking for issue change');
        lastUrl = currentUrl;
        lastActivityCount = 0; // Reset activity count

        // Wait a bit for content to load
        setTimeout(handleIssueView, 1000);
      }
    }, 1000);
  }

  // Initialize
  function init() {
    // Initial issue view check
    setTimeout(handleIssueView, 2000);

    // Watch for URL changes
    watchUrlChanges();
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    setTimeout(init, 1000); // Give Jira a moment to load
  }
})();
