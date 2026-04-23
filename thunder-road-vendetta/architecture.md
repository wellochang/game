# 雷霆之路：復仇 — 數位化邏輯架構

---

## 一、資料模型（Data Models）

### 座標系統

道路由 3 塊格板組成，每塊格板為 **6 欄 × 18 行**，採交錯（staggered hex-offset）排列。

```
tile_index: 0 = 最後方, 1 = 中間, 2 = 最前方
col: 0~5（交錯排列，偶數列與奇數列各有偏移）
row: 0~17（0 = 格板最後方那行）
```

絕對座標 `(tile_index, col, row)`，展平全域 row = tile_index * 18 + row。

#### 方向系統（6方向，Hex-offset）

因交錯格設計，每格有 6 個鄰居：

```
      前方
  ↖ 前左  ↗ 前右
  ←  左    右 →       ← 側向（不可主動移動，但方向骰可觸發）
  ↙ 後左  ↘ 後右
      後方

Direction enum:
  FORWARD | FORWARD_LEFT | FORWARD_RIGHT
  BACKWARD | BACKWARD_LEFT | BACKWARD_RIGHT
```

---

### Cell（格子）

```
Cell:
  tile_index: int          # 所屬格板
  col: int                 # 0~2
  row: int                 # 格板內行號
  terrain: Terrain         # NORMAL | MUD | ROAD
  hazard: Hazard | null    # 已翻面的危險標記
  face_down_hazard: HazardType | null  # 尚未翻開
```

---

### Tile（格板）

```
Tile:
  id: str                  # 格板牌ID
  cells: Cell[3][N]        # 格子矩陣
  is_finish_line: bool
```

---

### Board（棋盤）

```
Board:
  tiles: Tile[3]           # [0]=後, [1]=中, [2]=前
  tile_deck: Tile[]        # 待抽牌堆（洗牌後）
  discarded: Tile[]
```

---

### Car（車輛）

```
Car:
  id: str
  owner: PlayerId
  size: VehicleSize        # SMALL | MEDIUM | LARGE
  position: (tile_index, col, row) | null  # null = 未在場上
  facing: Direction        # FORWARD | BACKWARD
  damage_tokens: DamageToken[]  # 上限 2，滿了即 INOPERABLE
  state: CarState          # OPERABLE | INOPERABLE | ELIMINATED
  moved_this_round: bool
  coast_dice_used: int     # 本回合已用惰行骰數（上限 2）
```

---

### Chopper（直升機）

```
Chopper:
  owner: PlayerId
  position: (tile_index, col, row) | null  # null = 未部署
  deployed: bool
```

---

### Player（玩家）

```
Player:
  id: PlayerId
  color: Color
  cars: Car[3]
  chopper: Chopper
  dice: Die[4]             # 4 顆移動骰的當前骰值
  command_used: bool       # 本回合指令是否已用
  state: PlayerState       # ACTIVE | ELIMINATED
```

---

### Die（骰子）

```
Die:
  value: int               # 1~6
  assigned_to: CarId | CommandSlot | null
  is_coast: bool
```

---

### GameState（全局遊戲狀態）

```
GameState:
  players: Player[]
  board: Board
  turn_order: PlayerId[]       # 當前大回合的行動順序
  current_player: PlayerId
  current_phase: Phase         # 見下方狀態機
  round_number: int
  first_player: PlayerId
  finish_line_placed: bool
  winner: PlayerId | null
  is_first_round: bool
  damage_token_pool: DamageTokenType[]  # 洗牌後的損傷標記池
  hazard_token_pool: HazardTokenType[]
  event_log: GameEvent[]
```

---

## 二、列舉型別（Enums）

```
VehicleSize: SMALL | MEDIUM | LARGE

Direction: FORWARD_LEFT | FORWARD | FORWARD_RIGHT
           | LEFT | RIGHT
           | BACKWARD_LEFT | BACKWARD | BACKWARD_RIGHT

CarState: OPERABLE | INOPERABLE | ELIMINATED

PlayerState: ACTIVE | ELIMINATED

DamageTokenType: DENT | SHRAPNEL | SKID | DAZED | BLAST

HazardType: WRECK | MINE | OIL | ROAD | MUD

CommandType: AIRSTRIKE | NITRO | DRIFT | REPAIR

Terrain: NORMAL | MUD | ROAD
```

---

## 三、遊戲狀態機（State Machine）

```
SETUP
  │
  ▼
ROUND_START
  │  每位玩家擲 4 顆骰；先手玩家擲道路骰
  │  重設 command_used、moved_this_round、coast_dice_used
  ▼
PLAYER_TURN  ◄─────────────────────────────────────────┐
  │                                                     │
  ├─[步驟 1] ASSIGN_PHASE                               │
  │    選骰 → 指派給車或惰行                             │
  │                                                     │
  ├─[步驟 2] COMMAND_PHASE（可選，每回合限一次）          │
  │    選指令 → 消耗一骰 → 立即結算指令效果               │
  │                                                     │
  ├─[步驟 3] MOVE_PHASE                                 │
  │    移動車輛（逐格處理）                               │
  │    ├─ 遇到 face_down_hazard → 翻開並觸發             │
  │    ├─ 遇到已有車的格子 → SLAM_RESOLUTION             │
  │    ├─ 遇到 Chopper → 淘汰                           │
  │    └─ 越出最前端 → ROAD_SCROLL                      │
  │                                                     │
  ├─[步驟 4] SHOOT_PHASE（可選，第一回合禁用）            │
  │    選目標 → 擲射擊骰 → 判定命中 → DAMAGE_RESOLUTION  │
  │                                                     │
  └─ 檢查勝利條件                                        │
       ├─ 有人到達終點線 → GAME_OVER                     │
       ├─ 只剩一位玩家 → GAME_OVER                       │
       └─ 還有骰未用 → 下一位玩家行動 ──────────────────┘
             所有骰用完 → ROUND_END

ROUND_END
  │  轉移先手（左移一位）
  │  檢查是否需放入終點線格板
  ▼
ROUND_START（下一輪）

GAME_OVER
```

---

## 四、核心邏輯模組

### 4-1. DiceManager

```
rollDice(count: int) -> int[]          # 擲骰，回傳骰值陣列
assignDie(die, target)                 # 指派骰子到車或指令
getAvailableDice(player) -> Die[]      # 本回合可用骰
isCoastAssignable(car, player) -> bool # 惰行骰限制檢查
  # 惰行骰：指派給已移動過的車，讓它額外移動 1 格（固定，非骰值）
  # 每輛車每回合最多累積 2 顆惰行骰（最多再移動 2 格）
```

---

### 4-2. MovementEngine

```
getForwardArc(car) -> Cell[3]
  # 根據 car.facing 與座標，回傳前方三格

moveCarStep(car, target_cell) -> MoveResult
  # 單步移動，回傳：OK | SLAM | HAZARD | CHOPPER_ELIMINATED | ROAD_SCROLL

moveCar(car, steps, drift=false) -> MoveEvent[]
  # 執行完整移動，逐格呼叫 moveCarStep
  # drift=true 時，第一個有車的格子不觸發 SLAM

resolveSlam(attacker, defender) -> SlamResult
  # 碰撞：擲一顆骰決定誰受傷（由骰值高低判定）
  # L 體型車被選中受傷時可重擲一次（取較有利結果）
  # 攻擊方停止移動（剩餘步數作廢）

triggerHazard(car, hazard_type) -> HazardEvent
  # 依 hazard_type 觸發對應邏輯
```

---

### 4-3. RoadScrollEngine

```
shouldScroll(car, target_cell) -> bool
  # 判斷是否越出最前端

performScroll(board) -> ScrollEvent
  # 執行道路推進：
  #   1. 收集後方格板上所有車/直升機
  #   2. 淘汰車輛 / 歸還直升機
  #   3. tiles 陣列 shift：[0,1,2] → [1,2,new]
  #   4. 抽新格板，放置危險標記
  #   5. 檢查是否插入終點線格板

checkFinishLinePlacement(game_state) -> bool
  # 2人：牌堆已放出第5塊 → 下一塊為終點線
  # 3人+：第一位玩家剛被淘汰
```

---

### 4-4. CombatEngine

```
getShootableTargets(attacker) -> Car[]
  # 前方弧形 3 格內的車輛（非直升機）

rollShootingDie() -> ShootingDieResult
  # 結果包含 size_symbol: VehicleSize

resolveShot(attacker, target) -> ShotResult
  # 判定命中：shooting_die.size == target.size
  # 命中 → 呼叫 applyDamage(target)
  # 射擊骰尺寸對應（平均分配）：1~2=SMALL, 3~4=MEDIUM, 5~6=LARGE
  # 空襲後射擊與一般射擊規則相同
```

---

### 4-5. DamageEngine

```
drawDamageToken(pool) -> DamageTokenType

applyDamage(car, token_type) -> DamageEvent
  # DENT:     僅增加 damage_tokens 計數
  # SHRAPNEL: 擲方向骰 → 找最近車 → 遞迴 applyDamage
  # SKID:     移動 1 格到指定方向（不觸發碰撞）
  # DAZED:    擲特技骰 + 方向骰 → 移動
  # BLAST:    擲特技骰 + 方向骰 → teleport（跳過中間格）

checkInoperable(car)
  # damage_tokens.length >= 2 → state = INOPERABLE, facing = BACKWARD
```

---

### 4-6. CommandEngine

```
executeCommand(player, command_type, die) -> CommandEvent
  # AIRSTRIKE: deployChopper(player, target_cell) → shoot
  # NITRO:     car.extra_movement += die.value  (限骰值 1~3)
  # DRIFT:     car.drift_active = true           (限骰值 3~5)
  # REPAIR:    removeOneDamageToken(car) 或 restoreInoperable(car)  (限骰值 6)

validateCommand(player, command_type, die) -> bool
  # 檢查骰值範圍 + 非第一回合 + 本回合未用過指令
```

---

### 4-7. ChopperEngine

```
deployChopper(player, cell)
  # 放置直升機到指定空格（不可放有車的格子）

checkChopperElimination(car)
  # 車輛移動結束後，若同格有直升機 → 淘汰車輛

returnChopper(chopper)
  # 後方格板被移除時，歸還直升機給主人（deployed = false）
```

---

### 4-8. WinConditionChecker

```
checkWin(game_state) -> WinResult | null
  # 優先：任何車輛踏上終點線 → 該玩家獲勝
  # 其次：只剩一位 ACTIVE 玩家 → 獲勝

checkElimination(player) -> bool
  # 所有 cars 均為 INOPERABLE 或 ELIMINATED → 玩家出局
```

---

## 五、事件系統（Event Log）

所有狀態改變都應產生 Event，方便 UI 播放動畫、回放、或 undo。

```
GameEvent（union type）:
  | DiceRolledEvent       { player, values[] }
  | DieAssignedEvent      { player, die, car_id }
  | CommandExecutedEvent  { player, command, die }
  | CarMovedEvent         { car, from, to }
  | SlamEvent             { attacker, defender }
  | HazardTriggeredEvent  { car, hazard_type }
  | ShotFiredEvent        { attacker, target, hit: bool }
  | DamageAppliedEvent    { car, token_type }
  | InoperableEvent       { car }
  | EliminatedEvent       { car | player }
  | RoadScrolledEvent     { removed_tile, new_tile }
  | FinishLinePlacedEvent { }
  | GameOverEvent         { winner }
```

---

## 六、回合流程虛擬碼

```python
def run_game(game_state):
    setup(game_state)

    while not game_state.winner:
        # 大回合開始
        for player in game_state.turn_order:
            player.dice = roll_dice(4)
            player.command_used = False
            reset_car_flags(player)

        # 每位玩家各行動 3 次（用完 3 顆骰）
        while any(player has unused dice for active players):
            player = get_current_player(game_state)

            # 步驟 1：指派骰
            die = player.choose_assign()
            assign_die(player, die)

            # 步驟 2：指令（可選）
            if player.wants_command() and not player.command_used:
                execute_command(...)

            # 步驟 3：移動
            events = move_car(car, die.value)
            process_events(events)  # 可能觸發 road_scroll

            # 步驟 4：射擊（可選，非第一回合）
            if not game_state.is_first_round and player.wants_shoot():
                resolve_shot(...)

            # 勝利檢查
            if result := check_win(game_state):
                game_state.winner = result.winner
                break

        rotate_first_player(game_state)
        game_state.round_number += 1
        game_state.is_first_round = False
```

---

## 七、模組依賴關係

```
GameState
    │
    ├── Board ──── RoadScrollEngine
    │
    ├── Player[] ─── DiceManager
    │                CommandEngine
    │
    └── Car[] ────── MovementEngine ──── HazardEngine
                     CombatEngine  ──── DamageEngine
                     ChopperEngine
                     WinConditionChecker

所有模組 → EventLog
```

---

## 八、待確認的規則細節

| # | 項目 | 狀態 | 說明 |
|---|------|------|------|
| 1 | 碰撞（Slam）受傷判定 | ✅ 確認 | 擲骰決定誰受傷；L 體型可重擲一次；攻擊方停止移動 |
| 2 | 惰行骰（Coast Die） | ✅ 確認 | 指派給已移動車，固定額外移動 1 格；每車每回合上限 2 顆 |
| 3 | 射擊骰尺寸對應 | ✅ 確認（暫定） | 平均分配：1~2=Small, 3~4=Medium, 5~6=Large |
| 4 | 特技骰（Stunt Die）骰面 | ✅ 確認（暫定） | 用於 DAZED / BLAST；骰面 1~3（各出現兩面） |
| 5 | 方向骰（Direction Die） | ✅ 確認 | 6 方向（hex-offset）：前、前左、前右、後、後左、後右 |
| 6 | 格板尺寸 | ✅ 確認（暫定） | 6 欄 × 18 行，交錯排列 |
| 7 | 空襲後射擊 | ✅ 確認 | 與一般射擊規則相同 |
