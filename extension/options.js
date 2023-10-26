const select = document.getElementById("language");
const popups = document.getElementById("popups");
const popupFontSize = document.getElementById("popupFontSize");

chrome.runtime.sendMessage({ command: "get-language" }, (response) => {
  select.value = response;
});

chrome.runtime.sendMessage({ command: "get-popup-mode" }, (response) => {
  popups.checked = response;
});

chrome.runtime.sendMessage({ command: "get-popup-fontsize" }, (response) => {
  popupFontSize.value = response;
});

select.addEventListener("change", (_) => {
  chrome.runtime.sendMessage({ command: "set-language", language: select.value });
});

popups.addEventListener("change", (_) => {
  chrome.runtime.sendMessage({ command: "set-popup-mode", popup_mode: popups.checked });
});

popupFontSize.addEventListener("change", (_) => {
  chrome.runtime.sendMessage({ command: "set-popup-fontsize", popup_fontsize: popupFontSize.value });
});
