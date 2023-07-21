document.onselectionchange = () => {
  const selection = document.getSelection();
  if (selection.type == "Range") {
    chrome.runtime.sendMessage(selection.toString());
  }
};
