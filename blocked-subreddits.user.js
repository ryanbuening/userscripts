// ==UserScript==
// @name         Reddit Subreddit Blocker
// @namespace    https://github.com/ryanbuening/userscripts
// @version      1.0
// @description  Blocks specific Reddit subreddits
// @match        *://*.reddit.com/r/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    // List of subreddits to block (in lowercase)
    const blockedSubreddits = [
        "moderatepolitics",
        "politics"
    ];

    // Get the current subreddit from the URL
    const currentSubreddit = window.location.pathname.split('/')[2].toLowerCase();

    // Check if the current subreddit is in the blocked list
    if (blockedSubreddits.includes(currentSubreddit)) {
        window.location.href = "https://oneminutefocus.com";
    }
})();
