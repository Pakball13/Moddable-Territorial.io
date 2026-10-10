## 🆕 Stable API (v1.11.0+)

Instead of reaching into `window.__TT__`, use the facade:

```js
// Read game state
api.getPlayers()        // [{ id, name, strength, territory, isHuman, bounds }]
api.getPlayer(id)       // one player or null
api.getMyPlayer()       // your player object
api.getMap()            // { maxPlayers, humanCount, botCount, tileCount, inMatch, isReplay }
api.getTerritories()    // simplified array
api.isInMatch()         // boolean

// Write
api.setPlayerName(id, "NewName")

// Events
api.onGameEvent('start', () => console.log('match began'))
api.onGameEvent('end',   () => console.log('match over'))
api.onRender('hud', (ctx) => { ctx.fillText('hi', 10, 10); })
api.onInput('keydown', (e) => { if (e.key === 'Q') api.showToast('Q!'); })
```

## 📋 Mod metadata (new fields)

```json
{
  "id": "my-mod",
  "name": "My Mod",
  "version": "1.0.0",
  "author": "You",

  "minimumClientVersion": "1.11.0",
  "compatibleGameVersions": [25],

  "requires":      ["core-api"],
  "conflictsWith": ["old-name-bots"],
  "optionalDeps":  ["theme-pack"]
}
```

- If `minimumClientVersion` is higher than the loader's version, the mod is auto-disabled with a clear error.
- If the current game version isn't in `compatibleGameVersions`, same thing.
- `requires` — mods that must be loaded for this mod to work.
- `conflictsWith` — mods that can't be loaded at the same time.
- `optionalDeps` — loaded if available, no error if missing.

## ♻️ Lifecycle

Your `main.js` can export lifecycle hooks:

```js
api.log('loading');   // runs at load time

return {
  init(mod)    { console.log('mod initialized'); },
  onEnable(mod){ console.log('mod enabled'); },
  onDisable(mod){ console.log('mod disabled — cleanup here'); },
  onUnload(mod) { console.log('mod being removed'); }
};
```

Or register cleanups manually:

```js
mod.registerCleanup(() => {
  // runs when the mod is disabled
  clearInterval(myInterval);
});
```

## 🧹 Auto-tracking

The loader automatically cleans up:
- **Hooks** registered via `api.addHook(...)` during load
- **Listeners** registered via `api.on(...)` during load
- **Intervals / timeouts** created via `mod.setInterval()` or `mod.setTimeout()`
- **DOM elements** created via `document.createElement(...)` during load

For best results, register hooks inside your mod's top-level code (not in callbacks).

## 📝 Per-mod logging

```js
mod.log('hello');      // → [mod:my-mod] hello
mod.warn('uh oh');     // → [mod:my-mod] uh oh
mod.error('broken');   // → [mod:my-mod] broken
```

Use these instead of `console.log` for cleaner attribution.

## 🔄 Reload a single mod

In the mod menu, click **↻** on any mod card to re-run its `main.js` without reloading the page. Cleanups run automatically.

## 🔍 Search & filter

The mod menu now has a search bar and a filter dropdown (`all` / `active` / `disabled` / `error`).