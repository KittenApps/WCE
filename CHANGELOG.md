# Changelog of Wholesome Club Extensions (WCE)

## Changes between FBC 5.8 / 5.9 and WCE 6.2
* bring back all features from FBC 5.8 removed in FBC 5.9:
    * Animation Engine and dependents
    * chat links and embeds (and 3d party content prompts)
    * friends online notifications
    * buttplug.io toy sync
    * and other smaller features
* Anti Garble system: complete rewrite from scratch ([read the docs](https://github.com/KittenApps/WCE/wiki/Anti-Garble-system))
    * BC changed from a recipient based garbling to sender based garbling in r103+
    * set garble level separately for your outgoing whisper and normal chat messages (everyone can see the less garbled message in brackets, without requiring any addons on their side)
    * added options to preserve baby talk or stutter too
    * revamp in chat controls, with the side effect of having a larger more text fitting chat input
    * added Anti Deafen cheat (see original message in brackets while deafened)
* updated layering menus and copy color button to recent BC changes
  * moved both buttons from bottom left corner to the menu bar at the top
  * still offers a cheat to use layering menus while bound
  * improved copy color (to items of the same type) logic
* added a button to manual clear and reload the drawing cache of all characters in a chat room
  * can help with performance and not loaded assets on characters
  * now you can just press a button instead of having to reload BC and reconnect
  * same functionality then what could be run on a hourly schedule with FBC already
* converted the source code from a single 12.000 line of code file to multiple smaller ESM modules, improving maintainability
  * added build tooling and linters with CI / CD
  * allows gradually migrating to TypeScript in the future too
* other smaller fixes and improvements
  * updated for r104 compatibility
  * improved the performance of the timer implementation by hooking the main game loop only once and using a timer registry instead of hooking it once for every timer
  * fix discreet mode
  * fix send to club slavery feature
  * added an option to let overriding existing wardrobe outfits require an extra confirmation step (thanks Stacey for the idea)
  * added `/wcegotoroom <roomname>` chat command to go to the specified room (or leave to mail hall if empty) immediately ignoring all restrictions
  * settings: added support for disabled input and select fields (and used them in anti garble and animation engine settings)
  * improved loader performance by using modulepreload
  * removed fps limits / counter (now natively in base game in graphic preferences, page 2)
  * use new BC preferences system, moving it to the Extensions preferences sub-screen
  * reduces file size by removing unused ICONS, switching text icons to simple text elements and loading hosted images instead of embedding ICONS in the script
  * make activating the animation engine properly disable the affect expression setting in BC's arousal preferences
  * made it load separate from FUSAM again (still requires FUSAM for it's API though)
  * fix rich profile sticking on the screen after disconnect
  * improve blindWithoutGlasees performance by hooking it on character draw instead of the main game loop
  * update dependencies (bc-stubs, dexie)
  * add `Improved whisper target handling` chat option to automatically reset the whisper target if they leave the room for more than one minute and after the first invalid whisper target warning message (thanks Sophie for the idea)
