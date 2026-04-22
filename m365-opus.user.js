// ==UserScript==
// @name         M365 Copilot - Auto Select Opus
// @version      2.0
// @description  Automatically selects the Opus model in M365 Copilot
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @match        https://m365.cloud.microsoft/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    'use strict';

    const TARGET_MODEL = 'Opus';
    const MENU_TIMEOUT_MS = 3000;
    const DEBOUNCE_MS = 600;

    let selecting = false;
    let debounceTimer = null;

    // --- Helpers ---

    function getModelButton() {
        return Array.from(document.querySelectorAll('button'))
            .find(btn => {
                const t = btn.textContent.trim();
                return t === 'Auto' || t === TARGET_MODEL;
            });
    }

    function isAlreadySelected() {
        const btn = getModelButton();
        return btn?.textContent.trim() === TARGET_MODEL;
    }

    /** Polls for an element until found or timeout. */
    function waitFor(finderFn, timeoutMs = MENU_TIMEOUT_MS, intervalMs = 100) {
        return new Promise(resolve => {
            const start = Date.now();
            const id = setInterval(() => {
                const el = finderFn();
                if (el) { clearInterval(id); resolve(el); }
                else if (Date.now() - start >= timeoutMs) { clearInterval(id); resolve(null); }
            }, intervalMs);
        });
    }

    /** Finds the Opus option inside the open dropdown menu. */
    function findMenuOption() {
        const modelBtn = getModelButton();
        // Prefer ARIA-role elements (menuitem, option, etc.)
        const selectors = [
            '[role="menuitem"]', '[role="option"]',
            '[role="menuitemradio"]', '[role="radio"]',
        ];
        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                if (el.textContent.trim().startsWith(TARGET_MODEL)) return el;
            }
        }
        // Fallback: smallest matching button that isn't the model toggle itself
        return Array.from(document.querySelectorAll('button, [role="button"]'))
            .filter(el => el.textContent.trim().startsWith(TARGET_MODEL) && el !== modelBtn)
            .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null;
    }

    // --- Core ---

    async function selectModel() {
        if (selecting || isAlreadySelected()) return;
        selecting = true;
        try {
            const btn = getModelButton();
            if (!btn || btn.textContent.trim() !== 'Auto') return;

            btn.click(); // open the dropdown

            const option = await waitFor(findMenuOption);
            if (option) {
                option.click();
                console.log(`[userscript] Selected ${TARGET_MODEL}`);
            } else {
                // Close menu gracefully if option wasn't found
                btn.click();
                console.warn(`[userscript] "${TARGET_MODEL}" not found in menu`);
            }
        } finally {
            selecting = false;
        }
    }

    // --- Observer (handles SPA navigation & re-renders) ---

    const observer = new MutationObserver(() => {
        if (selecting || isAlreadySelected()) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(selectModel, DEBOUNCE_MS);
    });

    observer.observe(document.body, { childList: true, subtree: true });

    // Initial run
    selectModel();
})();
