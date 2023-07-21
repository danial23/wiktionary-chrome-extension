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

chrome.contextMenus.onClicked.addListener((info, tab) => {
  // chrome.sidePanel.open({ windowId: tab.windowId }); //available in Chrome v116 only
  chrome.runtime.sendMessage(info.selectionText);
});
