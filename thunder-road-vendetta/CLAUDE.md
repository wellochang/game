# Thunder Road: Vendetta（雷霆之路：復仇）

## 狀態快照
| 欄位 | 內容 |
|------|------|
| 類型 | 桌遊數位化實作（Python） |
| 狀態 | 進行中 |
| 上次工作 | 2026-04-20 |
| 下次優先項 | 確認並實作各引擎模組（MovementEngine、CombatEngine 等）的核心邏輯 |

## 一句話說明
將桌遊《Thunder Road: Vendetta》數位化：玩家各控制 3 輛車，用骰子移動、射擊、使用指令，最先抵達終點線或消滅對手獲勝。

## 核心架構
- **引擎模組：** MovementEngine、CombatEngine、DamageEngine、CommandEngine、RoadScrollEngine、ChopperEngine、WinConditionChecker
- **資料模型：** GameState → Board → Tile → Cell；Player → Car / Die / Chopper
- **事件系統：** 所有狀態改變產生 GameEvent，支援 UI 播放與回放
- 詳見 [architecture.md](./architecture.md)

## 資料夾導覽
| 檔案/資料夾 | 說明 |
|------------|------|
| [main.py](./main.py) | 遊戲進入點 |
| [src/game.py](./src/game.py) | 主遊戲邏輯 |
| [src/models.py](./src/models.py) | 資料模型（GameState, Car, Player 等） |
| [src/combat.py](./src/combat.py) | 射擊與傷害 |
| [src/movement.py](./src/movement.py) | 移動引擎 |
| [src/ai.py](./src/ai.py) | AI 玩家 |
| [src/dice.py](./src/dice.py) | 骰子管理 |
| [src/road.py](./src/road.py) | 道路推進 |
| [src/chopper.py](./src/chopper.py) | 直升機 |
| [src/command.py](./src/command.py) | 指令（AIRSTRIKE/NITRO/DRIFT/REPAIR） |
| [src/ui.py](./src/ui.py) | 介面 |
| [architecture.md](./architecture.md) | 完整架構文件 |
| [rules.md](./rules.md) | 原始桌遊規則 |

## 工作約定
- 規格依據：先查 [architecture.md](./architecture.md)，再查 [rules.md](./rules.md)
- 不確定的規則細節見 architecture.md 第八節「待確認的規則細節」
