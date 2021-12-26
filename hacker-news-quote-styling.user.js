// ==UserScript==
// @name         Hacker News Quote Styling
// @version      1.0
// @description  Adds styling to Hacker News block quotes in comments
// @author       Ryan Buening
// @license      MIT
// @namespace    https://github.com/ryanbuening/userscripts
// @include      http*://www.google.*/search*
// @include      http*://google.*/search*
// @run-at       document-end
// ==/UserScript==

const [head] = document.getElementsByTagName('head');
style = document.createElement('style');
style.type = 'text/css';
style.innerHTML = `
.comment-quote {
	background: #46464620;
	font-style: italic;
	color: #464646;
  border-left-width:: 3px;
  border-left-color: #46464650;
  border-left-style: solid;
  padding: 2px;
  padding-left: 5px;
};
`;
head.appendChild(style);

document.querySelectorAll('.commtext').forEach(c => {
  let quoteDiv = null;
  c.childNodes.forEach(node => {
    const commentLine = node.textContent || node.innerText;
    if (quoteDiv || commentLine.match(/^>+\s/)) {
      if (commentLine.startsWith('>')) {
        const quoteText = commentLine.substring(commentLine.indexOf(' '));

        if (node.textContent)
          node.textContent = quoteText;
        else
          node.innerText = quoteText;
      }

      if (!quoteDiv) {
        quoteDiv = document.createElement('div');
        quoteDiv.classList.add('comment-quote');
        node.parentNode.insertBefore(quoteDiv, node);
      }

      quoteDiv.appendChild(node);

      if (!commentLine.match(/^>+\s*$/)) {
        quoteDiv = null;
      }
    }
  });
});
