// ==UserScript==
// @name         StackOverflow search on Google
// @version      1.3
// @description  Adds a button to search StackOverflow posts with Google
// @author       Ryan Buening
// @namespace    https://ryanbuening.com
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
const urlFilter = "+site%3Astackoverflow.com";
let icon = '<svg aria-hidden="true" class="svg-icon iconLogoGlyphXSm native js-svg" width="18" height="18" viewBox="0 0 18 18"><path d="M14 16v-5h2v7H2v-7h2v5h10z" fill="#BCBBBB"></path><path d="M12.09.72l-1.21.9 4.5 6.07 1.22-.9L12.09.71zM5 15h8v-2H5v2zm9.15-5.87L8.35 4.3l.96-1.16 5.8 4.83-.96 1.16zm-7.7-1.47l6.85 3.19.63-1.37-6.85-3.2-.63 1.38zm6.53 5L5.4 11.39l.38-1.67 7.42 1.48-.22 1.46z" fill="#F48024"></path></svg>';
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
	link.appendChild(document.createTextNode('StackOverflow'));
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
