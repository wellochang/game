from typing import List, Optional
from rich.console import Console
from rich.table import Table
from rich.panel import Panel
from rich.columns import Columns
from rich import box
from src.models import (
    GameState, Car, Cell, Die, Player, GameEvent,
    CarState, HazardType, CommandType
)
from src.movement import get_forward_arc
from src.combat import get_shootable_targets
from src.command import validate_command

console = Console()

COLOR_MAP = {
    "RED": "bold red",
    "BLUE": "bold blue",
}

CAR_SYMBOL = {
    "RED": "R",
    "BLUE": "B",
}


def _car_char(gs: GameState, pos) -> str:
    cars = gs.cars_at(pos)
    chopper = gs.chopper_at(pos)
    cell = gs.get_cell(pos)

    if chopper:
        return "[yellow]✈[/yellow]"
    if cars:
        car = cars[0]
        color = COLOR_MAP.get(car.owner, "white")
        dmg = "!" if car.damage_tokens else ""
        x = "x" if car.state == CarState.INOPERABLE else ""
        return f"[{color}]{car.id[0]}{car.id[1]}{x}{dmg}[/{color}]"
    if cell.face_down_hazard:
        return "[dim]?[/dim]"
    if cell.hazard:
        symbols = {
            HazardType.WRECK: "[dim]W[/dim]",
            HazardType.MINE: "[red]M[/red]",
            HazardType.OIL: "[yellow]O[/yellow]",
        }
        return symbols.get(cell.hazard, "[dim]H[/dim]")
    return "  "


def render_board(gs: GameState):
    table = Table(box=box.SIMPLE, show_header=True, padding=(0, 0))
    table.add_column("row", style="dim", width=4)
    for c in range(6):
        table.add_column(str(c), width=5, justify="center")

    # Show tiles from front (2) to rear (0)
    for ti in reversed(range(3)):
        tile = gs.board.tiles[ti]
        label = {0: "REAR", 1: "MID", 2: "FRONT"}[ti]
        finish = " [FINISH]" if tile.is_finish_line else ""
        table.add_row(f"── {label}{finish} ──", *["" * 5] * 6, style="dim")
        for row in reversed(range(18)):
            row_label = f"{ti*18+row:02d}"
            cells_str = [_car_char(gs, (ti, col, row)) for col in range(6)]
            table.add_row(row_label, *cells_str)

    console.print(Panel(table, title=f"[bold]THUNDER ROAD[/bold]  Round {gs.round_number}  |  {gs.current_player.color}'s Turn", border_style="bright_white"))


def render_player_status(gs: GameState):
    panels = []
    for player in gs.players:
        color = COLOR_MAP.get(player.color, "white")
        lines = []

        dice_str = " ".join(
            f"[[{d.value}]{'C' if d.is_coast else ''}]" if d.assigned_to is None
            else f"[dim][{d.value}✓][/dim]"
            for d in player.dice
        )
        lines.append(f"Dice: {dice_str}")

        for car in player.cars:
            if car.state == CarState.ELIMINATED:
                lines.append(f"  [{car.id}] [dim]淘汰[/dim]")
                continue
            dmg = "♥" * (2 - len(car.damage_tokens)) + "✗" * len(car.damage_tokens)
            state_tag = " [dim](失能)[/dim]" if car.state == CarState.INOPERABLE else ""
            moved = " ✓" if car.moved_this_round else ""
            pos_str = str(car.position) if car.position else "場外"
            lines.append(f"  [{car.id}]({car.size.value}) {dmg}{state_tag}{moved}  @{pos_str}")

        chopper_str = f"  ✈ {'deployed @' + str(player.chopper.position) if player.chopper.deployed else '待命'}"
        lines.append(chopper_str)

        text = "\n".join(lines)
        panels.append(Panel(text, title=f"[{color}]{player.color}[/{color}]",
                            border_style=color.split()[-1], width=45))

    console.print(Columns(panels))


def render_event_log(gs: GameState, last_n: int = 6):
    if not gs.event_log:
        return
    events = gs.event_log[-last_n:]
    lines = [f"  [dim]{e.description}[/dim]" for e in events]
    console.print(Panel("\n".join(lines), title="事件記錄", border_style="dim"))


def render_all(gs: GameState):
    console.clear()
    render_board(gs)
    render_player_status(gs)
    render_event_log(gs)


# --- Input prompts ---

def prompt_assign(player: Player, gs: GameState):
    unmoved = [c for c in player.operable_cars if not c.moved_this_round]
    coastable = [c for c in player.operable_cars
                 if c.moved_this_round and c.coast_dice_used < 2]
    available_dice = player.available_dice

    console.print("\n[bold]【指派】選骰子 → 車輛[/bold]")
    options = []
    for die in available_dice:
        for car in unmoved:
            options.append((die, car, False))
        for car in coastable:
            options.append((die, car, True))

    if not options:
        console.print("[dim]無可指派選項，跳過[/dim]")
        return None, None, False

    for i, (die, car, is_coast) in enumerate(options):
        coast_tag = " [dim](惰行+1格)[/dim]" if is_coast else ""
        console.print(f"  [{i+1}] 骰[{die.value}] → {car.id}({car.size.value}){coast_tag}")

    while True:
        raw = console.input("選擇 (輸入編號): ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(options):
            return options[int(raw) - 1]
        console.print("[red]無效輸入[/red]")


def prompt_command(player: Player, gs: GameState):
    if player.command_used or gs.is_first_round:
        return None
    available_dice = player.available_dice
    if not available_dice:
        return None

    console.print("\n[bold]【指令】使用指令？（Enter 跳過）[/bold]")
    valid = []
    for cmd in CommandType:
        for die in available_dice:
            ok, reason = validate_command(player, cmd, die)
            if ok:
                valid.append((cmd, die))

    if not valid:
        return None

    console.print("  [0] 跳過")
    for i, (cmd, die) in enumerate(valid):
        console.print(f"  [{i+1}] {cmd.value}（骰 {die.value}）")

    raw = console.input("選擇: ").strip()
    if raw == "0" or raw == "":
        return None
    if raw.isdigit() and 1 <= int(raw) <= len(valid):
        return valid[int(raw) - 1]
    return None


def prompt_move_direction(car: Car, gs: GameState, steps: int, is_coast: bool = False):
    arc = get_forward_arc(car, gs)
    if not arc:
        console.print(f"[dim]{car.id} 無法移動（超出前方）[/dim]")
        return None

    extra = " [dim](+1 惰行格)[/dim]" if is_coast else f"（步數 {steps}）"
    console.print(f"\n[bold]【移動】{car.id}{extra}  選擇方向：[/bold]")
    for i, cell in enumerate(arc):
        occupants = gs.cars_at(cell.pos)
        occ_str = f" [有車: {', '.join(c.id for c in occupants)}]" if occupants else ""
        chopper = gs.chopper_at(cell.pos)
        chop_str = " [⚠ 直升機！]" if chopper else ""
        hazard_str = " [?]" if cell.face_down_hazard else ""
        console.print(f"  [{i+1}] col={cell.col} row={cell.row}{occ_str}{chop_str}{hazard_str}")

    while True:
        raw = console.input("選擇方向（編號）: ").strip()
        if raw.isdigit() and 1 <= int(raw) <= len(arc):
            return arc[int(raw) - 1]
        console.print("[red]無效輸入[/red]")


def prompt_shoot(player: Player, gs: GameState):
    if gs.is_first_round:
        return None
    targets = []
    shooter = None
    for car in player.operable_cars:
        t = get_shootable_targets(car, gs)
        if t:
            targets.extend([(car, target) for target in t])
            if not shooter:
                shooter = car

    if not targets:
        return None

    console.print("\n[bold]【射擊】選擇目標（Enter 跳過）[/bold]")
    console.print("  [0] 跳過")
    for i, (src, tgt) in enumerate(targets):
        dmg_str = f"({len(tgt.damage_tokens)}損傷)" if tgt.damage_tokens else ""
        console.print(f"  [{i+1}] {src.id} 射 {tgt.id}({tgt.size.value}){dmg_str}")

    raw = console.input("選擇: ").strip()
    if raw == "0" or raw == "":
        return None
    if raw.isdigit() and 1 <= int(raw) <= len(targets):
        return targets[int(raw) - 1]
    return None
