// Combat — side-view 1D chase. Auto-resolved based on vehicle stats.
// Camera scrolls right with the player. Enemies appear ahead/behind and try
// to close range to shoot or ram. No direct player input over moves; only
// pace + retreat controls.

const COMBAT_W = 960;
const COMBAT_H = 320;

// ──────────────────────────────────────────────────────────────────────
// Side-view vehicle drawing — parametric so 6 vehicles share the same code.
// All cars face RIGHT. (px, py) is top-left of the bounding box; scale = "pixel" size.
// ──────────────────────────────────────────────────────────────────────

const CAR_CONFIGS = {
  scout: {
    bodyLen: 22, bodyTop: 4, bodyH: 4,
    cabin: { x: 7, w: 7, h: 3 }, hood: 4,
    body: '#c45a1c', dark: '#7a2c0e', light: '#e8762a',
    cabinDark: '#3a2014', glass: '#6a8aa0',
    wheels: [4, 16], wheelR: 3,
    spoiler: { x: 21, y: 4, w: 3, h: 1 },
  },
  runner: {
    bodyLen: 28, bodyTop: 3, bodyH: 5,
    cabin: { x: 8, w: 9, h: 4 }, hood: 6,
    body: '#a85020', dark: '#5e2810', light: '#e8762a',
    cabinDark: '#3a2014', glass: '#6a8aa0',
    wheels: [4, 22], wheelR: 4,
    bullbar: true,
  },
  hauler: {
    bodyLen: 36, bodyTop: 2, bodyH: 7,
    cabin: { x: 4, w: 10, h: 5 }, hood: 4,
    body: '#8a4018', dark: '#3a1d0a', light: '#c45a1c',
    cabinDark: '#2a1408', glass: '#6a8aa0',
    wheels: [4, 20, 32], wheelR: 4,
    trailer: { x: 16, w: 22, top: 1, h: 7 },
    armored: true,
  },
  raider: {
    bodyLen: 24, bodyTop: 3, bodyH: 5,
    cabin: { x: 8, w: 7, h: 3 }, hood: 4,
    body: '#7a2c0e', dark: '#3a1408', light: '#c45a1c',
    cabinDark: '#1a0a04', glass: '#3a4a5a',
    wheels: [4, 18], wheelR: 4,
    spikes: true,
  },
  scraprig: {
    bodyLen: 30, bodyTop: 2, bodyH: 6,
    cabin: { x: 6, w: 10, h: 5 }, hood: 5,
    body: '#7a2c0e', dark: '#3a1408', light: '#a4232a',
    cabinDark: '#1a0a04', glass: '#3a4a5a',
    wheels: [4, 16, 26], wheelR: 4,
    junkTop: true, spikes: true,
  },
  juggernaut: {
    bodyLen: 44, bodyTop: 1, bodyH: 9,
    cabin: { x: 4, w: 12, h: 7 }, hood: 4,
    body: '#5a1818', dark: '#1a0808', light: '#a4232a',
    cabinDark: '#0a0404', glass: '#3a1a1a',
    wheels: [5, 18, 30, 40], wheelR: 5,
    armored: true, plates: true, ramFront: true,
  },
};

function drawSideCar(ctx, ox, oy, scale, kind, flash) {
  const cfg = CAR_CONFIGS[kind];
  if (!cfg) return;
  const px = (x, y, w, h, color) => {
    ctx.fillStyle = color;
    ctx.fillRect(ox + x * scale, oy + y * scale, w * scale, h * scale);
  };

  // shadow under car
  ctx.fillStyle = 'rgba(0,0,0,0.45)';
  ctx.fillRect(ox + 3 * scale, oy + (cfg.bodyTop + cfg.bodyH + 5) * scale, (cfg.bodyLen - 4) * scale, 2 * scale);

  // Wheels (drawn first, behind body)
  for (const wx of cfg.wheels) {
    const wy = cfg.bodyTop + cfg.bodyH;
    px(wx, wy, cfg.wheelR + 1, cfg.wheelR + 1, '#1a0808');
    px(wx + 1, wy + 1, cfg.wheelR - 1, cfg.wheelR - 1, '#3a3a40');
    px(wx + 1, wy + 1, 1, 1, '#7a7a80');
  }

  // Trailer (hauler only)
  if (cfg.trailer) {
    const t = cfg.trailer;
    px(t.x, t.top, t.w, t.h, cfg.dark);
    px(t.x, t.top, t.w, 1, cfg.light);
    px(t.x + 2, t.top + 1, t.w - 4, t.h - 2, '#4a2810');
    // slats
    for (let i = 2; i < t.w - 2; i += 3) {
      px(t.x + i, t.top + 1, 1, t.h - 2, cfg.dark);
    }
  }

  // Body
  px(2, cfg.bodyTop, cfg.bodyLen, cfg.bodyH, cfg.body);
  // body top hightlight
  px(2, cfg.bodyTop, cfg.bodyLen, 1, cfg.light);
  // body bottom shadow
  px(2, cfg.bodyTop + cfg.bodyH - 1, cfg.bodyLen, 1, cfg.dark);
  // rust streaks
  for (let i = 0; i < cfg.bodyLen; i += 5) {
    px(3 + i, cfg.bodyTop + 1, 1, cfg.bodyH - 2, cfg.dark);
  }

  // Cabin
  const cy = cfg.bodyTop - cfg.cabin.h;
  px(cfg.cabin.x, cy, cfg.cabin.w, cfg.cabin.h, cfg.cabinDark);
  // windows
  if (!cfg.armored) {
    px(cfg.cabin.x + 1, cy + 1, cfg.cabin.w - 2, cfg.cabin.h - 1, cfg.glass);
    // window divider
    px(cfg.cabin.x + Math.floor(cfg.cabin.w / 2), cy + 1, 1, cfg.cabin.h - 1, cfg.cabinDark);
  } else {
    // armored slit
    px(cfg.cabin.x + 1, cy + Math.floor(cfg.cabin.h / 2), cfg.cabin.w - 2, 1, cfg.glass);
    // rivets
    for (let i = 1; i < cfg.cabin.w - 1; i += 2) {
      px(cfg.cabin.x + i, cy, 1, 1, cfg.light);
    }
  }

  // Spikes
  if (cfg.spikes) {
    for (let i = 0; i < 4; i++) {
      const sx = 4 + i * 5;
      px(sx, cfg.bodyTop - 1, 1, 1, cfg.dark);
    }
  }
  // Junk pile
  if (cfg.junkTop) {
    px(cfg.cabin.x + cfg.cabin.w + 1, cy + 1, 3, 2, '#5b5b62');
    px(cfg.cabin.x + cfg.cabin.w + 5, cy + 2, 2, 2, '#7a7a80');
    px(cfg.cabin.x + cfg.cabin.w + 2, cy - 1, 1, 2, '#3a3a40'); // antenna
  }
  // Spoiler (scout)
  if (cfg.spoiler) {
    const s = cfg.spoiler;
    px(s.x, cy + 1, 1, 2, cfg.dark);
    px(s.x, cy, s.w, 1, cfg.dark);
  }
  // Bull bar (runner)
  if (cfg.bullbar) {
    px(cfg.bodyLen + 1, cfg.bodyTop + 1, 1, cfg.bodyH - 1, cfg.dark);
    px(cfg.bodyLen + 1, cfg.bodyTop + 2, 2, 1, cfg.dark);
  }
  // Ram front (juggernaut)
  if (cfg.ramFront) {
    for (let i = 0; i < cfg.bodyH; i++) {
      px(cfg.bodyLen + 1 + (i % 2), cfg.bodyTop + i, 1, 1, cfg.light);
    }
    px(cfg.bodyLen + 2, cfg.bodyTop + 1, 1, cfg.bodyH - 2, cfg.dark);
  }
  // Plates (juggernaut)
  if (cfg.plates) {
    for (let i = 0; i < cfg.bodyLen; i += 4) {
      px(2 + i, cfg.bodyTop + 2, 1, 1, cfg.light);
      px(2 + i, cfg.bodyTop + cfg.bodyH - 3, 1, 1, cfg.light);
    }
  }

  // Damage flash overlay
  if (flash > 0) {
    ctx.fillStyle = `rgba(255, 240, 200, ${Math.min(0.7, flash)})`;
    ctx.fillRect(ox, oy, (cfg.bodyLen + 6) * scale, (cfg.bodyTop + cfg.bodyH + cfg.wheelR + 4) * scale);
  }
}

function carWidth(kind) {
  const c = CAR_CONFIGS[kind];
  return c ? (c.bodyLen + 6) * 3 : 100;
}

// ──────────────────────────────────────────────────────────────────────
// Vehicle behaviour configs — sim parameters per kind
// ──────────────────────────────────────────────────────────────────────

const SIM_CONFIG = {
  scout:      { maxSpeed: 220, accel: 180, weight: 1, ramDmg: 1 },
  runner:     { maxSpeed: 195, accel: 160, weight: 2, ramDmg: 2 },
  hauler:     { maxSpeed: 165, accel: 120, weight: 4, ramDmg: 4 },
  raider:     { maxSpeed: 205, accel: 170, weight: 1, ramDmg: 1, behavior: 'shoot' },
  scraprig:   { maxSpeed: 175, accel: 140, weight: 2, ramDmg: 2, behavior: 'shoot' },
  juggernaut: { maxSpeed: 150, accel: 100, weight: 5, ramDmg: 6, behavior: 'ram' },
};

// ──────────────────────────────────────────────────────────────────────
// CombatScreen — auto-resolves the engagement
// ──────────────────────────────────────────────────────────────────────

function CombatScreen({ runState, build, encounter, onVictory, onDefeat }) {
  const chassis = CHASSIS_OPTIONS.find(c => c.id === build.chassis);
  const weapon  = WEAPON_OPTIONS.find(w => w.id === build.weapon);
  const engine  = ENGINE_OPTIONS.find(e => e.id === build.engine);
  const armor   = ARMOR_OPTIONS.find(a => a.id === build.armor);

  const playerStats = useMemo(() => {
    const simC = SIM_CONFIG[chassis.id];
    return {
      maxSpeed: simC.maxSpeed + engine.stats.MOV * 18,
      accel:    simC.accel + engine.stats.MOV * 12,
      weight:   simC.weight,
      ramDmg:   simC.ramDmg + (armor.id === 'scrap' ? 1 : 0),
      hp:       runState.hp,
      maxHp:    runState.maxHp,
      armor:    chassis.stats.ARM + armor.stats.ARM,
      weapon: {
        kind:    weapon.id,
        dmg:     weapon.stats.DMG,
        range:   weapon.stats.RNG * 60,
        cooldown: weapon.id === 'autocannon' ? 0.55 : weapon.id === 'flamer' ? 0.35 : weapon.id === 'mortar' ? 1.6 : weapon.id === 'harpoon' ? 1.0 : 0.8,
        color:   weapon.id === 'flamer' ? '#e8762a' : weapon.id === 'mortar' ? '#f59a3a' : weapon.id === 'harpoon' ? '#e9d7a5' : '#f4e1b3',
      },
    };
  }, [build, runState]);

  const [outcome, setOutcome] = useState(null);
  const [paused, setPaused] = useState(false);
  const [simSpeed, setSimSpeed] = useState(1);
  const [logLines, setLogLines] = useState([
    `// engagement initiated. ${encounter.enemies.length} hostiles spotted.`,
    `// callsign ${build.callsign} — ${chassis.name}-class rig, ${weapon.name.toLowerCase()} armed.`,
  ]);
  const [uiTick, setUiTick] = useState(0); // forces re-render of sidebar

  const canvasRef = useRef(null);
  const stateRef  = useRef(null);
  const animRef   = useRef(null);
  const lastTimeRef = useRef(performance.now());

  // build initial sim state
  if (!stateRef.current) {
    const enemies = encounter.enemies.map((e, i) => {
      const def = ENEMY_DEFS[e.kind];
      const simC = SIM_CONFIG[e.kind];
      return {
        id: 'e' + i, kind: e.kind, name: def.name,
        x: 220 + i * 70 + (i % 2 === 0 ? 0 : 20),
        speed: 70 + Math.random() * 30,
        maxSpeed: simC.maxSpeed,
        accel: simC.accel,
        weight: simC.weight,
        ramDmg: simC.ramDmg,
        behavior: simC.behavior,
        hp: def.hp, maxHp: def.hp, armor: def.armor,
        cd: 0.4 + Math.random() * 0.6,
        weapon: {
          kind: e.kind === 'juggernaut' ? 'cannon' : (e.kind === 'scraprig' ? 'shotgun' : 'rifle'),
          dmg: def.dmg, range: def.rng * 60,
          cooldown: simC.behavior === 'ram' ? 2.0 : (e.kind === 'scraprig' ? 1.2 : 0.9),
          color: '#d83a30',
        },
        flash: 0, burn: 0, burnT: 0,
      };
    });
    stateRef.current = {
      player: {
        id: 'p', kind: chassis.id, name: build.callsign,
        x: 0, speed: 80,
        maxSpeed: playerStats.maxSpeed, accel: playerStats.accel,
        weight: playerStats.weight, ramDmg: playerStats.ramDmg,
        hp: playerStats.hp, maxHp: playerStats.maxHp, armor: playerStats.armor,
        weapon: playerStats.weapon, cd: 0.3,
        flash: 0, burn: 0, burnT: 0,
      },
      enemies,
      tracers: [], floaters: [], particles: [],
      camera: { x: -300 },
      roadScroll: 0, bgScroll: 0,
      elapsed: 0,
    };
  }

  useEffect(() => {
    const onTick = (now) => {
      const rawDt = Math.min(0.04, (now - lastTimeRef.current) / 1000);
      lastTimeRef.current = now;
      const dt = rawDt * (paused ? 0 : simSpeed);

      const st = stateRef.current;
      if (st && !outcome && !paused) {
        simStep(st, dt, (line) => setLogLines(l => [...l, line].slice(-14)));
        if (st.player.hp <= 0) {
          setOutcome('defeat');
          setTimeout(() => onDefeat(), 1600);
        } else if (st.enemies.length === 0) {
          setOutcome('victory');
          setTimeout(() => onVictory({
            playerHp: Math.max(1, Math.floor(st.player.hp)),
            weapon: weapon.id, encounter: encounter.nodeType,
          }), 1600);
        }
      }
      if (st && canvasRef.current) drawScene(canvasRef.current, st);
      // periodic UI sync
      if (Math.floor(now / 80) !== Math.floor(lastTimeRef.uiAt || 0)) {
        lastTimeRef.uiAt = Math.floor(now / 80);
        setUiTick(t => (t + 1) % 1000000);
      }
      animRef.current = requestAnimationFrame(onTick);
    };
    animRef.current = requestAnimationFrame(onTick);
    return () => cancelAnimationFrame(animRef.current);
  }, [paused, simSpeed, outcome]);

  const retreat = () => {
    setOutcome('retreat');
    setTimeout(() => onVictory({ playerHp: Math.max(1, Math.floor(stateRef.current.player.hp - 3)), weapon: weapon.id, encounter: encounter.nodeType, retreated: true }), 900);
  };

  const st = stateRef.current;

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14, position: 'relative' }}>
      <Dust />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 className="silkscreen" style={{ fontSize: 22, margin: 0, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>ENGAGEMENT</h1>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>
          // {NODE_TYPES[encounter.nodeType].label.toLowerCase()} · {outcome ? outcome.toUpperCase() : (paused ? 'PAUSED' : 'IN PROGRESS')}
        </span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>{build.callsign}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 290px', gap: 14 }}>
        <Panel title="HIGHWAY" subtitle={`// auto-resolving · sim ${simSpeed.toFixed(1)}×`}>
          <div style={{ flex: 1, position: 'relative', background: '#0a0604', overflow: 'hidden', display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
            <canvas
              ref={canvasRef}
              width={COMBAT_W} height={COMBAT_H}
              style={{ width: '100%', height: '100%', imageRendering: 'pixelated', display: 'block' }}
            />
            {/* speed gauge overlay */}
            <div style={{ position: 'absolute', top: 10, left: 14, fontFamily: '"Silkscreen", monospace', fontSize: 11, color: 'var(--rust-bright)', letterSpacing: '0.08em', textShadow: '2px 2px 0 #000' }}>
              SPEED  {st ? Math.floor(st.player.speed) : 0} <span style={{ color: 'var(--ink-dim)' }}>/ {Math.floor(playerStats.maxSpeed)}</span>
            </div>
            <div style={{ position: 'absolute', top: 10, right: 14, fontFamily: '"Silkscreen", monospace', fontSize: 11, color: 'var(--rust-bright)', letterSpacing: '0.08em', textShadow: '2px 2px 0 #000' }}>
              DIST  {st ? Math.floor(st.player.x) : 0}m
            </div>
          </div>
          {/* Action bar */}
          <div style={{ padding: 12, borderTop: '2px solid var(--line)', background: 'var(--bg-2)', display: 'flex', gap: 10, alignItems: 'center' }}>
            <PixelButton active={paused} small onClick={() => setPaused(p => !p)}>{paused ? '▶ RESUME' : '⏸ PAUSE'}</PixelButton>
            <PixelButton active={simSpeed === 1} small onClick={() => setSimSpeed(1)}>1×</PixelButton>
            <PixelButton active={simSpeed === 2} small onClick={() => setSimSpeed(2)}>2×</PixelButton>
            <PixelButton active={simSpeed === 4} small onClick={() => setSimSpeed(4)}>4×</PixelButton>
            <div style={{ flex: 1 }} />
            <span style={{ fontSize: 15, color: 'var(--ink-faint)' }}>
              auto-combat resolves by stats · no direct control
            </span>
            <PixelButton small danger onClick={retreat} disabled={!!outcome}>↶ RETREAT</PixelButton>
          </div>
        </Panel>

        <Panel title="STATUS">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, overflow: 'auto', flex: 1 }}>
            <div className="silkscreen" style={{ fontSize: 11, color: 'var(--rust-bright)' }}>YOU — {build.callsign}</div>
            {st && <>
              <StatBar label="HULL"  value={Math.max(0, Math.floor(st.player.hp))} max={st.player.maxHp} color="var(--blood)" width={170} />
              <StatBar label="SPEED" value={Math.floor(st.player.speed)} max={Math.floor(playerStats.maxSpeed)} color="var(--rust)" width={170} />
              <div style={{ fontSize: 15, color: 'var(--ink-dim)' }}>
                ARM <span style={{ color: 'var(--ink)' }}>{st.player.armor}</span> ·
                RAM <span style={{ color: 'var(--ink)' }}>{st.player.ramDmg}</span> ·
                WPN <span style={{ color: 'var(--ink)' }}>{weapon.name}</span>
              </div>
            </>}

            <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', width: '100%', margin: '6px 0' }} />
            <div className="silkscreen" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>HOSTILES — {st ? st.enemies.length : 0}</div>
            {st && st.enemies.map(e => {
              const dx = e.x - st.player.x;
              return (
                <div key={e.id} style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 15 }}>
                  <div style={{ width: 40, height: 24, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
                    <MiniCarPreview kind={e.kind} />
                  </div>
                  <div style={{ flex: 1, minWidth: 0 }}>
                    <div style={{ color: 'var(--ink)', display: 'flex', justifyContent: 'space-between' }}>
                      <span>{e.name}</span>
                      <span style={{ color: 'var(--ink-faint)', fontSize: 13 }}>
                        {dx > 0 ? '→' : '←'}{Math.abs(Math.floor(dx))}m
                      </span>
                    </div>
                    <div style={{ display: 'flex', height: 5, background: 'var(--bg-0)', border: '1px solid var(--line)' }}>
                      <div style={{ width: `${(e.hp / e.maxHp) * 100}%`, background: '#a4232a' }} />
                    </div>
                  </div>
                </div>
              );
            })}

            <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', width: '100%', margin: '6px 0' }} />
            <div className="silkscreen" style={{ fontSize: 11, color: 'var(--ink-dim)' }}>RADIO CHATTER</div>
            <div style={{ display: 'flex', flexDirection: 'column', gap: 2, maxHeight: 220, overflow: 'auto' }}>
              {logLines.slice().reverse().map((l, i) => (
                <div key={i} style={{ fontSize: 14, color: i === 0 ? 'var(--ink)' : 'var(--ink-dim)' }}>{l}</div>
              ))}
            </div>
          </div>
        </Panel>
      </div>

      {outcome && (
        <div style={{ position: 'absolute', inset: 0, background: 'rgba(10,6,4,0.78)', display: 'flex', alignItems: 'center', justifyContent: 'center', zIndex: 30 }}>
          <div style={{ background: 'var(--bg-1)', border: `3px solid ${outcome === 'victory' || outcome === 'retreat' ? 'var(--rust-bright)' : 'var(--blood)'}`, padding: '32px 56px', textAlign: 'center' }}>
            <div className="silkscreen" style={{ fontSize: 32, color: outcome === 'victory' ? 'var(--rust-bright)' : outcome === 'retreat' ? 'var(--bone)' : 'var(--blood)', letterSpacing: '0.15em' }}>
              {outcome === 'victory' ? 'WRECKED ‘EM' : outcome === 'retreat' ? 'BROKE OFF' : 'YOU BURNED'}
            </div>
            <div style={{ fontSize: 18, color: 'var(--ink-dim)', marginTop: 8 }}>
              {outcome === 'victory' ? 'the dust settles. the convoy rolls on.' : outcome === 'retreat' ? 'engine still warm. another road, another day.' : 'the carrion birds circle low.'}
            </div>
          </div>
        </div>
      )}
    </div>
  );
}

function MiniCarPreview({ kind }) {
  const ref = useRef(null);
  useEffect(() => {
    const c = ref.current;
    if (!c) return;
    const ctx = c.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, c.width, c.height);
    drawSideCar(ctx, 0, 2, 1, kind, 0);
  }, [kind]);
  return <canvas ref={ref} width={50} height={20} style={{ imageRendering: 'pixelated' }} />;
}

// ──────────────────────────────────────────────────────────────────────
// SIM
// ──────────────────────────────────────────────────────────────────────

function lerp(a, b, t) { return a + (b - a) * Math.min(1, Math.max(0, t)); }

function simStep(state, dt, logFn) {
  if (dt <= 0) return;
  state.elapsed += dt;
  const { player, enemies } = state;

  // ── Player AI: chase nearest, hold range, shoot when ready ──
  // dx > 0 → target is ahead (accelerate to close)
  // dx < 0 → target is behind (decelerate so they close)
  if (enemies.length > 0) {
    let nearest = enemies[0];
    for (const e of enemies) if (Math.abs(e.x - player.x) < Math.abs(nearest.x - player.x)) nearest = e;
    const dx = nearest.x - player.x;
    const gap = player.weapon.range * 0.65;
    const adx = Math.abs(dx);
    if (dx > gap) {
      player.speed = Math.min(player.maxSpeed, player.speed + player.accel * dt);
    } else if (dx < -gap) {
      // target behind — slow to let them catch up
      player.speed = Math.max(60, player.speed - player.accel * 0.6 * dt);
    } else if (adx < gap * 0.4) {
      // too close to a forward target: ease off; if it's behind, push forward a bit
      if (dx > 0) player.speed = Math.max(60, player.speed - player.accel * 0.5 * dt);
      else player.speed = Math.min(player.maxSpeed, player.speed + player.accel * 0.4 * dt);
    } else {
      player.speed = lerp(player.speed, nearest.speed, dt * 2);
    }

    player.cd -= dt;
    if (player.cd <= 0 && adx <= player.weapon.range) {
      shoot(state, player, nearest, true, logFn);
      player.cd = player.weapon.cooldown;
    }
  } else {
    player.speed = Math.max(80, player.speed - 40 * dt);
  }

  // ── Enemy AI ──
  // dx = player.x - e.x; dx > 0 → player ahead of me, dx < 0 → player behind me.
  for (const e of enemies) {
    const dx = player.x - e.x;
    const isRammer = e.behavior === 'ram';
    const gap = isRammer ? 6 : (e.weapon.range * 0.6);
    const adx = Math.abs(dx);
    if (dx > gap) {
      // player is ahead — chase (this enemy was overtaken or sniped past)
      e.speed = Math.min(e.maxSpeed, e.speed + e.accel * dt);
    } else if (dx < -gap) {
      // player is behind — slow down so they catch up into engagement range
      e.speed = Math.max(60, e.speed - e.accel * 0.55 * dt);
    } else if (adx < gap * 0.4 && !isRammer) {
      // too close: keep some distance if shooter; if rammer, ignore
      if (dx < 0) e.speed = Math.min(e.maxSpeed, e.speed + e.accel * 0.5 * dt);
      else e.speed = Math.max(60, e.speed - e.accel * 0.5 * dt);
    } else {
      e.speed = lerp(e.speed, player.speed, dt * 2);
    }

    e.cd -= dt;
    if (e.cd <= 0 && adx <= e.weapon.range && !isRammer) {
      shoot(state, e, player, false, logFn);
      e.cd = e.weapon.cooldown;
    }

    // burn ticks
    if (e.burn > 0) {
      e.burnT += dt;
      if (e.burnT >= 1) {
        e.burnT -= 1;
        e.hp -= 1;
        e.flash = 0.6;
        spawnFloat(state, e.x, -25, '-1 fire', '#e8762a');
        e.burn -= 1;
      }
    }
  }

  // Move
  player.x += player.speed * dt;
  for (const e of enemies) e.x += e.speed * dt;

  // Camera follows player (so player sits ~250 px from left of canvas)
  state.camera.x = lerp(state.camera.x, player.x - 280, dt * 3);
  state.roadScroll += player.speed * dt;
  state.bgScroll += player.speed * dt * 0.25;

  // Collisions
  for (const e of enemies) {
    const dx = e.x - player.x;
    const minDist = (carWidth(player.kind) / 3 + carWidth(e.kind) / 3) * 0.35;
    if (Math.abs(dx) < minDist) {
      const relSpeed = Math.abs(e.speed - player.speed);
      let pDmg = Math.max(0, Math.floor(e.ramDmg + relSpeed * 0.025 - player.armor));
      let eDmg = Math.max(0, Math.floor(player.ramDmg + relSpeed * 0.025 - e.armor));
      if (pDmg > 0) {
        player.hp -= pDmg; player.flash = 1;
        spawnFloat(state, player.x, -28, `-${pDmg}`, '#d83a30');
        logFn(`‼ ${e.name} rammed for ${pDmg}.`);
      }
      if (eDmg > 0) {
        e.hp -= eDmg; e.flash = 1;
        spawnFloat(state, e.x, -28, `-${eDmg}`, '#e8762a');
      }
      // separate
      const push = (minDist - Math.abs(dx)) * 0.6 + 1;
      if (player.x < e.x) { player.x -= push * 0.5; e.x += push * 0.5; }
      else { player.x += push * 0.5; e.x -= push * 0.5; }
      // bounce speeds (heavier wins)
      const total = player.weight + e.weight;
      const avg = (player.speed * player.weight + e.speed * e.weight) / total;
      player.speed = lerp(player.speed, avg, 0.5);
      e.speed = lerp(e.speed, avg, 0.5);
      spawnSparks(state, (player.x + e.x) / 2, -10, 12);
    }
  }

  // Flash decay
  player.flash = Math.max(0, player.flash - dt * 3);
  for (const e of enemies) e.flash = Math.max(0, e.flash - dt * 3);

  // Update ephemerals
  state.tracers = state.tracers.filter(t => (t.life -= dt) > 0);
  state.floaters = state.floaters.filter(f => {
    f.life -= dt; f.y -= 35 * dt;
    return f.life > 0;
  });
  state.particles = state.particles.filter(p => {
    p.life -= dt;
    p.x += p.vx * dt; p.y += p.vy * dt; p.vy += 240 * dt;
    return p.life > 0;
  });

  // Remove dead enemies
  const newE = [];
  for (const e of enemies) {
    if (e.hp <= 0) {
      logFn(`✖ ${e.name} wrecked.`);
      spawnSparks(state, e.x, -10, 40, '#e8762a');
      spawnSparks(state, e.x, -10, 30, '#d83a30');
      spawnFloat(state, e.x, -40, 'WRECKED', '#e8762a');
    } else newE.push(e);
  }
  state.enemies = newE;
}

function shoot(state, shooter, target, isPlayer, logFn) {
  const dx = target.x - shooter.x;
  let dmg = Math.max(1, shooter.weapon.dmg - target.armor);
  const kind = shooter.weapon.kind;

  // Tracer (visual)
  state.tracers.push({
    x1: shooter.x + (dx > 0 ? carWidth(shooter.kind) / 6 : -carWidth(shooter.kind) / 6),
    y1: -20,
    x2: target.x,
    y2: -22,
    life: 0.1,
    color: shooter.weapon.color,
    thick: kind === 'mortar' ? 4 : (kind === 'autocannon' ? 2 : kind === 'flamer' ? 5 : 2),
    arc: kind === 'mortar',
  });
  spawnSparks(state, shooter.x + (dx > 0 ? 30 : -30), -22, 3, shooter.weapon.color);

  // Apply effects
  if (kind === 'flamer') {
    target.burn = Math.max(target.burn || 0, 3);
  }
  if (kind === 'harpoon') {
    target.x -= Math.sign(target.x - shooter.x) * 14;
    spawnFloat(state, target.x, -38, 'PULL', '#e9d7a5');
  }
  if (kind === 'mortar') {
    dmg += 1;
    // splash also hits other enemies near target
    if (isPlayer) {
      for (const e of state.enemies) {
        if (e !== target && Math.abs(e.x - target.x) < 40) {
          const splash = Math.max(1, Math.floor(shooter.weapon.dmg * 0.6) - e.armor);
          e.hp -= splash; e.flash = 0.7;
          spawnFloat(state, e.x, -22, `-${splash}`, '#f59a3a');
        }
      }
    }
  }

  target.hp -= dmg;
  target.flash = 1;
  spawnFloat(state, target.x, -28, `-${dmg}`, isPlayer ? '#e8762a' : '#d83a30');
  spawnSparks(state, target.x, -10, 6, isPlayer ? '#e8762a' : '#d83a30');

  if (isPlayer) logFn(`› ${shooter.weapon.kind.toUpperCase()} → ${target.name} ${dmg}.`);
}

function spawnFloat(state, x, y, text, color) {
  state.floaters.push({ x, y, text, color, life: 1.0 });
}
function spawnSparks(state, x, baseY, n, color) {
  const c = color || '#f4e1b3';
  for (let i = 0; i < n; i++) {
    state.particles.push({
      x, y: baseY,
      vx: (Math.random() - 0.5) * 200,
      vy: -Math.random() * 200 - 40,
      life: 0.4 + Math.random() * 0.3,
      color: c,
      size: 1 + Math.floor(Math.random() * 2),
    });
  }
}

// ──────────────────────────────────────────────────────────────────────
// RENDER
// ──────────────────────────────────────────────────────────────────────

function drawScene(canvas, state) {
  const ctx = canvas.getContext('2d');
  ctx.imageSmoothingEnabled = false;
  const W = canvas.width, H = canvas.height;

  // ── Sky
  const grad = ctx.createLinearGradient(0, 0, 0, H * 0.7);
  grad.addColorStop(0, '#1a0c04');
  grad.addColorStop(0.4, '#3a1a08');
  grad.addColorStop(0.8, '#7a3a12');
  grad.addColorStop(1, '#c45a1c');
  ctx.fillStyle = grad;
  ctx.fillRect(0, 0, W, H * 0.72);

  // Sun
  ctx.fillStyle = 'rgba(245, 154, 58, 0.6)';
  ctx.beginPath(); ctx.arc(W * 0.78, H * 0.42, 38, 0, Math.PI * 2); ctx.fill();
  ctx.fillStyle = 'rgba(232, 118, 42, 0.9)';
  ctx.beginPath(); ctx.arc(W * 0.78, H * 0.42, 24, 0, Math.PI * 2); ctx.fill();

  // ── Far mountains (parallax slow)
  drawFarMountains(ctx, W, H, state.bgScroll * 0.3);

  // ── Mid wrecks / mesas
  drawMidLayer(ctx, W, H, state.bgScroll * 0.7);

  // ── Ground
  ctx.fillStyle = '#1a120c';
  ctx.fillRect(0, H * 0.72, W, H * 0.28);
  // sand stripes
  for (let i = 0; i < 12; i++) {
    const y = H * 0.72 + 4 + i * 8;
    const off = ((state.roadScroll * (0.5 + i * 0.08)) % 60);
    ctx.fillStyle = `rgba(184, 154, 106, ${0.05 + (i / 12) * 0.08})`;
    for (let x = -off; x < W; x += 60) {
      ctx.fillRect(x, y, 30, 1);
    }
  }

  // ── Road dashes (centerline)
  const roadY = H * 0.82;
  ctx.strokeStyle = 'rgba(244, 225, 179, 0.18)';
  ctx.lineWidth = 2;
  ctx.setLineDash([24, 18]);
  ctx.lineDashOffset = -((state.roadScroll) % 42);
  ctx.beginPath(); ctx.moveTo(0, roadY + 30); ctx.lineTo(W, roadY + 30); ctx.stroke();
  ctx.setLineDash([]);

  // ── Vehicles
  const baseY = H * 0.82 - 4;
  const cam = state.camera.x;
  const drawCar = (car, isPlayer) => {
    const sx = car.x - cam;
    const cfg = CAR_CONFIGS[car.kind];
    const halfW = cfg ? (cfg.bodyLen + 6) * 3 / 2 : 50;
    if (sx + halfW < -20 || sx - halfW > W + 20) return;
    // tiny vertical jitter
    const jitter = (Math.sin(state.elapsed * 18 + (isPlayer ? 0 : car.x * 0.01)) * 1) | 0;
    drawSideCar(ctx, Math.floor(sx - halfW), Math.floor(baseY - 40 + jitter), 3, car.kind, car.flash);

    // HP bar above
    const barW = (cfg ? cfg.bodyLen : 28) * 1.8;
    const barX = Math.floor(sx - barW / 2);
    const barY = Math.floor(baseY - 56);
    ctx.fillStyle = '#0a0604';
    ctx.fillRect(barX, barY, barW, 4);
    ctx.fillStyle = isPlayer ? '#e8762a' : '#a4232a';
    ctx.fillRect(barX, barY, barW * Math.max(0, car.hp / car.maxHp), 4);
    ctx.strokeStyle = '#0a0604';
    ctx.lineWidth = 1;
    ctx.strokeRect(barX - 0.5, barY - 0.5, barW + 1, 5);

    // Name tag
    if (isPlayer) {
      ctx.fillStyle = '#e8762a';
      ctx.font = '11px "Silkscreen", monospace';
      ctx.textAlign = 'center';
      ctx.fillText(car.name, sx, barY - 4);
    }
    // Burn flame
    if (car.burn > 0) {
      const f = (state.elapsed * 12) % 1;
      ctx.fillStyle = `rgba(232, 118, 42, ${0.7 - f * 0.4})`;
      ctx.fillRect(sx - halfW + 4, baseY - 50 - f * 6, 4, 4);
      ctx.fillStyle = `rgba(245, 154, 58, ${0.5})`;
      ctx.fillRect(sx + halfW - 8, baseY - 48 - (1 - f) * 6, 3, 3);
    }
    // Smoke trail behind
    if ((state.elapsed * 30 + car.x * 0.1) % 5 < 1) {
      ctx.fillStyle = 'rgba(160,140,110,0.2)';
      ctx.fillRect(sx - halfW - 6, baseY - 14, 4, 4);
    }
  };
  drawCar(state.player, true);
  for (const e of state.enemies) drawCar(e, false);

  // ── Tracers
  for (const t of state.tracers) {
    const sx1 = t.x1 - cam, sx2 = t.x2 - cam;
    const sy = baseY - 30;
    ctx.strokeStyle = t.color;
    ctx.lineWidth = t.thick;
    ctx.beginPath();
    if (t.arc) {
      const mx = (sx1 + sx2) / 2;
      ctx.moveTo(sx1, sy);
      ctx.quadraticCurveTo(mx, sy - 40, sx2, sy);
    } else {
      ctx.moveTo(sx1, sy);
      ctx.lineTo(sx2, sy);
    }
    ctx.stroke();
  }

  // ── Particles
  for (const p of state.particles) {
    const sx = p.x - cam;
    ctx.fillStyle = p.color;
    ctx.fillRect(sx, baseY - 30 + p.y, p.size, p.size);
  }

  // ── Floaters
  ctx.font = 'bold 14px "VT323", monospace';
  ctx.textAlign = 'center';
  for (const f of state.floaters) {
    const sx = f.x - cam;
    ctx.fillStyle = '#0a0604';
    ctx.fillText(f.text, sx + 1, baseY - 60 + f.y + 1);
    ctx.fillStyle = f.color;
    ctx.fillText(f.text, sx, baseY - 60 + f.y);
  }

  // ── Speed lines on player at high speed
  const ps = state.player.speed;
  if (ps > 140) {
    const sx = state.player.x - cam;
    const intensity = (ps - 140) / 250;
    ctx.strokeStyle = `rgba(232, 118, 42, ${intensity * 0.45})`;
    ctx.lineWidth = 1;
    for (let i = 0; i < 6; i++) {
      const y = baseY - 28 + (i - 3) * 5;
      const len = 30 + intensity * 60 + Math.random() * 10;
      ctx.beginPath(); ctx.moveTo(sx - 25, y); ctx.lineTo(sx - 25 - len, y); ctx.stroke();
    }
  }

  // ── Vignette
  const vg = ctx.createRadialGradient(W/2, H/2, H * 0.4, W/2, H/2, H * 0.85);
  vg.addColorStop(0, 'rgba(0,0,0,0)');
  vg.addColorStop(1, 'rgba(0,0,0,0.55)');
  ctx.fillStyle = vg;
  ctx.fillRect(0, 0, W, H);
}

function drawFarMountains(ctx, W, H, scroll) {
  ctx.fillStyle = '#2a1408';
  const baseY = H * 0.62;
  const off = scroll % 200;
  ctx.beginPath();
  ctx.moveTo(-off - 100, baseY);
  for (let x = -off - 100, i = 0; x < W + 200; x += 50, i++) {
    const h = 30 + ((i * 37) % 50);
    ctx.lineTo(x + 25, baseY - h);
    ctx.lineTo(x + 50, baseY);
  }
  ctx.lineTo(W + 200, H * 0.72);
  ctx.lineTo(-100, H * 0.72);
  ctx.closePath();
  ctx.fill();
}

function drawMidLayer(ctx, W, H, scroll) {
  // a few wreck silhouettes
  ctx.fillStyle = '#1a0c04';
  const baseY = H * 0.72;
  const off = scroll % 400;
  const wrecks = [
    { x: 80,  w: 30, h: 14 },
    { x: 240, w: 18, h: 8 },
    { x: 380, w: 40, h: 20 },
    { x: 520, w: 22, h: 10 },
    { x: 700, w: 34, h: 16 },
    { x: 860, w: 16, h: 6 },
  ];
  for (const wr of wrecks) {
    const x = ((wr.x - off) % (W + 400) + W + 400) % (W + 400) - 100;
    ctx.fillRect(x, baseY - wr.h, wr.w, wr.h);
    // antenna
    ctx.fillRect(x + Math.floor(wr.w / 2), baseY - wr.h - 4, 1, 4);
  }
}

// keep these for compatibility with the rest of the app
function makeEncounter(nodeType, seed = 1) {
  let s = seed; const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  let enemies = [];
  if (nodeType === 'fight') {
    const n = 2 + Math.floor(rand() * 2);
    for (let i = 0; i < n; i++) enemies.push(rand() < 0.7 ? 'raider' : 'scraprig');
  } else if (nodeType === 'elite') {
    enemies = ['scraprig', 'scraprig', 'raider'];
  } else if (nodeType === 'boss') {
    enemies = ['juggernaut', 'scraprig', 'raider', 'raider'];
  }
  return enemies.map((id, i) => ({ uid: 'e' + i, kind: id, ...ENEMY_DEFS[id] }));
}
function makeObstacles() { return []; }

const ENEMY_DEFS = {
  raider:     { name: 'Raider Buggy', sprite: 'raider',     hp: 6,  mov: 3, dmg: 2, rng: 4, armor: 0 },
  scraprig:   { name: 'Scrap Rig',    sprite: 'scraprig',   hp: 10, mov: 2, dmg: 3, rng: 3, armor: 1 },
  juggernaut: { name: 'Juggernaut',   sprite: 'juggernaut', hp: 22, mov: 2, dmg: 5, rng: 3, armor: 3 },
};

window.ENEMY_DEFS = ENEMY_DEFS;
window.makeEncounter = makeEncounter;
window.makeObstacles = makeObstacles;
