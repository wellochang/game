// Garage screen — pick chassis / weapon / engine / armor

const CHASSIS_OPTIONS = [
  { id: 'scout',  sprite: 'scout',  name: 'Scout',  stats: { HP: 12, MOV: 4, ARM: 0 }, desc: 'Fast frame. Outrun, outflank.' },
  { id: 'runner', sprite: 'runner', name: 'Runner', stats: { HP: 18, MOV: 3, ARM: 1 }, desc: 'Balanced wrecker.' },
  { id: 'hauler', sprite: 'hauler', name: 'Hauler', stats: { HP: 28, MOV: 2, ARM: 2 }, desc: 'Slow tank. Bone plates welded thick.' },
];

const WEAPON_OPTIONS = [
  { id: 'harpoon',    name: 'Harpoon',    stats: { DMG: 3, RNG: 4, AMMO: 99 }, desc: 'Pulls target 1 tile closer.' },
  { id: 'flamer',     name: 'Flamer',     stats: { DMG: 2, RNG: 2, BURN: 1 }, desc: 'Cone. Sets target on fire (2 turns).' },
  { id: 'autocannon', name: 'Autocannon', stats: { DMG: 4, RNG: 5, AMMO: 99 }, desc: 'Straight line. Bread and butter.' },
  { id: 'mortar',     name: 'Mortar',     stats: { DMG: 5, RNG: 7, AMMO: 3 },  desc: 'Arcs over cover. Splash 1.' },
];

const ENGINE_OPTIONS = [
  { id: 'diesel', name: 'Diesel',  stats: { MOV: 0, FUEL: 12 }, desc: 'Reliable. Cheap.' },
  { id: 'nitro',  name: 'Nitro',   stats: { MOV: 2, FUEL: 8 },  desc: '+2 move, burns hot.' },
  { id: 'hybrid', name: 'Hybrid',  stats: { MOV: 1, FUEL: 14 }, desc: 'Salvaged batteries. Quiet.' },
];

const ARMOR_OPTIONS = [
  { id: 'bone',    name: 'Bone Plates',  stats: { ARM: 1, HP: 2 },  desc: 'Lacquered skull lattice.' },
  { id: 'scrap',   name: 'Scrap Iron',   stats: { ARM: 2, HP: 0 },  desc: 'Bolted-on door panels.' },
  { id: 'ceramic', name: 'Ceramic',      stats: { ARM: 3, HP: -2 }, desc: 'Brittle. Stops one big hit.' },
];

function GarageScreen({ build, setBuild, onStart, runState }) {
  const [section, setSection] = useState('chassis'); // chassis | weapon | engine | armor

  const chassis = CHASSIS_OPTIONS.find(c => c.id === build.chassis);
  const weapon  = WEAPON_OPTIONS.find(w => w.id === build.weapon);
  const engine  = ENGINE_OPTIONS.find(e => e.id === build.engine);
  const armor   = ARMOR_OPTIONS.find(a => a.id === build.armor);

  const totalHP  = chassis.stats.HP + armor.stats.HP;
  const totalMOV = chassis.stats.MOV + engine.stats.MOV;
  const totalARM = chassis.stats.ARM + armor.stats.ARM;
  const totalFUEL = engine.stats.FUEL;

  const sections = [
    { id: 'chassis', label: 'CHASSIS', current: chassis.name },
    { id: 'weapon',  label: 'WEAPON',  current: weapon.name },
    { id: 'engine',  label: 'ENGINE',  current: engine.name },
    { id: 'armor',   label: 'ARMOR',   current: armor.name },
  ];

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14, position: 'relative' }}>
      <Dust />

      {/* Header */}
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 className="silkscreen" style={{ fontSize: 22, margin: 0, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>
          THE GARAGE
        </h1>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>
          // weld your rig before the convoy moves out
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>RUN {runState.runNum} · DAY {runState.day}</span>
      </div>

      {/* Main: Preview | Options */}
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '440px 1fr', gap: 14 }}>
        {/* Preview */}
        <Panel title="THE RIG" subtitle={`// ${build.callsign}`}>
          <div style={{ flex: 1, position: 'relative', background: 'radial-gradient(ellipse at 50% 60%, #2a1c10 0%, #14100a 100%)', overflow: 'hidden' }}>
            {/* ground stripes */}
            <div style={{ position: 'absolute', left: 0, right: 0, bottom: 40, height: 40, background: 'repeating-linear-gradient(to right, transparent 0 18px, rgba(184,154,106,0.15) 18px 24px)' }} />
            <div style={{ position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
              <PixelCanvas sprite={chassis.sprite ? Sprites.CHASSIS[chassis.sprite] : null} scale={10} />
            </div>
            {/* corner tags */}
            <div style={{ position: 'absolute', top: 10, left: 10, color: 'var(--ink-faint)', fontSize: 14 }}>┌── TOP VIEW</div>
            <div style={{ position: 'absolute', top: 10, right: 10, color: 'var(--ink-faint)', fontSize: 14 }}>SCALE 10× ──┐</div>
            <div style={{ position: 'absolute', bottom: 10, left: 10, color: 'var(--ink-faint)', fontSize: 14 }}>└── x: {build.chassis}</div>
            <div style={{ position: 'absolute', bottom: 10, right: 10, color: 'var(--ink-faint)', fontSize: 14 }}>w: {build.weapon} ──┘</div>
          </div>

          {/* Stats summary */}
          <div style={{ padding: 14, borderTop: '2px solid var(--line)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 6 }}>
            <StatBar label="HULL"  value={totalHP}   max={36} color="var(--blood)" />
            <StatBar label="ARMOR" value={totalARM}  max={6}  color="var(--steel)" />
            <StatBar label="MOVE"  value={totalMOV}  max={8}  color="var(--rust)" />
            <StatBar label="FUEL"  value={totalFUEL} max={20} color="var(--acid)" />
          </div>
        </Panel>

        {/* Options */}
        <Panel title="WORKBENCH" subtitle={`// ${section.toUpperCase()}`}>
          <div style={{ display: 'flex', borderBottom: '2px solid var(--line)' }}>
            {sections.map(s => (
              <button
                key={s.id}
                onClick={() => setSection(s.id)}
                className="silkscreen noselect"
                style={{
                  flex: 1,
                  padding: '10px 8px',
                  background: section === s.id ? 'var(--bg-3)' : 'transparent',
                  color: section === s.id ? 'var(--rust-bright)' : 'var(--ink-dim)',
                  border: 'none',
                  borderRight: '1px solid var(--line)',
                  cursor: 'pointer',
                  fontSize: 12,
                  letterSpacing: '0.08em',
                  textAlign: 'left',
                  display: 'flex',
                  flexDirection: 'column',
                  gap: 4,
                }}
              >
                <span>{s.label}</span>
                <span style={{ fontFamily: '"VT323", monospace', fontSize: 15, color: 'var(--ink)', letterSpacing: '0' }}>
                  {s.current.toLowerCase()}
                </span>
              </button>
            ))}
          </div>

          <div style={{ flex: 1, padding: 16, overflow: 'auto' }}>
            {section === 'chassis' && (
              <PartGrid
                options={CHASSIS_OPTIONS}
                selectedId={build.chassis}
                onSelect={(id) => setBuild({ ...build, chassis: id })}
                renderSprite={(o) => Sprites.CHASSIS[o.sprite]}
              />
            )}
            {section === 'weapon' && (
              <PartGrid
                options={WEAPON_OPTIONS}
                selectedId={build.weapon}
                onSelect={(id) => setBuild({ ...build, weapon: id })}
                renderSprite={() => null}
                renderLayers={(o) => [
                  { sprite: Sprites.CHASSIS[chassis.sprite], x: 0, y: 0 },
                  { sprite: Sprites.WEAPONS[o.id], x: 0, y: 4 },
                ]}
              />
            )}
            {section === 'engine' && (
              <PartGrid
                options={ENGINE_OPTIONS}
                selectedId={build.engine}
                onSelect={(id) => setBuild({ ...build, engine: id })}
                renderSprite={() => null}
                renderLayers={(o) => [{ sprite: makeEngineSprite(o.id), x: 0, y: 0 }]}
              />
            )}
            {section === 'armor' && (
              <PartGrid
                options={ARMOR_OPTIONS}
                selectedId={build.armor}
                onSelect={(id) => setBuild({ ...build, armor: id })}
                renderSprite={() => null}
                renderLayers={(o) => [{ sprite: makeArmorSprite(o.id), x: 0, y: 0 }]}
              />
            )}
          </div>

          {/* Footer / callsign + start */}
          <div style={{ padding: 14, borderTop: '2px solid var(--line)', background: 'var(--bg-2)', display: 'flex', alignItems: 'center', gap: 14 }}>
            <span className="silkscreen" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>CALLSIGN</span>
            <input
              value={build.callsign}
              onChange={(e) => setBuild({ ...build, callsign: e.target.value.toUpperCase().slice(0, 14) })}
              style={{
                background: 'var(--bg-0)', border: '1px solid var(--line)', color: 'var(--ink)',
                padding: '6px 10px', fontFamily: 'inherit', fontSize: 18, letterSpacing: '0.06em',
                width: 200,
              }}
            />
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 16, color: 'var(--ink-dim)' }}>
              {weapon.desc}
            </span>
            <PixelButton onClick={onStart}>ROLL OUT →</PixelButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function PartGrid({ options, selectedId, onSelect, renderSprite, renderLayers }) {
  return (
    <div style={{ display: 'grid', gridTemplateColumns: 'repeat(auto-fill, minmax(160px, 1fr))', gap: 12 }}>
      {options.map(o => (
        <PartCard
          key={o.id}
          sprite={renderSprite ? renderSprite(o) : null}
          layers={renderLayers ? renderLayers(o) : null}
          name={o.name}
          stats={o.stats}
          selected={selectedId === o.id}
          onClick={() => onSelect(o.id)}
        />
      ))}
    </div>
  );
}

// Generated icon sprites for engine/armor parts (small 12x10)
function makeEngineSprite(id) {
  const map = {
    diesel: [
      "............",
      "...MMMMMM...",
      "..MmmmmmmM..",
      ".MmLrrrrLmM.",
      ".MmLroorLmM.",
      ".MmLrrrrLmM.",
      "..MmmmmmmM..",
      "...MMMMMM...",
      ".....k......",
      "............",
    ],
    nitro: [
      "...........",
      "...aaaaa...",
      "..aAAAAAa..",
      ".aAoooooAa.",
      ".aAoOOOoAa.",
      ".aAoooooAa.",
      "..aAAAAAa..",
      "...aaaaa...",
      "....aaa....",
      "............",
    ],
    hybrid: [
      "............",
      "...sssss....",
      "..sSSSSSs...",
      ".sSaaaaaSs..",
      ".sSaAAAaSs..",
      ".sSaaaaaSs..",
      "..sSSSSSs...",
      "...sssss....",
      ".....k......",
      "............",
    ],
  };
  return map[id];
}

function makeArmorSprite(id) {
  const map = {
    bone: [
      "............",
      "...wwwwww...",
      "..wWWWWWWw..",
      ".wW8wwww8Ww.",
      ".wWwk88kwWw.",
      ".wW8wwww8Ww.",
      "..wWWWWWWw..",
      "...wwwwww...",
      "............",
      "............",
    ],
    scrap: [
      "............",
      "..MmmmmmmM..",
      ".MmLLLLLLmM.",
      ".MmLrrRrLmM.",
      ".MmLrRRRrmM.",
      ".MmLrRrrLmM.",
      ".MmLLLLLLmM.",
      "..MmmmmmmM..",
      "............",
      "............",
    ],
    ceramic: [
      "............",
      "...88888....",
      "..8wwwww8...",
      ".8w99999w8..",
      ".8w9wkw9w8..",
      ".8w99999w8..",
      "..8wwwww8...",
      "...88888....",
      "............",
      "............",
    ],
  };
  return map[id];
}

window.GarageScreen = GarageScreen;
window.CHASSIS_OPTIONS = CHASSIS_OPTIONS;
window.WEAPON_OPTIONS = WEAPON_OPTIONS;
window.ENGINE_OPTIONS = ENGINE_OPTIONS;
window.ARMOR_OPTIONS = ARMOR_OPTIONS;
