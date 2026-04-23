from typing import List
from src.models import Car, Chopper, GameState, GameEvent, CarState


def deploy_chopper(chopper: Chopper, pos, gs: GameState) -> List[GameEvent]:
    events = []
    if gs.cars_at(pos) or gs.chopper_at(pos):
        gs.log("chopper", "無法部署：目標格已有車或直升機")
        return events
    chopper.position = pos
    chopper.deployed = True
    msg = f"直升機部署到 {pos}"
    events.append(GameEvent("chopper_deployed", msg))
    gs.log("chopper_deployed", msg)
    return events


def check_chopper_elimination(car: Car, gs: GameState) -> List[GameEvent]:
    events = []
    if car.position is None or car.state == CarState.ELIMINATED:
        return events
    chopper = gs.chopper_at(car.position)
    if chopper:
        car.state = CarState.ELIMINATED
        car.position = None
        msg = f"{car.id} 停在直升機上，遭淘汰！"
        events.append(GameEvent("eliminated", msg, car_id=car.id))
        gs.log("eliminated", msg)
    return events


def return_chopper(chopper: Chopper, gs: GameState):
    chopper.deployed = False
    chopper.position = None
    gs.log("chopper_returned", f"{chopper.owner} 的直升機歸還")
