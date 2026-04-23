import random
from typing import List
from src.models import VehicleSize, Direction


def roll_dice(count: int) -> List[int]:
    return [random.randint(1, 6) for _ in range(count)]


def roll_stunt_die() -> int:
    return random.choice([1, 1, 2, 2, 3, 3])


def roll_direction_die() -> Direction:
    return random.choice(list(Direction))


def roll_shooting_die() -> VehicleSize:
    v = random.randint(1, 6)
    if v <= 2:
        return VehicleSize.SMALL
    elif v <= 4:
        return VehicleSize.MEDIUM
    else:
        return VehicleSize.LARGE


def roll_slam_die() -> int:
    return random.randint(1, 6)


def roll_d6() -> int:
    return random.randint(1, 6)
