// ==UserScript==
// @name         M365 Copilot - Auto Select Preferred Model
// @version      5.3
// @description  Auto-selects the preferred Claude model in M365 Copilot, but not in Cowork (which remembers your last model) and yields to manual selection
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-copilot-auto-select-preferred-model.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-copilot-auto-select-preferred-model.user.js
// @match        https://m365.cloud.microsoft/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    'use strict';

    const PREFERRED_MODELS = ['Claude Opus 4.8', 'Opus', 'Claude Sonnet 4.6'];
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 300;
    const MODEL_BUTTON_SELECTOR = '[data-telemetry-id="Header.ModelSelector"]';
    const COWORK_TAB_SELECTOR = '[role="tab"][value="cowork"]';
    const MENU_OPTION_SELECTOR = '[role="menuitem"],[role="option"],[role="menuitemradio"],[role="radio"]';
    const INPUT_SELECTOR =
        '[data-placeholder="Message Copilot"],[placeholder="Message Copilot"],' +
        '[contenteditable="true"],textarea[placeholder*="Message"],textarea';

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;
    let bestAvailableModel = null;
    let userOverride = false; // set when the user manually picks a model → pause auto-select

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    // Cowork persists the last-used model itself, so the script must not interfere.
    const isCoworkActive = () =>
        document.querySelector(COWORK_TAB_SELECTOR)?.getAttribute('aria-selected') === 'true';

    function simulateClick(el) {
        const hasPointer = typeof PointerEvent === 'function';
        for (const type of ['pointerdown', 'mousedown', 'pointerup', 'mouseup', 'click']) {
            const pointer = hasPointer && type.startsWith('pointer');
            const Ctor = pointer ? PointerEvent : MouseEvent;
            el.dispatchEvent(new Ctor(type, {
                view: window, bubbles: true, cancelable: true, buttons: 1,
                ...(pointer && { pointerId: 1, isPrimary: true }),
            }));
        }
    }

    const matchesPreferred = (text) =>
        !!text && PREFERRED_MODELS.some((m) => text.startsWith(m));

    function getModelButton() {
        const byHook = document.querySelector(MODEL_BUTTON_SELECTOR);
        if (byHook) return byHook;
        for (const btn of document.querySelectorAll('button')) {
            const t = btn.textContent.trim();
            if (t === 'Auto' || matchesPreferred(t)) return btn;
        }
        return null;
    }

    const menuIsOpen = () =>
        getModelButton()?.getAttribute('aria-expanded') === 'true';

    const currentSelection = () => getModelButton()?.textContent.trim() ?? '';

    function isSettled() {
        const text = currentSelection();
        if (!text || text === 'Auto') return false;
        return text.startsWith(PREFERRED_MODELS[0]) ||
            (!!bestAvailableModel && text.startsWith(bestAvailableModel));
    }

    function waitFor(finderFn, timeoutMs = MENU_TIMEOUT_MS, intervalMs = POLL_INTERVAL_MS) {
        return new Promise((resolve) => {
            const immediate = finderFn();
            if (immediate) return resolve(immediate);
            const start = Date.now();
            const id = setInterval(() => {
                const el = finderFn();
                if (el || Date.now() - start >= timeoutMs) {
                    clearInterval(id);
                    resolve(el ?? null);
                }
            }, intervalMs);
        });
    }

    function findMenuOption() {
        const modelBtn = getModelButton();
        let elements = [...document.querySelectorAll(MENU_OPTION_SELECTOR)];
        if (elements.length === 0) {
            elements = [...document.querySelectorAll('button, [role="button"]')]
                .filter((el) => el !== modelBtn);
        }
        for (const model of PREFERRED_MODELS) {
            const match = elements.find((el) => el.textContent.trim().startsWith(model));
            if (match) return { element: match, modelName: model };
        }
        return null;
    }

    function focusInputBox() {
        document.querySelector(INPUT_SELECTOR)?.focus();
    }

    async function selectModel() {
        if (selecting || userOverride || isCoworkActive() || isSettled()) return false;
        selecting = true;
        try {
            const btn = getModelButton();
            if (!btn) return false;

            const before = btn.textContent.trim();
            simulateClick(btn);

            const result = await waitFor(findMenuOption);
            if (!result) {
                simulateClick(btn); // close empty menu
                return false;
            }

            if (before.startsWith(result.modelName)) {
                bestAvailableModel = result.modelName;
                simulateClick(btn);
                return false;
            }

            await sleep(50);
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
        for (let i = 0, streak = 0; i < 20 && streak < 3; i++) {
            if (userOverride || isCoworkActive()) break;
            if (isSettled()) streak++;
            else { streak = 0; await selectModel(); }
            await sleep(500);
        }
        observer.observe(document.body, { childList: true, subtree: true });
    }

    // A *trusted* click on a model-menu option = the user choosing manually.
    // The script's own clicks are isTrusted === false, so they're ignored here.
    document.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        const option = e.target.closest?.(MENU_OPTION_SELECTOR);
        if (option && menuIsOpen()) {
            userOverride = true;
            bestAvailableModel = null;
            console.log(
                `[userscript] Manual override → "${option.textContent.trim()}". ` +
                `Auto-select paused (press Alt+M to resume).`
            );
        }
    }, true);

    // Alt+M re-enables auto-select and re-applies your default.
    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
            userOverride = false;
            console.log('[userscript] Auto-select resumed.');
            selectModel();
        }
    });

    const observer = new MutationObserver(() => {
        if (userOverride || isCoworkActive() || selecting || Date.now() < cooldownUntil) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!userOverride && !isCoworkActive() && !isSettled()) selectModel();
        }, DEBOUNCE_MS);
    });

    enforceUntilSettled();
})();
