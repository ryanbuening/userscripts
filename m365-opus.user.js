// ==UserScript==
// @name         M365 Copilot - Auto Select Opus
// @version      3.1
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
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 1000;

    let selecting = false;
    let cooldownUntil = 0;
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
        return getModelButton()?.textContent.trim() === TARGET_MODEL;
    }

    function waitFor(finderFn, timeoutMs = MENU_TIMEOUT_MS, intervalMs = POLL_INTERVAL_MS) {
        return new Promise(resolve => {
            const immediate = finderFn();
            if (immediate) return resolve(immediate);

            const start = Date.now();
            const id = setInterval(() => {
                const el = finderFn();
                if (el) { clearInterval(id); resolve(el); }
                else if (Date.now() - start >= timeoutMs) { clearInterval(id); resolve(null); }
            }, intervalMs);
        });
    }

    function findMenuOption() {
        const modelBtn = getModelButton();
        for (const sel of ['[role="menuitem"]', '[role="option"]', '[role="menuitemradio"]', '[role="radio"]']) {
            for (const el of document.querySelectorAll(sel)) {
                if (el.textContent.trim().startsWith(TARGET_MODEL)) return el;
            }
        }
        return Array.from(document.querySelectorAll('button, [role="button"]'))
            .filter(el => el.textContent.trim().startsWith(TARGET_MODEL) && el !== modelBtn)
            .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null;
    }

    function focusInputBox() {
        for (const sel of [
            '[data-placeholder="Message Copilot"]',
            '[placeholder="Message Copilot"]',
            '[contenteditable="true"]',
            'textarea[placeholder*="Message"]',
            'textarea',
        ]) {
            const el = document.querySelector(sel);
            if (el) { el.focus(); return; }
        }
    }

    function startObserving() {
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // --- Core ---

    async function selectModel() {
        if (selecting || isAlreadySelected()) return;
        selecting = true;
        observer.disconnect();                  // pause — our own clicks won't re-trigger
        try {
            const btn = getModelButton();
            if (!btn || btn.textContent.trim() !== 'Auto') return;

            btn.click();

            const option = await waitFor(findMenuOption);
            if (option) {
                option.click();
                cooldownUntil = Date.now() + COOLDOWN_MS;
                console.log(`[userscript] Selected ${TARGET_MODEL}`);
                setTimeout(focusInputBox, 50);
            } else {
                btn.click();
                console.warn(`[userscript] "${TARGET_MODEL}" not found in menu`);
            }
        } finally {
            selecting = false;
            setTimeout(startObserving, 100);    // resume after DOM settles
        }
    }

    // --- Observer ---

    const observer = new MutationObserver(() => {
        if (selecting || Date.now() < cooldownUntil || isAlreadySelected()) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(selectModel, DEBOUNCE_MS);
    });

    startObserving();
    selectModel();
})();
