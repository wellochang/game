# 廢土衝鋒 — 遊戲規格文件

版本：v0.5　日期：2026-05-14

---

## 一、車輛建造（Garage）

詳見 **`equipment-spec.md`**（車架、武器、引擎、裝甲完整數值與公式）。

---

## 二、地圖（Map）

### 結構

6 欄節點圖，由 LCG 隨機種子生成。

| 欄（col） | 節點數   | 可能類型                         |
|-----------|----------|----------------------------------|
| 0         | 1        | fight（固定）                    |
| 1–4       | 2–3      | fight / scrap / event / elite*   |
| 5         | 1        | boss（固定）                     |

`*` elite 只在 col ≥ 3 出現，機率 25%

### 節點類型

| 類型  | 標籤       | 顏色    | 觸發內容     |
|-------|------------|---------|--------------|
| fight | RAIDERS    | #a4232a | 普通戰鬥     |
| elite | WARLORD    | #e8762a | 精英戰鬥     |
| scrap | SCRAPYARD  | #e9d7a5 | 廢料場畫面   |
| event | WANDERER   | #b6c43a | 隨機事件     |
| boss  | OIL BARON  | #d83a30 | 最終戰       |

### 行進規則

- 初始無當前節點，可選 col 0 任意節點
- 每次只能往下一欄移動，沿邊選取
- 已拜訪節點灰暗，不可再選

---

## 三、戰鬥（Combat）

### 核心模型

1D 追趕，單一數值 `gap`：

```
gap = 敵車位置 − 玩家位置（初始 450）
gap = clamp(gap − (playerSpd − enemySpd) × 60 × dt, 0, 800)
```

車輛畫面 X 由各自所在的速度區塊（Zone System）決定：

```
pSX = W × (2 × playerZone − 1) / 10   （玩家）
eSX = W × (2 × enemyZone − 1) / 10    （敵車）
// 若 playerZone === enemyZone：pSX −= 28，eSX += 28（視覺錯開）
```

速度由當前 zone 決定（見 `feature-combat-overhaul.md` Zone System），gap 由雙方速度差連續積分。

### 衝撞（gap < 28）

```
colDmg_player = max(0, floor(2 + relV × 0.02 − player.ARM × 0.5))
colDmg_enemy  = max(0, floor(3 + relV × 0.02 − enemy.ARM × 0.5))
gap = max(30, gap + 18)   # 碰後彈開
```

### 燃燒（Burn）

命中後設定 `burn = 3`，每秒觸發一次 `-1 HP`，共 3 次。

### 武器狀態機（每 tick）

```
w.timer = max(0, w.timer − dt)
if w.timer == 0 AND abs(playerZone − enemyZone) <= w.zoneRange:
    fire()
    w.timer = w.cd
```

### 敵人數值

詳見 **`enemy-spec.md`**（含 kind、wZoneRange、選定邏輯、AI 行為）。

### 戰鬥結果

| 結果   | 條件              | 效果                                     |
|--------|-------------------|------------------------------------------|
| 勝利   | enemy.hp ≤ 0      | +廢料（fight +3 / elite +5 / boss +10） |
| 撤退   | 玩家手動撤退      | hp -= 3，返回地圖                        |
| 失敗   | player.hp ≤ 0     | 遊戲結束畫面                             |
| Boss勝 | boss enemy.hp ≤ 0 | 通關結束畫面                             |

---

## 四、廢料場（Scrapyard）

節點類型 `scrap` 進入。消耗廢料換取回復。

| 動作   | 條件                          | 費用     | 效果            |
|--------|-------------------------------|----------|-----------------|
| 敲一敲 | scrap ≥ 2 且 hp < maxHp       | −2 廢料  | HP +5           |
| 焊接裝甲 | scrap ≥ 4                   | −4 廢料  | maxHP +3，HP +3 |

---

## 五、隨機事件（Events）

節點類型 `event` 進入，從事件池隨機抽取一個。

---

### 事件 1：踉蹌的流浪者

> "水…只要水，"他嘶聲說，拖著一個包。

| 選項              | 條件        | 效果                        |
|-------------------|-------------|---------------------------  |
| 給水（-1 廢料）   | scrap ≥ 1   | scrap −1                    |
| 直接開過去        | 無          | 無                          |
| 搶他的包          | hp > 2      | scrap +2，hp −2             |

---

### 事件 2：半埋的緊急艙

> 鏽鉸鏈，清晰噴字：「請勿」。

| 選項                        | 條件   | 效果               |
|-----------------------------|--------|-------------------|
| 硬撬開（+4 廢料, -3 HP）    | hp > 3 | scrap +4，hp −3   |
| 小心打開（+2 廢料）         | 無     | scrap +2           |
| 不管它                      | 無     | hp +1              |

---

### 事件 3：護衛車隊邀請

> "跟我們跑到下一個據點？"

| 選項                         | 條件                       | 效果                |
|------------------------------|----------------------------|---------------------|
| 加入車隊（+3 HP, -1 廢料）   | scrap ≥ 1 且 hp < maxHp    | hp +3，scrap −1     |
| 拒絕，單獨上路               | 無                         | 無                  |

---

## 六、Run 狀態（runState）

```js
{
  hp, maxHp,
  scrap,          // 起始 3
  callsign,
  chassis, weapon, engine, armor,   // 建造選擇
  currentNodeId,  // 當前節點 ID（null = 尚未出發）
  visited[],      // 已拜訪節點 ID 列表
  log[],          // 行動紀錄（顯示於地圖面板）
  map             // { cols, edges, seed }
}
```

---

## 七、待設計

- [ ] 更多事件（目前僅 3 個）
- [ ] 更多武器特效（護盾、反傷、EMP）
- [ ] 多種敵方 AI 原型（衝角型、飛彈型）
- [ ] 零件商店節點（花廢料買零件）
- [ ] Meta 升級系統（跨 Run 解鎖）
- [ ] FUEL 數值目前未接入任何機制
