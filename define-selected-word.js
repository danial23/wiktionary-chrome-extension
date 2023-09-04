let feature_flags;
const popup_width = 320,
  popup_height = 240; // change in css as well

let popupAbortController = null;

let isOnCooldown = false; //will delay sending new requests during cooldown
const cooldownDuration = 1500;
const newCooldownDuration = 500; // for async popup
const requestDelay = 500;
let timeoutId = -1;

(async () => {
  // get feature flags from service worker
  feature_flags = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ command: "get-feature-flags" }, resolve);
  });

  // setup popup mode if enabled
  if (await get_popup_mode()) {
    document.addEventListener("selectionchange", popupEventHandler);
  }
})();

async function get_popup_mode() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ command: "get-popup-mode" }, resolve);
  });
}

// search on word select
document.addEventListener("selectionchange", () => {
  const selection = document.getSelection();
  if (shouldDefineSelection(selection)) {
    chrome.runtime.sendMessage(
      { command: "search", text: selection.toString().trim() },
      () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      }
    );
  }
});

// enable/disable popup mode on message from service worker
chrome.runtime.onMessage.addListener((request, sender) => {
  if (!sender.tab && request.command == "set-popup-mode") {
    if (request.popup_mode) {
      document.addEventListener("selectionchange", popupEventHandler);
      const selection = document.getSelection();
      if (shouldDefineSelection(selection)) {
        showPopupWithCooldown(selection.toString().trim());
      }
    } else {
      document.removeEventListener("selectionchange", popupEventHandler);
      removePopup();
    }
  }
});

async function popupEventHandler() {
  const selection = document.getSelection();

  removePopup();

  if (shouldDefineSelection(selection)) {
    showPopupWithCooldown(selection.toString().trim());
  }
}

function shouldDefineSelection(selection) {
  return !isSelectionEmpty(selection) && !isSelectionInEditableArea(selection);
}

function isSelectionEmpty(selection) {
  return selection.type != "Range" || !selection.toString().trim();
}

function isSelectionInEditableArea(selection) {
  return (
    selection.anchorNode.parentNode.isContentEditable ||
    ["INPUT", "TEXTAREA"].includes(document.activeElement.nodeName)
  );
}

document.addEventListener("contextmenu", () => {
  document.removeEventListener("selectionchange", popupEventHandler);
  removePopup();
  setTimeout(() => {
    if (popupAbortController) {
      popupAbortController.abort();
    }
    document.addEventListener("selectionchange", popupEventHandler);
  }, 3); // anything >1 works. What's the most reliable value?
});

function showPopupWithCooldown(text) {
  if (feature_flags.asyncPopup) {
    newShowPopupWithCooldown(text);
  } else {
    oldShowPopupWithCooldown(text);
  }
}

// cooldown behaviour: if a new req comes in while still busy,
// cancel the old one and issue a cooldown. The popup will be
// shown if the req is still active after the cooldown.
async function newShowPopupWithCooldown(text) {
  const ac = new AbortController();
  if (popupAbortController) {
    // if there's an active req, cancel it and issue a cooldown
    popupAbortController.abort();
    popupAbortController = ac;
    await new Promise((resolve) => setTimeout(resolve, newCooldownDuration));
  } else {
    popupAbortController = ac;
  }

  // are we still the active req?
  if (!ac.signal.aborted) {
    await newShowPopup(text, ac.signal);
  }

  // Don't clear the abort controller just yet.
  // We want to eliminate quick-flashing popups
  // when selectionchange is fired rapidly.
  await new Promise((resolve) => setTimeout(resolve, newCooldownDuration));

  // if there's no new req, clear the abort controller
  if (popupAbortController == ac) {
    popupAbortController = null;
  }
}

async function newShowPopup(text, abortSignal) {
  popup = document.createElement("div");
  popup.setAttribute("id", "wiktionary-popup");

  const usages = await newGetDefinitions(text, abortSignal);
  if (usages.length > 0 && !abortSignal.aborted) {
    popup.appendChild(popupContent(usages));
    document.getElementsByTagName("html")[0].append(popup);
    setupPopupPosition(popup);
  }
}

async function newGetDefinitions(text, abortSignal) {
  const text_lowercase = text.toLowerCase();
  const doc_lang = document.documentElement.lang.split("-", 1)[0];
  const user_lang = window.navigator.language.split("-", 1)[0];
  const order_preference = [user_lang, "en", doc_lang]; // from least preferred to most
  const requests = [fetchDefinitions(text, abortSignal)];
  if (text != text_lowercase) {
    requests.push(fetchDefinitions(text_lowercase, abortSignal));
  }
  const usages = [];
  for (const request of requests) {
    usages.push(...(await request));
  }

  usages.sort((a, b) => {
    // lowercase entries have a lower preference
    if (a.key.entry.localeCompare(b.key.entry) != 0) {
      return b.key.entry.localeCompare(a.key.entry);
    }
    if (
      order_preference.findIndex((lang) => lang == a.key.lang) !=
      order_preference.findIndex((lang) => lang == b.key.lang)
    ) {
      return (
        order_preference.findIndex((lang) => lang == b.key.lang) -
        order_preference.findIndex((lang) => lang == a.key.lang)
      );
    }
    if (a.key.lang != b.key.lang) {
      return a.key.lang.localeCompare(b.key.lang);
    }
    return a.key.index - b.key.index;
  });

  return usages;
}

async function newFetchDefinitions(entry, abortSignal) {
  const usages = [];
  const response = await fetch(
    "https://en.wiktionary.org/api/rest_v1/page/definition/" +
      entry.replace(" ", "_"),
    { signal: abortSignal }
  );

  if (response.status != 200) {
    return [];
  }

  const json = await response.json();
  for (const key of Object.keys(json)) {
    json[key].forEach((usage, index) => {
      usages.push({
        key: { entry: entry, lang: key, index: index },
        usage: usage,
      });
    });
  }
  return usages;
}

function oldShowPopupWithCooldown(text) {
  if (isOnCooldown) {
    clearTimeout(timeoutId);
    timeoutId = setTimeout(showPopup, requestDelay, text);
  } else {
    isOnCooldown = true;
    timeoutId = setTimeout(() => {
      isOnCooldown = false;
    }, cooldownDuration);
    showPopup(text);
  }
}

async function getDefinitions(text) {
  const text_lowercase = text.toLowerCase();
  const doc_lang = document.documentElement.lang.split("-", 1)[0];
  const user_lang = window.navigator.language.split("-", 1)[0];
  const order_preference = [user_lang, "en", doc_lang]; // from least preferred to most
  const usages = await fetchDefinitions(text);
  if (text != text_lowercase) {
    usages.push(...(await fetchDefinitions(text_lowercase)));
  }

  usages.sort((a, b) => {
    // lowercase entries have a lower preference
    if (a.key.entry.localeCompare(b.key.entry) != 0) {
      return b.key.entry.localeCompare(a.key.entry);
    }
    if (
      order_preference.findIndex((lang) => lang == a.key.lang) !=
      order_preference.findIndex((lang) => lang == b.key.lang)
    ) {
      return (
        order_preference.findIndex((lang) => lang == b.key.lang) -
        order_preference.findIndex((lang) => lang == a.key.lang)
      );
    }
    if (a.key.lang != b.key.lang) {
      return a.key.lang.localeCompare(b.key.lang);
    }
    return a.key.index - b.key.index;
  });

  return usages;
}

async function fetchDefinitions(entry) {
  const usages = [];
  const response = await fetch(
    "https://en.wiktionary.org/api/rest_v1/page/definition/" +
      entry.replace(" ", "_")
  );

  if (response.status != 200) {
    return [];
  }

  const json = await response.json();
  for (const key of Object.keys(json)) {
    json[key].forEach((usage, index) => {
      usages.push({
        key: { entry: entry, lang: key, index: index },
        usage: usage,
      });
    });
  }
  return usages;
}

async function showPopup(text) {
  popup = document.createElement("div");
  popup.setAttribute("id", "wiktionary-popup");

  const usages = await getDefinitions(text);
  if (usages.length > 0) {
    popup.appendChild(popupContent(usages));
  } else {
    return; // don't show popup if no definitions are found

    // const no_def = document.createElement("div");
    // no_def.setAttribute("style", "text-align: center; width: 100%;");
    // popup.append(no_def);
    // no_def.innerHTML = "No definition found for <em>" + text + "</em>";
  }

  document.getElementsByTagName("html")[0].append(popup);
  setupPopupPosition(popup);
}

function removePopup() {
  const popup = document.getElementById("wiktionary-popup");
  if (popup) {
    document.getElementsByTagName("html")[0].removeChild(popup);
  }
}

function setupPopupPosition(popup) {
  const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
  x = window.scrollX + (rect.left + rect.right - popup.offsetWidth) / 2;
  x = Math.max(10, Math.min(x, window.innerWidth - 10)); // clamp position to screen size
  y = window.scrollY + rect.top - popup.offsetHeight - 10;
  if (y < window.scrollY + 10) {
    y = window.scrollY + rect.bottom + 10;
  }
  popup.setAttribute(
    "style",
    "top:" + Math.round(y) + "px; left:" + Math.round(x) + "px;"
  );
}

// abandon all hope, ye who enter here
function popupContent(usages) {
  const container = document.createElement("div");
  container.setAttribute("id", "wiktionary-popup-contents");

  for (const usage of usages) {
    const usage_container = document.createElement("div");
    usage_container.setAttribute("class", "wiktionary-popup-usage");
    container.appendChild(usage_container);

    const entry = document.createElement("div");
    entry.setAttribute("class", "wiktionary-popup-entry");
    usage_container.appendChild(entry);

    const entry_text = document.createElement("span");
    entry_text.setAttribute("class", "wiktionary-popup-entry-text");
    entry_text.textContent = usage.key.entry;
    entry.appendChild(entry_text);

    const pos = document.createElement("span");
    pos.textContent = " • " + usage.usage.partOfSpeech;
    pos.setAttribute("class", "wiktionary-popup-entry-pos");
    entry.appendChild(pos);

    const language = document.createElement("span");
    language.textContent = " " + usage.usage.language;
    language.setAttribute("class", "wiktionary-popup-entry-language");
    entry.appendChild(language);

    const list = document.createElement("div");
    list.setAttribute("class", "wiktionary-popup-definitions");
    usage_container.appendChild(list);

    for (const definition of usage.usage.definitions) {
      let def = document.createElement("div");
      def.setAttribute("class", "wiktionary-popup-definition");

      let def_text = document.createElement("div");
      def_text.innerHTML = definition.definition;
      cleanRecursive(def_text);
      def_text.setAttribute("class", "wiktionary-popup-definition-text");
      def.appendChild(def_text);

      if ("examples" in definition) {
        let examples = document.createElement("div");
        examples.setAttribute("class", "wiktionary-popup-examples");
        def.appendChild(examples);

        for (const example_html of definition.examples) {
          let example = document.createElement("div");
          example.setAttribute("class", "wiktionary-popup-example");
          examples.appendChild(example);

          let example_text = document.createElement("div");
          example_text.innerHTML = example_html;
          cleanRecursive(example_text);
          example_text.setAttribute("class", "wiktionary-popup-example-text");
          example.appendChild(example_text);
        }
      }

      if (def.textContent && def.textContent.charAt(0) != "↑") {
        list.appendChild(def);
      }
    }
  }

  return container;
}

// replaces all elements with spans
// removes ol and li elements (dataset bugs)
// prunes empty elements
function cleanRecursive(elem) {
  for (const child of elem.children) {
    if (
      child.nodeName == "OL" ||
      child.nodeName == "UL" ||
      child.nodeName == "LI" ||
      !child.textContent
    ) {
      elem.removeChild(child);
      continue;
    }

    cleanRecursive(child);

    let elem2 = document.createElement("span");
    switch (child.nodeName) {
      case "A":
        elem2.setAttribute("class", "wiktionary-popup-link");
        break;
      case "B":
      case "STRONG":
        elem2.setAttribute("class", "wiktionary-popup-bold");
        break;
      case "I":
      case "EM":
        elem2.setAttribute("class", "wiktionary-popup-italic");
        break;
      case "SUB":
        elem2.setAttribute("class", "wiktionary-popup-sub");
        break;
      case "SUP":
        elem2.setAttribute("class", "wiktionary-popup-sup");
        break;
      default:
        break;
    }

    [...child.childNodes].forEach((child) => elem2.appendChild(child));
    child.replaceWith(elem2);
  }
}
