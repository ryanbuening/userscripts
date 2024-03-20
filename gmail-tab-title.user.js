// ==UserScript==
// @name         Modify Tab Title for Gmail
// @version      1.0
// @description  Modifies the title of the browser tab for Gmail
// @author       Ryan Buening
// @license      MIT
// @namespace    https://github.com/ryanbuening/userscripts
// @run-at       document-start
// @match        https://mail.google.com/*
// ==/UserScript==

function hideUnread()
{
    document.title = 'Gmail';
}

setInterval(function () { hideUnread(); }, 10);