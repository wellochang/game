# 空艇戰鬥機制規格文件

版本：v0.3　日期：2026-05-07

---

## 一、核心模型

### 1D 追趕模型

兩艘空艇沿同一方向（+x 軸）飛行。戰鬥狀態只需一個數值描述：

```
gap = 敵方位置 - 玩家位置  （單位：距離，初始值 400）
```

每個 tick 更新：

```
gap += enemySpeed - playerSpeed
gap = clamp(gap, 0, 720)
```

| gap 變化 | 意義 |
|----------|------|
| gap 縮小 | 玩家追趕上敵方 |
| gap 增大 | 敵方拉開距離 |
| gap = 0  | 兩艇接觸（Ram 觸發條件） |

---

## 二、能力值

| 能力值 | 效果 |
|--------|------|
| **Craft** | 決定最大 HP：`maxHP = 80 + craft × 28` |
| **Gun**   | 提升砲、副砲傷害（scale = gun） |
| **Nav**   | 決定移動速度：`baseSpeed = 2.2 + nav × 0.38`；提升衝角、飛彈傷害（scale = nav） |

---

## 三、武器系統

### 武器基礎數值

| 武器 | 射程 | 冷卻（幀） | 基礎傷害 | 傷害縮放 |
|------|------|-----------|---------|---------|
| 砲（Cannon） | 320 | 80 | 14 | Gun |
| 副砲（Sub Cannon） | 155 | 38 | 18 | Gun |
| 飛彈（Missile） | 540 | 180 | 36 | Nav |
| 衝角（Ram） | 52 | 38 | — | Nav（特殊） |

### 傷害公式

```
# 一般武器（砲 / 副砲 / 飛彈）
damage = baseDmg × (1 + stat × 0.12) × rand(0.9, 1.1)

# 衝角（近戰）
damage = (10 + nav × 5) × rand(0.9, 1.1)
```

`rand(0.9, 1.1)` 為 ±10% 隨機波動。

### 射擊條件

```
if (weapon.cooldown == 0) AND (gap <= weapon.range):
    fire()
    weapon.cooldown = weapon.baseCooldown
```

雙方武器同幀計算，無攻擊順序優先級。

---

## 四、移動模型

### 速度公式

```
baseSpeed = 2.2 + nav × 0.38
```

| Nav 值 | 速度 |
|--------|------|
| 0      | 2.20 |
| 3      | 3.34 |
| 5      | 4.10 |
| 7      | 4.86 |

### 玩家行為（自動，無操作）

依流派的 `targetGap` / `fleeGap` 決定當前速度：

```
if gap > targetGap + 30:
    speed = baseSpeed      # 追近

elif fleeGap > 0 AND gap < fleeGap:
    speed = baseSpeed      # 逃開

else:
    speed = 0              # 維持
```

### 敵方 AI 行為（固定砲擊型）

```
if gap < 120:
    speed = min(baseSpeed × 1.2, 5.0)   # 太近，逃跑

elif gap > 300:
    speed = baseSpeed × 0.35             # 太遠，等待

else:
    speed = baseSpeed                    # 正常推進
```

---

## 五、流派預設（Prototype v0.3）

### 衝角流（Rammer）

| 項目 | 值 |
|------|---|
| Craft / Gun / Nav | 3 / 1 / 7 |
| maxHP | 164 |
| 速度 | 4.86 |
| 武器 | 衝角 + 副砲 |
| targetGap | 20 |
| fleeGap | 0 |

**戰術**：全速追近，gap < 52 時衝角 + 副砲同時輸出。Nav 最高，速度超過敵方逃跑速度，必定能追上。

---

### 砲擊流（Gunner）

| 項目 | 值 |
|------|---|
| Craft / Gun / Nav | 5 / 5 / 0 |
| maxHP | 220 |
| 速度 | 2.20 |
| 武器 | 砲 + 副砲 |
| targetGap | 200 |
| fleeGap | 0 |

**戰術**：推進到 targetGap 200 後停下，依靠敵方 AI 自然調整到 120-300 交戰範圍。Gun 最高，砲擊流 DPS 最穩定。

---

### 飛彈流（Missiler）

| 項目 | 值 |
|------|---|
| Craft / Gun / Nav | 2 / 3 / 5 |
| maxHP | 136 |
| 速度 | 4.10 |
| 武器 | 飛彈 × 2 |
| targetGap | 400 |
| fleeGap | 320 |

**戰術**：維持距離在 320-540「安全帶」內。gap < 320 時啟動逃跑（fleeGap），敵砲打不到但飛彈打得到，單方面輸出。

---

## 六、戰鬥終止條件

```
if enemy.hp <= 0:  玩家勝利
if player.hp <= 0: 玩家失敗
```

結果畫面顯示：戰鬥時長、輸出傷害、承受傷害、剩餘 HP。

---

## 七、待設計（未來迭代）

- [ ] Roguelike 裝備系統：玩家自由分配 Craft / Gun / Nav 點數，自選武器槽
- [ ] 更多武器類型與被動效果（如荊棘甲反傷、護盾）
- [ ] 多種敵方 AI 原型（衝角型、飛彈型）
- [ ] 零件 Tier 系統與數值範圍定義
- [ ] 特殊技能 / 被動 slot（Hades / StS 風格的搭配層）
- [ ] 連續關卡與 Meta 升級系統
