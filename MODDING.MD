# Modatorial.io — Modding Guide

## Installing mods
1. Create a folder inside `mods/`, e.g. `mods/my-mod/`.
2. Add three files:
   - `mod.json` — metadata
   - `main.js` — mod logic
   - `icon.png` — optional cover
3. Add the folder name to `mods/manifest.json`.
4. Reload.

## mod.json
\`\`\`json
{
  "name": "My Mod",
  "version": "1.0.0",
  "author": "You",
  "description": "Does a thing.",
  "main": "main.js",
  "gameVersion": 25
}
\`\`\`

## The `api` object
- `api.on(event, fn)` / `api.emit(event, ...)`
- `api.addHook(name, fn)` — `netSend`, `netRecv`, `preUpdate`, `postUpdate`, `preRender`, `postRender`, `keyDown`, `keyUp`, `mouseDown`, `mouseUp`, `mouseMove`
- `api.showToast(msg)`, `api.addButton(text, onClick)`
- `api.readModFile(mod, 'assets/foo.png', 'image')`
- `api.setMenuBackground((ctx, w, h) => {...})` — draw behind the menu UI

## Client controls (in-game console)
\`\`\`js
TerritorialMods.setLayout('grid' | 'list' | 'circles')
TerritorialMods.setChrome(false)
TerritorialMods.setHideMenuButtons(false)
TerritorialMods.showMenuClutter()    // bring back the bottom timeline bars
TerritorialMods.offlineMode = false  // re-enable WS connections
\`\`\`