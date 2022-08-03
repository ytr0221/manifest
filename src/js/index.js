import { GRID_SIZE, MARGIN, DRAG_INDEX, STATIC_INDEX, DEFAULT_MEMO } from "./globals";
import { snapToGrid, confirm, generateUUID, getLocalStorageItem, setLocalStorageItem, decreaseAllMemoIndexes, checkBounds } from "./utils";
import { addItem } from "./notion-utils";

import "../sass/index.scss";

/*
  Memo Functions and Handlers
*/

/*

# Features

データをどこに保存するか。
①最優先は、firebaseとの連携か
②React, Next.js化

どっち？

TrashBox Space right-bottom corner
同じ行で何番目か

# Accessory
Sliders for showing the progress.
Color changer.
Pomodoro like timer.

# Library

Linkify: https://github.com/Hypercontext/linkifyjs

# Data Structure

user {

}

project {
  name,
  projectId,
  description,
  relation,
  tags

  (subProjects)
}

memo {
  (title),
  id,
  text,
  position: {x,y},
  size:{height, width},
  status:{createdAt, updatedAt, done},
  projectId

  (due, inProgress, priority, tags)
  (connectedTo)
}

*/

// working with text and caret
/*
function setCaretPosition(elemId, caretPos) {
  var elem = document.getElementById(elemId);

  if (elem != null) {
    if (elem.createTextRange) {
      var range = elem.createTextRange();
      range.move("character", caretPos);
      range.select();
    } else {
      if (elem.selectionStart) {
        elem.focus();
        elem.setSelectionRange(caretPos, caretPos);
      } else { elem.focus(); }
    }
  }
} */
import toggleSwitch from "../assets/audio/toggle_switch.mp3";

let theme = "light";
let activeMemo;

let main, canvas, board, selection;
let currentMouse, currentSize;

/*
  Generic Event Handlers
*/

function onMouseDown(e) {
  if (e.target === board) {
    handleBoardDragStart(e);
  } else {
    if (e.target.classList[0] === "drag") {
      handleMemoDragStart(e);
    } else if (e.target.classList[0] === "resize") {
      handleMemoResizeStart(e);
    }
  }
};

function whatTimeIsIt() {
  const now = new Date();

  const hours = now.getHours();
  const minutes = now.getMinutes();
  const seconds = now.getSeconds();

  /* const time = {
    hours: hours.toString().padStart(true ? 2 : 1, "0"),
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0")
  }; */
  const time = {
    hours: hours.toString.padStart(2, "0"),
    minutes: minutes.toString().padStart(2, "0"),
    seconds: seconds.toString().padStart(2, "0")
  };

  return time;
}
const seToggleSwitch = new Audio(toggleSwitch);
// console.log(sound)

function audioPlay(se) {
  se.currentTime = 0;
  se.play(); // 再生
  // document.getElementById('se').currentTime = 0; //連続クリックに対応
  // document.getElementById('se').play(); //クリックしたら音を再生
}

function getLineNumberAtCursorPosition(text, position) {
  console.log("lineNum: ", text.substr(0, position).split("\n").length);
  return text.substr(0, position).split("\n").length;
}
function getCursorPositionInLine(text, lineNumber) {
  console.log(text.split("\n")[lineNumber - 1]);
  return text.split("\n")[lineNumber - 1];
}
function addDOM() {
  const html = "<ul></ul>";
  const selection = window.getSelection();
  const range = selection.getRangeAt(0);
  range.deleteContents();

  const node = document.createElement("div");
  const child = document.createElement("li");
  child.append("");

  node.style.whiteSpace = "pre";
  node.innerHTML = html;
  node.appendChild(child);
  range.insertNode(node);

  // 挿入文字列の末尾にカーソルを移動させる
  selection.collapseToEnd();
}

function createMemo(id, text, position, size, createdAt, updatedAt) { // projectId,
  const memo = document.createElement("div");
  memo.setAttribute("data-id", id);
  memo.classList.add("memo");
  memo.style.top = `${position.top}px`;
  memo.style.left = `${position.left}px`;
  memo.style.width = `${size.width}px`;
  memo.style.height = `${size.height}px`;
  memo.style.zIndex = STATIC_INDEX;

  // const textarea = document.createElement("div"); // contentEditable true
  // textarea.setAttribute("contentEditable", true);

  const textarea = document.createElement("textarea");
  textarea.classList.add("input");
  textarea.setAttribute("placeholder", "");
  textarea.setAttribute("autocomplete", true);

  // DATETIME
  const dt = document.createElement("span");
  dt.textContent = createdAt || updatedAt;
  memo.appendChild(dt);

  if (text) { textarea.value = text; }// textarea.innerHTML = text; } //

  textarea.addEventListener("input", function (e) {
    const memos = getLocalStorageItem("manifest_memos");
    const content = e.target.value; // innerHTML;//textContent; //e.target.value;

    memos[id] = { ...memos[id], createdAt: createdAt || new Date().toLocaleString() };
    memos[id] = { ...memos[id], updatedAt: new Date().toLocaleString() };
    memos[id] = { ...memos[id], text: content };
    setLocalStorageItem("manifest_memos", memos);

    // Bigram detector for monitoring command

    var cursorStartPosition = textarea.selectionStart;
    var cursorEndPosition = textarea.selectionEnd;
    if ((cursorStartPosition === cursorEndPosition) && cursorStartPosition > 1) {
      const bigram = content.substring(cursorStartPosition - 2, cursorStartPosition);
      if (bigram === "- ") {
        console.log("detected!");
        getCursorPositionInLine(content, getLineNumberAtCursorPosition(content, cursorStartPosition));
        // const insert = '<ul><li></li></ul>';
        /* const replaced = content.replace(/- /g, insert);
        //e.target.value = replaced;
        //memos[id] = { ...memos[id], text: replaced };
        //e.target.setSelectionRange(cursorStartPosition+insert.length-2, cursorStartPosition+insert.length-2);
        // document.execCommand('insertText', false, 'test');
        // document.execCommand('insertHTML', false, insert);
        setLocalStorageItem("manifest_memos", memos); */
      }
    }
  }, { passive: false, useCapture: false });
  // https://stackoverflow.com/questions/12661293/save-and-load-date-localstorage
  // https://dev-moyashi.hatenablog.com/entry/2021/10/03/202750
  textarea.addEventListener("focus", function (e) {
    e.target.classList.add("active");

    decreaseAllMemoIndexes();

    activeMemo = e.target.parentNode;
    activeMemo.style.zIndex = STATIC_INDEX;
  });
  textarea.addEventListener("blur", function (e) { e.target.classList.remove("active"); }, { passive: false, useCapture: false });

  memo.appendChild(textarea);

  const drag = document.createElement("div");
  drag.classList.add("drag");
  drag.addEventListener("mousedown", onMouseDown);
  drag.addEventListener("touchstart", onMouseDown);
  memo.appendChild(drag);

  const close = document.createElement("div");
  close.classList.add("close");
  close.innerHTML = "–";
  close.addEventListener("mouseup", handleMemoClose);
  close.addEventListener("touchend", handleMemoClose);
  memo.appendChild(close);

  const resize = document.createElement("div");
  resize.classList.add("resize");
  resize.addEventListener("mousedown", onMouseDown);
  resize.addEventListener("touchstart", onMouseDown);
  memo.appendChild(resize);

  return memo;
};

function handleMemoDragStart(e) {
  if (e.which === 1 || e.touches) {
    decreaseAllMemoIndexes();

    activeMemo = e.target.parentNode;
    activeMemo.classList.add("active");
    activeMemo.style.zIndex = STATIC_INDEX;

    const textarea = activeMemo.querySelectorAll(".input")[0];
    textarea.blur();

    e.target.style.backgroundColor = "var(--gray)";
    e.target.style.cursor = "grabbing";

    document.body.style.cursor = "grabbing";

    const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
    const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

    currentMouse = { x, y };

    document.addEventListener("mousemove", handleMemoDragMove, { passive: false, useCapture: false });
    document.addEventListener("touchmove", handleMemoDragMove, { passive: false, useCapture: false });

    document.addEventListener("mouseup", handleMemoDragEnd, { passive: false, useCapture: false });
    document.addEventListener("touchcancel", handleMemoDragEnd, { passive: false, useCapture: false });
    document.addEventListener("touchend", handleMemoDragEnd, { passive: false, useCapture: false });
  }
};

function handleMemoDragMove(e) {
  const isActive = activeMemo.classList.contains("active");

  if (isActive) {
    const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
    const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

    activeMemo.style.top = `${activeMemo.offsetTop - (currentMouse.y - y)}px`;
    activeMemo.style.left = `${activeMemo.offsetLeft - (currentMouse.x - x)}px`;

    currentMouse = { x, y };
  }
};

function handleMemoDragEnd(e) {
  const bounds = checkBounds(board.getBoundingClientRect(), activeMemo.getBoundingClientRect());

  const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
  const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

  let top = activeMemo.offsetTop - (currentMouse.y - y);
  let left = activeMemo.offsetLeft - (currentMouse.x - x);

  if (bounds) {
    if (bounds.edge === "top") {
      top = bounds.offset;
    } else if (bounds.edge === "bottom") {
      top = bounds.offset;
    } else if (bounds.edge === "left") {
      left = bounds.offset;
    } else if (bounds.edge === "right") {
      left = bounds.offset;
    }
  }

  activeMemo.style.top = `${top}px`;
  activeMemo.style.left = `${left}px`;
  activeMemo.classList.remove("active");

  const drag = activeMemo.querySelectorAll(".drag")[0];
  drag.style.cursor = "grab";
  drag.style.backgroundColor = "transparent";

  const textarea = activeMemo.querySelectorAll(".input")[0];
  textarea.focus();

  const id = activeMemo.dataset.id;
  const memos = getLocalStorageItem("manifest_memos");
  memos[id] = { ...memos[id], position: { top, left } };
  setLocalStorageItem("manifest_memos", memos);

  document.body.style.cursor = null;
  activeMemo = null;
  currentMouse = null;

  document.removeEventListener("mousemove", handleMemoDragMove);
  document.removeEventListener("touchmove", handleMemoDragMove);

  document.removeEventListener("mouseup", handleMemoDragEnd);
  document.removeEventListener("touchcancel", handleMemoDragEnd);
  document.removeEventListener("touchend", handleMemoDragEnd);
};

function handleMemoClose(e) {
  if (confirm("Are you sure you want to remove this memo?")) {
    const id = e.target.parentNode.dataset.id;
    const memos = getLocalStorageItem("manifest_memos");
    delete memos[id];
    setLocalStorageItem("manifest_memos", memos);

    board.removeChild(e.target.parentNode);

    addItem("Yurts in Big Sur, California");
  }
};

function handleMemoResizeStart(e) {
  if (e.which === 1 || e.touches) {
    decreaseAllMemoIndexes();

    activeMemo = e.target.parentNode;
    activeMemo.classList.add("active");
    activeMemo.style.zIndex = STATIC_INDEX;

    const textarea = activeMemo.querySelectorAll(".input")[0];
    textarea.blur();

    document.body.style.cursor = "nw-resize";

    e.target.style.backgroundColor = "var(--gray)";

    const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
    const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

    const rect = activeMemo.getBoundingClientRect();
    const width = parseInt(rect.width, 10);
    const height = parseInt(rect.height, 10);

    currentMouse = { x, y };
    currentSize = { width, height };

    document.addEventListener("mousemove", handleMemoResizeMove, { passive: false, useCapture: false });
    document.addEventListener("touchmove", handleMemoResizeMove, { passive: false, useCapture: false });

    document.addEventListener("mouseup", handleMemoResizeEnd, { passive: false, useCapture: false });
    document.addEventListener("touchcancel", handleMemoResizeEnd, { passive: false, useCapture: false });
    document.addEventListener("touchend", handleMemoResizeEnd, { passive: false, useCapture: false }); ;
  }
};

function handleMemoResizeMove(e) {
  const isActive = activeMemo.classList.contains("active");

  if (isActive) {
    const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
    const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

    const width = (currentSize.width + (x - currentMouse.x)) - 2;
    const height = (currentSize.height + (y - currentMouse.y)) - 2;

    activeMemo.style.width = `${width}px`;
    activeMemo.style.height = `${height}px`;
  }
};

function handleMemoResizeEnd(e) {
  const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX, GRID_SIZE) : snapToGrid(e.clientX, GRID_SIZE);
  const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY, GRID_SIZE) : snapToGrid(e.clientY, GRID_SIZE);

  const width = (currentSize.width + (x - currentMouse.x)) - 2;
  const height = (currentSize.height + (y - currentMouse.y)) - 2;

  activeMemo.style.width = `${width}px`;
  activeMemo.style.height = `${height}px`;

  const bounds = checkBounds(board.getBoundingClientRect(), activeMemo.getBoundingClientRect());

  if (bounds) {
    let top = activeMemo.offsetTop;
    let left = activeMemo.offsetLeft;

    if (bounds.edge === "top") {
      top = bounds.offset;
    } else if (bounds.edge === "bottom") {
      top = bounds.offset;
    } else if (bounds.edge === "left") {
      left = bounds.offset;
    } else if (bounds.edge === "right") {
      left = bounds.offset;
    }

    activeMemo.style.top = `${top}px`;
    activeMemo.style.left = `${left}px`;
  }

  const resize = activeMemo.querySelectorAll(".resize")[0];
  resize.style.cursor = "nw-resize";
  resize.style.backgroundColor = "transparent";

  activeMemo.classList.remove("active");

  const textarea = activeMemo.querySelectorAll(".input")[0];
  textarea.focus();

  const id = activeMemo.dataset.id;
  const memos = getLocalStorageItem("manifest_memos");
  memos[id] = { ...memos[id], size: { width, height } };
  setLocalStorageItem("manifest_memos", memos);

  document.body.style.cursor = null;
  activeMemo = null;
  currentSize = null;

  document.removeEventListener("mousemove", handleMemoResizeMove, { passive: false, useCapture: false });
  document.removeEventListener("touchmove", handleMemoResizeMove, { passive: false, useCapture: false });

  document.removeEventListener("mouseup", handleMemoResizeEnd, { passive: false, useCapture: false });
  document.removeEventListener("touchcancel", handleMemoResizeEnd, { passive: false, useCapture: false });
  document.removeEventListener("touchend", handleMemoResizeEnd, { passive: false, useCapture: false });
};

/*
  Board Functions and Handlers
*/

function handleBoardDragStart(e) {
  if (e.which === 1 || e.touches) {
    document.body.style.cursor = "crosshair";

    board.classList.add("active");

    const rect = board.getBoundingClientRect();
    const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX - rect.left, GRID_SIZE) : snapToGrid(e.clientX - rect.left, GRID_SIZE);
    const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY - rect.top, GRID_SIZE) : snapToGrid(e.clientY - rect.top, GRID_SIZE);

    currentMouse = { x, y };

    selection = document.createElement("div");
    selection.setAttribute("id", "selection");
    selection.style.zIndex = DRAG_INDEX;

    board.appendChild(selection);

    document.addEventListener("mousemove", handleBoardDragMove);
    document.addEventListener("touchmove", handleBoardDragMove);

    document.addEventListener("mouseup", handleBoardDragEnd);
    document.addEventListener("touchcancel", handleBoardDragEnd);
    document.addEventListener("touchend", handleBoardDragEnd);
  }
};

function handleBoardDragMove(e) {
  const rect = board.getBoundingClientRect();
  const x = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientX - rect.left, GRID_SIZE) : snapToGrid(e.clientX - rect.left, GRID_SIZE);
  const y = (e.touches && e.touches.length > 0) ? snapToGrid(e.touches[0].clientY - rect.top, GRID_SIZE) : snapToGrid(e.clientY - rect.top, GRID_SIZE);

  const top = (y - currentMouse.y < 0) ? y : currentMouse.y;
  const left = (x - currentMouse.x < 0) ? x : currentMouse.x;
  const width = Math.abs(x - currentMouse.x) + 1;
  const height = Math.abs(y - currentMouse.y) + 1;

  selection.style.top = `${top}px`;
  selection.style.left = `${left}px`;
  selection.style.width = `${width}px`;
  selection.style.height = `${height}px`;
};

function handleBoardDragEnd(e) {
  const boardRect = board.getBoundingClientRect();
  const selectionRect = selection.getBoundingClientRect();

  const width = selectionRect.width - 2;
  const height = selectionRect.height - 2;

  let top = selectionRect.top - boardRect.top;
  let left = selectionRect.left - boardRect.left;

  const bounds = checkBounds(boardRect, selectionRect);

  if (bounds) {
    if (bounds.edge === "top") {
      top = bounds.offset;
    } else if (bounds.edge === "bottom") {
      top = bounds.offset;
    } else if (bounds.edge === "left") {
      left = bounds.offset;
    } else if (bounds.edge === "right") {
      left = bounds.offset;
    }
  }

  if (width >= 80 && height >= 80) {
    const id = generateUUID();
    const dateNow = new Date().toLocaleString();
    const memo = createMemo(id, null, { top, left }, { width, height }, dateNow, dateNow);
    board.appendChild(memo);

    const textarea = memo.querySelectorAll(".input")[0];
    textarea.focus();

    const memos = getLocalStorageItem("manifest_memos");
    memos[id] = { text: null, position: { top, left }, size: { width, height } };
    setLocalStorageItem("manifest_memos", memos);

    activeMemo = memo;
  }

  document.body.style.cursor = null;
  board.classList.remove("active");
  board.removeChild(selection);

  document.removeEventListener("mousemove", handleBoardDragMove, { passive: false, useCapture: false });
  document.removeEventListener("touchmove", handleBoardDragMove, { passive: false, useCapture: false });

  document.removeEventListener("mouseup", handleBoardDragEnd, { passive: false, useCapture: false });
  document.removeEventListener("touchcancel", handleBoardDragEnd, { passive: false, useCapture: false });
  document.removeEventListener("touchend", handleBoardDragEnd, { passive: false, useCapture: false });
};

/*
  App Functions
*/

function toggleTheme() {
  const body = document.querySelector("body");
  if (theme === "light") {
    body.classList.add("dark");
    theme = "dark";
    setLocalStorageItem("manifest_theme", "dark");
  } else {
    body.classList.remove("dark");
    theme = "light";
    setLocalStorageItem("manifest_theme", "light");
  }

  // Redraw the canvas
  onResize();
}

function handleTheme() {
  const body = document.querySelector("body");
  const savedPreference = getLocalStorageItem("manifest_theme");

  // Prefer saved preference over OS preference
  if (savedPreference) {
    if (savedPreference === "dark") {
      body.classList.add("dark");
      theme = "dark";
      setLocalStorageItem("manifest_theme", "dark");
    } else {
      body.classList.remove("dark");
      theme = "light";
      setLocalStorageItem("manifest_theme", "light");
    }
    return;
  }

  if (window.matchMedia("(prefers-color-scheme: dark)").matches) {
    body.classList.add("dark");
    theme = "dark";
  }
}

function onKeydown(e) {
  if ((e.code === "KeyT" || e.keyCode === 84) && e.altKey) {
    audioPlay(seToggleSwitch);
    toggleTheme();
    addDOM();
    console.log(whatTimeIsIt());
  } // else if ((e.code === "KeyP" || e.keyCode === 84) && e.altKey) {
  // toggleTheme();
  // }
}

function onResize() {
  main.style.width = `${window.innerWidth}px`;
  main.style.height = `${window.innerHeight}px`;

  const width = (window.innerWidth - MARGIN) - 1;
  const height = (window.innerHeight - MARGIN) + 1;

  canvas.setAttribute("width", width);
  canvas.setAttribute("height", height);

  canvas.style.top = `${MARGIN / 2}px`;
  canvas.style.left = `${MARGIN / 2}px`;
  canvas.style.width = `${width}px`;
  canvas.style.height = `${height}px`;

  const context = canvas.getContext("2d");

  for (let x = 0; x <= width; x += GRID_SIZE) {
    for (let y = 0; y <= height; y += GRID_SIZE) {
      context.fillStyle = theme === "light" ? "rgba(0, 0, 0, 0.5)" : "rgba(255, 255, 255, 0.4)";
      context.beginPath();
      context.rect(x, y, 1, 1);
      context.fill();
    }
  }

  board.style.top = `${MARGIN / 2}px`;
  board.style.left = `${MARGIN / 2}px`;
  board.style.width = `${width}px`;
  board.style.height = `${height}px`;

  currentMouse = null;
  currentSize = null;
};

function onLoad() {
  handleTheme();

  main = document.createElement("main");
  main.setAttribute("id", "app");

  canvas = document.createElement("canvas");
  canvas.setAttribute("id", "grid");

  board = document.createElement("section");
  board.setAttribute("id", "board");

  board.addEventListener("mousedown", onMouseDown, { passive: false, useCapture: false });
  board.addEventListener("touchstart", onMouseDown, { passive: false, useCapture: false });

  document.oncontextmenu = function () { return false; };
  const menu = document.getElementById("contextmenu");
  /*
  const menuBar = document.createElement("div");
  menuBar.classList.add("menuBar");
  menuBar.innerHTML = "menu";
  menu.appendChild(menuBar); */

  // menu.setAttribute("id", "contextmenu");
  window.addEventListener("contextmenu", function (e) {
    menu.style.left = e.pageX + "px";
    menu.style.top = e.pageY + "px";
    menu.classList.add("show");
  });

  window.addEventListener("click", function () {
    if (menu.classList.contains("show")) {
      menu.classList.remove("show");
    }
  });

  main.appendChild(canvas);
  main.appendChild(board);
  document.body.appendChild(main);

  document.body.addEventListener("touchmove", function (event) {
    event.preventDefault();
  }, { passive: false, useCapture: false });

  const memos = getLocalStorageItem("manifest_memos");
  if (!memos || Object.keys(memos).length === 0) {
    const memo = createMemo(DEFAULT_MEMO.id, DEFAULT_MEMO.text, DEFAULT_MEMO.position, DEFAULT_MEMO.size);
    board.appendChild(memo);

    const memos = {};
    // DEFAULT MEMO !!!!!!!!
    memos[DEFAULT_MEMO.id] = { text: DEFAULT_MEMO.text, position: DEFAULT_MEMO.position, size: DEFAULT_MEMO.size };
    setLocalStorageItem("manifest_memos", memos);
  } else {
    for (const key of Object.keys(memos)) {
      const memo = createMemo(key, memos[key].text, memos[key].position, memos[key].size, memos[key].createdAt, memos[key].updatedAt);
      board.appendChild(memo);
    }
  }

  onResize();
};

window.addEventListener("resize", onResize);
window.addEventListener("load", onLoad);
window.addEventListener("keydown", onKeydown);
