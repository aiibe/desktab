// @ts-check
/// <reference path="chrome.d.ts" />
"use strict";

// DeskTab - Content Script

/**
 * @typedef {object} TabInfo
 * @property {number} id
 * @property {string} title
 * @property {string} url
 * @property {string} favIconUrl
 * @property {boolean} active
 * @property {number} windowId
 * @property {number} index
 */

(function () {
  const ROOT_ID = "desktab-root";
  const ESTIMATED_RAM_PER_TAB_MB = 50;

  /** @type {ShadowRoot | null} */
  let shadowRoot = null;
  /** @type {boolean} */
  let isOverlayVisible = false;
  /** @type {number} */
  let selectedIndex = 0;
  /** @type {TabInfo[]} */
  let currentTabs = [];
  /** @type {string | null} */
  let savedBodyOverflow = null;
  /** @type {string | null} */
  let savedHtmlOverflow = null;
  /** @type {HTMLDivElement | null} */
  let draggedCard = null;
  /** @type {number | null} */
  let draggedFromIndex = null;
  /** @type {number | null} */
  let currentDropIndex = null;
  /** @type {DOMRect[]} */
  let cardRects = [];

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
      background: transparent;
      display: flex;
      flex-direction: column;
      align-items: center;
      z-index: 2147483647;
      font-family: -apple-system, BlinkMacSystemFont, 'Segoe UI', Roboto, Oxygen, Ubuntu, sans-serif;
      opacity: 0;
      transition: opacity 0.25s ease, transform 0.25s ease;
      transform: scale(1.1);
    }

    .overlay.visible {
      opacity: 1;
      transform: scale(1);
    }

    .container {
      display: flex;
      flex-direction: column;
      max-width: 900px;
      max-height: 80vh;
      width: 90%;
      margin-top: 80px;
      background: rgba(0, 0, 0, 0.75);
      backdrop-filter: blur(10px);
      -webkit-backdrop-filter: blur(10px);
      border: 1px solid rgba(255, 255, 255, 0.2);
      border-radius: 16px;
      overflow: hidden;
      box-shadow: 0 25px 50px -12px rgba(0, 0, 0, 0.5);
    }

    .header {
      display: flex;
      align-items: center;
      justify-content: space-between;
      padding: 16px 24px;
      background: rgba(255, 255, 255, 0.05);
      border-bottom: 1px solid rgba(255, 255, 255, 0.1);
      flex-shrink: 0;
    }

    .logo {
      display: flex;
      align-items: center;
      gap: 12px;
      color: rgba(255, 255, 255, 0.9);
      font-size: 20px;
      font-weight: 600;
    }

    .logo img {
      width: 32px;
      height: 32px;
    }

    .stats {
      display: flex;
      align-items: center;
      gap: 24px;
    }

    .stat {
      display: flex;
      flex-direction: column;
      align-items: center;
    }

    .stat-value {
      color: rgba(255, 255, 255, 0.9);
      font-size: 18px;
      font-weight: 600;
    }

    .stat-label {
      color: rgba(255, 255, 255, 0.5);
      font-size: 11px;
      text-transform: uppercase;
    }

    .grid {
      display: grid;
      grid-template-columns: repeat(auto-fill, minmax(140px, 1fr));
      gap: 16px;
      padding: 24px;
      overflow-y: auto;
      flex: 1;
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
      border: 1px solid transparent;
      border-radius: 12px;
      cursor: pointer;
      transition: all 0.2s ease;
    }

    .card:hover {
      background: rgba(255, 255, 255, 0.15);
      transform: translateY(-2px);
    }

    .card.selected {
      background: rgba(255, 255, 255, 0.15);
      border-color: rgba(255, 255, 255, 0.2);
      transform: translateY(-2px);
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
      background: transparent;
      color: rgba(255, 255, 255, 0.6);
      font-size: 18px;
      font-weight: bold;
      cursor: pointer;
      opacity: 0;
      transition: opacity 0.2s ease, transform 0.1s ease, color 0.2s ease;
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
      color: rgba(255, 100, 100, 1);
      transform: scale(1.2);
    }

    .favicon-wrapper {
      position: relative;
      width: 40px;
      height: 40px;
      margin-bottom: 10px;
    }

    .favicon {
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: 4px;
      filter: grayscale(100%);
    }

    .favicon-color {
      position: absolute;
      top: 0;
      left: 0;
      width: 40px;
      height: 40px;
      object-fit: contain;
      border-radius: 4px;
      clip-path: circle(0% at center bottom);
      transition: clip-path 0s;
    }

    .card:hover .favicon-color,
    .card.selected .favicon-color {
      clip-path: circle(150% at center bottom);
      transition: clip-path 0.8s cubic-bezier(0.4, 0, 0.2, 1);
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

    .clear-all-btn {
      padding: 8px 16px;
      border: none;
      border-radius: 6px;
      background: rgba(255, 100, 100, 0.8);
      color: white;
      font-size: 13px;
      cursor: pointer;
      transition: background 0.2s ease;
    }

    .clear-all-btn:hover {
      background: rgba(255, 70, 70, 1);
    }

    .empty-state {
      color: rgba(255, 255, 255, 0.7);
      font-size: 16px;
      text-align: center;
      padding: 40px;
    }

    /* Drag and Drop */
    .card[draggable="true"] { cursor: grab; }
    .card[draggable="true"]:active { cursor: grabbing; }
    .card.dragging {
      opacity: 0;
      pointer-events: none;
    }
    .card.animating {
      transition: transform 0.4s cubic-bezier(0.25, 0.1, 0.25, 1);
    }
  `;

  /**
   * Initialize the Shadow DOM container. Creates the host element and shadow
   * root on first call; subsequent calls return the existing shadow root.
   * @returns {ShadowRoot}
   */
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
    return /** @type {ShadowRoot} */ (shadowRoot);
  }

  /**
   * Render the overlay showing all open tabs in a grid.
   * @param {TabInfo[]} tabs
   * @returns {void}
   */
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
      const container = document.createElement("div");
      container.className = "container";

      // Sticky header with stats
      const header = document.createElement("div");
      header.className = "header";
      header.append(...createHeaderContent(tabs.length));
      container.appendChild(header);

      // Scrollable grid
      const grid = document.createElement("div");
      grid.className = "grid";

      tabs.forEach((tab, index) => {
        const card = createTabCard(tab, index);
        grid.appendChild(card);
      });

      // Grid-level drag handlers for catching drops in gaps
      grid.addEventListener("dragover", handleGridDragOver);
      grid.addEventListener("drop", handleGridDrop);

      container.appendChild(grid);
      overlay.appendChild(container);
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
    document.addEventListener("keydown", handleKeydown, true);
    lockBodyScroll();

    // Scroll selected card into view
    scrollSelectedIntoView();
  }

  /**
   * Create a tab card element for the grid.
   * @param {TabInfo} tab
   * @param {number} index
   * @returns {HTMLDivElement}
   */
  function createTabCard(tab, index) {
    const card = document.createElement("div");
    card.className = "card";
    card.dataset.tabId = String(tab.id);
    card.dataset.windowId = String(tab.windowId);
    card.dataset.index = String(index);

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
    /** @type {HTMLDivElement} */
    let faviconEl;
    if (tab.favIconUrl) {
      // Create wrapper with grayscale and color layers for ripple effect
      const wrapper = document.createElement("div");
      wrapper.className = "favicon-wrapper";

      const faviconGray = document.createElement("img");
      faviconGray.className = "favicon";
      faviconGray.src = tab.favIconUrl;

      const faviconColor = document.createElement("img");
      faviconColor.className = "favicon-color";
      faviconColor.src = tab.favIconUrl;

      wrapper.appendChild(faviconGray);
      wrapper.appendChild(faviconColor);

      faviconGray.onerror = () => {
        wrapper.replaceWith(createFaviconPlaceholder(tab.title));
      };

      faviconEl = wrapper;
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

    // Drag and drop
    card.draggable = true;
    card.addEventListener("dragstart", handleDragStart);
    card.addEventListener("dragend", handleDragEnd);

    return card;
  }

  /**
   * Handle drag start event.
   * @param {DragEvent} e
   * @returns {void}
   */
  function handleDragStart(e) {
    const card = /** @type {HTMLDivElement} */ (e.currentTarget);
    draggedCard = card;
    draggedFromIndex = parseInt(card.dataset.index || "0", 10);
    currentDropIndex = draggedFromIndex;

    // Capture original positions of all cards before any shifts
    if (shadowRoot) {
      const cards = shadowRoot.querySelectorAll(".card");
      cardRects = Array.from(cards).map((c) => c.getBoundingClientRect());
    }

    // Use the card itself as drag image
    if (e.dataTransfer) {
      e.dataTransfer.effectAllowed = "move";
      e.dataTransfer.setData("text/plain", card.dataset.tabId || "");
      e.dataTransfer.setDragImage(
        card,
        card.offsetWidth / 2,
        card.offsetHeight / 2,
      );
    }

    requestAnimationFrame(() => {
      card.classList.add("dragging");
    });
  }

  /**
   * Handle drag end event - clean up all drag state and classes.
   * @param {DragEvent} e
   * @returns {void}
   */
  function handleDragEnd(e) {
    const card = /** @type {HTMLDivElement} */ (e.currentTarget);
    card.classList.remove("dragging");

    if (shadowRoot) {
      shadowRoot.querySelectorAll(".card").forEach((c) => {
        const el = /** @type {HTMLElement} */ (c);
        el.style.transform = "";
        el.classList.remove("animating");
      });
    }

    draggedCard = null;
    draggedFromIndex = null;
    currentDropIndex = null;
    cardRects = [];
  }

  /**
   * Update card positions to show where the dragged card will be inserted.
   * Uses FLIP technique for smooth animation.
   * @param {number} targetIndex
   * @returns {void}
   */
  function updateCardShifts(targetIndex) {
    if (!shadowRoot || draggedFromIndex === null || cardRects.length === 0) {
      return;
    }

    const fromIdx = draggedFromIndex;
    const cards = /** @type {NodeListOf<HTMLElement>} */ (
      shadowRoot.querySelectorAll(".card")
    );

    // Calculate where each card should visually end up
    // based on the reordering from fromIdx to targetIndex
    cards.forEach((c, idx) => {
      if (c === draggedCard) return;

      // Determine this card's visual target position
      let visualTarget = idx;

      if (fromIdx < targetIndex) {
        // Dragging right: cards between from+1 and target shift left by 1
        if (idx > fromIdx && idx <= targetIndex) {
          visualTarget = idx - 1;
        }
      } else if (fromIdx > targetIndex) {
        // Dragging left: cards between target and from-1 shift right by 1
        if (idx >= targetIndex && idx < fromIdx) {
          visualTarget = idx + 1;
        }
      }

      // Calculate transform from original position to target position
      const originalRect = cardRects[idx];
      const targetRect = cardRects[visualTarget];

      if (!originalRect || !targetRect) return;

      const deltaX = targetRect.left - originalRect.left;
      const deltaY = targetRect.top - originalRect.top;

      if (deltaX === 0 && deltaY === 0) {
        c.style.transform = "";
        return;
      }

      c.classList.add("animating");
      c.style.transform = `translate(${deltaX}px, ${deltaY}px)`;
    });
  }

  /**
   * Handle dragover on grid - track position and allow drop.
   * @param {DragEvent} e
   * @returns {void}
   */
  function handleGridDragOver(e) {
    e.preventDefault();
    if (e.dataTransfer) {
      e.dataTransfer.dropEffect = "move";
    }

    if (!draggedCard || draggedFromIndex === null || cardRects.length === 0) {
      return;
    }

    // Find which card position the cursor is over using original rects
    let targetIndex = draggedFromIndex;
    for (let i = 0; i < cardRects.length; i++) {
      const rect = cardRects[i];
      if (
        e.clientX >= rect.left &&
        e.clientX <= rect.right &&
        e.clientY >= rect.top &&
        e.clientY <= rect.bottom
      ) {
        targetIndex = i;
        break;
      }
    }

    if (targetIndex !== currentDropIndex) {
      currentDropIndex = targetIndex;
      updateCardShifts(targetIndex);
    }
  }

  /**
   * Handle drop on grid - move tab to tracked position.
   * @param {DragEvent} e
   * @returns {void}
   */
  function handleGridDrop(e) {
    e.preventDefault();

    if (
      !draggedCard ||
      draggedFromIndex === null ||
      currentDropIndex === null
    ) {
      return;
    }

    // Skip if dropping on same position
    if (currentDropIndex === draggedFromIndex) {
      return;
    }

    const tabId = parseInt(draggedCard.dataset.tabId || "0", 10);
    const windowId = parseInt(draggedCard.dataset.windowId || "0", 10);

    // Get the actual Chrome tab index from the target position
    const targetTab = currentTabs[currentDropIndex];
    if (!targetTab) return;

    chrome.runtime.sendMessage({
      type: "MOVE_TAB",
      tabId,
      windowId,
      newIndex: targetTab.index,
    });
  }

  /**
   * Create a placeholder element for a tab that has no favicon.
   * @param {string} title
   * @returns {HTMLDivElement}
   */
  function createFaviconPlaceholder(title) {
    const placeholder = document.createElement("div");
    placeholder.className = "favicon-placeholder";
    placeholder.textContent = title ? title.charAt(0).toUpperCase() : "?";
    return placeholder;
  }

  /**
   * Create the header content elements (logo, stats, close-all button).
   * @param {number} tabCount
   * @returns {[HTMLDivElement, HTMLDivElement]}
   */
  function createHeaderContent(tabCount) {
    // Logo
    const logo = document.createElement("div");
    logo.className = "logo";
    const logoImg = document.createElement("img");
    logoImg.src = chrome.runtime.getURL("icons/icon-48.png");
    const logoText = document.createElement("span");
    logoText.textContent = "DeskTab";
    logo.appendChild(logoImg);
    logo.appendChild(logoText);

    // Stats
    const stats = document.createElement("div");
    stats.className = "stats";
    const estimatedRAM = tabCount * ESTIMATED_RAM_PER_TAB_MB;

    // Tab count stat
    const tabStat = document.createElement("div");
    tabStat.className = "stat";
    const tabValue = document.createElement("span");
    tabValue.className = "stat-value";
    tabValue.textContent = String(tabCount);
    const tabLabel = document.createElement("span");
    tabLabel.className = "stat-label";
    tabLabel.textContent = "Open Tabs";
    tabStat.appendChild(tabValue);
    tabStat.appendChild(tabLabel);

    // RAM stat
    const ramStat = document.createElement("div");
    ramStat.className = "stat";
    const ramValue = document.createElement("span");
    ramValue.className = "stat-value";
    ramValue.textContent = `~${estimatedRAM}`;
    const ramLabel = document.createElement("span");
    ramLabel.className = "stat-label";
    ramLabel.textContent = "MB RAM";
    ramStat.appendChild(ramValue);
    ramStat.appendChild(ramLabel);

    const clearAllBtn = document.createElement("button");
    clearAllBtn.className = "clear-all-btn";
    clearAllBtn.textContent = "Close All";
    clearAllBtn.addEventListener("click", () => {
      chrome.runtime.sendMessage({ type: "CLOSE_ALL_TABS" });
    });

    stats.appendChild(tabStat);
    stats.appendChild(ramStat);
    stats.appendChild(clearAllBtn);

    return [logo, stats];
  }

  /**
   * Lock body and html scroll to prevent background scrolling while overlay
   * is open.
   * @returns {void}
   */
  function lockBodyScroll() {
    savedBodyOverflow = document.body.style.overflow;
    savedHtmlOverflow = document.documentElement.style.overflow;
    document.body.style.overflow = "hidden";
    document.documentElement.style.overflow = "hidden";
  }

  /**
   * Restore body and html scroll to their original values.
   * @returns {void}
   */
  function unlockBodyScroll() {
    document.body.style.overflow = savedBodyOverflow ?? "";
    document.documentElement.style.overflow = savedHtmlOverflow ?? "";
    savedBodyOverflow = null;
    savedHtmlOverflow = null;
  }

  /**
   * Hide the overlay with a fade-out animation and clean up listeners.
   * @returns {void}
   */
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
    document.removeEventListener("keydown", handleKeydown, true);
    unlockBodyScroll();
  }

  /**
   * Handle keyboard navigation within the overlay (arrows, Enter, Delete,
   * Escape).
   * @param {KeyboardEvent} e
   * @returns {void}
   */
  function handleKeydown(e) {
    if (!isOverlayVisible) return;

    // Ignore keyboard events while dragging
    if (draggedCard !== null) return;

    // Prevent all keyboard events from reaching the page
    e.preventDefault();
    e.stopPropagation();

    if (currentTabs.length === 0) return;

    const gridColumns = getGridColumns();

    switch (e.key) {
      case "Escape":
        hideOverlay();
        break;

      case "ArrowRight":
        selectedIndex = (selectedIndex + 1) % currentTabs.length;
        updateSelection();
        break;

      case "ArrowLeft":
        selectedIndex =
          (selectedIndex - 1 + currentTabs.length) % currentTabs.length;
        updateSelection();
        break;

      case "ArrowDown":
        selectedIndex = Math.min(
          selectedIndex + gridColumns,
          currentTabs.length - 1,
        );
        updateSelection();
        break;

      case "ArrowUp":
        selectedIndex = Math.max(selectedIndex - gridColumns, 0);
        updateSelection();
        break;

      case "Enter": {
        const selectedTab = currentTabs[selectedIndex];
        if (selectedTab) {
          switchToTab(selectedTab.id, selectedTab.windowId);
        }
        break;
      }

      case "Delete":
      case "Backspace": {
        const tabToClose = currentTabs[selectedIndex];
        if (tabToClose) {
          closeTab(tabToClose.id);
        }
        break;
      }
    }
  }

  /**
   * Calculate the number of grid columns based on the current viewport width.
   * @returns {number}
   */
  function getGridColumns() {
    const grid = shadowRoot?.querySelector(".grid");
    if (!grid) return 4;

    const gridWidth = /** @type {HTMLElement} */ (grid).clientWidth - 48; // Subtract padding
    const cardMinWidth = 140 + 16; // minmax value + gap
    return Math.max(1, Math.floor(gridWidth / cardMinWidth));
  }

  /**
   * Update the visual selection state across all tab cards.
   * @returns {void}
   */
  function updateSelection() {
    if (!shadowRoot) return;

    const cards = shadowRoot.querySelectorAll(".card");
    cards.forEach((card, index) => {
      card.classList.toggle("selected", index === selectedIndex);
    });

    scrollSelectedIntoView();
  }

  /**
   * Scroll the currently selected card into the visible area of the grid.
   * @returns {void}
   */
  function scrollSelectedIntoView() {
    if (!shadowRoot) return;

    const selectedCard = shadowRoot.querySelector(".card.selected");
    if (selectedCard) {
      selectedCard.scrollIntoView({ block: "nearest", behavior: "smooth" });
    }
  }

  /**
   * Send a message to the background script to close a tab.
   * @param {number} tabId
   * @returns {void}
   */
  function closeTab(tabId) {
    chrome.runtime.sendMessage({ type: "CLOSE_TAB", tabId });
  }

  /**
   * Send a message to the background script to switch to a tab, then hide
   * the overlay.
   * @param {number} tabId
   * @param {number} windowId
   * @returns {void}
   */
  function switchToTab(tabId, windowId) {
    chrome.runtime.sendMessage({ type: "SWITCH_TAB", tabId, windowId });
    hideOverlay();
  }

  /**
   * Update the overlay grid after a tab has been closed.
   * @param {TabInfo[]} tabs
   * @returns {void}
   */
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
    const header = shadow.querySelector(".header");

    if (grid && tabs.length > 0) {
      grid.innerHTML = "";

      tabs.forEach((tab, index) => {
        const card = createTabCard(tab, index);
        grid.appendChild(card);
      });

      // Update header stats
      if (header) {
        header.innerHTML = "";
        header.append(...createHeaderContent(tabs.length));
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
