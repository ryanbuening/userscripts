// ==UserScript==
// @name         M365 Copilot - Auto Select Preferred Model
// @version      5.6
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

    const DEBUG = true; // flip to false to silence
    const TAG = '[auto-model]';
    const dbg   = (...a) => DEBUG && console.log(TAG, ...a);
    const dbgw  = (...a) => DEBUG && console.warn(TAG, ...a);
    const dbge  = (...a) => DEBUG && console.error(TAG, ...a);
    const group = (label, fn) => {
        if (!DEBUG) return fn();
        console.groupCollapsed(TAG, label);
        try { return fn(); } finally { console.groupEnd(); }
    };

    const PREFERRED_PROVIDER = 'Claude';
    const PREFERRED_MODELS = ['Opus 5'];
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 300;
    const MODEL_BUTTON_SELECTOR = '[data-telemetry-id="Header.ModelSelector"]';
    const COWORK_TAB_SELECTOR = '[role="tab"][value="cowork"]';
    const NEW_CHAT_LABEL = 'New chat';
    const MENU_OPTION_SELECTOR = '[role="menuitem"],[role="option"],[role="menuitemradio"],[role="radio"]';
    const INPUT_SELECTOR =
        '[data-placeholder="Message Copilot"],[placeholder="Message Copilot"],' +
        '[contenteditable="true"],textarea[placeholder*="Message"],textarea';

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;
    let bestAvailableModel = null;
    let userOverride = false;
    let observerTickCount = 0;
    let selectModelInvocations = 0;

    dbg('script loaded', {
        version: '5.4-debug',
        url: location.href,
        preferred: PREFERRED_MODELS,
        readyState: document.readyState,
    });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    const isCoworkActive = () => {
        const tab = document.querySelector(COWORK_TAB_SELECTOR);
        const active = tab?.getAttribute('aria-selected') === 'true';
        dbg('isCoworkActive()', { tabFound: !!tab, active });
        return active;
    };

    function simulateClick(el) {
        dbg('simulateClick()', {
            tag: el?.tagName,
            role: el?.getAttribute?.('role'),
            text: el?.textContent?.trim().slice(0, 60),
        });
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
        !!text && (
            text.startsWith(PREFERRED_PROVIDER + ' ' + PREFERRED_MODELS[0]) ||
            PREFERRED_MODELS.some((m) => text.startsWith(m))
        );

    function getModelButton() {
        const byHook = document.querySelector(MODEL_BUTTON_SELECTOR);
        if (byHook) {
            dbg('getModelButton() → found via data-telemetry-id', {
                text: byHook.textContent.trim(),
                ariaExpanded: byHook.getAttribute('aria-expanded'),
            });
            return byHook;
        }
        for (const btn of document.querySelectorAll('button')) {
            const t = btn.textContent.trim();
            if (t === 'Auto' || matchesPreferred(t)) {
                dbgw('getModelButton() → fallback match on button text', { text: t });
                return btn;
            }
        }
        dbgw('getModelButton() → NOT FOUND');
        return null;
    }

    const menuIsOpen = () =>
        getModelButton()?.getAttribute('aria-expanded') === 'true';

    const currentSelection = () => getModelButton()?.textContent.trim() ?? '';

    function isSettled() {
        const text = currentSelection();
        if (!text || text === 'Auto') return false;
        return matchesPreferred(text);
    }

    function waitFor(finderFn, timeoutMs = MENU_TIMEOUT_MS, intervalMs = POLL_INTERVAL_MS) {
        return new Promise((resolve) => {
            const immediate = finderFn();
            if (immediate) return resolve(immediate);
            const start = Date.now();
            const id = setInterval(() => {
                const element = finderFn();
                if (element || Date.now() - start >= timeoutMs) {
                    clearInterval(id);
                    resolve(element ?? null);
                }
            }, intervalMs);
        });
    }

    function findMenuOption(label) {
        const modelBtn = getModelButton();
        let elements = [...document.querySelectorAll(MENU_OPTION_SELECTOR)]
            .filter((el) => el !== modelBtn);
        if (elements.length === 0) {
            elements = [...document.querySelectorAll('button, [role="button"]')]
                .filter((el) => el !== modelBtn);
        }
        return elements.find((el) => el.textContent.trim().startsWith(label)) ?? null;
    }

    function focusInputBox() {
        document.querySelector(INPUT_SELECTOR)?.focus();
    }

    function isNewChatButton(element) {
        if (!element) return false;
        const text = element.textContent.trim();
        const ariaLabel = element.getAttribute('aria-label')?.trim();
        return text === NEW_CHAT_LABEL || ariaLabel === NEW_CHAT_LABEL;
    }

    function selectModelAfterNewChat() {
        userOverride = false;
        bestAvailableModel = null;
        cooldownUntil = 0;
        setTimeout(() => {
            if (!isCoworkActive()) selectModel();
        }, 300);
    }

    async function selectModel() {
        selectModelInvocations++;
        dbg('selectModel()', { invocation: selectModelInvocations });
        if (selecting || userOverride || isCoworkActive() || isSettled()) return false;
        selecting = true;
        try {
            const btn = getModelButton();
            if (!btn) return false;

            simulateClick(btn);

            const provider = await waitFor(() => findMenuOption(PREFERRED_PROVIDER));
            if (!provider) {
                simulateClick(btn);
                return false;
            }

            await sleep(50);
            simulateClick(provider);

            const model = await waitFor(() => findMenuOption(PREFERRED_MODELS[0]));
            if (!model) return false;

            await sleep(50);
            simulateClick(model);
            bestAvailableModel = PREFERRED_MODELS[0];
            cooldownUntil = Date.now() + COOLDOWN_MS;
            console.log(`[userscript] Selected ${PREFERRED_PROVIDER} ${PREFERRED_MODELS[0]}`);
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
            else {
                streak = 0;
                await selectModel();
            }
            await sleep(500);
        }
        observer.observe(document.body, { childList: true, subtree: true });
    }

    document.addEventListener('click', (e) => {
        if (!e.isTrusted) return;
        const clickedControl = e.target.closest?.('button,[role="button"],a');
        if (isNewChatButton(clickedControl)) {
            selectModelAfterNewChat();
            return;
        }
        const option = e.target.closest?.(MENU_OPTION_SELECTOR);
        if (option && menuIsOpen()) {
            userOverride = true;
            bestAvailableModel = null;
            console.log(
                `[userscript] Manual override -> "${option.textContent.trim()}". ` +
                'Auto-select paused (press Alt+M to resume).'
            );
        }
    }, true);

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
