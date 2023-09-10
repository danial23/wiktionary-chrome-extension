import feature_flags from "./feature-flags.js";
let popup_mode = false;
let language = "en";
let lastSearch = "";

chrome.storage.local.get("popup_mode", (result) => {
  popup_mode = result ? result.popup_mode : false;
});

chrome.storage.local.get("language", (result) => {
  if (result && result.language) {
    language = result.language;
  } else {
    chrome.storage.local.set({ language: "en" });
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function setupContextMenu() {
  chrome.contextMenus.create({
    id: "wiktionary",
    title: "Wiktionary search",
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

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.command == "get-language") {
    sendResponse(language);
  }
});

chrome.runtime.onMessage.addListener((request) => {
  if (request.command == "set-language") {
    language = request.language;
    chrome.storage.local.set({ language: language });
  }
});

chrome.runtime.onMessage.addListener((request, _) => {
  if (request.command == "search") {
    lastSearch = request.text;
  }
});

chrome.runtime.onMessage.addListener((request, _, sendResponse) => {
  if (request.command == "get-last-search") {
    sendResponse(lastSearch);
  }
});

chrome.windows.onRemoved.addListener((_) => {
  lastSearch = "";
});
