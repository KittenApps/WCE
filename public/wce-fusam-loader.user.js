// ==UserScript==
// @name WCE loader local with FUSAM
// @namespace https://www.bondageprojects.com/
// @version 1.2
// @description Wholesome Club Extensions (WCE) - enhancements for the bondage club - fork of FBC 5.8
// @author Sidious, Stella
// @supportURL https://github.com/KittenApps/WCE
// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match http://localhost:*/*
// @icon https://wce.netlify.app/icon.png
// @grant none
// @run-at document-end
// ==/UserScript==

var SCRIPT_URL = 'http://localhost:4000/wce.js';

import(`https://sidiousious.gitlab.io/bc-addon-loader/fusam.js?v=${(Date.now()/10000).toFixed(0)}`).then(() => import(SCRIPT_URL));

var preloadLink = document.createElement("link");
preloadLink.href = SCRIPT_URL;
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
delete fusam.enabledDistributions.WCE;
delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));
