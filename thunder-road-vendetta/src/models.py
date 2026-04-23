from __future__ import annotations
from dataclasses import dataclass, field
from enum import Enum, auto
from typing import Optional, List, Tuple


class VehicleSize(Enum):
    SMALL = "S"
    MEDIUM = "M"
    LARGE = "L"


class CarState(Enum):
    OPERABLE = auto()
    INOPERABLE = auto()
    ELIMINATED = auto()


class PlayerState(Enum):
    ACTIVE = auto()
    ELIMINATED = auto()


class Direction(Enum):
    FORWARD = (0, 1)
    FORWARD_LEFT = (-1, 1)
    FORWARD_RIGHT = (1, 1)
    BACKWARD = (0, -1)
    BACKWARD_LEFT = (-1, -1)
    BACKWARD_RIGHT = (1, -1)

    def __init__(self, dc: int, dr: int):
        self.dc = dc
        self.dr = dr


class DamageTokenType(Enum):
    DENT = "Dent"
    SHRAPNEL = "Shrapnel"
    SKID = "Skid"
    DAZED = "Dazed"
    BLAST = "Blast"


class HazardType(Enum):
    WRECK = "Wreck"
    MINE = "Mine"
    OIL = "Oil"
    ROAD = "Road"
    MUD = "Mud"


class CommandType(Enum):
    AIRSTRIKE = "Airstrike"
    NITRO = "Nitro"
    DRIFT = "Drift"
    REPAIR = "Repair"


class Terrain(Enum):
    NORMAL = "normal"
    MUD = "mud"
    ROAD = "road"


class Phase(Enum):
    SETUP = auto()
    ROUND_START = auto()
    PLAYER_TURN = auto()
    ROUND_END = auto()
    GAME_OVER = auto()


# --- Positions ---

Pos = Tuple[int, int, int]  # (tile_index, col, row)


def global_row(pos: Pos) -> int:
    tile_index, col, row = pos
    return tile_index * 18 + row


# --- Board entities ---

@dataclass
class Cell:
    tile_index: int
    col: int
    row: int
    terrain: Terrain = Terrain.NORMAL
    hazard: Optional[HazardType] = None        # flipped/resolved hazard marker
    face_down_hazard: Optional[HazardType] = None  # not yet revealed

    @property
    def pos(self) -> Pos:
        return (self.tile_index, self.col, self.row)


@dataclass
class Tile:
    id: str
    cells: List[List[Cell]]   # cells[col][row], 6 cols x 18 rows
    is_finish_line: bool = False

    def get_cell(self, col: int, row: int) -> Cell:
        return self.cells[col][row]

    def all_cells(self) -> List[Cell]:
        return [self.cells[c][r] for c in range(6) for r in range(18)]


@dataclass
class Board:
    tiles: List[Tile]         # [0]=rear, [1]=middle, [2]=front
    tile_deck: List[Tile]
    discarded: List[Tile] = field(default_factory=list)
    tiles_generated: int = 3  # total tiles ever placed (for finish line timing)


# --- Dice ---

@dataclass
class Die:
    value: int
    assigned_to: Optional[str] = None   # car_id or "command"
    is_coast: bool = False


# --- Vehicles ---

@dataclass
class Car:
    id: str
    owner: str                   # player_id
    size: VehicleSize
    position: Optional[Pos] = None
    facing: Direction = Direction.FORWARD
    damage_tokens: List[DamageTokenType] = field(default_factory=list)
    state: CarState = CarState.OPERABLE
    moved_this_round: bool = False
    coast_dice_used: int = 0

    @property
    def is_operable(self) -> bool:
        return self.state == CarState.OPERABLE

    @property
    def label(self) -> str:
        return self.id  # e.g. "R1", "B2"


@dataclass
class Chopper:
    owner: str                   # player_id
    position: Optional[Pos] = None
    deployed: bool = False


# --- Player ---

@dataclass
class Player:
    id: str
    color: str                   # "RED" | "BLUE"
    cars: List[Car]
    chopper: Chopper
    dice: List[Die] = field(default_factory=list)
    command_used: bool = False
    state: PlayerState = PlayerState.ACTIVE
    is_human: bool = True

    @property
    def active_cars(self) -> List[Car]:
        return [c for c in self.cars if c.state != CarState.ELIMINATED]

    @property
    def operable_cars(self) -> List[Car]:
        return [c for c in self.cars if c.state == CarState.OPERABLE]

    @property
    def available_dice(self) -> List[Die]:
        return [d for d in self.dice if d.assigned_to is None]


# --- Events ---

class GameEvent:
    def __init__(self, kind: str, description: str, data: dict = None, **kwargs):
        self.kind = kind
        self.description = description
        self.data = {**(data or {}), **kwargs}


# --- Game State ---

@dataclass
class GameState:
    players: List[Player]
    board: Board
    turn_order: List[str]           # player ids
    current_player_id: str = ""
    phase: Phase = Phase.SETUP
    round_number: int = 0
    first_player_id: str = ""
    finish_line_placed: bool = False
    winner: Optional[Player] = None
    is_first_round: bool = True
    damage_token_pool: List[DamageTokenType] = field(default_factory=list)
    event_log: List[GameEvent] = field(default_factory=list)

    def get_player(self, pid: str) -> Player:
        return next(p for p in self.players if p.id == pid)

    def get_car(self, car_id: str) -> Car:
        for p in self.players:
            for c in p.cars:
                if c.id == car_id:
                    return c
        raise ValueError(f"Car {car_id} not found")

    def get_cell(self, pos: Pos) -> Cell:
        tile_index, col, row = pos
        return self.board.tiles[tile_index].cells[col][row]

    def cars_at(self, pos: Pos) -> List[Car]:
        return [
            c for p in self.players
            for c in p.cars
            if c.position == pos and c.state != CarState.ELIMINATED
        ]

    def chopper_at(self, pos: Pos) -> Optional[Chopper]:
        for p in self.players:
            if p.chopper.deployed and p.chopper.position == pos:
                return p.chopper
        return None

    def log(self, kind: str, desc: str, **data):
        self.event_log.append(GameEvent(kind=kind, description=desc, data=data))

    @property
    def current_player(self) -> Player:
        return self.get_player(self.current_player_id)

    @property
    def active_players(self) -> List[Player]:
        return [p for p in self.players if p.state == PlayerState.ACTIVE]
