// ==UserScript==
// @name         Hacker News search on Google
// @version      1.0
// @description  Adds a button to your Google searches to show only Hacker News results
// @author       Ryan Buening
// @license      MIT
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
const urlFilter = "+site%3Anews.ycombinator.com";
const linkText = "Hacker News";
let icon = '<?xml version="1.0" encoding="UTF-8"?><svg preserveAspectRatio="xMidYMid" version="1.1" viewBox="0 0 256 256" xmlns="http://www.w3.org/2000/svg"><rect width="256" height="256" fill="#FB651E"/><path d="m119.37 144.75l-43.941-82.314h20.081l25.847 52.093c0.39766 0.92786 0.86158 1.8888 1.3918 2.883 0.53021 0.99414 0.99413 2.0214 1.3918 3.0818 0.2651 0.39766 0.46393 0.76217 0.59648 1.0935 0.13255 0.33138 0.2651 0.62962 0.39765 0.89472 0.66276 1.3255 1.2592 2.6179 1.7894 3.8771s0.99413 2.4191 1.3918 3.4795c1.0604-2.2534 2.2202-4.6724 3.4795-7.2572s2.5516-5.2689 3.8771-8.0525l26.245-52.093h18.69l-44.338 83.308v53.087h-16.9v-54.081z" fill="#fff"/></svg>';
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