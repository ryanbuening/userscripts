// ==UserScript==
// @name         Select Text Inside Link
// @version      1.0.0
// @description  Disable link dragging and select text.
// @author       Ryan Buening
// @license      MIT
// @namespace    https://github.com/ryanbuening/userscripts
// @updateURL    https://github.com/ryanbuening/userscripts/raw/refs/heads/master/select-text-inside-link.user.js
// @downloadURL  https://github.com/ryanbuening/userscripts/raw/refs/heads/master/select-text-inside-link.user.js
// @include      *
// @grant        GM_addStyle
// @run-at       document-start
// ==/UserScript==

const tracker = createMovementTracker();
const selection = window.getSelection();

// State machine: WAITING -> STARTING -> STARTED -> ENDING -> WAITING
let state = "WAITING";
let preState;
let mousemoves = 0;
let linkTarget;
const initPos = [0, 0];
let selectType;

// Ensures required placeholder elements exist in the DOM.
// Must run after document.body is available.
function fix() {
  const ids = ['ace-block', 'insights-widget', 'onboarding-checklist'];
  for (const id of ids) {
    if (!document.getElementById(id)) {
      const el = document.createElement('div');
      el.id = id;
      el.className = 'is-hidden';
      document.body.appendChild(el);
    }
  }
}

const EVENTS = {
  mousedown: e => {
    if (state !== "WAITING") return;
    if (e.altKey || e.button) return;
    if (/img/i.test(e.target.nodeName)) return;

    const target = findLinkTarget(e.target);
    if (!target || !target.href) return;

    selectType = e.ctrlKey ? "add" : e.shiftKey ? "extend" : "new";
    initPos[0] = e.pageX;
    initPos[1] = e.pageY;

    if (selectType === "new") {
      if (!selection.isCollapsed && inSelect(getInitPos(), selection)) return;
    }

    mousemoves = 0;
    state = "STARTING";
    linkTarget = target;
    linkTarget.classList.add("select-text-inside-a-link");
  },

  mousemove: e => {
    if (state === "STARTING") {
      mousemoves++;
      // dragstart doesn't always fire; fall back to mousemove threshold
      // https://github.com/eight04/select-text-inside-a-link-like-opera/issues/9
      if (mousemoves >= 3) startSelecting(e);
    }
    if (state === "STARTED") {
      const caretPos = caretPositionFromPoint(
        e.pageX - window.scrollX,
        e.pageY - window.scrollY
      );
      selection.extend(caretPos.offsetNode, caretPos.offset);
    }
  },

  mouseup: () => {
    if (state !== "WAITING") {
      preState = state;
      state = "ENDING";
      setTimeout(startWaiting); // delay to allow click event to fire first
    }
  },

  click: e => {
    if (state === "ENDING") {
      if (preState === "STARTED") {
        // Cancel navigation if text was selected
        const clickedTarget = findLinkTarget(e.target);
        if (clickedTarget === linkTarget) {
          e.preventDefault();
          e.stopImmediatePropagation();
        }
      }
      startWaiting();
    }
  },

  dragstart: e => {
    if (state === "STARTED") {
      e.preventDefault();
      return;
    }
    if (state === "STARTING") startSelecting(e);
  }
};

for (const key in EVENTS) {
  document.addEventListener(key, EVENTS[key], true);
}

// Deferred until DOM is ready — document.body is null at document-start
document.addEventListener("DOMContentLoaded", () => {
  fix();
  if (!document.contentType || !document.contentType.endsWith("/xml")) {
    GM_addStyle(".select-text-inside-a-link{ -moz-user-select: text!important; }");
  }
});

// --- Helpers ---

function startSelecting(e) {
  if (!shouldStart(e)) {
    startWaiting();
    return;
  }
  if (e.type === "dragstart") e.preventDefault();

  if (selectType === "new") {
    const pos = getInitPos();
    selection.collapse(pos.offsetNode, pos.offset);
  } else if (selectType === "add") {
    const range = new Range();
    const pos = getInitPos();
    range.setStart(pos.offsetNode, pos.offset);
    selection.addRange(range);
  }
  state = "STARTED";
}

function getInitPos() {
  return caretPositionFromPoint(initPos[0] - window.scrollX, initPos[1] - window.scrollY);
}

function shouldStart(e) {
  const delta = tracker
    ? tracker()
    : [Math.abs(e.pageX - initPos[0]), Math.abs(e.pageY - initPos[1])];
  return delta[0] >= delta[1]; // horizontal movement dominates
}

function startWaiting() {
  if (linkTarget) linkTarget.classList.remove("select-text-inside-a-link");
  state = "WAITING";
  linkTarget = null;
}

function createMovementTracker() {
  // Tracks the last 3 mousemove positions to compute delta on dragstart,
  // where Chrome and Firefox disagree on event timing.
  const moves = [[0, 0], [0, 0], [0, 0]];
  let index = 0;
  document.addEventListener("mousemove", e => {
    moves[index][0] = e.pageX;
    moves[index][1] = e.pageY;
    index = (index + 1) % 3;
  });
  return () => {
    const output = [];
    for (let i = 0; i < 2; i++) {
      output.push(
        Math.abs(moves[index][i] - moves[(index + 1) % 3][i]) +
        Math.abs(moves[(index + 1) % 3][i] - moves[(index + 2) % 3][i])
      );
    }
    return output;
  };
}

function caretPositionFromPoint(x, y) {
  if (document.caretPositionFromPoint) {
    return document.caretPositionFromPoint(x, y);
  }
  // Fallback for browsers using the older caretRangeFromPoint (WebKit/Blink)
  const r = document.caretRangeFromPoint(x, y);
  return { offsetNode: r.startContainer, offset: r.startOffset };
}

function inSelect(caretPos, selection) {
  for (let i = 0; i < selection.rangeCount; i++) {
    if (selection.getRangeAt(i).isPointInRange(caretPos.offsetNode, caretPos.offset)) {
      return true;
    }
  }
  return false;
}

function findLinkTarget(target) {
  while (target && target.nodeName !== "A" && target.nodeName !== "a") {
    target = target.parentNode;
  }
  return target;
}
