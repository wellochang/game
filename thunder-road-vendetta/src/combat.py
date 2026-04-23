import random
from typing import List, Optional
from src.models import (
    Car, GameState, GameEvent, DamageTokenType, VehicleSize,
    CarState, Direction, Pos, global_row
)
from src.dice import roll_shooting_die, roll_direction_die, roll_stunt_die

COLS = 6
ROWS_PER_TILE = 18

DAMAGE_TOKEN_POOL = (
    [DamageTokenType.DENT] * 4 +
    [DamageTokenType.SHRAPNEL] * 2 +
    [DamageTokenType.SKID] * 3 +
    [DamageTokenType.DAZED] * 2 +
    [DamageTokenType.BLAST] * 1
)


def draw_damage_token(gs: GameState) -> DamageTokenType:
    if not gs.damage_token_pool:
        gs.damage_token_pool = DAMAGE_TOKEN_POOL.copy()
        random.shuffle(gs.damage_token_pool)
    return gs.damage_token_pool.pop()


def check_inoperable(car: Car, gs: GameState):
    if len(car.damage_tokens) >= 2 and car.state == CarState.OPERABLE:
        car.state = CarState.INOPERABLE
        car.facing = Direction.BACKWARD
        msg = f"{car.id} 失能（損傷 x{len(car.damage_tokens)}）"
        gs.log("inoperable", msg, car_id=car.id)


def apply_damage(car: Car, token: DamageTokenType, gs: GameState, depth: int = 0) -> List[GameEvent]:
    events = []
    if car.state == CarState.ELIMINATED:
        return events

    car.damage_tokens.append(token)
    msg = f"{car.id} 受到損傷：{token.value}"
    events.append(GameEvent("damage", msg, car_id=car.id, token=token.value))
    gs.log("damage", msg)

    if token == DamageTokenType.DENT:
        pass  # no additional effect

    elif token == DamageTokenType.SHRAPNEL and depth < 3:
        direction = roll_direction_die()
        gs.log("shrapnel", f"彈片往 {direction.name} 方向")
        victim = _find_first_car_in_direction(car, direction, gs)
        if victim:
            t = draw_damage_token(gs)
            events += apply_damage(victim, t, gs, depth + 1)

    elif token == DamageTokenType.SKID:
        direction = roll_direction_die()
        gs.log("skid", f"{car.id} 打滑往 {direction.name}")
        if car.position:
            from src.movement import _apply_direction
            new_pos = _apply_direction(car.position, direction, gs)
            if new_pos:
                car.position = new_pos

    elif token == DamageTokenType.DAZED:
        dist = roll_stunt_die()
        direction = roll_direction_die()
        gs.log("dazed", f"{car.id} 眩暈，往 {direction.name} 移 {dist} 格")
        if car.position:
            from src.movement import _apply_direction
            pos = car.position
            for _ in range(dist):
                new_pos = _apply_direction(pos, direction, gs)
                if new_pos:
                    pos = new_pos
            car.position = pos

    elif token == DamageTokenType.BLAST:
        dist = roll_stunt_die()
        direction = roll_direction_die()
        gs.log("blast", f"{car.id} 爆炸，往 {direction.name} 飛 {dist} 格（跳過中間）")
        if car.position:
            ti, col, row = car.position
            g_row = global_row(car.position)
            new_col = max(0, min(COLS - 1, col + direction.dc * dist))
            new_g_row = g_row + direction.dr * dist
            tile_index = new_g_row // ROWS_PER_TILE
            new_row = new_g_row % ROWS_PER_TILE
            if 0 <= tile_index <= 2:
                car.position = (tile_index, new_col, new_row)

    check_inoperable(car, gs)
    return events


def _find_first_car_in_direction(origin: Car, direction: Direction, gs: GameState) -> Optional[Car]:
    if origin.position is None:
        return None
    from src.movement import _apply_direction
    pos = origin.position
    for _ in range(10):
        new_pos = _apply_direction(pos, direction, gs)
        if new_pos is None:
            break
        cars = [c for c in gs.cars_at(new_pos) if c.id != origin.id]
        if cars:
            return cars[0]
        pos = new_pos
    return None


def get_shootable_targets(attacker: Car, gs: GameState) -> List[Car]:
    if attacker.position is None or attacker.state != CarState.OPERABLE:
        return []
    from src.movement import get_forward_arc
    arc_cells = get_forward_arc(attacker, gs)
    targets = []
    for cell in arc_cells:
        for car in gs.cars_at(cell.pos):
            if car.owner != attacker.owner and car.state != CarState.ELIMINATED:
                targets.append(car)
    return targets


def resolve_shot(attacker: Car, target: Car, gs: GameState) -> List[GameEvent]:
    events = []
    shot_size = roll_shooting_die()
    hit = (shot_size == target.size)
    msg = f"{attacker.id} 射擊 {target.id}（骰={shot_size.value}, 目標={target.size.value}）→ {'命中！' if hit else '未命中'}"
    events.append(GameEvent("shot", msg, hit=hit))
    gs.log("shot", msg)
    if hit:
        token = draw_damage_token(gs)
        events += apply_damage(target, token, gs)
    return events
