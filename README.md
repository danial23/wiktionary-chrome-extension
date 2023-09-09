# Wiktionary (Chrome extension)

Find the definition of any word on a webpage. Available in 162 languages.

[![Chrome](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png "Chrome")](https://chrome.google.com/webstore/detail/wiktionary/cgeoeehlcbijkefhlmcnoahlelccfndj)

[or download via direct link](https://github.com/danial23/wiktionary-chrome-extension/releases/download/v0.3.0/wiktionary-chrome-extension.crx)

## Usage

- Open the side panel by clicking the extension icon (or by clicking the side panel icon and selecting "Wiktionary").

  **Note:** You need to enable the Side Panel feature in Chrome.

- Once the side panel is open, search Wiktionary by highlighting a word.

- To change the language of Wiktionary, right-click the extension icon and select _options_.

**Popup Mode:** Toggle popup mode by pressing Alt+P, then highlight a word (by double-clicking or dragging) to see its definition(s) in a popup. Popup Mode is only available in English. You can change this shortcut on chrome://extensions/shortcuts

**Note:** In PDF files, the methods above do not work. You can instead highlight the word while the side panel is open, then right click and select _Wiktionary search_.

## Developer notes

To test new features without having to toggle feature flags manually before/after every commit, enter the following command after a git clone: `git update-index --skip-worktree ./feature-flags.js`

If you want to commit changes made to this file, do `git update-index --no-skip-worktree ./feature-flags.js`

You'll still get updates to this file coming in from upstream either way.
