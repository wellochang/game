import random
from typing import List
from src.models import (
    GameState, Player, Car, Chopper, Die, Board,
    VehicleSize, CarState, PlayerState, Phase
)
from src.road import init_board
from src.dice import roll_dice
from src.movement import get_forward_arc, move_car_to
from src.combat import get_shootable_targets, resolve_shot, draw_damage_token
from src.command import validate_command, execute_command
from src.win import check_win, check_elimination
from src.chopper import check_chopper_elimination

ROWS_PER_TILE = 18
COLS = 6


def _make_player(pid: str, color: str, is_human: bool) -> Player:
    prefix = color[0]
    cars = [
        Car(id=f"{prefix}1", owner=pid, size=VehicleSize.LARGE),
        Car(id=f"{prefix}2", owner=pid, size=VehicleSize.MEDIUM),
        Car(id=f"{prefix}3", owner=pid, size=VehicleSize.SMALL),
    ]
    chopper = Chopper(owner=pid)
    player = Player(id=pid, color=color, cars=cars, chopper=chopper, is_human=is_human)
    return player


def setup_game(human_color: str = "RED") -> GameState:
    ai_color = "BLUE"
    p1 = _make_player("RED", human_color, is_human=True)
    p2 = _make_player("BLUE", ai_color, is_human=False)

    board = init_board()

    # Initial dice roll to determine first player
    r1 = sum(roll_dice(4))
    r2 = sum(roll_dice(4))
    first = p1 if r1 <= r2 else p2
    turn_order = [p1.id, p2.id] if first.id == p1.id else [p2.id, p1.id]

    gs = GameState(
        players=[p1, p2],
        board=board,
        turn_order=turn_order,
        first_player_id=first.id,
        current_player_id=first.id,
        phase=Phase.ROUND_START,
        is_first_round=True,
        round_number=1,
    )

    # Initial damage token pool
    from src.combat import DAMAGE_TOKEN_POOL
    gs.damage_token_pool = DAMAGE_TOKEN_POOL.copy()
    random.shuffle(gs.damage_token_pool)

    # Place cars on back edge of rear tile (row 0)
    _place_starting_cars(gs)

    gs.log("setup", f"遊戲開始！先手：{first.color}（骰值 {first.id=='RED' and r1 or r2}）")
    return gs


def _place_starting_cars(gs: GameState):
    start_cols = {
        "RED":  [1, 3, 5],
        "BLUE": [0, 2, 4],
    }
    for player in gs.players:
        cols = start_cols.get(player.color, [0, 2, 4])
        for i, car in enumerate(player.cars):
            car.position = (0, cols[i], 0)


def round_start(gs: GameState):
    gs.phase = Phase.ROUND_START
    for player in gs.players:
        if player.state == PlayerState.ELIMINATED:
            continue
        values = roll_dice(4)
        player.dice = [Die(value=v) for v in values]
        player.command_used = False
        for car in player.cars:
            car.moved_this_round = False
            car.coast_dice_used = 0
            if hasattr(car, 'nitro_bonus'):
                car.nitro_bonus = 0  # type: ignore
            if hasattr(car, 'drift_active'):
                car.drift_active = False  # type: ignore

    gs.log("round_start", f"=== 第 {gs.round_number} 回合開始 ===")


def _dice_all_assigned(player: Player) -> bool:
    return all(d.assigned_to is not None for d in player.dice)


def run_human_turn(player: Player, gs: GameState):
    from src import ui

    # Step 1: Assign
    result = ui.prompt_assign(player, gs)
    if result is None or result[0] is None:
        return
    die, car, is_coast = result

    if is_coast:
        die.assigned_to = car.id
        die.is_coast = True
        car.coast_dice_used += 1
    else:
        die.assigned_to = car.id

    # Step 2: Command (optional)
    cmd_result = ui.prompt_command(player, gs)
    if cmd_result:
        cmd, cmd_die = cmd_result
        events = execute_command(player, cmd, cmd_die, car, gs)

    # Step 3: Move
    ui.render_all(gs)
    steps = 1 if is_coast else die.value
    if hasattr(car, 'nitro_bonus'):
        steps += getattr(car, 'nitro_bonus', 0)
        car.nitro_bonus = 0  # type: ignore
    drift = getattr(car, 'drift_active', False)

    remaining = steps
    first_step = True
    while remaining > 0 and car.state == CarState.OPERABLE and car.position:
        arc = get_forward_arc(car, gs)
        if not arc:
            # Car is at front edge — trigger road scroll
            from src.movement import is_at_front_edge
            from src.road import perform_scroll
            if is_at_front_edge(car):
                perform_scroll(gs)
                ui.render_all(gs)
                if gs.winner:
                    break
            break
        target_cell = ui.prompt_move_direction(car, gs, remaining, is_coast)
        if target_cell is None:
            break
        events = move_car_to(car, target_cell, gs, drift=(drift and first_step))
        first_step = False
        remaining -= 1
        ui.render_all(gs)
        if any(e.kind in ("slam", "hazard", "eliminated", "finish_line") for e in events):
            if any(e.kind in ("slam", "hazard") for e in events):
                break

    car.moved_this_round = True
    if hasattr(car, 'drift_active'):
        car.drift_active = False  # type: ignore

    # Chopper elimination check
    if car.position:
        check_chopper_elimination(car, gs)

    # Step 4: Shoot (optional)
    shoot_result = ui.prompt_shoot(player, gs)
    if shoot_result:
        src_car, target = shoot_result
        resolve_shot(src_car, target, gs)


def run_ai_turn(player: Player, gs: GameState):
    from src import ai

    # Step 2: Command
    cmd_result = ai.ai_choose_command(player, gs)
    if cmd_result:
        cmd, die, car = cmd_result
        execute_command(player, cmd, die, car, gs)

    # Step 1+3: Assign + Move
    die, car, is_coast = ai.ai_choose_assign(player, gs)

    if is_coast:
        die.assigned_to = car.id
        die.is_coast = True
        car.coast_dice_used += 1
    else:
        die.assigned_to = car.id

    steps = 1 if is_coast else die.value
    if hasattr(car, 'nitro_bonus'):
        steps += getattr(car, 'nitro_bonus', 0)
        car.nitro_bonus = 0  # type: ignore
    drift = getattr(car, 'drift_active', False)

    remaining = steps
    first_step = True
    while remaining > 0 and car.state == CarState.OPERABLE and car.position:
        arc = get_forward_arc(car, gs)
        if not arc:
            from src.movement import is_at_front_edge
            from src.road import perform_scroll
            if is_at_front_edge(car):
                perform_scroll(gs)
                if gs.winner:
                    break
            break
        target_cell = ai.ai_choose_move_direction(car, arc)
        if target_cell is None:
            break
        events = move_car_to(car, target_cell, gs, drift=(drift and first_step))
        first_step = False
        remaining -= 1
        if any(e.kind in ("slam", "hazard", "eliminated", "finish_line") for e in events):
            if any(e.kind in ("slam", "hazard") for e in events):
                break

    car.moved_this_round = True
    if hasattr(car, 'drift_active'):
        car.drift_active = False  # type: ignore

    if car.position:
        check_chopper_elimination(car, gs)

    # Step 4: Shoot
    target = ai.ai_choose_shoot(player, gs)
    if target:
        # Find a shooter
        for src in player.operable_cars:
            from src.combat import get_shootable_targets
            if target in get_shootable_targets(src, gs):
                resolve_shot(src, target, gs)
                break


def run_game(gs: GameState):
    from src import ui

    ui.render_all(gs)

    while gs.winner is None:
        round_start(gs)
        ui.render_all(gs)

        # Each player takes turns until all dice assigned
        turn_idx = 0
        turns_taken = {pid: 0 for pid in gs.turn_order}

        while True:
            # Find next player who still has unassigned dice
            active_ids = [pid for pid in gs.turn_order
                          if gs.get_player(pid).state == PlayerState.ACTIVE
                          and not _dice_all_assigned(gs.get_player(pid))]
            if not active_ids:
                break

            pid = active_ids[turn_idx % len(active_ids)]
            player = gs.get_player(pid)
            gs.current_player_id = pid
            gs.phase = Phase.PLAYER_TURN

            if player.is_human:
                ui.render_all(gs)
                run_human_turn(player, gs)
            else:
                run_ai_turn(player, gs)
                ui.render_all(gs)
                ui.console.input("[dim]（AI 行動完畢，按 Enter 繼續）[/dim]")

            winner = check_win(gs)
            if winner:
                gs.winner = winner
                break

            turn_idx += 1

        if gs.winner:
            break

        gs.round_number += 1
        gs.is_first_round = False
        # Rotate first player
        gs.turn_order = gs.turn_order[1:] + [gs.turn_order[0]]
        gs.first_player_id = gs.turn_order[0]

    ui.render_all(gs)
    ui.console.print(f"\n[bold green]🏁 {gs.winner.color} 獲勝！[/bold green]\n")
