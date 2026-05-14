# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## 主要開發目標

**`prototype/index.html`**（`http://localhost:8766`）是目前唯一活躍開發的版本。
`index.html` + `src/*.jsx` 是 React 設計稿參考，不做功能迭代。

## 回覆規則

- 直接給結果，不要前言、不要總結
- 使用工具後，只回報結果，不描述過程
- 除非我主動問，否則不解釋你在做什麼
- 程式碼和資料維持完整精確，只壓縮自然語言

## Development server

This project has no build step. Serve the files with Python's built-in HTTP server — opening via `file://` will block font and script loading due to CORS.

```bash
# Main React version (root index.html)
python3 -m http.server 8765 --directory /path/to/game

# Vanilla prototype (prototype/index.html) — most active development target
python3 -m http.server 8766 --directory /path/to/game/prototype
```

Then open `http://localhost:8766` (prototype) or `http://localhost:8765` (React).

## Two parallel implementations

This repo contains two separate implementations of the same game ("廢土衝鋒 / Wasteland Runners"):

| Path | Stack | Status |
|------|-------|--------|
| `prototype/index.html` | Vanilla JS + Canvas, single self-contained file (~1100 lines) | **Primary active target** |
| `index.html` + `src/*.jsx` | React 18 + Babel standalone (no bundler), 7 JSX files | Design handoff reference |

The React version in `src/` was generated from a Claude Design handoff (`prototype/game/project/`). The vanilla prototype in `prototype/index.html` is where actual gameplay iteration happens.

## Prototype architecture (`prototype/index.html`)

The file is structured in this order: CSS → HTML screens → JS.

**Screen management:** Five screens toggled via `.screen.active` CSS class + the `#game` combat div (shown/hidden via `style.display`). `goScreen(id)` handles all transitions.

```
garage → map → fight/elite/boss → (combat canvas) → back to map
              → scrap            → scrap screen    → back to map
              → event            → event screen    → back to map
              → boss (win)       → end overlay
```

**Run state** (`runState` object) persists across all screens: `{hp, maxHp, scrap, chassis, weapon, engine, armor, callsign, currentNodeId, visited[], log[], map}`.

**Pixel sprite system:**
- `PAL` — colour palette lookup (single char → hex)
- `drawSprite(ctx, sp, ox, oy, sc)` — renders a `string[]` sprite grid
- `TD` — top-down chassis sprites (14×12), used in garage part picker
- `WPS` — weapon overlay sprites, used in garage part picker
- `ICONS` — 12×12 node icons for the map canvas
- `CAR` — side-view car configs; `drawCar(ctx, ox, oy, sc, kind, flash)` draws parametric side-view vehicles used in combat

**Map generation:** `generateMap(seed)` produces a 6-column node graph with seeded LCG RNG. `nodePos(node, W, H)` converts node grid coords to canvas pixels. Map animates with `requestAnimationFrame`; always call `stopMapAnim()` before any screen transition.

**Combat loop:** Gap-based 1D chase (`gap` = pixel distance between vehicles). `update(dt)` runs physics + AI + weapon firing. `drawCombat()` syncs the canvas buffer to its CSS display size each frame, then renders background, vehicles, tracers, particles, and HUD. Sidebar HTML elements (`cs-hp-fill`, `cs-ehp-fill`, etc.) are updated each frame by `updateCombatSidebar()`.

## React version architecture (`src/`)

Each file exports one global via `window.X = X` (Babel standalone, no ES modules):

- `sprites.jsx` — `Sprites` object (drawSprite, all sprite data)
- `ui.jsx` — shared components: `PixelCanvas`, `PixelButton`, `Panel`, `StatBar`, `PartCard`, `Dust`
- `garage.jsx` — `GarageScreen`, all part option arrays (`CHASSIS_OPTIONS`, `WEAPON_OPTIONS`, etc.)
- `map.jsx` — `MapScreen`, `generateMap`, `NODE_TYPES`
- `combat.jsx` — `CombatScreen`, sim loop, `ENEMY_DEFS`, `makeEncounter`
- `game.jsx` — `App` root, screen state machine (`title | garage | map | combat | event | scrap | gameover`)
- `tweaks-panel.jsx` — live-edit panel for design tweaks

Load order in `index.html` matters: `sprites → ui → garage → map → combat → game`.

## Combat mechanics reference

See `prototype/combat-spec.md` for the full 1D chase model spec. Key numbers for the vanilla prototype:

- Initial gap: 450px, SCALE factor: 0.72 (gap px → screen px)
- Player screen X is fixed at 220px; enemy drawn at `220 + gap * 0.72`
- Weapon ranges are in gap-px (e.g. autocannon: 400, mortar: 560)
- `endCombat(win)`: boss win → `showEnd(true)`; normal win → return to map after 1200ms delay; loss → `showEnd(false)`
