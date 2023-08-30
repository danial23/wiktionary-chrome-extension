let popup_mode = false;
const popup_width = 320,
  popup_height = 240; // change in css as well

let isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 500; //delay amount in ms
const cooldownDuration = 1500;
let timeoutId = -1;

(async () => {
  const response = await chrome.runtime.sendMessage({
    command: "get-popup-mode-state",
  });
  popup_mode = response;
})();

chrome.runtime.onMessage.addListener((request, sender) => {
  if (!sender.tab && request.command == "set-popup-mode") {
    popup_mode = request.popup_mode;
    if (popup_mode) {
      const selection = document.getSelection();
      if (selection.type == "Range" && selection.toString().trim()) {
        showPopupWithCooldown(selection.toString().trim());
      }
    } else {
      removePopup();
    }
  }
});

document.oncontextmenu = () => {
  removePopup();
};

document.onselectionchange = () => {
  chrome.runtime.sendMessage(
    { command: "get-popup-mode-state" },
    (response) => {
      popup_mode = response;
    }
  );
  const selection = document.getSelection();
  if (selection.type == "Range") {
    let text = selection.toString().trim();

    if (!text) {
      removePopup();
      return;
    }

    if (popup_mode) {
      showPopupWithCooldown(text);
    } else {
      chrome.runtime.sendMessage({ command: "search", text: text }, () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    }
  } else {
    removePopup();
  }
};

function showPopupWithCooldown(text) {
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
  removePopup();

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
