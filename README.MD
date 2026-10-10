<div align="center">

# 🎮 Modatorial.io

**A moddable client for Territorial.io — built on a Minecraft-inspired mod loader.**

[![Version](https://img.shields.io/badge/version-1.9.2-brightgreen?style=flat-square)](https://github.com/Pakball13/moddatorial.io/releases)
[![Game](https://img.shields.io/badge/powered%20by-territorial.io-blue?style=flat-square)](https://territorial.io)
[![License](https://img.shields.io/badge/license-MIT-lightgrey?style=flat-square)](LICENSE)
[![Fair Play](https://img.shields.io/badge/fair%20play-enforced-red?style=flat-square)](#-fair-play-notice)

[🌐 Wiki](https://github.com/Pakball13/moddatorial.io/wiki) · [🎥 YouTube](https://youtube.com/@pakball13) · [🐛 Issues](https://github.com/Pakball13/moddatorial.io/issues) · [💬 Discussions](https://github.com/Pakball13/moddatorial.io/discussions)

</div>

---

## 📖 What is Modatorial.io?

Modatorial.io is a **moddable client** for [Territorial.io](https://territorial.io). It wraps the original game with a mod loader that lets you install, enable, and disable mods — each living in its own folder, just like Minecraft.

Drop a mod in `mods/<name>/`, add its name to `mods/manifest.json`, reload. That's it.

Built from scratch in plain JavaScript — no build step, no bundler, no dependencies.

---

## ⚠️ Fair Play Notice

**Modatorial.io is NOT a cheat client.**

Using this project to gain an unfair advantage in multiplayer — automation, ESP, packet manipulation, multi-accounting — is **strictly forbidden** and will result in a permanent ban and public blacklisting.

Read the full [Rules & Fair Play Policy](https://github.com/Pakball13/moddatorial.io/wiki/Rules-and-Fair-Play-Policy).

---

## ✨ Features

### 🎨 Client
- **Custom splash screen** — intro animation morphs `TERRITORIAL.IO` → `MODATORIAL.IO`
- **Client chrome bar** — brand, version, layout switcher
- **Sidebar layout** — clean vertical menu on the left
- **Hover animations** — bouncy lifts, radial glow, shine sweep, click ripples
- **SVG icons** — modern icon system for every menu button
- **Panorama background** — mouse-controlled scrolling menu backdrop

### 🔧 Mod Loader
- **Monkey-patched engine hooks** — WebSocket, `requestAnimationFrame`, Canvas2D, input
- **`window.TerritorialMods` API** — clean interface for mods
- **`mods/` folder system** — each mod gets its own directory
- **F10 mod menu** — enable/disable any mod, persisted across reloads
- **Per-mod metadata** — `mod.json` describes name, author, version, icon

### 🧹 Cleanup
- Hides store icons, clan bar, timeline bars, contest countdown, version text
- Filters out `Logs`, `Clan Charts`, `Gold Transfer`, `Join Lobby 2`, `Account Recovery`, `Delete Data`, `Privacy Settings`

---

## 🚀 Quick Start

### 1. Clone
```bash
git clone https://github.com/Pakball13/moddatorial.io.git
cd moddatorial.io
