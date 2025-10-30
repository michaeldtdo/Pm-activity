// Activity Observer - Monitors user activity and captures context
// This runs on all pages to intelligently understand what the user is doing

class ActivityObserver {
  constructor() {
    this.lastActivity = null;
    this.activityBuffer = [];
    this.isActive = false;
    this.idleTimeout = null;
    this.analysisInterval = 10 * 60 * 1000; // 10 minutes
    this.analysisTimer = null;
    this.lastAnalysisTime = Date.now();
    this.significantChangeThreshold = 30 * 1000; // 30 seconds
  }

  init() {
    console.log('[Activity Observer] Initializing on:', window.location.hostname);

    // Start observing
    this.observePageActivity();
    this.observeUserInteraction();
    this.startAnalysisTimer();

    // Listen for visibility changes
    document.addEventListener('visibilitychange', () => {
      if (document.visibilityState === 'visible') {
        this.onPageFocused();
      } else {
        this.onPageBlurred();
      }
    });

    // Listen for beforeunload (page close/navigate away)
    window.addEventListener('beforeunload', () => {
      this.onPageLeaving();
    });
  }

  observePageActivity() {
    // Capture initial page state
    this.capturePageState('page_load');

    // Watch for significant DOM changes
    const observer = new MutationObserver((mutations) => {
      if (this.isSignificantChange(mutations)) {
        this.capturePageState('content_change');
      }
    });

    // Observe body for changes
    if (document.body) {
      observer.observe(document.body, {
        childList: true,
        subtree: true,
        characterData: false,
        attributes: false
      });
    }
  }

  observeUserInteraction() {
    // Track meaningful interactions
    const events = ['click', 'input', 'scroll', 'keydown'];

    events.forEach(eventType => {
      document.addEventListener(eventType, (e) => {
        this.onUserInteraction(eventType, e);
      }, { passive: true });
    });
  }

  isSignificantChange(mutations) {
    // Only consider changes that add/remove substantial content
    let significantNodes = 0;

    for (const mutation of mutations) {
      if (mutation.addedNodes.length > 0 || mutation.removedNodes.length > 0) {
        mutation.addedNodes.forEach(node => {
          if (node.nodeType === Node.ELEMENT_NODE && node.textContent.length > 50) {
            significantNodes++;
          }
        });
      }
    }

    return significantNodes > 3;
  }

  onUserInteraction(type, event) {
    this.isActive = true;

    // Reset idle timeout
    clearTimeout(this.idleTimeout);
    this.idleTimeout = setTimeout(() => {
      this.onUserIdle();
    }, 5 * 60 * 1000); // 5 minutes idle

    // Capture interaction context for certain events
    if (type === 'click') {
      const target = event.target;
      if (target.tagName === 'BUTTON' || target.tagName === 'A') {
        this.captureInteraction('click', {
          element: target.tagName,
          text: target.textContent?.substring(0, 100),
          href: target.href
        });
      }
    } else if (type === 'input') {
      const target = event.target;
      if (target.tagName === 'INPUT' || target.tagName === 'TEXTAREA') {
        // Don't capture actual input content for privacy
        this.captureInteraction('typing', {
          element: target.tagName,
          type: target.type,
          placeholder: target.placeholder
        });
      }
    }
  }

  capturePageState(reason) {
    const state = {
      timestamp: new Date().toISOString(),
      reason,
      url: window.location.href,
      title: document.title,
      hostname: window.location.hostname,
      pathname: window.location.pathname,
      // Capture visible text (limited for privacy)
      visibleText: this.getVisibleText(),
      // Detect activity type from URL and content
      detectedType: this.detectActivityType()
    };

    this.activityBuffer.push(state);

    // Keep buffer size manageable
    if (this.activityBuffer.length > 50) {
      this.activityBuffer = this.activityBuffer.slice(-30);
    }

    console.log('[Activity Observer] Captured state:', reason, state.title);
  }

  captureInteraction(type, data) {
    const interaction = {
      timestamp: new Date().toISOString(),
      type,
      data
    };

    this.activityBuffer.push(interaction);
  }

  getVisibleText() {
    // Get main content text (avoiding navigation, ads, etc.)
    const mainSelectors = [
      'main',
      'article',
      '[role="main"]',
      '.main-content',
      '#content',
      'body'
    ];

    for (const selector of mainSelectors) {
      const element = document.querySelector(selector);
      if (element) {
        // Get text but limit to first 1000 chars for privacy/performance
        const text = element.textContent
          ?.replace(/\s+/g, ' ')
          .trim()
          .substring(0, 1000);
        return text;
      }
    }

    return document.body.textContent
      ?.replace(/\s+/g, ' ')
      .trim()
      .substring(0, 1000);
  }

  detectActivityType() {
    const url = window.location.href.toLowerCase();
    const title = document.title.toLowerCase();

    // Detect based on URL patterns
    if (url.includes('docs.google.com') || url.includes('/document/')) {
      return 'document_editing';
    } else if (url.includes('slack.com')) {
      return 'team_communication';
    } else if (url.includes('teams.microsoft.com')) {
      return 'team_communication';
    } else if (url.includes('jira') || url.includes('atlassian')) {
      return 'project_management';
    } else if (url.includes('claude.ai') || url.includes('anthropic.com')) {
      return 'ai_assistance';
    } else if (url.includes('meet.google.com') || url.includes('zoom.us')) {
      return 'meeting';
    } else if (url.includes('calendar.google.com')) {
      return 'scheduling';
    } else if (url.includes('mail.google.com') || url.includes('outlook')) {
      return 'email';
    } else if (url.includes('github.com') || url.includes('gitlab.com')) {
      return 'code_development';
    } else if (title.includes('meeting') || title.includes('call')) {
      return 'meeting';
    }

    return 'general_work';
  }

  onPageFocused() {
    console.log('[Activity Observer] Page focused');
    this.capturePageState('page_focused');
  }

  onPageBlurred() {
    console.log('[Activity Observer] Page blurred');
    this.capturePageState('page_blurred');

    // Trigger analysis if enough time has passed
    const timeSinceLastAnalysis = Date.now() - this.lastAnalysisTime;
    if (timeSinceLastAnalysis > this.significantChangeThreshold) {
      this.triggerAnalysis('context_switch');
    }
  }

  onPageLeaving() {
    console.log('[Activity Observer] Page leaving');
    this.triggerAnalysis('page_leaving');
  }

  onUserIdle() {
    console.log('[Activity Observer] User idle detected');
    this.isActive = false;
    this.triggerAnalysis('idle');
  }

  startAnalysisTimer() {
    // Analyze activity periodically
    this.analysisTimer = setInterval(() => {
      if (this.isActive && this.activityBuffer.length > 0) {
        this.triggerAnalysis('periodic');
      }
    }, this.analysisInterval);
  }

  triggerAnalysis(reason) {
    console.log('[Activity Observer] Triggering analysis:', reason);

    if (this.activityBuffer.length === 0) {
      console.log('[Activity Observer] No activity to analyze');
      return;
    }

    // Send activity buffer to background for AI analysis
    chrome.runtime.sendMessage({
      type: 'ANALYZE_ACTIVITY',
      reason,
      activityData: {
        buffer: this.activityBuffer,
        duration: Date.now() - this.lastAnalysisTime,
        hostname: window.location.hostname
      }
    }).then(response => {
      if (response?.success) {
        console.log('[Activity Observer] Analysis complete, card generated');
        // Clear buffer after successful analysis
        this.activityBuffer = [];
        this.lastAnalysisTime = Date.now();
      }
    }).catch(error => {
      console.error('[Activity Observer] Analysis failed:', error);
    });
  }

  destroy() {
    clearInterval(this.analysisTimer);
    clearTimeout(this.idleTimeout);
  }
}

// Initialize observer
const observer = new ActivityObserver();
observer.init();

console.log('[Activity Observer] Loaded on:', window.location.href);
