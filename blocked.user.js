// ==UserScript==
// @name         Website Blocker
// @namespace    https://github.com/ryanbuening/userscripts
// @version      1.0
// @description  Blocks a list of websites
// @match        *://*/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // List of websites to block
    const blockedUrls = [
        "reddit.com/r/moderatepolitics",
        "reddit.com/r/politics",
        "reddit.com/r/conservative",
    ];

    // Check if the current URL matches any blocked URL
    blockedUrls.forEach(blockedUrl => {
        if (window.location.hostname.includes(blockedUrl)) {
            // Option 1: Redirect to a blocked page
            window.location.href = "https://oneminutefocus.com/;
        }
    });
})();