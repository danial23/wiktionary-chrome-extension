let popup_hotkey_pressed = false;
const popup_width = 320,
  popup_height = 240; // change in css as well

var isOnCooldown = false; //will delay sending new requests during cooldown
const requestDelay = 500; //delay amount in ms
const cooldownDuration = 1500;
var timeoutId = -1;

function getCooldown() {}

document.onselectionchange = () => {
  const selection = document.getSelection();
  if (selection.type == "Range") {
    let text = selection.toString().trim();
    if (!text) {
      removePopup();
      return;
    }
    if (popup_hotkey_pressed) {
      showPopupWithCooldown(text);
    } else {
      chrome.runtime.sendMessage(text, () => {
        if (chrome.runtime.lastError) {
          // ignore
        }
      });
    }
  } else {
    removePopup();
  }
};

onkeydown = (e) => {
  if (e.key == "Control") {
    popup_hotkey_pressed = true;
  }
};

onkeyup = (e) => {
  if (e.key == "Control") {
    popup_hotkey_pressed = false;
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

  setupPopupPosition(popup);

  const usages = await getDefinitions(text);
  if (usages.length > 0) {
    popup.appendChild(popupContent(usages));
  } else {
    const no_def = document.createElement("div");
    no_def.setAttribute("style", "text-align: center; width: 100%;");
    popup.append(no_def);
    no_def.innerHTML = "No definition found for <em>" + text + "</em>";
  }

  document.getElementsByTagName("html")[0].append(popup);
}

function removePopup() {
  const popup = document.getElementById("wiktionary-popup");
  if (popup) {
    popup.get
    document.getElementsByTagName("html")[0].removeChild(popup);
  }
}

function popupContent(usages) {
  const container = document.createElement("div");
  container.setAttribute("id", "wiktionary-popup-container");

  for (const usage of usages) {
    const usage_container = document.createElement("div");
    usage_container.setAttribute("id", "wiktionary-popup-usage-container");
    container.appendChild(usage_container);

    const entry = document.createElement("h2");
    entry.setAttribute("id", "wiktionary-popup-entry");
    entry.textContent = usage.key.entry;
    usage_container.appendChild(entry);

    const pos = document.createElement("span");
    pos.textContent = " • " + usage.usage.partOfSpeech;
    pos.setAttribute("id", "wiktionary-popup-partOfSpeech");
    entry.appendChild(pos);

    const language = document.createElement("span");
    language.textContent = " (" + usage.usage.language + ")";
    language.setAttribute("id", "wiktionary-popup-language");
    entry.appendChild(language);

    const list = document.createElement("ol");
    list.setAttribute("id", "wiktionary-popup-definition-list");
    usage_container.appendChild(list);

    for (const definition of usage.usage.definitions) {
      const def = document.createElement("li");
      def.innerHTML = definition.definition;
      removeAttributesRecursive(def);
      def.setAttribute("id", "wiktionary-popup-definition");

      if ("examples" in definition) {
        const examples = document.createElement("ul");
        examples.setAttribute("id", "wiktionary-popup-example-list");
        def.appendChild(examples);

        for (const example of definition.examples) {
          const ex = document.createElement("li");
          ex.innerHTML = example;
          removeAttributesRecursive(ex);
          ex.setAttribute("id", "wiktionary-popup-example");
          examples.appendChild(ex);
        }
      }

      if (def.textContent && def.textContent.charAt(0) != "↑") {
        list.appendChild(def);
      }
    }
  }

  return container;
}

function setupPopupPosition(popup) {
  const rect = window.getSelection().getRangeAt(0).getBoundingClientRect();
  x = window.scrollX + (rect.left + rect.right - popup_width) / 2;
  x = Math.max(10, Math.min(x, window.innerWidth - 10)); // clamp position to screen size
  y = window.scrollY + rect.top - popup_height - 30;
  if (y < window.scrollY + 10) {
    y = window.scrollY + rect.bottom + 10;
  }
  popup.setAttribute(
    "style",
    "top:" + Math.round(y) + "px; left:" + Math.round(x) + "px;"
  );
}

// removes all attributes and prunes empty elements
// removes ol and li elements (dataset bugs)
function removeAttributesRecursive(elem) {
  [...elem.attributes].forEach((attr) => elem.removeAttribute(attr.name));
  for (const child of elem.children) {
    if (
      child.nodeName == "OL" ||
      child.nodeName == "LI" ||
      !child.textContent
    ) {
      elem.removeChild(child);
    } else {
      removeAttributesRecursive(child);
    }
  }
}
