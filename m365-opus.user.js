// ==UserScript==
// @name         M365 Copilot - Auto Select Opus
// @version      1.0
// @description  Automatically clicks the model dropdown and selects Opus
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/m365-opus.user.js
// @match        https://m365.cloud.microsoft/*
// @grant        none
// ==/UserScript==

(function() {
    'use strict';

    let attempts = 0;
    const maxAttempts = 20; // Stops trying after 10 seconds (20 * 500ms)

    const intervalId = setInterval(() => {
        attempts++;
        
        // Find the button that currently says "Auto"
        const buttons = Array.from(document.querySelectorAll('button'));
        const autoBtn = buttons.find(btn => btn.textContent.trim() === 'Auto');

        if (autoBtn) {
            autoBtn.click();
            
            // Wait a moment for the animation/menu to open
            setTimeout(() => {
                const allElements = Array.from(document.querySelectorAll('*'));
                const opusBtn = allElements.find(el => el.textContent.trim().startsWith('Opus'));
                
                if (opusBtn) {
                    opusBtn.click();
                    clearInterval(intervalId);
                }
            }, 300);
        } else if (attempts >= maxAttempts) {
            clearInterval(intervalId);
        }
    }, 500);
})();