// ==UserScript==
// @name WCE loader
// @namespace https://www.bondageprojects.com/
// @version 0.9
// @description loader script for the fork of old fbc
// @author Sidious (and others)
// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match http://localhost:*/*
// @icon data:image/gif;base64,R0lGODlhAQABAAAAACH5BAEKAAEALAAAAAABAAEAAAICTAEAOw==
// @grant none
// @run-at document-end
// ==/UserScript==

var SCRIPT_URL = 'http://localhost:4000/fbc.js';

var preloadLink = document.createElement("link");
preloadLink.href = SCRIPT_URL;
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

if (typeof FUSAM === "object" && FUSAM?.present) {
  import(SCRIPT_URL);
} else {
  let storeFUSAM;
  Object.defineProperty(window, "FUSAM", {
    set(n) {
      storeFUSAM = n;
      import(SCRIPT_URL);
    },
    get() {
      return storeFUSAM;
    },
  });
}
