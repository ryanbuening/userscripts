// ==UserScript==
// @name         M365 Copilot - Auto Select Opus
// @version      4.0
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

    // Reduced cooldown to allow faster reactions to SPA reversions
    const COOLDOWN_MS = 300;

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;

    // --- Helpers ---

    function simulateClick(element) {
        const events = ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click'];
        for (const eventType of events) {
            element.dispatchEvent(new MouseEvent(eventType, {
                view: window,
                bubbles: true,
                cancelable: true,
                buttons: 1
            }));
        }
    }

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
        const selectors = ['[role="menuitem"]', '[role="option"]', '[role="menuitemradio"]', '[role="radio"]'];

        for (const sel of selectors) {
            for (const el of document.querySelectorAll(sel)) {
                if (el.textContent.trim().startsWith(TARGET_MODEL)) return el;
            }
        }
        return Array.from(document.querySelectorAll('button, [role="button"]'))
            .filter(el => el.textContent.trim().startsWith(TARGET_MODEL) && el !== modelBtn)
            .sort((a, b) => a.textContent.length - b.textContent.length)[0] ?? null;
    }

    function focusInputBox() {
        const selectors = [
            '[data-placeholder="Message Copilot"]',
            '[placeholder="Message Copilot"]',
            '[contenteditable="true"]',
            'textarea[placeholder*="Message"]',
            'textarea',
        ];
        for (const sel of selectors) {
            const el = document.querySelector(sel);
            if (el) { el.focus(); return; }
        }
    }

    // --- Core Action ---

    async function selectModel() {
        if (selecting || isAlreadySelected()) return false;
        selecting = true;

        try {
            const btn = getModelButton();
            if (!btn || btn.textContent.trim() !== 'Auto') return false;

            simulateClick(btn);

            const option = await waitFor(findMenuOption);
            if (option) {
                await new Promise(r => setTimeout(r, 50));
                simulateClick(option);
                cooldownUntil = Date.now() + COOLDOWN_MS;
                console.log(`[userscript] Selected ${TARGET_MODEL}`);
                setTimeout(focusInputBox, 100);
                return true;
            } else {
                simulateClick(btn);
                return false;
            }
        } finally {
            selecting = false;
        }
    }

    // --- Boot Sequence & Observers ---

    // Forces the selection until the SPA stops reverting it
    async function enforceUntilSettled() {
        let consecutiveSuccesses = 0;
        const maxAttempts = 20; // Will monitor for up to ~10 seconds

        for (let i = 0; i < maxAttempts; i++) {
            if (isAlreadySelected()) {
                consecutiveSuccesses++;
                // If it holds Opus for 3 consecutive checks (~1.5 seconds), the SPA is settled
                if (consecutiveSuccesses >= 3) break;
            } else {
                consecutiveSuccesses = 0;
                await selectModel();
            }
            await new Promise(r => setTimeout(r, 500));
        }

        // Once settled, hand over to the standard observer for the rest of the session
        observer.observe(document.body, { childList: true, subtree: true });
    }

    const observer = new MutationObserver(() => {
        if (selecting || Date.now() < cooldownUntil || isAlreadySelected()) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(selectModel, DEBOUNCE_MS);
    });

    // Start the boot sequence instead of a one-time execution
    enforceUntilSettled();
})();
