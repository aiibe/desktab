"use strict";

// Tabs Janitor - Content Script

(function () {
  const ROOT_ID = "tabs-janitor-root";
  const ESTIMATED_RAM_PER_TAB_MB = 50;

  let shadowRoot = null;
  let isOverlayVisible = false;
  let selectedIndex = 0;
  let currentTabs = [];

  // CSS Styles for the overlay (glassmorphism dark mode)
  const styles = `
    * {
      margin: 0;
      padding: 0;
      box-sizing: border-box;
    }

    .overlay {
      position: fixed;
      top: 0;
      left: 0;
      width: 100vw;
      height: 100vh;
      background: rgba(0, 0, 0, 0.7);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      display: flex;
      flex-direction: column;
      align-items: center;
      justify-content: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      opacity: 0;
      transition: opacity 0.2s ease;
    }

    .overlay.visible {
      opacity: 1;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      max-width: 900px;
      max-height: 70vh;
      overflow-y: auto;
      padding: 24px;
      width: 90%;
    }

    .grid::-webkit-scrollbar {
      width: 8px;
    }

    .grid::-webkit-scrollbar-track {
      background: rgba(255, 255, 255, 0.1);
      border-radius: 4px;
    }

    .grid::-webkit-scrollbar-thumb {
      background: rgba(255, 255, 255, 0.3);
      border-radius: 4px;
    }

    .card {
      position: relative;
      display: flex;
      flex-direction: column;
      align-items: center;
      padding: 16px 12px;
      background: rgba(255, 255, 255, 0.1);
      backdrop-filter: blur(20px);
      -webkit-backdrop-filter: blur(20px);
      border: 1px solid rgba(255, 255, 255, 0.15);
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .card:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .card.selected {
      background: rgba(255, 255, 255, 0.2);
      border-color: rgba(100, 150, 255, 0.6);
      box-shadow: 0 0 20px rgba(100, 150, 255, 0.3);
    }

    .card.active-tab {
      border-color: rgba(100, 255, 150, 0.5);
    }

    .close-btn {
      position: absolute;
      top: 6px;
      right: 6px;
      width: 22px;
      height: 22px;
      border: none;
      border-radius: 50%;
      background: rgba(255, 100, 100, 0.8);
      color: white;
      font-size: 12px;
      font-weight: bold;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.1s ease;
      display: flex;
      align-items: center;
      justify-content: center;
      line-height: 1;
    }

    .card:hover .close-btn,
    .card.selected .close-btn {
      opacity: 1;
    }

    .close-btn:hover {
      background: rgba(255, 70, 70, 1);
      transform: scale(1.1);
    }

    .favicon {
      width: 40px;
      height: 40px;
      object-fit: contain;
      margin-bottom: 10px;
      border-radius: 4px;
    }

    .favicon-placeholder {
      width: 40px;
      height: 40px;
      margin-bottom: 10px;
      border-radius: 4px;
      background: rgba(255, 255, 255, 0.2);
      display: flex;
      align-items: center;
      justify-content: center;
      color: rgba(255, 255, 255, 0.6);
      font-size: 18px;
      font-weight: bold;
    }

    .title {
      color: rgba(255, 255, 255, 0.9);
      font-size: 12px;
      text-align: center;
      width: 100%;
      overflow: hidden;
      text-overflow: ellipsis;
      white-space: nowrap;
    }

    footer {
      display: flex;
      align-items: center;
      gap: 24px;
      padding: 16px 24px;
      background: rgba(0, 0, 0, 0.5);
      border-radius: 8px;
      margin-top: 16px;
    }

    footer span {
      color: rgba(255, 255, 255, 0.7);
      font-size: 13px;
    }

    .clear-all-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: rgba(180, 80, 80, 0.8);
      color: white;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .clear-all-btn:hover {
      background: rgba(200, 70, 70, 0.9);
    }

    .empty-state {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      text-align: center;
      padding: 40px;
    }
  `;

  // Initialize Shadow DOM container
  function initShadowDOM() {
    let root = document.getElementById(ROOT_ID);
    if (!root) {
      root = document.createElement("div");
      root.id = ROOT_ID;
      document.body.appendChild(root);
      shadowRoot = root.attachShadow({ mode: "closed" });

      const styleEl = document.createElement("style");
      styleEl.textContent = styles;
      shadowRoot.appendChild(styleEl);
    }
    return shadowRoot;
  }

  // Render the overlay with tabs
  function renderOverlay(tabs) {
    currentTabs = tabs;
    selectedIndex = tabs.findIndex((t) => t.active);
    if (selectedIndex === -1) selectedIndex = 0;

    const shadow = initShadowDOM();

    // Remove existing overlay if any
    const existingOverlay = shadow.querySelector(".overlay");
    if (existingOverlay) {
      existingOverlay.remove();
    }

    const overlay = document.createElement("div");
    overlay.className = "overlay";

    if (tabs.length === 0) {
      overlay.innerHTML = `<div class="empty-state">No tabs found</div>`;
    } else {
      const grid = document.createElement("div");
      grid.className = "grid";

      tabs.forEach((tab, index) => {
        const card = createTabCard(tab, index);
        grid.appendChild(card);
      });

      overlay.appendChild(grid);

      // Footer with stats
      const footer = document.createElement("footer");
      footer.append(...createFooterContent(tabs.length));
      overlay.appendChild(footer);
    }

    // Click on backdrop to close
    overlay.addEventListener("click", (e) => {
      if (e.target === overlay) {
        hideOverlay();
      }
    });

    shadow.appendChild(overlay);

    // Trigger animation
    requestAnimationFrame(() => {
      overlay.classList.add("visible");
    });

    isOverlayVisible = true;
    document.addEventListener("keydown", handleKeydown);

    // Scroll selected card into view
    scrollSelectedIntoView();
  }

  // Create a tab card element
  function createTabCard(tab, index) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.tabId = tab.id;
    card.dataset.windowId = tab.windowId;
    card.dataset.index = index;

    if (tab.active) {
      card.classList.add("active-tab");
    }
    if (index === selectedIndex) {
      card.classList.add("selected");
    }

    // Close button
    const closeBtn = document.createElement("button");
    closeBtn.className = "close-btn";
    closeBtn.textContent = "×";
    closeBtn.addEventListener("click", (e) => {
      e.stopPropagation();
      closeTab(tab.id);
    });

    // Favicon
    let faviconEl;
    if (tab.favIconUrl) {
      faviconEl = document.createElement("img");
      faviconEl.className = "favicon";
      faviconEl.src = tab.favIconUrl;
      faviconEl.onerror = () => {
        faviconEl.replaceWith(createFaviconPlaceholder(tab.title));
      };
    } else {
      faviconEl = createFaviconPlaceholder(tab.title);
    }

    // Title
    const title = document.createElement("span");
    title.className = "title";
    title.textContent = tab.title;
    title.title = tab.title; // Tooltip for full title

    card.appendChild(closeBtn);
    card.appendChild(faviconEl);
    card.appendChild(title);

    // Click to switch tab
    card.addEventListener("click", () => {
      switchToTab(tab.id, tab.windowId);
    });

    return card;
  }

  // Create placeholder for missing favicon
  function createFaviconPlaceholder(title) {
    const placeholder = document.createElement("div");
    placeholder.className = "favicon-placeholder";
    placeholder.textContent = title ? title.charAt(0).toUpperCase() : "?";
    return placeholder;
  }

  // Create footer content elements
  function createFooterContent(tabCount) {
    const estimatedRAM = tabCount * ESTIMATED_RAM_PER_TAB_MB;
    const tabCountSpan = document.createElement("span");
    tabCountSpan.textContent = `Total Open Tabs: ${tabCount}`;
    const ramSpan = document.createElement("span");
    ramSpan.textContent = `Estimated RAM: ~${estimatedRAM} MB`;
    const clearAllBtn = document.createElement("button");
    clearAllBtn.className = "clear-all-btn";
    clearAllBtn.textContent = "Close All Tabs";
    clearAllBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLOSE_ALL_TABS" });
    });
    return [tabCountSpan, ramSpan, clearAllBtn];
  }

  // Hide the overlay
  function hideOverlay() {
    if (!shadowRoot) return;

    const overlay = shadowRoot.querySelector(".overlay");
    if (overlay) {
      overlay.classList.remove("visible");
      setTimeout(() => {
        overlay.remove();
      }, 200);
    }

    isOverlayVisible = false;
    document.removeEventListener("keydown", handleKeydown);
  }

  // Handle keyboard navigation
  function handleKeydown(e) {
    if (!isOverlayVisible || currentTabs.length === 0) return;

    const gridColumns = getGridColumns();

    switch (e.key) {
      case "Escape":
        e.preventDefault();
        hideOverlay();
        break;

      case "ArrowRight":
        e.preventDefault();
        selectedIndex = (selectedIndex + 1) % currentTabs.length;
        updateSelection();
        break;

      case "ArrowLeft":
        e.preventDefault();
        selectedIndex =
          (selectedIndex - 1 + currentTabs.length) % currentTabs.length;
        updateSelection();
        break;

      case "ArrowDown":
        e.preventDefault();
        selectedIndex = Math.min(
          selectedIndex + gridColumns,
          currentTabs.length - 1
        );
        updateSelection();
        break;

      case "ArrowUp":
        e.preventDefault();
        selectedIndex = Math.max(selectedIndex - gridColumns, 0);
        updateSelection();
        break;

      case "Enter":
        e.preventDefault();
        const selectedTab = currentTabs[selectedIndex];
        if (selectedTab) {
          switchToTab(selectedTab.id, selectedTab.windowId);
        }
        break;

      case "Delete":
      case "Backspace":
        e.preventDefault();
        const tabToClose = currentTabs[selectedIndex];
        if (tabToClose) {
          closeTab(tabToClose.id);
        }
        break;
    }
  }

  // Calculate grid columns based on viewport
  function getGridColumns() {
    const grid = shadowRoot?.querySelector(".grid");
    if (!grid) return 4;

    const gridWidth = grid.clientWidth - 48; // Subtract padding
    const cardMinWidth = 140 + 16; // minmax value + gap
    return Math.max(1, Math.floor(gridWidth / cardMinWidth));
  }

  // Update visual selection
  function updateSelection() {
    if (!shadowRoot) return;

    const cards = shadowRoot.querySelectorAll(".card");
    cards.forEach((card, index) => {
      card.classList.toggle("selected", index === selectedIndex);
    });

    scrollSelectedIntoView();
  }

  // Scroll selected card into view
  function scrollSelectedIntoView() {
    if (!shadowRoot) return;

    const selectedCard = shadowRoot.querySelector(".card.selected");
    if (selectedCard) {
      selectedCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  // Close a tab
  function closeTab(tabId) {
    chrome.runtime.sendMessage({ type: "CLOSE_TAB", tabId });
  }

  // Switch to a tab
  function switchToTab(tabId, windowId) {
    chrome.runtime.sendMessage({ type: "SWITCH_TAB", tabId, windowId });
    hideOverlay();
  }

  // Update tabs after one is closed
  function updateTabs(tabs) {
    if (!isOverlayVisible) return;

    currentTabs = tabs;

    // Adjust selected index if needed
    if (selectedIndex >= currentTabs.length) {
      selectedIndex = Math.max(0, currentTabs.length - 1);
    }

    // Re-render the grid
    const shadow = initShadowDOM();
    const grid = shadow.querySelector(".grid");
    const footer = shadow.querySelector("footer");

    if (grid && tabs.length > 0) {
      grid.innerHTML = "";
      tabs.forEach((tab, index) => {
        const card = createTabCard(tab, index);
        grid.appendChild(card);
      });

      // Update footer
      if (footer) {
        footer.textContent = "";
        footer.append(...createFooterContent(tabs.length));
      }
    } else if (tabs.length === 0) {
      hideOverlay();
    }
  }

  // Listen for messages from background script
  chrome.runtime.onMessage.addListener((message) => {
    switch (message.type) {
      case "TOGGLE_OVERLAY":
        if (isOverlayVisible) {
          hideOverlay();
        } else {
          renderOverlay(message.tabs);
        }
        break;

      case "TABS_UPDATED":
        updateTabs(message.tabs);
        break;
    }
    return false;
  });
})();
