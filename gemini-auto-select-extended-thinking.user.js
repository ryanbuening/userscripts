// ==UserScript==
// @name         Gemini - Auto Select Extended Thinking
// @version      1.1
// @description  Auto-selects Extended Thinking in Google Gemini dropdown and yields to manual selection
// @namespace    https://github.com/ryanbuening/userscripts
// @match        https://gemini.google.com/*
// @grant        none
// @run-at       document-idle
// ==/UserScript==
(function () {
    'use strict';

    const DEBUG = true; // flip to false to silence console output
    const TAG = '[gemini-auto-model]';
    const dbg   = (...a) => DEBUG && console.log(TAG, ...a);
    const dbgw  = (...a) => DEBUG && console.warn(TAG, ...a);
    const dbge  = (...a) => DEBUG && console.error(TAG, ...a);
    const group = (label, fn) => {
        if (!DEBUG) return fn();
        console.groupCollapsed(TAG, label);
        try { return fn(); } finally { console.groupEnd(); }
    };

    const TARGET_OPTION = 'Extended thinking';
    const MENU_TIMEOUT_MS = 2000;
    const DEBOUNCE_MS = 150;
    const POLL_INTERVAL_MS = 30;
    const COOLDOWN_MS = 300;

    // Primary & fallback button selectors
    const MODEL_BUTTON_SELECTOR = '[data-test-id="bard-mode-menu-button"]';
    const MODEL_BUTTON_FALLBACKS = [
        MODEL_BUTTON_SELECTOR,
        'button.input-area-switch',
        'button[gemmenutrigger]',
        'button[aria-label*="mode picker" i]',
        'button[aria-haspopup="true"]'
    ];

    const MENU_OPTION_SELECTOR = [
        '[role="menuitem"]',
        '[role="menuitemcheckbox"]',
        '[role="menuitemradio"]',
        '[role="option"]',
        '.mat-mdc-menu-item',
        'button.mat-mdc-menu-item',
        '[role="button"]'
    ].join(',');

    const INPUT_SELECTOR = [
        'rich-textarea [contenteditable="true"]',
        '[contenteditable="true"]',
        'textarea[placeholder*="Ask"]',
        'textarea[placeholder*="Message"]',
        'textarea'
    ].join(',');

    const NEW_CHAT_LABEL = 'New chat';

    let selecting = false;
    let cooldownUntil = 0;
    let debounceTimer = null;
    let userOverride = false;
    let isSettledState = false;
    let selectModelInvocations = 0;

    dbg('script loaded', {
        version: '1.1',
        url: location.href,
        target: TARGET_OPTION,
        readyState: document.readyState,
    });

    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

    function simulateClick(el) {
        if (!el) return;
        dbg('simulateClick()', {
            tag: el?.tagName,
            testId: el?.getAttribute?.('data-test-id'),
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

    function getModelButton() {
        // Direct match on data-test-id
        const direct = document.querySelector(MODEL_BUTTON_SELECTOR);
        if (direct) {
            dbg('getModelButton() -> found via data-test-id', {
                ariaLabel: direct.getAttribute('aria-label'),
                ariaExpanded: direct.getAttribute('aria-expanded'),
                text: direct.textContent.trim(),
            });
            return direct;
        }

        // Fallback selectors
        for (const selector of MODEL_BUTTON_FALLBACKS) {
            const btn = document.querySelector(selector);
            if (btn) {
                dbgw('getModelButton() -> found via fallback selector', { selector });
                return btn;
            }
        }

        dbgw('getModelButton() -> NOT FOUND');
        return null;
    }

    const menuIsOpen = () => {
        const btn = getModelButton();
        if (btn?.getAttribute('aria-expanded') === 'true') return true;

        // Check if CDK overlay menu referenced by aria-controls is rendered
        const menuId = btn?.getAttribute('aria-controls');
        if (menuId && document.getElementById(menuId)) return true;

        return !!document.querySelector('.cdk-overlay-pane .mat-mdc-menu-panel, [role="menu"]');
    };

    function findMenuOption(label) {
        const modelBtn = getModelButton();
        // Look within CDK overlay container or the broader document
        const root = document.querySelector('.cdk-overlay-container') || document;
        let elements = [...root.querySelectorAll(MENU_OPTION_SELECTOR)].filter((el) => el !== modelBtn);
        return elements.find((el) => el.textContent.trim().toLowerCase().includes(label.toLowerCase())) ?? null;
    }

    function isOptionChecked(el) {
        if (!el) return false;
        if (el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-selected') === 'true') return true;
        if (el.classList.contains('selected') || el.classList.contains('active') || el.classList.contains('checked')) return true;

        // Check for presence of active checkmark SVG or mat-icon
        const checkIcon = el.querySelector('mat-icon, gem-icon, svg, [class*="check"], [class*="done"]');
        if (checkIcon) {
            const iconName = checkIcon.getAttribute('data-mat-icon-name') || checkIcon.getAttribute('fonticon') || checkIcon.textContent?.trim() || '';
            if (iconName === 'check' || iconName === 'done' || iconName === '✓' || iconName === '✔') return true;
            if (checkIcon.tagName.toLowerCase() === 'svg' && getComputedStyle(checkIcon).display !== 'none') return true;
        }
        return el.textContent.includes('✓') || el.textContent.includes('✔');
    }

    function isSettled() {
        return isSettledState;
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

    function focusInputBox() {
        document.querySelector(INPUT_SELECTOR)?.focus();
    }

    function isNewChatButton(element) {
        if (!element) return false;
        const text = element.textContent.trim();
        const ariaLabel = element.getAttribute('aria-label')?.trim() || '';
        return text.includes(NEW_CHAT_LABEL) || ariaLabel.includes(NEW_CHAT_LABEL) || element.matches?.('a[href="/app"]');
    }

    function selectModelAfterNewChat() {
        userOverride = false;
        isSettledState = false;
        cooldownUntil = 0;
        setTimeout(() => {
            selectExtendedThinking();
        }, 300);
    }

    async function selectExtendedThinking() {
        selectModelInvocations++;
        dbg('selectExtendedThinking()', { invocation: selectModelInvocations });
        if (selecting || userOverride || isSettled()) return false;
        selecting = true;

        try {
            const btn = getModelButton();
            if (!btn) return false;

            const wasOpen = menuIsOpen();
            if (!wasOpen) {
                simulateClick(btn);
            }

            const option = await waitFor(() => findMenuOption(TARGET_OPTION));
            if (!option) {
                if (!wasOpen && menuIsOpen()) {
                    simulateClick(btn); // dismiss menu if target not found
                }
                return false;
            }

            if (isOptionChecked(option)) {
                dbg('Extended thinking is already active');
                isSettledState = true;
                if (!wasOpen && menuIsOpen()) {
                    simulateClick(btn); // close menu
                }
                cooldownUntil = Date.now() + COOLDOWN_MS;
                setTimeout(focusInputBox, 100);
                return true;
            }

            await sleep(50);
            simulateClick(option);

            isSettledState = true;
            cooldownUntil = Date.now() + COOLDOWN_MS;
            console.log(`[userscript] Selected ${TARGET_OPTION}`);

            await sleep(100);
            if (menuIsOpen()) {
                const btnAfter = getModelButton();
                if (btnAfter) simulateClick(btnAfter);
            }

            setTimeout(focusInputBox, 100);
            return true;
        } finally {
            selecting = false;
        }
    }

    async function enforceUntilSettled() {
        for (let i = 0, streak = 0; i < 20 && streak < 3; i++) {
            if (userOverride) break;
            if (isSettled()) {
                streak++;
            } else {
                streak = 0;
                await selectExtendedThinking();
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
            const text = option.textContent.trim();
            if (!text.toLowerCase().includes(TARGET_OPTION.toLowerCase())) {
                userOverride = true;
                isSettledState = true;
                console.log(
                    `[userscript] Manual override -> "${text}". ` +
                    'Auto-select paused (press Alt+M to resume).'
                );
            }
        }
    }, true);

    document.addEventListener('keydown', (e) => {
        if (e.altKey && (e.key === 'm' || e.key === 'M')) {
            userOverride = false;
            isSettledState = false;
            console.log('[userscript] Auto-select resumed.');
            selectExtendedThinking();
        }
    });

    const observer = new MutationObserver(() => {
        if (userOverride || selecting || Date.now() < cooldownUntil) return;
        clearTimeout(debounceTimer);
        debounceTimer = setTimeout(() => {
            if (!userOverride && !isSettled()) selectExtendedThinking();
        }, DEBOUNCE_MS);
    });

    enforceUntilSettled();
})();