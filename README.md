<p align="center">
  <img src="src/icons/icon-128.png" width="100" alt="DeskTab" />
</p>

<h1 align="center">DeskTab</h1>

<p align="center">
  <strong>Tidy up your tabs.</strong><br/>
  A minimal Chrome extension that gives you a beautiful overview of all your open tabs — right from any page.
</p>

<p align="center">
  <img src="https://img.shields.io/badge/manifest-v3-blue" alt="Manifest V3" />
  <img src="https://img.shields.io/badge/version-1.1.1-green" alt="Version 1.1.1" />
  <img src="https://img.shields.io/badge/license-MIT-lightgrey" alt="License" />
</p>

---

## How It Works

Hit **`Cmd + .`** (Mac) or **`Ctrl + .`** (Windows/Linux) — or just click the toolbar icon — and a sleek overlay appears on top of your current page showing every open tab across all windows.

From there you can **switch**, **close**, or **close all** tabs without ever leaving the page.

## Features

- **Instant overlay** — no new tab, no popup, just a smooth full-screen overlay
- **Keyboard-first navigation** — arrow keys to browse, Enter to switch, Delete to close, Escape to dismiss
- **Click the icon or use the shortcut** — both toggle the overlay
- **Glassmorphism UI** — dark translucent backdrop with blur, subtle animations, and responsive grid layout
- **Favicon color reveal** — favicons animate from grayscale to full color on hover
- **Active tab indicator** — green border highlights the tab you're currently on
- **RAM estimate** — see an approximate memory footprint based on your tab count
- **Drag to reorder** — rearrange tabs by dragging cards to a new position
- **Close all** — one button to close every tab except the current one
- **Works everywhere it can** — on restricted pages (chrome://, Web Store), a helpful popup explains the limitation

## Install

1. Clone or download this repo
2. Open `chrome://extensions` in Chrome
3. Enable **Developer mode** (top-right toggle)
4. Click **Load unpacked** and select the project folder
5. Pin DeskTab to your toolbar for quick access

## Usage

| Action | Trigger |
|---|---|
| Toggle overlay | `Cmd + .` / `Ctrl + .` or click the toolbar icon |
| Navigate tabs | Arrow keys |
| Switch to tab | Click the card or press `Enter` |
| Close a tab | Hover and click `×` or press `Delete` / `Backspace` |
| Reorder tabs | Drag and drop cards |
| Close all tabs | Click the **Close All** button in the header |
| Dismiss overlay | Press `Escape` or click the backdrop |

## Permissions

DeskTab only requests the **`tabs`** permission — needed to list, switch, and close your tabs. No data leaves your browser.

## Tech

- Chrome Extension Manifest V3
- Vanilla JavaScript — no frameworks, no build step
- Content script injects the overlay UI
- Background service worker handles tab operations

---

<p align="center">
  Built for people with too many tabs.
</p>
