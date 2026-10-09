# Modding Territorial.io

## Installing a mod
1. Put the mod folder inside `mods/`.
2. Add the folder name to `mods/manifest.json` under `"mods"`.
3. Reload the page.

## Mod folder contents
- `mod.json`  – metadata (required)
- `icon.png`  – cover image shown in the F10 menu (optional)
- `main.js`   – the mod's JavaScript (name configurable via `main`)
- Any other folders/files you want – read them with `api.readModFile()`.

## `mod.json` fields
| field         | type    | description                                |
|---------------|---------|--------------------------------------------|
| name          | string  | display name                               |
| version       | string  | semver                                     |
| author        | string  | your name                                  |
| description   | string  | short blurb                                |
| icon          | string  | path relative to the mod folder            |
| main          | string  | path to the JS entry file (or `false`)     |
| gameVersion   | number  | game r-version (25 for this build)         |
| enabled       | boolean | optional – set `false` to disable the mod  |

## The `api` object
Everything a mod can do goes through `window.TerritorialMods`.

### Events (pub/sub)
```js
api.on('event', handler)     // subscribe
api.off('event', handler)    // unsubscribe
api.emit('event', ...args)   // emit custom events