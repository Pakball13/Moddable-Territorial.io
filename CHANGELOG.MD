# Changelog

## [2.0.0] — 2026-10-10

The "Real Client" release. Modatorial.io is now a proper platform.

### Added
- 📦 **Mod Store** — browse, search, install, and publish mods via Firebase Firestore
- 🌐 Stable `TerritorialAPI` facade (`getPlayers`, `getMap`, `getTerritories`, event hooks)
- 🧩 Mod dependency system (`requires`, `conflictsWith`, `optionalDeps`)
- 🔢 Version compatibility checks (`minimumClientVersion`, `compatibleGameVersions`)
- ♻️ Mod lifecycle (init / enable / disable / unload) with automatic cleanup of hooks, timers, and DOM
- 📝 Per-mod scoped logging (`[mod:id]` prefix)
- 🔄 Per-mod reload button
- 🔍 Search + filter in the mod menu
- 📁 Loadout profiles
- 🎬 Replay theater with speed controls
- 🏆 Achievements & badges (10 to unlock)
- 📊 Live stats overlay
- 🔗 Share setup via URL
- 🔊 Code-generated audio system (no asset files needed)
- 🎨 5 theme presets
- ⏱ Speedrun mode with PB tracking
- 📸 F2 screenshot
- 🎂 Birthday mode

### Fixed
- Mod loader no longer crashes when menu filters are missing
- Panorama mod correctly resolves `mod.basePath`
- Version text reliably hidden
- Chrome bar persists across reloads

### Known Issues
- Multiplayer mode disabled by default (see Rules & Fair Play Policy)

## [1.11.1] — earlier
- Restored menu-filter helpers

## [1.0.0] — initial
- Mod loader with WebSocket / rAF / Canvas2D hooks