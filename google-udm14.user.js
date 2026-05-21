// ==UserScript==
// @name         Google UDM=14 Enforcer
// @version      1.0
// @description  Automatically appends udm=14 to Google search URLs to force the Web-only results view
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

    url.searchParams.set('udm', '14');
    window.location.replace(url.toString());
})();
