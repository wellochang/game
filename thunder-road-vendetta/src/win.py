from typing import Optional
from src.models import Player, GameState, CarState, PlayerState


def check_elimination(player: Player) -> bool:
    return all(c.state in (CarState.INOPERABLE, CarState.ELIMINATED) for c in player.cars)


def check_win(gs: GameState) -> Optional[Player]:
    # Check finish line crossing
    for player in gs.players:
        for car in player.cars:
            if car.state == CarState.OPERABLE and car.position:
                ti, col, row = car.position
                tile = gs.board.tiles[ti]
                if tile.is_finish_line:
                    gs.log("win", f"{player.color} 的 {car.id} 抵達終點線！")
                    return player

    # Eliminate players with no active cars
    for player in gs.players:
        if player.state == PlayerState.ACTIVE and check_elimination(player):
            player.state = PlayerState.ELIMINATED
            gs.log("player_eliminated", f"{player.color} 出局（所有車輛失能或淘汰）")

    active = [p for p in gs.players if p.state == PlayerState.ACTIVE]
    if len(active) == 1:
        gs.log("win", f"{active[0].color} 是最後倖存者！")
        return active[0]

    return None
