// Pixel sprite system. Sprites are arrays of strings; each char is a palette index.
// '.' = transparent.

const PAL = {
  // base
  '.': null,
  '0': '#0e0a07',
  '1': '#1a120c',
  '2': '#251a11',
  '3': '#382617',
  '4': '#4a341e',
  '5': '#6b5638',
  '6': '#8a7146',
  '7': '#b89a6a',
  '8': '#e9d7a5',
  '9': '#f4e1b3',
  // metal
  'M': '#3a3a40',
  'm': '#5b5b62',
  'L': '#7a7a80',
  'l': '#9a9a9e',
  // rust
  'R': '#7a2c0e',
  'r': '#c45a1c',
  'o': '#e8762a',
  'O': '#f59a3a',
  // blood / danger
  'B': '#6b1418',
  'b': '#a4232a',
  'd': '#d83a30',
  // acid / toxic
  'A': '#4a5418',
  'a': '#b6c43a',
  // sky / glass
  'S': '#3a4a5a',
  's': '#6a8aa0',
  // shadow
  'k': 'rgba(0,0,0,0.5)',
  // bone
  'W': '#c8b07a',
  'w': '#e9d7a5',
};

function drawSprite(ctx, sprite, x, y, scale = 1, palOverride) {
  const pal = palOverride || PAL;
  for (let row = 0; row < sprite.length; row++) {
    const line = sprite[row];
    for (let col = 0; col < line.length; col++) {
      const ch = line[col];
      const color = pal[ch];
      if (!color) continue;
      ctx.fillStyle = color;
      ctx.fillRect(x + col * scale, y + row * scale, scale, scale);
    }
  }
}

function spriteSize(sprite) {
  return { w: sprite[0].length, h: sprite.length };
}

// ───────────────────────────────────────────────────────────────────
// CHASSIS — top-down view, ~24x14
// ───────────────────────────────────────────────────────────────────

const CHASSIS_SCOUT = [
  "....MMMM....",
  "...MmmmmM...",
  "..MmllllmM..",
  ".MmlssssLmM.",
  "MmLLssssLLmM",
  "MmLLssssLLmM",
  "MmllllllllmM",
  "MmLLrrrrLLmM",
  "MmLLrooorLLM",
  "MmllrooorllM",
  ".MmllrrrlmM.",
  "..MmlllmM...",
  "...MmmmM....",
  "....kkkk....",
];

const CHASSIS_RUNNER = [
  "...MMMMMM...",
  "..MmmmmmmmM.",
  ".MmllllllmM.",
  "MmLLsssssLmM",
  "MmLssssssLmM",
  "MmLLLLLLLLmM",
  "MmlrrrrrrlmM",
  "MmLrooooorLM",
  "MmLrooooorLM",
  "MmlrooooorlM",
  "MmLLrrrrrLLM",
  ".MmllrrrllmM",
  "..MmmllmmM..",
  "...kkkkkk...",
];

const CHASSIS_HAULER = [
  "..MMMMMMMM..",
  ".MmmmmmmmmM.",
  "MmLLLLLLLLmM",
  "MmLssssssLmM",
  "MmLssssssLmM",
  "MmLLLLLLLLmM",
  "MmlrrRRrrrlM",
  "MmLrRRRRRrLM",
  "MmLrRRBBRrLM",
  "MmLrRRBBRrLM",
  "MmLrRRRRRrLM",
  "MmlrrRRrrrlM",
  "MmLLLLLLLLmM",
  ".MmmmmmmmmM.",
];

// ───────────────────────────────────────────────────────────────────
// WEAPONS (overlay on chassis)
// ───────────────────────────────────────────────────────────────────

const WEAPON_HARPOON = [
  "....MMMM....",
  "....MllM....",
  "....MllM....",
  "....MllM....",
  "....MllM....",
  "....MLLM....",
];

const WEAPON_FLAMER = [
  "....rRoo....",
  "...rROOob...",
  "...rROOob...",
  "....rRoo....",
];

const WEAPON_AUTOCANNON = [
  "....MmmM....",
  "...MLllLM...",
  "..MLlllllM..",
  "...MLLLLM...",
  "....MMMM....",
];

const WEAPON_MORTAR = [
  ".....MM.....",
  "....MmmM....",
  "...MmllmM...",
  "...MmllmM...",
  "....MmmM....",
];

// ───────────────────────────────────────────────────────────────────
// ENEMIES
// ───────────────────────────────────────────────────────────────────

const ENEMY_RAIDER = [
  "....RRRR....",
  "...RrrrrR...",
  "..RrLLLLrR..",
  ".Rrl3333lrR.",
  "Rrl333333lrR",
  "RrL333333LrR",
  "RrllllllllrR",
  "RrLLrrrrLLrR",
  "RrLLrbbrLLrR",
  "RrllrbbrllrR",
  ".RrllrrrlrR.",
  "..Rrlll  rR.",
  "...RrrrrR...",
  "....kkkk....",
];

const ENEMY_SCRAPRIG = [
  "..RRRRRRRR..",
  ".RrrrrrrrrR.",
  "RrlLLLLLLLrR",
  "RrlbbbbbbLrR",
  "RrlbBBBBbLrR",
  "RrlLLLLLLLrR",
  "RrlrrRRrrrlR",
  "RrLrRRBBRrLR",
  "RrLrRBBBBrLR",
  "RrLrRBBBBrLR",
  "RrLrRRBBRrLR",
  "RrlrrRRrrrlR",
  "RrlLLLLLLLrR",
  ".RrrrrrrrrR.",
];

const ENEMY_JUGGERNAUT = [
  ".MMMMMMMMMM.",
  "MmRRRRRRRRmM",
  "MmRbbbbbbRmM",
  "MmRbBBBBbRmM",
  "MmRbBddBbRmM",
  "MmRbBddBbRmM",
  "MmRbBBBBbRmM",
  "MmRbbbbbbRmM",
  "MmRRRRRRRRmM",
  "MmRrrRRrrRmM",
  "MmRrRBBRrRmM",
  "MmRrRBBRrRmM",
  "MmRrrRRrrRmM",
  ".MMMMMMMMMM.",
];

// ───────────────────────────────────────────────────────────────────
// TERRAIN TILES — 16x16
// ───────────────────────────────────────────────────────────────────

function makeSandTile(seed) {
  // deterministic noisy sand tile
  const w = 16, h = 16;
  let s = seed * 9301 + 49297;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const rows = [];
  for (let y = 0; y < h; y++) {
    let row = "";
    for (let x = 0; x < w; x++) {
      const r = rand();
      if (r < 0.04) row += '4';
      else if (r < 0.12) row += '5';
      else if (r < 0.55) row += '6';
      else if (r < 0.92) row += '7';
      else row += '8';
    }
    rows.push(row);
  }
  return rows;
}

const TILE_SAND_A = makeSandTile(1);
const TILE_SAND_B = makeSandTile(7);
const TILE_SAND_C = makeSandTile(23);

const TILE_ROCK = [
  "6677788877766665",
  "6778866678777655",
  "7783334456687765",
  "778333455567a765",
  "67833455566a7765",
  "778334556677a765",
  "67833445667a7755",
  "778334566677aa55",
  "67833445566a7766",
  "7783345566677766",
  "6778334566677665",
  "7778334456677755",
  "6677834456677665",
  "7678345456677665",
  "6677845466787766",
  "5577665555666655",
];

const TILE_WRECK = [
  "7777777777777777",
  "7766R67R67R66777",
  "76RRRrRRRrRRRR67",
  "7RRRrrr3rrrRRRr7",
  "7Rrrr333r3rrRRr7",
  "7RrrM333MrrrRRr7",
  "7RrMMMMMMMrrrRr7",
  "7RMMLLLLLMMMrrr7",
  "7RMlLllllLMRrrr7",
  "7RMLLllllLMRRrr7",
  "7RMMMMLMMMMRRrr7",
  "7RrMMlllMMRrrrr7",
  "7RrrrMmMRRRrrr67",
  "77rrrrRRrrrr6677",
  "6776rrr6rr66Rr67",
  "7666666667767667",
];

const TILE_BARREL = [
  "7777777777777777",
  "7777aaaaaaaa7777",
  "777aAAAAAAAAa777",
  "77aAaAaAaAaAaa77",
  "77aAaaaaaaaaAa77",
  "77aAaAAAAAAaAa77",
  "77aAaAaaaaAaAa77",
  "77aAaAaaaaAaAa77",
  "77aAaAAAAAAaAa77",
  "77aAaaaaaaaaAa77",
  "77aAAAAAAAAAAa77",
  "77aaaaaaaaaaaa77",
  "777aaaaaaaaaa777",
  "7777aaaaaaaa7777",
  "7777777777777777",
  "7777777777777777",
];

// ───────────────────────────────────────────────────────────────────
// MAP ICONS — 12x12 for nodes
// ───────────────────────────────────────────────────────────────────

const ICON_FIGHT = [
  "....bb......",
  "...bbbb.....",
  "..bb..bb....",
  ".bb....bb...",
  "bb......bb..",
  ".bb....bb...",
  "..bb..bb....",
  "...bbbb.....",
  "....bb......",
  "............",
  "....bb......",
  "............",
];

const ICON_ELITE = [
  "....dd......",
  "...dbbd.....",
  "..dbBBbd....",
  ".dbBddBbd...",
  "dbBdooodBbd.",
  "dbBdoo odBbd",
  ".dbBdoodBbd.",
  "..dbBBBBbd..",
  "...dbBBbd...",
  "....dbbd....",
  ".....dd.....",
  "............",
];

const ICON_SCRAP = [
  "............",
  "...MmmmmM...",
  "..MmLLLLmM..",
  ".MmL7777LmM.",
  "MmL777777LmM",
  "MmL77WW77LmM",
  "MmL777777LmM",
  ".MmL7777LmM.",
  "..MmLLLLmM..",
  "...MmmmmM...",
  "............",
  "............",
];

const ICON_EVENT = [
  "....8888....",
  "...8oooo8...",
  "..8oo88oo8..",
  ".8o8....8o8.",
  ".8o8....8o8.",
  ".....8o8....",
  "....8o8.....",
  "....8o8.....",
  "....8o8.....",
  "............",
  "....8o8.....",
  "............",
];

const ICON_BOSS = [
  "...kkkkkk...",
  "..kRRRRRRk..",
  ".kRbBBBBbRk.",
  "kRbBddddBbRk",
  "kRbBdddOBbRk",
  "kRbBdooBdBRk",
  "kRbBdOOdBbRk",
  "kRbBBddBBbRk",
  ".kRbBBBBbRk.",
  "..kRRRRRRk..",
  "...kkkkkk...",
  "............",
];

// ───────────────────────────────────────────────────────────────────
// Drawing helpers
// ───────────────────────────────────────────────────────────────────

function drawText(ctx, text, x, y, scale, color, opts = {}) {
  // Use VT323-style canvas text. For pixel feel, use bigger pixels via tiny font size + scale.
  ctx.save();
  ctx.fillStyle = color;
  ctx.font = `${opts.size || 14 * scale}px "VT323", monospace`;
  ctx.textBaseline = 'top';
  if (opts.align) ctx.textAlign = opts.align;
  ctx.fillText(text, x, y);
  ctx.restore();
}

const Sprites = {
  PAL,
  drawSprite, drawText, spriteSize,
  CHASSIS: { scout: CHASSIS_SCOUT, runner: CHASSIS_RUNNER, hauler: CHASSIS_HAULER },
  WEAPONS: { harpoon: WEAPON_HARPOON, flamer: WEAPON_FLAMER, autocannon: WEAPON_AUTOCANNON, mortar: WEAPON_MORTAR },
  ENEMIES: { raider: ENEMY_RAIDER, scraprig: ENEMY_SCRAPRIG, juggernaut: ENEMY_JUGGERNAUT },
  TILES: { sand: [TILE_SAND_A, TILE_SAND_B, TILE_SAND_C], rock: TILE_ROCK, wreck: TILE_WRECK, barrel: TILE_BARREL },
  ICONS: { fight: ICON_FIGHT, elite: ICON_ELITE, scrap: ICON_SCRAP, event: ICON_EVENT, boss: ICON_BOSS },
};

window.Sprites = Sprites;
