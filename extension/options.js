const select = document.getElementById("language");

chrome.runtime.sendMessage({ command: "get-language" }, (response) => {
  console.log(response);
  select.value = response;
});

select.addEventListener("change", (_) => {
  console.log(select.value);
  chrome.runtime.sendMessage({ command: "set-language", language: select.value });
});
