import feature_flags from "./feature-flags.js";
let popup_mode = false;

chrome.storage.local.get("popup_mode", (result) => {
  popup_mode = result === undefined ? false : result;
});

function setupContextMenu() {
  chrome.contextMenus.create({
    id: "wiktionary",
    title: "Wiktionary Search",
    contexts: ["selection"],
  });
}

chrome.runtime.onInstalled.addListener(() => {
  setupContextMenu();
});

chrome.contextMenus.onClicked.addListener(async (info, tab) => {
  const options = chrome.sidePanel.getOptions({ tabId: tab.id });
  if (options.enabled) {
    chrome.runtime.sendMessage(info.selectionText);
  } else {
    if (tab.windowId != -1) {
      await chrome.sidePanel.open({ windowId: tab.windowId });
    }
    setTimeout(chrome.runtime.sendMessage, 500, {
      command: "search",
      text: info.selectionText,
    });
  }
});

chrome.commands.onCommand.addListener(async (command) => {
  if (command == "toggle-popup-mode") {
    popup_mode = !popup_mode;
    chrome.storage.local.set({ popup_mode: popup_mode });
    const [tab] = await chrome.tabs.query({
      active: true,
      lastFocusedWindow: true,
    });
    chrome.tabs.sendMessage(tab.id, {
      command: "set-popup-mode",
      popup_mode: popup_mode,
    });
  }
});

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.command == "get-popup-mode") {
    sendResponse(popup_mode);
  }
});

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.command == "get-feature-flags") {
    sendResponse(feature_flags);
  }
});
