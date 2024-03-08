// ==UserScript==
// @name         Drag text to search
// @version      1.0
// @description  Highlight, drag, then release text to search in Google
// @author       Ryan Buening
// @license      MIT
// @namespace    https://github.com/ryanbuening/userscripts
// @run-at       document-start
// @include      *
// ==/UserScript==

(function() {
  const isTextArea = element => ['email', 'number', 'password', 'search', 'tel', 'text', 'url', 'textarea'].includes(element.type) && !element.disabled;

  const handleDragOver = event => {
    if (event.dataTransfer.types.includes('text/uri-list')) {
      event.dataTransfer.dropEffect = 'link';
      event.preventDefault();
    } else if (event.dataTransfer.types.includes('text/plain') && !isTextArea(event.target)) {
      event.dataTransfer.dropEffect = 'link';
      event.preventDefault();
    }
  };

  const handleDrop = event => {
    if (event.dataTransfer.types.includes('text/uri-list')) {
      const url = event.dataTransfer.getData('URL');
      window.open(url, '_blank');
      event.preventDefault();
    } else if (event.dataTransfer.types.includes('text/plain') && !isTextArea(event.target)) {
      const keyword = event.dataTransfer.getData('text/plain');
      const url = 'https://www.google.com/search?q=%s'.replace(/%s/gi, encodeURIComponent(keyword));
      window.open(url, '_blank');
      event.preventDefault();
    }
  };

  document.addEventListener('dragover', handleDragOver, false);
  document.addEventListener('drop', handleDrop, false);
})();
