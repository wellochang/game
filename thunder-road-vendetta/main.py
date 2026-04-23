import sys
import os

sys.path.insert(0, os.path.dirname(__file__))

from src.game import setup_game, run_game

if __name__ == "__main__":
    gs = setup_game(human_color="RED")
    run_game(gs)
