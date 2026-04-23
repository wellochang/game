import random
from typing import List
from src.models import (
    Tile, Cell, Board, GameState, GameEvent, HazardType, Terrain,
    CarState, PlayerState, Pos
)

COLS = 6
ROWS = 18

HAZARD_WEIGHTS = {
    HazardType.WRECK: 30,
    HazardType.MINE: 20,
    HazardType.OIL: 25,
    HazardType.ROAD: 15,
    HazardType.MUD: 10,
}
HAZARD_POOL = []
for h, w in HAZARD_WEIGHTS.items():
    HAZARD_POOL.extend([h] * w)

_tile_counter = 0


def generate_tile(is_finish_line: bool = False) -> Tile:
    global _tile_counter
    _tile_counter += 1
    tile_id = f"T{_tile_counter:03d}"

    cells = [[Cell(tile_index=0, col=c, row=r) for r in range(ROWS)] for c in range(COLS)]
    tile = Tile(id=tile_id, cells=cells, is_finish_line=is_finish_line)

    if not is_finish_line:
        n_hazards = random.randint(2, 4)
        positions = random.sample(
            [(c, r) for c in range(COLS) for r in range(2, ROWS - 2)],
            min(n_hazards, COLS * (ROWS - 4))
        )
        for c, r in positions:
            cells[c][r].face_down_hazard = random.choice(HAZARD_POOL)

    return tile


def _reindex_tile(tile: Tile, new_index: int):
    for col_cells in tile.cells:
        for cell in col_cells:
            cell.tile_index = new_index


def init_board(deck_size: int = 15) -> Board:
    tiles = [generate_tile() for _ in range(3)]
    for i, t in enumerate(tiles):
        _reindex_tile(t, i)

    deck = [generate_tile() for _ in range(deck_size)]
    return Board(tiles=tiles, tile_deck=deck, tiles_generated=3)


def perform_scroll(gs: GameState) -> List[GameEvent]:
    events: List[GameEvent] = []
    board = gs.board
    rear_tile = board.tiles[0]

    # Eliminate cars on rear tile
    for player in gs.players:
        for car in player.cars:
            if car.position and car.position[0] == 0 and car.state != CarState.ELIMINATED:
                car.state = CarState.ELIMINATED
                car.position = None
                msg = f"{car.id} 被捲走淘汰（後方格板移除）"
                events.append(GameEvent("eliminated", msg, car_id=car.id))
                gs.log("eliminated", msg, car_id=car.id)

        # Return chopper if on rear tile
        if player.chopper.deployed and player.chopper.position and player.chopper.position[0] == 0:
            player.chopper.deployed = False
            player.chopper.position = None
            msg = f"{player.color} 的直升機歸還"
            events.append(GameEvent("chopper_returned", msg))
            gs.log("chopper_returned", msg)

    # Discard rear tile
    board.discarded.append(rear_tile)

    # Shift tiles: [0,1,2] → remove 0, shift 1→0, 2→1
    board.tiles = [board.tiles[1], board.tiles[2]]
    _reindex_tile(board.tiles[0], 0)
    _reindex_tile(board.tiles[1], 1)

    # Update car positions that were on tiles 1 and 2
    for player in gs.players:
        for car in player.cars:
            if car.position:
                ti, col, row = car.position
                if ti in (1, 2):
                    car.position = (ti - 1, col, row)
        if player.chopper.deployed and player.chopper.position:
            ti, col, row = player.chopper.position
            if ti in (1, 2):
                player.chopper.position = (ti - 1, col, row)

    # Draw new front tile
    should_place_finish = check_finish_line_placement(gs)
    if should_place_finish and not gs.finish_line_placed:
        new_tile = generate_tile(is_finish_line=True)
        gs.finish_line_placed = True
        events.append(GameEvent("finish_line_placed", "終點線格板放入！"))
        gs.log("finish_line_placed", "終點線格板放入！")
    elif board.tile_deck:
        new_tile = board.tile_deck.pop(0)
    else:
        new_tile = generate_tile()

    _reindex_tile(new_tile, 2)
    board.tiles.append(new_tile)
    board.tiles_generated += 1

    events.append(GameEvent("road_scrolled", f"道路推進（新格板 {new_tile.id}）"))
    gs.log("road_scrolled", f"道路推進（新格板 {new_tile.id}）")
    return events


def check_finish_line_placement(gs: GameState) -> bool:
    if gs.finish_line_placed:
        return False
    n_players = len(gs.players)
    if n_players == 2:
        # After 5th tile placed
        return gs.board.tiles_generated >= 5
    else:
        # When first player is eliminated
        eliminated = sum(1 for p in gs.players if p.state == PlayerState.ELIMINATED)
        return eliminated >= 1
