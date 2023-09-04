# Wiktionary (Chrome extension)

Find the definition of any word on a webpage. Searches the [English Wiktionary](https://en.wiktionary.org).

[![Chrome](https://storage.googleapis.com/web-dev-uploads/image/WlD8wC6g8khYWPJUsQceQkhXSlv1/UV4C4ybeBTsZt43U4xis.png "Chrome")](https://chrome.google.com/webstore/detail/wiktionary/cgeoeehlcbijkefhlmcnoahlelccfndj)

[or download via direct link](https://github.com/danial23/wiktionary-chrome-extension/releases/download/v0.2.0/wiktionary-sidepanel-extension.crx)

## Usage

- Open the side panel by clicking the extension icon (or by right clicking a word and selecting "Wiktionary Search").

  _Note:_ You need to enable the Side Panel feature in Chrome.

- Once the side panel is open, search Wiktionary by highlighting word.

**Popup Mode:** Toggle popup mode by pressing Alt+W, then highlight a word to see its definition(s) in a popup. You can change this shortcut on chrome://extensions/shortcuts

_Note:_ In PDF files, only the right-click method works.

## Developer notes

To test new features without having to toggle feature flags manually before/after every commit, enter the following command after a git clone: `git update-index --skip-worktree ./feature-flags.js`

If you want to commit changes made to this file, do `git update-index --no-skip-worktree ./feature-flags.js`

You'll still get updates to this file coming in from upstream either way.
