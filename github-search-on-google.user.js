// ==UserScript==
// @name         GitHub search on Google
// @version      1.2
// @description  Adds a button to your Google searches to show only GitHub results
// @author       Ryan Buening
// @namespace    https://github.com/ryanbuening/userscripts
// @include      http*://www.google.*/search*
// @include      http*://google.*/search*
// @run-at       document-end
// ==/UserScript==

// Change this to false if you don't want to include an icon
const addIcon = true;
// Change this to true if you want to add the button to the right of the 'Tools' button
const appendRight = false;

const queryRegex = /q=[^&]+/g;
const siteRegex = /\+site(?:%3A|\:).+\.[^&+]+/g;
const urlFilter = "+site%3Agithub.com";
const linkText = "GitHub";
let icon = '<svg xmlns="http://www.w3.org/2000/svg" width="18" height="18" viewBox="0 0 24 24"><path d="M12 0c-6.626 0-12 5.373-12 12 0 5.302 3.438 9.8 8.207 11.387.599.111.793-.261.793-.577v-2.234c-3.338.726-4.033-1.416-4.033-1.416-.546-1.387-1.333-1.756-1.333-1.756-1.089-.745.083-.729.083-.729 1.205.084 1.839 1.237 1.839 1.237 1.07 1.834 2.807 1.304 3.492.997.107-.775.418-1.305.762-1.604-2.665-.305-5.467-1.334-5.467-5.931 0-1.311.469-2.381 1.236-3.221-.124-.303-.535-1.524.117-3.176 0 0 1.008-.322 3.301 1.23.957-.266 1.983-.399 3.003-.404 1.02.005 2.047.138 3.006.404 2.291-1.552 3.297-1.23 3.297-1.23.653 1.653.242 2.874.118 3.176.77.84 1.235 1.911 1.235 3.221 0 4.609-2.807 5.624-5.479 5.921.43.372.823 1.102.823 2.222v3.293c0 .319.192.694.801.576 4.765-1.589 8.199-6.086 8.199-11.386 0-6.627-5.373-12-12-12z"/></svg>';
const isImageSearch = /[?&]tbm=isch/.test(location.search);

if (typeof trustedTypes !== 'undefined') {
	const policy = trustedTypes.createPolicy('html', { createHTML: input => input });
	icon = policy.createHTML(icon);
}

(function () {
	// create the element
	let el = document.createElement('div');
	el.className = 'hdtb-mitem';
	const link = document.createElement('a');

	// add the icon
	if (addIcon) {
		const span = document.createElement('span');
		span.className = isImageSearch ? 'm3kSL' : 'bmaJhd iJddsb';
		span.style.cssText = 'height:16px;width:16px';
		span.innerHTML = icon;
		link.appendChild(span);
	}

	// add 'site:*' to the query
	link.appendChild(document.createTextNode(linkText));
	link.href = window.location.href.replace(queryRegex, (match) => {
		// Replaces the existing `site` flags
		return match.search(siteRegex) >= 0 ? match.replace(siteRegex, urlFilter) : match + urlFilter;
	});
	if (isImageSearch) {
		link.classList.add('NZmxZe');
		el = link;
	} else {
		el.appendChild(link);
	}

	// insert the element into Google search
	if (appendRight) {
		const toolsBtn = document.querySelector(isImageSearch ? '.ssfWCe' : '.t2vtad');
		toolsBtn.parentNode.insertBefore(el, toolsBtn.nextSibling);
	} else {
		const menuBar = document.querySelector(isImageSearch ? '.T47uwc' : '.MUFPAc');
		if (isImageSearch) {
			menuBar.insertBefore(el, menuBar.children[menuBar.childElementCount - 1]);
		} else {
			menuBar.appendChild(el);
		}
	}
})();
