// ==UserScript==
// @name         M365 Copilot - Auto Select Preferred Model
// @version      4.1
// @description  Automatically selects Opus (or Claude as fallback) in M365 Copilot
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
    const PREFERRED_MODELS = ['Opus', 'Claude'];
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 300;

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;

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
                return t === 'Auto' || PREFERRED_MODELS.includes(t);
            });
    }

    function isAlreadySelected() {
        const currentText = getModelButton()?.textContent.trim();
        return PREFERRED_MODELS.includes(currentText);
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
        if (selecting || isAlreadySelected()) return false;
        selecting = true;

        try {
            const btn = getModelButton();
            if (!btn || btn.textContent.trim() !== 'Auto') return false;

            simulateClick(btn);

            const result = await waitFor(findMenuOption);
            if (result) {
                await new Promise(r => setTimeout(r, 50));
                simulateClick(result.element);
                cooldownUntil = Date.now() + COOLDOWN_MS;
                console.log(`[userscript] Selected ${result.modelName}`);
                setTimeout(focusInputBox, 100);
                return true;
            } else {
                simulateClick(btn); // Close the menu if no models match
                return false;
            }
        } finally {
            selecting = false;
        }
    }

    async function enforceUntilSettled() {
        let consecutiveSuccesses = 0;
        const maxAttempts = 20;

        for (let i = 0; i < maxAttempts; i++) {
            if (isAlreadySelected()) {
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
        if (selecting || Date.now() < cooldownUntil || isAlreadySelected()) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(selectModel, DEBOUNCE_MS);
    });

    enforceUntilSettled();
})();
