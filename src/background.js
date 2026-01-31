// @ts-check
/// <reference path="chrome.d.ts" />
"use strict";

// DeskTab - Background Service Worker

/**
 * @typedef {object} MappedTab
 * @property {number} id
 * @property {string} title
 * @property {string} url
 * @property {string} favIconUrl
 * @property {boolean} active
 * @property {number} windowId
 * @property {number} index
 */

/**
 * Map a Chrome tab to a simplified tab object.
 * @param {chrome.tabs.Tab} tab
 * @returns {MappedTab}
 */
function mapTab(tab) {
  return {
    id: /** @type {number} */ (tab.id),
    title: tab.title || "Untitled",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || "",
    active: tab.active,
    windowId: tab.windowId,
    index: tab.index,
  };
}

/** Track tabs where the content script has been injected. */
const injectedTabs = /** @type {Set<number>} */ (new Set());

/** Restricted URL prefixes where content scripts cannot be injected. */
const RESTRICTED_PREFIXES = [
  "chrome://",
  "chrome-extension://",
  "chrome-devtools://",
  "edge://",
  "about:",
  "chrome-error://",
];

/** Chrome Web Store origin (also restricted). */
const WEBSTORE_ORIGIN = "https://chromewebstore.google.com";

/**
 * Check whether a URL is restricted (content scripts cannot run there).
 * @param {string | undefined} url
 * @returns {boolean}
 */
function isRestrictedUrl(url) {
  if (!url) return true;
  if (RESTRICTED_PREFIXES.some((p) => url.startsWith(p))) return true;
  if (url.startsWith(WEBSTORE_ORIGIN)) return true;
  return false;
}

/**
 * Set or clear the popup for a given tab based on whether its URL is
 * restricted.  On restricted pages the popup shows a helpful message;
 * on normal pages the popup is cleared so `action.onClicked` fires.
 * @param {number} tabId
 * @param {string | undefined} url
 * @returns {void}
 */
function updatePopupForTab(tabId, url) {
  chrome.action.setPopup({
    tabId,
    popup: isRestrictedUrl(url) ? "popup.html" : "",
  });
}

/**
 * Ensure the content script is injected into the active tab, then send a
 * toggle message with the full list of open tabs.
 * @param {chrome.tabs.Tab} [activeTab] - Optional pre-fetched active tab
 * @returns {Promise<void>}
 */
async function toggleOverlay(activeTab) {
  if (!activeTab) {
    [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
  }
  if (!activeTab?.id) return;
  if (isRestrictedUrl(activeTab.url)) return;

  // Inject content script if not already present
  if (!injectedTabs.has(activeTab.id)) {
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content.js"],
    });
    injectedTabs.add(activeTab.id);
  }

  const tabs = await chrome.tabs.query({});
  try {
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "TOGGLE_OVERLAY",
      tabs: tabs.map(mapTab),
    });
  } catch {
    // Content script context was invalidated, re-inject and retry
    injectedTabs.delete(activeTab.id);
    await chrome.scripting.executeScript({
      target: { tabId: activeTab.id },
      files: ["content.js"],
    });
    injectedTabs.add(activeTab.id);
    await chrome.tabs.sendMessage(activeTab.id, {
      type: "TOGGLE_OVERLAY",
      tabs: tabs.map(mapTab),
    });
  }
}

// Clean up tracking when tabs are closed
chrome.tabs.onRemoved.addListener((tabId) => {
  injectedTabs.delete(tabId);
});

// Clean up tracking when tabs navigate (page reload or URL change)
chrome.tabs.onUpdated.addListener((tabId, changeInfo) => {
  // When a tab starts loading a new page, the content script is gone
  if (changeInfo.status === "loading") {
    injectedTabs.delete(tabId);
  }

  // Update popup state when the tab's URL changes
  if (changeInfo.url !== undefined) {
    updatePopupForTab(tabId, changeInfo.url);
  }
});

// Update popup state when the user switches to a different tab
chrome.tabs.onActivated.addListener(async (activeInfo) => {
  try {
    const tab = await chrome.tabs.get(activeInfo.tabId);
    updatePopupForTab(activeInfo.tabId, tab.url);
  } catch {
    // Tab may have been closed between event and handler
  }
});

// Initialize popup state for the current active tab on service worker startup
(async () => {
  try {
    const [activeTab] = await chrome.tabs.query({
      active: true,
      currentWindow: true,
    });
    if (activeTab?.id) {
      updatePopupForTab(activeTab.id, activeTab.url);
    }
  } catch {
    // Tabs may not be available yet during startup
  }
})();

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-overlay") {
    try {
      await toggleOverlay();
    } catch (error) {
      console.error("DeskTab: Error toggling overlay", error);
    }
  }
});

// Listen for extension icon click
chrome.action.onClicked.addListener(async () => {
  try {
    await toggleOverlay();
  } catch (error) {
    console.error("DeskTab: Error toggling overlay", error);
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender) => {
  switch (message.type) {
    case "CLOSE_TAB":
      handleCloseTab(message.tabId, sender.tab?.id);
      break;

    case "SWITCH_TAB":
      handleSwitchTab(message.tabId, message.windowId);
      break;

    case "CLOSE_ALL_TABS":
      handleCloseAllTabs(sender.tab?.id);
      break;

    case "MOVE_TAB":
      handleMoveTab(
        message.tabId,
        message.windowId,
        message.newIndex,
        sender.tab?.id,
      );
      break;
  }
});

/**
 * Close a tab and send the updated tab list back to the sender.
 * @param {number} tabIdToClose
 * @param {number | undefined} senderTabId
 * @returns {Promise<void>}
 */
async function handleCloseTab(tabIdToClose, senderTabId) {
  try {
    await chrome.tabs.remove(tabIdToClose);

    // Send updated tab list back to content script
    if (senderTabId) {
      const tabs = await chrome.tabs.query({});
      chrome.tabs.sendMessage(senderTabId, {
        type: "TABS_UPDATED",
        tabs: tabs.map(mapTab),
      });
    }
  } catch (error) {
    console.error("DeskTab: Error closing tab", error);
  }
}

/**
 * Focus the window and activate the specified tab.
 * @param {number} tabId
 * @param {number} [windowId]
 * @returns {Promise<void>}
 */
async function handleSwitchTab(tabId, windowId) {
  try {
    // Focus the window first if specified
    if (windowId) {
      await chrome.windows.update(windowId, { focused: true });
    }
    // Then activate the tab
    await chrome.tabs.update(tabId, { active: true });
  } catch (error) {
    console.error("DeskTab: Error switching tab", error);
  }
}

/**
 * Move a tab to a new position and send the updated tab list back.
 * @param {number} tabId
 * @param {number} windowId
 * @param {number} newIndex
 * @param {number | undefined} senderTabId
 * @returns {Promise<void>}
 */
async function handleMoveTab(tabId, windowId, newIndex, senderTabId) {
  try {
    await chrome.tabs.move(tabId, { windowId, index: newIndex });

    // Send updated tabs list back
    if (senderTabId) {
      const tabs = await chrome.tabs.query({});
      chrome.tabs.sendMessage(senderTabId, {
        type: "TABS_UPDATED",
        tabs: tabs.map(mapTab),
      });
    }
  } catch (error) {
    console.error("DeskTab: Error moving tab", error);
  }
}

/**
 * Close all tabs except the sender's tab, then send the updated list back.
 * @param {number | undefined} senderTabId
 * @returns {Promise<void>}
 */
async function handleCloseAllTabs(senderTabId) {
  try {
    const tabs = await chrome.tabs.query({});
    const tabIdsToClose = tabs
      .filter((tab) => tab.id !== senderTabId)
      .map((tab) => /** @type {number} */ (tab.id));

    if (tabIdsToClose.length > 0) {
      await chrome.tabs.remove(tabIdsToClose);
    }

    // Send updated tab list back
    if (senderTabId) {
      const remainingTabs = await chrome.tabs.query({});
      chrome.tabs.sendMessage(senderTabId, {
        type: "TABS_UPDATED",
        tabs: remainingTabs.map(mapTab),
      });
    }
  } catch (error) {
    console.error("DeskTab: Error closing all tabs", error);
  }
}
