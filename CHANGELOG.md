# Changelog of Wholesome Club Extensions (WCE)

## Wholesome Club Extensions (WCE) v6.3
* added a new feature to Layering menus: [WCE] configure layer hiding
  * this lets you override which other layers a items hides (cloths over a shiny petsuit anyone?)
  * only useable by WCE users on other WCE users (or yourself)
  * only visible to other WCE users (and yourself)
  * no stored in your appearance on BC servers, but instead in WCE settings
  * not available for crafting yet (for above reason)
  * requires BC R105
* added an option to prevent other (WCE) users from making layering changes to your character
* you won't be able to access the layering menu for locked items, which you can't unlock, even with the `allow layering menus while bound` option
* added BC R105 support
  * complete rewrite of the Anti Garble Chat Options using the new DOM based APIs (click the arrow next to the send chat button to access them)
  * removed the `show whisper button on chat messages` options, as it's replaced with something better in BC (clicking on highlighted names)
  * many more fixes related to the new BC version
* created a new documentation website: https://wce-docs.vercel.app/
  * it has a [Garble Simulator](https://wce-docs.vercel.app/docs/anti-garbling/simulator) too, which let you easily try out all anti garble options with different gag intensities
  * (for the devs) there is also a [BC API typedoc website](https://bc-typedoc.vercel.app/), here an [typedoc for `Layering`](https://bc-typedoc.vercel.app/api/namespace/Layering)
* migrate over half of the project to TypeScript for better maintainability (to be continued in the next releases)
* changed app icon (to fit more into BC icon theme)
* chat embeds for images are now working with uppercase file extensions too (which are technically incorrect, but browsers are less strict about them too)
* fixed an error with the `/w` command, when trying to whisper yourself
* improved linting, release building, CI/CD

## Wholesome Club Extensions (WCE) v6.2
* [HOTFIX] fix crash in 'take photo' character action menu
* [HOTFIX] antiGarble: fix preserve Baby Talk not working
* [HOTFIX] fix anti Garble settings resetting to default after reload (improved WCE's settings `sideEffects` handling)
* improved Anti Garble system ([read the updated docs](https://wce-docs.vercel.app/docs/category/anti-garbling-system))
  * improved controll over `stutter` and `baby talk`
    * in addition to always remove and always preserve you can now set it to the new option:
    * `ignore`: do not show an ungarbled message (in brackets) if no other garbling effects are applied, but otherwise removes it from the ungarbled message
  * hide ungarbled message if it's exactly the same as the garbled one
  * let you control `stutter` and `baby talk` options directly in the chat options menu
  * improved anti garble option tooltips in the WCE settings
  * integrate WCE's own `Alternate speech stutters` better into the game and into WCE's Anti Garble system
    * by updating the hook and reporting back appplied effects
    * fixes stutters being applied twice (both BC's and WCE's one)
    * the anti garble system supports now WCE's stutters too (in removing and preserving)
* Local Wardrobe (thanks cute outfit hoarding puppy Stacey for the idea <3)
  * extends the Wardrobe by an additional 288 slots saved locally on your device (page 9-32)
  * unlike the online section of the Wardrobe (page 1-8), the local wardrobe isn't synced between your different devices, but alts on the same device share the same Local Wardrobe
  * fix blurry effect being applied to WCE's Wardrobe previews
* encrypt `Saved Logins` credentials with a non exportable AES-GCM-256 key
  * no more storing them in plaintext in `localStorage` (moved to `IndexedDB`)
* upgrade Buttplug.io version to the latest 3.x (for toySync)
  * fixes some incompatibility issues with recent Intiface releases
  * allow setting a custom Intiface server address (now you can connect to Intiface on your phone in the same network)
* WCE is now on FUSAM (WCE's loaders still have some `modulepreload` optimizations to reduce the time until you can access your Saved Logins by ~50%)
* improved bundling of the WCE using Rollup (reducing bundle size)
  * enabled code splitting to ship our own package for our dependencies
  * upgrade Dexie version to 4.0.5
  * move base64 encoded icons out of the bundle and load them as optimized png's
* other smaller fixes and improvements
  * upgrade linting stack to latest Eslint 9
  * support checking hashes for nested functions
  * preliminary layering fix for r105
  * hide pagination button in WCE settings if there is only 1 page

## Changes between FBC 5.8 / 5.9 and WCE 6.2
* bring back all features from FBC 5.8 removed in FBC 5.9:
    * Animation Engine and dependents
    * chat links and embeds (and 3d party content prompts)
    * friends online notifications
    * buttplug.io toy sync
    * and other smaller features
* Anti Garble system: complete rewrite from scratch ([read the docs](https://wce-docs.vercel.app/docs/category/anti-garbling-system))
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
