import feature_flags from "./feature-flags.js";
let popup_mode = true;
let popup_fontsize = 12;
let language = "en";
let lastSearch = "";

chrome.storage.local.get("popup_mode", (result) => {
  popup_mode = result ? result.popup_mode : true;
});

chrome.storage.local.get("language", (result) => {
  if (result && result.language) {
    language = result.language;
  } else {
    chrome.storage.local.set({ language: "en" });
  }
});

chrome.storage.local.get("popup_fontsize", (result) => {
  if (result && result.popup_fontsize) {
    popup_fontsize = result.popup_fontsize;
  } else {
    chrome.storage.local.set({ popup_fontsize: 12 });
  }
});

chrome.sidePanel
  .setPanelBehavior({ openPanelOnActionClick: true })
  .catch((error) => console.error(error));

function setupContextMenu() {
  chrome.contextMenus.create({
    id: "wiktionary",
    title: "Search on Wiktionary.org",
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
  switch (request.command) {
    case "get-feature-flags":
      sendResponse(feature_flags);
      break;
    case "get-popup-mode":
      sendResponse(popup_mode);
      break;
    case "set-popup-mode":
      popup_mode = request.popup_mode;
      chrome.storage.local.set({ popup_mode: popup_mode });
      break;
    case "get-language":
      sendResponse(language);
      break;
    case "set-language":
      language = request.language;
      chrome.storage.local.set({ language: language });
      break;
    case "search":
      lastSearch = request.text;
      break;
    case "get-last-search":
      sendResponse(lastSearch);
      break;
    case "get-popup-fontsize":
      sendResponse(popup_fontsize);
      break;
    case "set-popup-fontsize":
      popup_fontsize = request.popup_fontsize;
      chrome.storage.local.set({ popup_fontsize: popup_fontsize });
      break;
    default: throw new Error("Unknown command");
  }
});

chrome.windows.onRemoved.addListener((_) => {
  lastSearch = "";
});
