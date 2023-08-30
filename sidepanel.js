let isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 1000; //delay amount in ms
const cooldownDuration = 3000;
let timeoutId = -1;

chrome.runtime.onMessage.addListener((message) => {
  if (message.command == "search") {
    if (isOnCooldown) {
      clearTimeout(timeoutId);
      timeoutId = setTimeout(getWordDefinition, requestDelay, message.text);
    } else {
      isOnCooldown = true;
      timeoutId = setTimeout(() => {
        isOnCooldown = false;
      }, cooldownDuration);
      getWordDefinition(message.text);
    }
  }
});

document.getElementById("wiktionary").focus();

function getWordDefinition(text) {
  document.getElementById("wiktionary").src =
    "https://en.m.wiktionary.org/wiki/" + text.replace(" ", "_");
}
