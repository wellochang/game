import random
from typing import Optional, Tuple
from src.models import (
    Player, Car, Die, Cell, GameState, CommandType
)
from src.movement import get_forward_arc
from src.combat import get_shootable_targets
from src.command import validate_command


def ai_choose_assign(player: Player, gs: GameState) -> Tuple[Die, Car, bool]:
    available_dice = player.available_dice
    unmoved = [c for c in player.operable_cars if not c.moved_this_round]

    if unmoved:
        car = random.choice(unmoved)
        die = random.choice(available_dice)
        return die, car, False

    # Coast die: assign to already-moved car
    moved = [c for c in player.operable_cars
             if c.moved_this_round and c.coast_dice_used < 2]
    if moved and available_dice:
        car = random.choice(moved)
        die = random.choice(available_dice)
        return die, car, True

    car = random.choice(player.operable_cars) if player.operable_cars else player.cars[0]
    die = random.choice(available_dice) if available_dice else player.dice[0]
    return die, car, False


def ai_choose_move_direction(car: Car, arc: list) -> Optional[Cell]:
    if not arc:
        return None
    # Prefer center, then random
    if len(arc) >= 2:
        return arc[1]
    return random.choice(arc)


def ai_choose_command(player: Player, gs: GameState) -> Optional[Tuple[CommandType, Die, Optional[Car]]]:
    if player.command_used or gs.is_first_round:
        return None
    available_dice = player.available_dice
    if not available_dice:
        return None

    # Try Nitro with low dice
    for die in available_dice:
        ok, _ = validate_command(player, CommandType.NITRO, die)
        if ok:
            unmoved = [c for c in player.operable_cars if not c.moved_this_round]
            car = random.choice(unmoved) if unmoved else None
            if car and random.random() < 0.3:
                return CommandType.NITRO, die, car

    # Try Repair if damaged
    for die in available_dice:
        ok, _ = validate_command(player, CommandType.REPAIR, die)
        if ok and random.random() < 0.5:
            return CommandType.REPAIR, die, None

    return None


def ai_choose_shoot(player: Player, gs: GameState) -> Optional[Car]:
    if gs.is_first_round:
        return None
    for car in player.operable_cars:
        targets = get_shootable_targets(car, gs)
        if targets and random.random() < 0.7:
            return random.choice(targets)
    return None


def ai_choose_airstrike_cell(player: Player, gs: GameState) -> Optional[Cell]:
    # Deploy chopper to a cell near enemy cars
    for p in gs.players:
        if p.id == player.id:
            continue
        for car in p.operable_cars:
            if car.position:
                ti, col, row = car.position
                # target one step ahead of enemy
                new_row = row + 1
                if new_row < 18:
                    cell = gs.board.tiles[ti].cells[col][new_row]
                    if not gs.cars_at(cell.pos) and not gs.chopper_at(cell.pos):
                        return cell
    return None
