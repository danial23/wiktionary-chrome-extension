var currentWord = ""; //as shown on extension panel
var isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 1000; //delay amount in ms
const cooldownDuration = 3000;
var timeoutId = -1;

chrome.runtime.onMessage.addListener(function(selection) {
  const word = selection.trim();

  if (currentWord === word) {
    clearTimeout(timeoutId);
    getCooldown();
    return;
  }

  if (word === "") {
    return;
  }

  if (isOnCooldown) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(getWordDefinition, requestDelay, word);
  } else {
    getWordDefinition(word);
  }
});

document.getElementById("wiktionary").focus();

function getWordDefinition(word) {
  getCooldown();

  document.getElementById("wiktionary").src =
    "https://en.m.wiktionary.org/wiki/" + word;
  currentWord = word;
}

function getCooldown() {
  isOnCooldown = true;
  timeoutId = setTimeout(() => {
    isOnCooldown = false;
  }, cooldownDuration);
}
