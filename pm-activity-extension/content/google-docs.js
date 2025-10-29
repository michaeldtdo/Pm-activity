// PM Activity Tracker - Google Docs Content Script
// Tracks document opens, edits, and closes

(function() {
  'use strict';

  console.log('[PM Activity] Google Docs tracker initialized');

  let docId = null;
  let docTitle = null;
  let isEditing = false;
  let editStartTime = null;
  let totalEditDuration = 0;

  // Extract document ID from URL
  function extractDocId() {
    const match = window.location.pathname.match(/\/document\/d\/([a-zA-Z0-9-_]+)\//);
    return match ? match[1] : null;
  }

  // Get document title
  function getDocTitle() {
    const titleElement = document.querySelector('.docs-title-input');
    return titleElement ? titleElement.textContent.trim() : 'Untitled Document';
  }

  // Send activity event to background
  function sendActivityEvent(type, data = {}) {
    chrome.runtime.sendMessage({
      type: 'ACTIVITY_EVENT',
      event: {
        type,
        tool: 'google_docs',
        doc_id: docId,
        doc_title: docTitle,
        ...data
      }
    }).catch(err => {
      console.error('[PM Activity] Error sending event:', err);
    });
  }

  // Handle document open
  function handleDocOpen() {
    docId = extractDocId();

    if (!docId) {
      console.log('[PM Activity] Could not extract doc ID');
      return;
    }

    // Wait for title to load
    const titleCheckInterval = setInterval(() => {
      docTitle = getDocTitle();
      if (docTitle && docTitle !== 'Untitled Document') {
        clearInterval(titleCheckInterval);
        console.log('[PM Activity] Doc opened:', docTitle);
        sendActivityEvent('doc_open');
      }
    }, 500);

    // Stop checking after 10 seconds
    setTimeout(() => {
      clearInterval(titleCheckInterval);
      if (!docTitle || docTitle === 'Untitled Document') {
        docTitle = getDocTitle(); // Get whatever is there
        sendActivityEvent('doc_open');
      }
    }, 10000);
  }

  // Handle editing start
  function handleEditStart() {
    if (!isEditing) {
      isEditing = true;
      editStartTime = Date.now();
      console.log('[PM Activity] Edit started');
    }
  }

  // Handle editing end
  function handleEditEnd() {
    if (isEditing) {
      isEditing = false;
      const duration = Math.floor((Date.now() - editStartTime) / 1000);
      totalEditDuration += duration;
      console.log('[PM Activity] Edit ended, duration:', duration, 'seconds');

      sendActivityEvent('doc_edit', {
        duration_seconds: duration
      });
    }
  }

  // Handle document close (tab/window unload)
  function handleDocClose() {
    // End any active editing
    if (isEditing) {
      handleEditEnd();
    }

    // Send close event with total edit time
    console.log('[PM Activity] Doc closed, total edit time:', totalEditDuration, 'seconds');
    sendActivityEvent('doc_close', {
      total_edit_duration_seconds: totalEditDuration
    });
  }

  // Set up edit detection
  function setupEditDetection() {
    const editorSelector = '.kix-appview-editor';

    // Use MutationObserver to detect when editor appears
    const observer = new MutationObserver(() => {
      const editor = document.querySelector(editorSelector);
      if (editor && !editor.dataset.pmTracked) {
        editor.dataset.pmTracked = 'true';
        console.log('[PM Activity] Editor found, attaching listeners');

        // Track focus/blur for editing detection
        editor.addEventListener('focus', handleEditStart);
        editor.addEventListener('blur', handleEditEnd);

        // Track keyboard activity as editing
        let keyActivityTimer = null;
        editor.addEventListener('keydown', () => {
          handleEditStart();

          // Consider editing ended after 30 seconds of no activity
          clearTimeout(keyActivityTimer);
          keyActivityTimer = setTimeout(() => {
            handleEditEnd();
          }, 30000);
        });
      }
    });

    observer.observe(document.body, {
      childList: true,
      subtree: true
    });

    // Also check immediately
    const editor = document.querySelector(editorSelector);
    if (editor) {
      observer.disconnect();
      observer.observe(document.body, { childList: true, subtree: true });

      const event = new Event('focus');
      editor.dispatchEvent(event);
    }
  }

  // Initialize
  function init() {
    handleDocOpen();
    setupEditDetection();

    // Handle page unload
    window.addEventListener('beforeunload', handleDocClose);

    // Handle visibility change (tab switching)
    document.addEventListener('visibilitychange', () => {
      if (document.hidden) {
        handleEditEnd();
      }
    });
  }

  // Wait for page to be ready
  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', init);
  } else {
    init();
  }
})();
