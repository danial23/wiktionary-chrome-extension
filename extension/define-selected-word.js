const cooldownDuration = 500; // ms
const maxCharacterCount = 100;

let feature_flags;
let popup = null;
let popupAbortController = null;
let allowPopups = true; // set to true to enable popups on current page

(async () => {
  // get feature flags from service worker
  feature_flags = await new Promise((resolve) => {
    chrome.runtime.sendMessage({ command: "get-feature-flags" }, resolve);
  });
})();

async function get_popup_mode() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ command: "get-popup-mode" }, resolve);
  });
}

async function get_popup_fontsize() {
  return new Promise((resolve) => {
    chrome.runtime.sendMessage({ command: "get-popup-fontsize" }, resolve);
  });
}

window.addEventListener("resize", () => {
  if (popup) {
    setupPopupPosition(popup);
  }
});

document.addEventListener("selectionchange", updatePopupAndSearch);

async function updatePopupAndSearch() {
  const selection = document.getSelection();

  removePopup();

  if (shouldDefineSelection(selection) && (await get_popup_mode()) && allowPopups) {
    showPopupWithCooldown(selection.toString().trim());
  }

  chrome.runtime.sendMessage(
    { command: "search", text: shouldDefineSelection(selection) ? selection.toString().trim() : "" },
    () => {
      if (chrome.runtime.lastError) {
        // ignore
      }
    }
  );
}

// enable/disable popup mode on message from service worker
chrome.runtime.onMessage.addListener((request, sender) => {
  if (!sender.tab && request.command == "set-popup-mode") {
    removePopup();

    if (request.popup_mode) {
      const selection = document.getSelection();

      if (shouldDefineSelection(selection) && allowPopups) {
        showPopupWithCooldown(selection.toString().trim());
      }
    }
  }
});

function shouldDefineSelection(selection) {
  return !isSelectionEmpty(selection)
    && !isSelectionInEditableArea(selection)
    && selection.toString().trim().length <= maxCharacterCount;
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
  allowPopups = false;
  if (popupAbortController) {
    popupAbortController.abort();
  }
  removePopup();
  setTimeout(() => {
    allowPopups = true;
  }, 100);
});

// cooldown behaviour: if a new req comes in while still busy,
// cancel the old one and issue a cooldown. The popup will be
// shown if the req is still active after the cooldown.
async function showPopupWithCooldown(text) {
  const ac = new AbortController();
  if (popupAbortController) {
    // if there's an active req, cancel it and issue a cooldown
    popupAbortController.abort();
    popupAbortController = ac;
    await new Promise((resolve) => setTimeout(resolve, cooldownDuration));
  } else {
    popupAbortController = ac;
  }

  // are we still the active req?
  if (!ac.signal.aborted) {
    await showPopup(text, ac.signal);
  }

  // Don't clear the abort controller just yet.
  // We want to eliminate quick-flashing popups
  // when selectionchange is fired rapidly.
  await new Promise((resolve) => setTimeout(resolve, cooldownDuration));

  // if there's no new req, clear the abort controller
  if (popupAbortController == ac) {
    popupAbortController = null;
  }
}

async function showPopup(text, abortSignal) {
  popup = document.createElement("div");
  popup.setAttribute("id", "wiktionary-popup");
  popup.style.fontSize = await get_popup_fontsize() + "pt";

  const usages = await getPossibleUsages(text, abortSignal);
  if (usages.length > 0 && !abortSignal.aborted) {
    popup.appendChild(popupContent(usages));
    document.getElementsByTagName("html")[0].append(popup);
    setupPopupPosition(popup);
  }
}

async function sortResultsByLanguagePreferences(usages) {
  const doc_lang = document.documentElement.lang.split("-", 1)[0];
  const user_lang = window.navigator.language.split("-", 1)[0];
  const order_preference = [user_lang, "en", doc_lang]; // from least preferred to most

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
}

// returns a list of usages asynchroniously
// includes usages for the lowercase variant
// (TODO: make this smarter - context dependent?)
async function getPossibleUsages(text, abortSignal) {
  const text_lowercase = text.toLowerCase();
  const requests = [fetchUsages(text, abortSignal)];
  if (text != text_lowercase) {
    requests.push(fetchUsages(text_lowercase, abortSignal));
  }
  const usages = [];
  for (const request of requests) {
    usages.push(...(await request));
  }

  sortResultsByLanguagePreferences(usages);

  return usages;
}

// returns a list of usages for the given entry by contacting the api
// low level function, doesn't do any sorting
async function fetchUsages(entry, abortSignal) {
  const usages = [];
  const response = await fetch(
    "https://en.wiktionary.org/api/rest_v1/page/definition/" +
    entry.replaceAll(" ", "_"),
    { signal: abortSignal }
  ).catch((e) => {
    if (e.name != "AbortError") {
      throw e;
    }
  });

  if (!response || response.status != 200) {
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

function removePopup() {
  if (popup) {
    try {
      document.getElementsByTagName("html")[0].removeChild(popup);
    }
    catch (e) {
      // ignore
      // this can happen if the popup is removed by the context menu
    }
    popup = null;
  }
}

function setupPopupPosition(popup) {
  const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
  x = window.scrollX + (rect.left + rect.right - popup.offsetWidth) / 2;
  x = Math.max(10, Math.min(x, window.innerWidth - popup.offsetWidth - 10)); // clamp position to screen size
  y = window.scrollY + rect.top - popup.offsetHeight - 10;
  if (y < window.scrollY + 10) {
    y = window.scrollY + rect.bottom + 10;
  }
  popup.style.top = Math.round(y) + "px";
  popup.style.left = Math.round(x) + "px";
}

// returns a div containing the contents of the popup
function popupContent(usages) {
  // abandon all hope, ye who enter here
  const container = document.createElement("div");
  container.setAttribute("id", "wiktionary-popup-contents");

  // jk it's not that bad
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
      cleanup(def_text);
      if (!def_text.textContent || def_text.textContent.charAt(0) == "↑") {
        // if the definition is empty or is a book reference, skip it (dataset bugs)
        continue;
      }
      def_text.setAttribute("class", "wiktionary-popup-definition-text");
      def.appendChild(def_text);
      list.appendChild(def);

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
          cleanup(example_text);
          example_text.setAttribute("class", "wiktionary-popup-example-text");
          example.appendChild(example_text);
        }
      }
    }
  }

  return container;
}

// replaces all elements within elem with spans
// removes ol and li elements (dataset bugs)
// prunes empty elements
function cleanup(elem) {
  for (const child of elem.children) {
    if (
      child.nodeName == "OL" ||
      child.nodeName == "UL" ||
      child.nodeName == "LI"
    ) {
      elem.removeChild(child);
      continue;
    }

    if (child.nodeName == "math") {
      continue;
    }

    cleanup(child);

    let elem2 = document.createElement("span");
    switch (child.nodeName) {
      case "A":
        elem2.setAttribute("class", "wiktionary-popup-link");
        // some links are internal to wiktionary, some are external
        // we need to handle them differently
        const link = child.getAttribute("href");
        if (link.startsWith("/wiki/")) {
          if (link.startsWith("/wiki/Template:")
            || link.startsWith("/wiki/Help:")
            || link.startsWith("/wiki/Category:")
            || link.startsWith("/wiki/Module:")
            || link.startsWith("/wiki/Portal:")
            || link.startsWith("/wiki/Appendix:")
            || link.startsWith("/wiki/Reconstruction:")
            || link.startsWith("/wiki/Citations:")
            || link.startsWith("/wiki/Thread:")
            || link.startsWith("/wiki/Topic:")
            || link.startsWith("/wiki/WT:")
            || link.startsWith("/wiki/Wiktionary:")) {
            elem2.addEventListener("click", (_) => {
              window.open("https://en.wiktionary.org" + link);
            });
          } else {
            elem2.addEventListener("click", (_) => {
              navigateWithinPopup(link);
            });
          }
        }
        else {
          elem2.addEventListener("click", (_) => {
            window.open(link);
          });
        }
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
      case "SPAN":
        if (child.style.display === "inline-block" && child.style.width === "80px") {
          elem2.style.backgroundColor = child.style.backgroundColor;
          elem2.style.display = "inline-block";
          elem2.style.width = "5em";
        }
        break;
      default:
        break;
    }

    elem2.append(...child.childNodes);
    child.replaceWith(elem2);
  }
}

// navigate to a new definition within the popup
async function navigateWithinPopup(link) {
  if (!popup) {
    return;
  }
  const contents = popup.firstElementChild;
  contents.setAttribute("style", "cursor: wait;");

  const usages = await fetchUsages(link.slice(6).replaceAll("_", " ").split("#")[0]); // removes "/wiki/" and "#..."
  sortResultsByLanguagePreferences(usages);

  if (popup.firstElementChild) {
    popup.removeChild(popup.firstElementChild);
  }
  popup.appendChild(popupContent(usages));
  popup.scrollTop = 0;

  setupPopupPosition(popup);
}
