// ==UserScript==
// @name WCE loader with FUSAM
// @namespace https://www.bondageprojects.com/
// @version 1.5
// @description Wholesome Club Extensions (WCE) - enhancements for the bondage club - fork of FBC 5.8
// @author Sidious, Stella
// @supportURL https://github.com/KittenApps/WCE
// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match https://bondageprojects.com/*
// @match https://www.bondageprojects.com/*
// @icon https://wce-docs.vercel.app/img/logo.png
// @grant none
// @run-at document-end
// ==/UserScript==

import(`https://sidiousious.gitlab.io/bc-addon-loader/fusam.js?v=${(Date.now()/10000).toFixed(0)}`);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
fusam.enabledDistributions.WCE ??= "stable";
const URL = fusam.enabledDistributions.WCE === "stable" ? "https://wce.netlify.app" : "https://beta--wce.netlify.app" ;

var preloadLink = document.createElement("link");
preloadLink.href = `${URL}/wce.js`;
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

var dexiePreloadLink = document.createElement("link");
dexiePreloadLink.href = `${URL}/dexie.js`;
dexiePreloadLink.rel = "modulepreload";
document.head.appendChild(dexiePreloadLink);

delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));
