from typing import List, Optional, Tuple
from src.models import (
    Car, Cell, GameState, GameEvent, Direction, HazardType,
    CarState, Terrain, Pos, global_row
)
from src.dice import roll_slam_die, roll_direction_die, roll_stunt_die

COLS = 6
ROWS_PER_TILE = 18
TOTAL_ROWS = ROWS_PER_TILE * 3  # 3 tiles


def _pos_from_global(g_row: int, col: int) -> Optional[Pos]:
    if col < 0 or col >= COLS or g_row < 0:
        return None
    tile_index = g_row // ROWS_PER_TILE
    row = g_row % ROWS_PER_TILE
    if tile_index > 2:
        return None
    return (tile_index, col, row)


def is_at_front_edge(car: Car) -> bool:
    """Car is at the last row of the front tile (tile_index=2, row=17)."""
    if car.position is None:
        return False
    ti, col, row = car.position
    return ti == 2 and row == ROWS_PER_TILE - 1


def get_forward_arc(car: Car, gs: GameState) -> List[Cell]:
    if car.position is None:
        return []
    g_row = global_row(car.position)
    _, col, _ = car.position
    candidates = []
    for dc in (-1, 0, 1):
        new_col = col + dc
        new_g_row = g_row + 1
        pos = _pos_from_global(new_g_row, new_col)
        if pos:
            candidates.append(gs.get_cell(pos))
    return candidates


def _apply_direction(pos: Pos, direction: Direction, gs: GameState) -> Optional[Pos]:
    ti, col, row = pos
    g_row = global_row(pos)
    new_col = col + direction.dc
    new_g_row = g_row + direction.dr
    return _pos_from_global(new_g_row, new_col)


def resolve_slam(attacker: Car, defender: Car, gs: GameState) -> List[GameEvent]:
    events = []

    def roll_for(car: Car) -> int:
        r = roll_slam_die()
        if car.size.value == "L":
            r2 = roll_slam_die()
            r = max(r, r2)
        return r

    a_roll = roll_for(attacker)
    d_roll = roll_for(defender)

    if a_roll >= d_roll:
        victim = attacker
        gs.log("slam", f"碰撞！{attacker.id}({a_roll}) vs {defender.id}({d_roll}) → {attacker.id} 受傷")
    else:
        victim = defender
        gs.log("slam", f"碰撞！{attacker.id}({a_roll}) vs {defender.id}({d_roll}) → {defender.id} 受傷")

    events.append(GameEvent("slam", f"碰撞：{attacker.id} → {defender.id}，{victim.id} 受傷",
                            victim=victim.id))
    from src.combat import apply_damage, draw_damage_token
    token = draw_damage_token(gs)
    events += apply_damage(victim, token, gs)
    return events


def trigger_hazard(car: Car, hazard: HazardType, gs: GameState) -> List[GameEvent]:
    events = []
    if hazard == HazardType.MINE:
        gs.log("hazard", f"{car.id} 踩到地雷！")
        events.append(GameEvent("hazard", f"{car.id} 踩到地雷", hazard="mine"))
        from src.combat import apply_damage, draw_damage_token
        token = draw_damage_token(gs)
        events += apply_damage(car, token, gs)
        car.position = car.position  # stop moving (handled in move_car)
        return events

    elif hazard == HazardType.OIL:
        direction = roll_direction_die()
        gs.log("hazard", f"{car.id} 滑過油漬，往 {direction.name} 滑 1 格")
        events.append(GameEvent("hazard", f"{car.id} 油漬滑移", direction=direction.name))
        if car.position:
            new_pos = _apply_direction(car.position, direction, gs)
            if new_pos:
                car.position = new_pos

    elif hazard == HazardType.WRECK:
        gs.log("hazard", f"{car.id} 撞上殘骸！觸發碰撞")
        events.append(GameEvent("hazard", f"{car.id} 撞上殘骸", hazard="wreck"))
        # wreck acts like an occupied cell — apply slam damage to the car itself
        from src.combat import apply_damage, draw_damage_token
        token = draw_damage_token(gs)
        events += apply_damage(car, token, gs)

    elif hazard == HazardType.ROAD:
        if car.position:
            gs.get_cell(car.position).terrain = Terrain.ROAD
        gs.log("hazard", f"{car.id} 格子變為道路")
        events.append(GameEvent("hazard", f"格子類型改變為 ROAD"))

    elif hazard == HazardType.MUD:
        if car.position:
            gs.get_cell(car.position).terrain = Terrain.MUD
        gs.log("hazard", f"{car.id} 格子變為泥路")
        events.append(GameEvent("hazard", f"格子類型改變為 MUD"))

    return events


def move_car(car: Car, steps: int, gs: GameState, drift: bool = False) -> List[GameEvent]:
    events = []
    if car.position is None or car.state != CarState.OPERABLE:
        return events

    remaining = steps
    first_occupied_passed = False

    while remaining > 0:
        arc = get_forward_arc(car, gs)
        if not arc:
            # Moved beyond front tile — trigger road scroll
            from src.road import perform_scroll
            events += perform_scroll(gs)
            # Check win condition after scroll
            from src.win import check_win
            if check_win(gs):
                return events
            # Re-check arc after scroll
            arc = get_forward_arc(car, gs)
            if not arc:
                break

        # Default: pick center if available, else first
        target = arc[1] if len(arc) > 1 else arc[0]
        return events  # caller (UI/AI) picks target; we do single-step API below

    return events


def move_car_to(car: Car, target_cell: Cell, gs: GameState, drift: bool = False) -> List[GameEvent]:
    """Move car one step to target_cell. Returns events. Caller loops for multi-step."""
    events = []
    if car.position is None or car.state != CarState.OPERABLE:
        return events

    target_pos = target_cell.pos
    ti, col, row = target_pos

    # Check if this moves beyond the front tile front edge
    current_g = global_row(car.position)
    target_g = global_row(target_pos)

    if ti > 2:
        # Beyond board — trigger scroll
        from src.road import perform_scroll
        events += perform_scroll(gs)
        # After scroll the car conceptually exits — it will land on new tile
        # Recalculate target position after scroll (tile indices shifted)
        new_ti = ti - 1
        new_pos = _pos_from_global(target_g - ROWS_PER_TILE, col)
        if new_pos is None:
            return events
        target_pos = new_pos
        target_cell = gs.get_cell(target_pos)

    # Reveal face-down hazard
    if target_cell.face_down_hazard:
        hazard = target_cell.face_down_hazard
        target_cell.face_down_hazard = None
        target_cell.hazard = hazard
        car.position = target_pos
        events += trigger_hazard(car, hazard, gs)
        if hazard in (HazardType.MINE, HazardType.WRECK):
            return events  # stop movement
        return events

    # Check for other cars (slam)
    others = [c for c in gs.cars_at(target_pos) if c.id != car.id]
    if others:
        if drift:
            # pass through first occupied without slam
            car.position = target_pos
            events.append(GameEvent("drift", f"{car.id} 飄移穿過 {others[0].id}"))
            gs.log("drift", f"{car.id} 飄移穿過 {others[0].id}")
            return events
        else:
            car.position = target_pos
            events += resolve_slam(car, others[0], gs)
            return events  # attacker stops

    # Check for chopper
    chopper = gs.chopper_at(target_pos)
    if chopper:
        car.state = CarState.ELIMINATED
        car.position = None
        msg = f"{car.id} 停在直升機上，遭淘汰！"
        events.append(GameEvent("eliminated", msg, car_id=car.id))
        gs.log("eliminated", msg)
        return events

    # Check for finish line
    if ti <= 2 and gs.board.tiles[ti].is_finish_line:
        car.position = target_pos
        msg = f"{car.id} 抵達終點線！"
        events.append(GameEvent("finish_line", msg, car_id=car.id))
        gs.log("finish_line", msg)
        return events

    # Normal move
    car.position = target_pos
    return events
