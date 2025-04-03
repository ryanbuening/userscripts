// ==UserScript==
// @name         URL and Search Blocker
// @namespace    https://github.com/ryanbuening/userscripts
// @version      1.0
// @description  Blocks specific URLs and redirects them
// @match        *://*/*
// @run-at       document-start
// @grant        none
// ==/UserScript==
(function () {
	'use strict';

	// List of URLs to block (can be full or partial URLs)
	const blockedUrls = [
		"reddit.com/r/politics",
		"reddit.com/r/moderatepolitics",
		"reddit.com/r/conservative",
		"reddit.com/r/ohio",
		"reddit.com/r/wallstreetbets"
	];

	// List of Google search queries to block
	const blockedSearchQueries = [
		"sp500",
	];

	// URL to redirect to when blocked content is detected
	const redirectUrl = "https://oneminutefocus.com";

	// Get the current URL
	const currentUrl = window.location.href.toLowerCase();

	// Check if current URL contains any of the blocked URLs
	for (const url of blockedUrls) {
		if (currentUrl.includes(url.toLowerCase())) {
			window.location.href = redirectUrl;
			return;
		}
	}

	// Check if this is a Google search
	if (currentUrl.includes("google.") && currentUrl.includes("/search?")) {
		// Extract the search query parameter
		const urlParams = new URLSearchParams(window.location.search);
		const searchQuery = urlParams.get('q');

		if (searchQuery) {
			// Check if the search query contains any blocked terms
			for (const term of blockedSearchQueries) {
				if (searchQuery.toLowerCase().includes(term.toLowerCase())) {
					window.location.href = redirectUrl;
					return;
				}
			}
		}
	}
})();
