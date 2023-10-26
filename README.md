# Dictionary (Chrome extension)

Find the definition of any word on a webpage. Search on Wiktionary.org in 162 languages.

[![Chrome](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png "Chrome")](https://chrome.google.com/webstore/detail/wiktionary/cgeoeehlcbijkefhlmcnoahlelccfndj)

[or download via direct link](https://github.com/danial23/wiktionary-chrome-extension/releases/download/v0.3.2/wiktionary-chrome-extension.crx)

## Features

- search on highlight
- pop-up mode (English only)
- available in 162 languages

## Usage

[out.webm](https://github.com/danial23/wiktionary-chrome-extension/assets/5867710/8ac0ae10-0d3f-4016-b0d9-d95dd054033a)
- Open the side panel by clicking the extension icon.

  **Note:** You need to enable the Side Panel feature in Chrome.
- Once the side panel is open, search Dictionary by highlighting a word.
- To change the language of Wiktionary, right-click the extension icon and select _options_.
- **Pop-up Mode:** Highlight a word (by double-clicking or dragging) to see its definition(s) in a pop-up. Pop-up mode is only available in English. Alt + P toggles pop-up mode. You can change this shortcut in chrome://extensions/shortcuts

**Note:** In PDF files, the methods above do not work. Instead, while the side panel is open, highlight a word, right-click it and select _Search on Wiktionary.org_.

## Developer notes

To test new features without having to toggle feature flags manually before/after every commit, enter the following command in project root after a git clone: `git update-index --skip-worktree ./extension/feature-flags.js`

If you want to commit changes made to this file, do `git update-index --no-skip-worktree ./extension/feature-flags.js`

You'll still get updates to this file coming in from upstream either way.
