// ==UserScript==
// @name         M365 Copilot - Auto Select Preferred Model
// @version      4.3
// @description  Automatically selects the highest-priority available Claude model in M365 Copilot
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @match        https://m365.cloud.microsoft/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    'use strict';

    // Ordered by priority. The script will select the first available match.
    // Most-specific names first so they win over the broader fallbacks.
    const PREFERRED_MODELS = [
        'Claude Opus 4.7',
        'Claude Sonnet 4.6',
        'Opus',
        'Claude'
    ];
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 300;

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;
    // Tracks the highest-priority model we've actually seen in the menu.
    // Prevents looping when PREFERRED_MODELS[0] isn't available in the UI.
    let bestAvailableModel = null;

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

    function matchesPreferred(text) {
        if (!text) return false;
        return PREFERRED_MODELS.some(m => text.startsWith(m));
    }

    function getModelButton() {
        return Array.from(document.querySelectorAll('button'))
            .find(btn => {
                const t = btn.textContent.trim();
                return t === 'Auto' || matchesPreferred(t);
            });
    }

    function currentSelection() {
        return getModelButton()?.textContent.trim() ?? '';
    }

    // "Settled" means: either we're on the top priority, OR we're on the
    // best option we've previously confirmed is available in the menu.
    function isSettled() {
        const text = currentSelection();
        if (!text || text === 'Auto') return false;
        if (text.startsWith(PREFERRED_MODELS[0])) return true;
        if (bestAvailableModel && text.startsWith(bestAvailableModel)) return true;
        return false;
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

        let elements = [];
        for (const sel of selectors) {
            elements.push(...document.querySelectorAll(sel));
        }

        // Fallback to standard buttons if strict roles aren't found
        if (elements.length === 0) {
            elements = Array.from(document.querySelectorAll('button, [role="button"]'))
                .filter(el => el !== modelBtn);
        }

        // Iterate through preferences to enforce priority
        for (const model of PREFERRED_MODELS) {
            const match = elements.find(el => el.textContent.trim().startsWith(model));
            if (match) {
                return { element: match, modelName: model };
            }
        }

        return null;
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

    async function selectModel() {
        if (selecting || isSettled()) return false;
        selecting = true;

        try {
            const btn = getModelButton();
            if (!btn) return false;

            const before = btn.textContent.trim();
            simulateClick(btn);

            const result = await waitFor(findMenuOption);
            if (!result) {
                simulateClick(btn); // Close the menu if no models match
                return false;
            }

            // The best option in the menu is already what's selected — just
            // remember it and close the menu without re-clicking.
            if (before.startsWith(result.modelName)) {
                bestAvailableModel = result.modelName;
                simulateClick(btn);
                return false;
            }

            await new Promise(r => setTimeout(r, 50));
            simulateClick(result.element);
            bestAvailableModel = result.modelName;
            cooldownUntil = Date.now() + COOLDOWN_MS;
            console.log(`[userscript] Selected ${result.modelName}`);
            setTimeout(focusInputBox, 100);
            return true;
        } finally {
            selecting = false;
        }
    }

    async function enforceUntilSettled() {
        let consecutiveSuccesses = 0;
        const maxAttempts = 20;

        for (let i = 0; i < maxAttempts; i++) {
            if (isSettled()) {
                consecutiveSuccesses++;
                if (consecutiveSuccesses >= 3) break;
            } else {
                consecutiveSuccesses = 0;
                await selectModel();
            }
            await new Promise(r => setTimeout(r, 500));
        }

        observer.observe(document.body, { childList: true, subtree: true });
    }

    const observer = new MutationObserver(() => {
        if (selecting || Date.now() < cooldownUntil || isSettled()) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(selectModel, DEBOUNCE_MS);
    });

    enforceUntilSettled();
})();
