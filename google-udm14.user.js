// ==UserScript==
// @name         Google UDM=14 Enforcer
// @version      1.2
// @description  Defaults Google searches to the Web-only view (udm=14), but respects tab clicks like AI Mode, All, Images, etc.
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/google-udm14.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/google-udm14.user.js
// @match        *://www.google.com/search*
// @run-at       document-start
// @grant        none
// ==/UserScript==

(function () {
    'use strict';

    const STORAGE_KEY = 'udm14_lastQuery';
    const url = new URL(window.location.href);
    const currentQuery = url.searchParams.get('q') || '';
    const currentUdm = url.searchParams.get('udm');
    const lastQuery = sessionStorage.getItem(STORAGE_KEY);

    sessionStorage.setItem(STORAGE_KEY, currentQuery);

    // Same query as the previous page load in this tab → user clicked a tab, respect their choice.
    if (lastQuery !== null && lastQuery === currentQuery) {
        return;
    }

    if (currentUdm === '14') {
        return;
    }

    url.searchParams.set('udm', '14');
    window.location.replace(url.toString());
})();
