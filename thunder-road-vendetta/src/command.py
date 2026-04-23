from typing import List, Optional, Tuple
from src.models import (
    Car, Player, Die, GameState, GameEvent, CommandType, Cell
)


def validate_command(player: Player, cmd: CommandType, die: Die) -> Tuple[bool, str]:
    v = die.value
    if cmd == CommandType.AIRSTRIKE:
        if player.chopper.deployed:
            return False, "直升機已部署"
        return True, ""
    elif cmd == CommandType.NITRO:
        if not (1 <= v <= 3):
            return False, f"氮氣需要骰值 1~3（目前 {v}）"
        return True, ""
    elif cmd == CommandType.DRIFT:
        if not (3 <= v <= 5):
            return False, f"飄移需要骰值 3~5（目前 {v}）"
        return True, ""
    elif cmd == CommandType.REPAIR:
        if v != 6:
            return False, f"維修需要骰值 6（目前 {v}）"
        has_damaged = any(c.damage_tokens for c in player.cars if c.state != __import__('src.models', fromlist=['CarState']).CarState.ELIMINATED)
        has_inoperable = any(c.state == __import__('src.models', fromlist=['CarState']).CarState.INOPERABLE for c in player.cars)
        if not (has_damaged or has_inoperable):
            return False, "沒有可維修的車輛"
        return True, ""
    return False, "未知指令"


def execute_command(player: Player, cmd: CommandType, die: Die,
                    car: Optional[Car], gs: GameState,
                    target_cell: Optional[Cell] = None) -> List[GameEvent]:
    events = []

    if cmd == CommandType.AIRSTRIKE:
        if target_cell and not gs.cars_at(target_cell.pos) and not gs.chopper_at(target_cell.pos):
            player.chopper.position = target_cell.pos
            player.chopper.deployed = True
            msg = f"{player.color} 部署直升機到 {target_cell.pos}"
            events.append(GameEvent("airstrike", msg))
            gs.log("airstrike", msg)
            # Shooting handled separately by caller
        else:
            gs.log("airstrike", "空襲：目標格無效")

    elif cmd == CommandType.NITRO:
        if car:
            car.nitro_bonus = die.value  # caller applies this to movement steps
            msg = f"{car.id} 氮氣加速 +{die.value}"
            events.append(GameEvent("nitro", msg, car_id=car.id, bonus=die.value))
            gs.log("nitro", msg)

    elif cmd == CommandType.DRIFT:
        if car:
            car.drift_active = True  # type: ignore
            msg = f"{car.id} 飄移啟動"
            events.append(GameEvent("drift_cmd", msg, car_id=car.id))
            gs.log("drift_cmd", msg)

    elif cmd == CommandType.REPAIR:
        # Find target car: prefer inoperable, else most damaged
        from src.models import CarState
        target = None
        if car:
            target = car
        else:
            inop = [c for c in player.cars if c.state == CarState.INOPERABLE]
            if inop:
                target = inop[0]
            else:
                damaged = [c for c in player.cars if c.damage_tokens and c.state == CarState.OPERABLE]
                if damaged:
                    target = max(damaged, key=lambda c: len(c.damage_tokens))
        if target:
            if target.state == CarState.INOPERABLE:
                target.state = CarState.OPERABLE
                from src.models import Direction
                target.facing = Direction.FORWARD
                if target.damage_tokens:
                    target.damage_tokens.pop()
                msg = f"{target.id} 從失能中恢復"
            elif target.damage_tokens:
                target.damage_tokens.pop()
                msg = f"{target.id} 移除一個損傷標記（剩 {len(target.damage_tokens)}）"
            else:
                msg = "無法維修"
            events.append(GameEvent("repair", msg))
            gs.log("repair", msg)

    die.assigned_to = "command"
    player.command_used = True
    return events
