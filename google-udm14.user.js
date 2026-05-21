// ==UserScript==
// @name         Google UDM=14 Enforcer
// @version      1.1
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

    const url = new URL(window.location.href);

    if (url.searchParams.get('udm') === '14') {
        return;
    }

    // If the user navigated here from another Google search results page,
    // they clicked a tab (AI Mode, All, Images, etc.) — respect that choice.
    if (document.referrer) {
        try {
            const ref = new URL(document.referrer);
            if (ref.hostname === 'www.google.com' && ref.pathname === '/search') {
                return;
            }
        } catch (_) { /* ignore malformed referrer */ }
    }

    url.searchParams.set('udm', '14');
    window.location.replace(url.toString());
})();
