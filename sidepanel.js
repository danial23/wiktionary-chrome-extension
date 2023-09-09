let isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 500; //delay amount in ms
const cooldownDuration = 1500;
let timeoutId = -1;
let url = "https://en.m.wiktionary.org";
const wiktionary = document.getElementById("wiktionary");

chrome.runtime.onMessage.addListener((message) => {
  if (message.command == "search") {
    if (isOnCooldown) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(showDefinition, requestDelay, message.text);
    } else {
      isOnCooldown = true;
      timeoutId = setTimeout(() => {
        isOnCooldown = false;
      }, cooldownDuration);
      showDefinition(message.text);
    }
  }
});

chrome.runtime.sendMessage({ command: "get-language" }, (response) => {
  changeLanguage(response);
  chrome.runtime.sendMessage({ command: "get-last-search" }, showDefinition);
});

function changeLanguage(language) {
  url = "https://" + language + ".m.wiktionary.org";
  wiktionary.src = url;
  wiktionary.focus();
}

function showDefinition(text) {
  if (text) {
    wiktionary.src =
      url + "/wiki/" + text.replaceAll(" ", "_");
  }
}

chrome.runtime.onMessage.addListener((message) => {
  if (message.command == "set-language") {
    changeLanguage(message.language);
  }
});
