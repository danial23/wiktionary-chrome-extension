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
    await chrome.sidePanel.open({ windowId: tab.windowId }); //available in Chrome v116 only
    setTimeout(chrome.runtime.sendMessage, 500, info.selectionText);
  }
});
