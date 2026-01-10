export default class LoaderBuilder {
  constructor() {
    this.isLocal = !process.env.NETLIFY;
    this.matchBlock = this.isLocal
      ? "// @match http://localhost:*/*"
      : `// @match https://bondageprojects.elementfx.com/*
// @match https://www.bondageprojects.elementfx.com/*
// @match https://bondage-europe.com/*
// @match https://www.bondage-europe.com/*
// @match https://bondage-asia.com/*
// @match https://www.bondage-asia.com/*
// @match https://bondageprojects.com/*
// @match https://www.bondageprojects.com/*`;
    this.isBranch = !this.isLocal && (process.env.BRANCH === "main" || process.env.BRANCH === "beta");
    this.branch = process.env.BRANCH;
    this.pr = process.env.REVIEW_ID;
    this.label = this.isLocal ? "local " : this.branch === "main" ? "" : `${this.branch.startsWith("pull/") ? `PR #${this.pr}` : this.branch} `;
    this.URL = this.isLocal ? "http://localhost:4000" : process.env.CONTEXT === "production" ? process.env.URL : process.env.DEPLOY_PRIME_URL;
  }

  getUserScriptMeta(isFUSAM) {
    return `// ==UserScript==
// @name WCE ${this.label}loader${isFUSAM ? " with FUSAM" : ""}
// @namespace https://www.bondageprojects.com/
// @version ${isFUSAM ? "1.6" : "1.3"}
// @description Wholesome Club Extensions (WCE) - enhancements for the bondage club - fork of FBC 5.8
// @author Sidious, Stella
// @supportURL https://github.com/KittenApps/WCE
${this.matchBlock}
// @icon https://wce-docs.vercel.app/img/logo.png
// @grant none
// @run-at document-end
// ==/UserScript==`;
  }

  generateFusamLoader() {
    if (this.isBranch) {
      return `${this.getUserScriptMeta(true)}

import(\`https://sidiousious.gitlab.io/bc-addon-loader/fusam.js?v=\${(Date.now()/10000).toFixed(0)}\`);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
fusam.enabledDistributions.WCE ??= "${process.env.BRANCH === "main" ? "stable" : "dev"}";
const URL = fusam.enabledDistributions.WCE === "stable" ? "https://wce.netlify.app" : "https://beta--wce.netlify.app" ;

var preloadLink = document.createElement("link");
preloadLink.href = \`\${URL}/wce.js\`;
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));`;
    }
    return `${this.getUserScriptMeta(true)}

import(\`https://sidiousious.gitlab.io/bc-addon-loader/fusam.js?v=\${(Date.now()/10000).toFixed(0)}\`).then(() => import("${this.URL}/wce.js"));

var preloadLink = document.createElement("link");
preloadLink.href = "${this.URL}/wce.js";
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
delete fusam.enabledDistributions.WCE;
delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));`;
  }

  generateStandaloneLoader() {
    return `${this.getUserScriptMeta(false)}

var preloadLink = document.createElement("link");
preloadLink.href = "${this.URL}/wce.js";
preloadLink.rel = "modulepreload";
document.head.appendChild(preloadLink);

var fusam = JSON.parse(localStorage.getItem("fusam.settings") || "{}");
fusam.enabledDistributions ??= {};
delete fusam.enabledDistributions.WCE;
delete fusam.enabledDistributions.FBC;
localStorage.setItem("fusam.settings", JSON.stringify(fusam));

if (typeof FUSAM === "object" && FUSAM?.present) {
  import("${this.URL}/wce.js");
} else {
  let storeFUSAM;
  Object.defineProperty(window, "FUSAM", {
    set(n) {
      storeFUSAM = n;
      import("${this.URL}/wce.js");
    },
    get() {
      return storeFUSAM;
    },
  });
}`;
  }
}
