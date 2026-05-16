# 廢土衝鋒 — 玩家裝備規格

版本：v0.1　日期：2026-05-16

---

## 一、數值合成

車輛由四個欄位組成：**車架 → 武器 × N → 引擎 → 裝甲**

出發時計算：

```
HP   = chassis.HP + armor.HP
ARM  = chassis.ARM + armor.ARM
MOV  = chassis.MOV + engine.MOV
FUEL = engine.FUEL
```

戰鬥速度：

```
playerMaxSpd = 1.2 + MOV × 0.35
```

---

## 二、車架（Chassis）

武器裝備需同時滿足：**槽位數** ≤ chassis.slots、**總重量** ≤ chassis.capacity。

| ID      | 名稱    | slots | capacity | HP  | MOV | ARM | 戰鬥特性                        |
|---------|---------|-------|----------|-----|-----|-----|---------------------------------|
| scout   | Scout   | 1     | 6        | 80  | 4   | 0   | 受擊 20% 機率 zone −1（失速）   |
| runner  | Runner  | 2     | 10       | 120 | 3   | 1   | 無特殊效果                      |
| hauler  | Hauler  | 3     | 16       | 180 | 2   | 2   | 選 Z4 失控 20%，選 Z5 失控 45%  |

> 設計依據：玩家 HP 需顯著高於單一敵人（fight 40–70 HP），且預設配裝（runner+scrap=120）能在無補給下撐過 3–4 場普通戰。

> Hybrid 引擎搭 Hauler：失控機率各 −10%（Z4→10%，Z5→35%）

---

## 三、武器（Weapons）

`zoneRange`：`abs(playerZone − enemyZone) ≤ zoneRange` 時可開火。

### 單體武器（Single-target）

每次只傷害一個目標，適合快速集中擊殺最危險的敵人。

| ID         | 名稱       | 重量 | zoneRange | CD（秒） | 傷害 | 特效                   |
|------------|------------|------|-----------|----------|------|------------------------|
| harpoon    | Harpoon    | 2    | Z1        | 1.5      | 10   | 命中後 gap -= 14       |
| autocannon | Autocannon | 3    | Z2        | 0.9      | 14   | 無                     |

### 區域武器（AoE）

命中同 zone 內**所有**敵車。單體 DPS 低於 autocannon，但敵人數量 × 2 時 DPS 翻倍。

| ID     | 名稱   | 重量 | zoneRange | CD（秒） | 傷害/目標 | 特效                    |
|--------|--------|------|-----------|----------|-----------|-------------------------|
| flamer | Flamer | 1    | Z0        | 0.5      | 7         | 燃燒 3 ticks（各 -1 HP）|
| mortar | Mortar | 5    | Z3        | 2.6      | 22        | 無                      |

> zone 內只有 1 輛敵車時：flamer DPS 14.0，mortar DPS 8.5，均低於 autocannon 15.6。
> zone 內有 3 輛敵車時：flamer DPS 42.0，mortar DPS 25.5，遠高於任何單體武器。

**傷害公式（單體與 AoE 共用）：**

```
// 對每個命中目標分別計算
dmg = floor(w.dmg × (0.85 + rand × 0.30) − target.ARM × 0.5)
dmg = max(1, dmg)
```

---

## 四、引擎（Engines）

引擎除了 MOV / FUEL 外，決定每回合玩家可切換的 zone 幅度（accel）：

| ID     | 名稱   | MOV | FUEL | accel | 描述                       |
|--------|--------|-----|------|-------|----------------------------|
| diesel | Diesel | 0   | 12   | ±1    | 穩定，換區慢               |
| nitro  | Nitro  | +2  | 8    | ±2    | 反應快，可跳兩格           |
| hybrid | Hybrid | +1  | 14   | ±1    | 省油；降低 Hauler 失控機率 |

---

## 五、裝甲（Armors）

| ID      | 名稱    | ARM | HP  | 描述           |
|---------|---------|-----|-----|----------------|
| bone    | Bone    | +1  | +2  | 骷髏骨板       |
| scrap   | Scrap   | +2  | ±0  | 廢車門（預設） |
| ceramic | Ceramic | +3  | −2  | 脆弱但能擋大砲 |
