// ==UserScript==
// @name WCE loader local with FUSAM
// @namespace https://www.bondageprojects.com/
// @version 1.3
// @description Wholesome Club Extensions (WCE) - enhancements for the bondage club - fork of FBC 5.8
// @author Sidious, Stella
// @supportURL https://github.com/KittenApps/WCE
// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match http://localhost:*/*
// @icon https://wce-docs.vercel.app/img/logo.png
// @grant none
// @run-at document-end
// ==/UserScript==

import(`https://sidiousious.gitlab.io/bc-addon-loader/fusam.js?v=${(Date.now()/10000).toFixed(0)}`);

var preloadLink = document.createElement("link");
preloadLink.href = 'http://localhost:4000/wce.js';
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

var dexiePreloadLink = document.createElement("link");
dexiePreloadLink.href = 'http://localhost:4000/dexie.js';
dexiePreloadLink.rel = "modulepreload";
document.head.appendChild(dexiePreloadLink);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
fusam.enabledDistributions.WCE ??= "stable";
delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));
