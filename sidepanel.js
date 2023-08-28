var isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 1000; //delay amount in ms
const cooldownDuration = 3000;
var timeoutId = -1;

chrome.runtime.onMessage.addListener(function (selection) {
  const word = selection.trim();

  if (isOnCooldown) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(getWordDefinition, requestDelay, word);
  } else {
    isOnCooldown = true;
    timeoutId = setTimeout(() => {
      isOnCooldown = false;
    }, cooldownDuration);
    getWordDefinition(word);
  }
});

document.getElementById("wiktionary").focus();

function getWordDefinition(word) {
  document.getElementById("wiktionary").src =
    "https://en.m.wiktionary.org/wiki/" + word;
  currentWord = word;
}
