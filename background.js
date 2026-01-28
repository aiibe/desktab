"use strict";

// DeskTab - Background Service Worker

// Helper to map tab data
function mapTab(tab) {
  return {
    id: tab.id,
    title: tab.title || "Untitled",
    url: tab.url || "",
    favIconUrl: tab.favIconUrl || "",
    active: tab.active,
    windowId: tab.windowId,
  };
}

// Listen for keyboard shortcut command
chrome.commands.onCommand.addListener(async (command) => {
  if (command === "toggle-overlay") {
    try {
      // Get the active tab to send the message to
      const [activeTab] = await chrome.tabs.query({
        active: true,
        currentWindow: true,
      });

      if (!activeTab?.id) return;

      // Query all tabs across all windows
      const tabs = await chrome.tabs.query({});

      // Send tabs data to content script
      chrome.tabs.sendMessage(activeTab.id, {
        type: "TOGGLE_OVERLAY",
        tabs: tabs.map(mapTab),
      });
    } catch (error) {
      console.error("DeskTab: Error toggling overlay", error);
    }
  }
});

// Listen for messages from content script
chrome.runtime.onMessage.addListener((message, sender, sendResponse) => {
  switch (message.type) {
    case "CLOSE_TAB":
      handleCloseTab(message.tabId, sender.tab?.id);
      break;

    case "SWITCH_TAB":
      handleSwitchTab(message.tabId, message.windowId);
      break;

    case "GET_TABS":
      handleGetTabs(sendResponse);
      return true; // Keep channel open for async response

    case "CLOSE_ALL_TABS":
      handleCloseAllTabs(sender.tab?.id);
      break;
  }
});

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

async function handleGetTabs(sendResponse) {
  try {
    const tabs = await chrome.tabs.query({});
    sendResponse({
      tabs: tabs.map(mapTab),
    });
  } catch (error) {
    console.error("DeskTab: Error getting tabs", error);
    sendResponse({ tabs: [] });
  }
}

async function handleCloseAllTabs(senderTabId) {
  try {
    const tabs = await chrome.tabs.query({});
    const tabIdsToClose = tabs
      .filter((tab) => tab.id !== senderTabId)
      .map((tab) => tab.id);

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
