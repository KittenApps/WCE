# Wholesome Club Extensions (WCE)
[![Netlify Status](https://api.netlify.com/api/v1/badges/35a90374-386e-4a9e-98a0-ad54fbf0b2e3/deploy-status)](https://app.netlify.com/sites/wce/deploys?branch=main)
[![Github Actions main](https://github.com/KittenApps/WCE/actions/workflows/test.yml/badge.svg?branch=main&event=push)](https://github.com/KittenApps/WCE/actions?query=event%3Apush+branch%3Amain)

*this BC addon started as a fork of [FBC](https://sidiousious.gitlab.io/bce/) created by [Sidiousious](https://gitlab.com/Sidiousious)*

## Features

* all your features you learned to love from the FBC 5.8 version are back:
    * the super wholesome Animation Engine
    * Chat links and embeds (and 3d party content prompts)
    * friends online notifications, buttplug.io toy sync and more ...
* a completely rewritten anti garble feature for the latest BC versions ([read the docs](https://wce-docs.vercel.app/docs/category/anti-garbling-system))
* adopted to new features in latest BC versions:
    * updated layering menus and copy color button
    * added clear cache button to chat menu
* check out the [Changelog](https://wce-docs.vercel.app/blog/wce-v6-2) for a complete list of changes since FBC 5.8

## Installation

see also: https://wce-docs.vercel.app/docs/installation

### User Script loader (recommended)

1. **Install a users script manager:**
    * install [Violentmonkey](https://violentmonkey.github.io/#installation) (recommended, open source) for your browser following the linked instructions 
    * or [Tampermonkey](https://www.tampermonkey.net/) (closed source, includes questionable tracking)
    * for (mobile) Safarie you could use [Userscripts](https://apps.apple.com/de/app/userscripts/id1463298887)
2. **Install one of these addon loaders:**
    * just open the link in your browser and confirming the installation with your choosen user script manager:
    1. [WCE with FUSAM loader](https://wce.netlify.app/wce-fusam-loader.user.js) (recommended)
        * make sure to also remove the old FUSAM loader
    2. [WCE loader](https://wce.netlify.app/wce-loader.user.js) (without FUSAM):
        * make sure you still load [FUSAM following their introductions](https://sidiousious.gitlab.io/bc-addon-loader/)
3. Make sure that the old FBC version isn't loaded through FUSAM anymore
    * and that you removed the old user script for previous version of this fork (if applicable)

### Bookmarklet

* create new Bookmark and add the following code as the URL of the new bookmark:
```js
javascript:(() => {if(!window.FUSAM) return alert('error: load FUSAM first!'); let s = document.body.appendChild(document.createElement('script')); s.type= 'module'; s.src='https://wce.netlify.app/wce.js';})();
```
* make sure to load this Bookmarklet after FUSAM has loaded (and the `Addon Manager` button is visible)

### Beta releases

* install the beta loaders: [WCE with FUSAM loader](https://beta--wce.netlify.app/wce-fusam-loader.user.js) or [WCE loader](https://beta--wce.netlify.app/wce-loader.user.js)
* or the bookmarklet with the `https://beta--wce.netlify.app/wce.js` URL
