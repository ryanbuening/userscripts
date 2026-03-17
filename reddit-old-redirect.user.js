// ==UserScript==
// @name         Reddit Old Redirect
// @namespace    https://www.reddit.com
// @version      1.0.0
// @description  Redirects new Reddit to old.reddit.com
// @author       Ryan Buening
// @license      MIT
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://raw.githubusercontent.com/USER/REPO/main/script.user.js
// @downloadURL  https://raw.githubusercontent.com/USER/REPO/main/script.user.js
// @match        https://*.reddit.com/*
// @exclude      https://old.reddit.com/*
// @exclude      https://*.reddit.com/poll/*
// @exclude      https://*.reddit.com/gallery/*
// @exclude      https://www.reddit.com/media*
// @exclude      https://chat.reddit.com/*
// @exclude      https://www.reddit.com/appeal*
// @exclude      https://www.reddit.com/notifications*
// @exclude      https://embed.reddit.com/*
// @exclude      https://www.reddit.com/mail/*
// @run-at       document-start
// ==/UserScript==

(() => {
  const { host, pathname, search, hash } = window.location;
  if (host === 'old.reddit.com') return;

  const url = new URL(window.location.href);
  url.hostname = 'old.reddit.com';

  window.location.replace(url.href);
})();
