// Main game state machine + non-combat encounter screens

const DEFAULT_BUILD = {
  callsign: 'BONESAW',
  chassis: 'runner',
  weapon: 'autocannon',
  engine: 'diesel',
  armor: 'scrap',
};

const TWEAK_DEFAULTS = /*EDITMODE-BEGIN*/{
  "palette": "rust",
  "pixelScale": 1.0,
  "difficulty": "normal",
  "showScanlines": true
}/*EDITMODE-END*/;

function App() {
  const [tweaks, setTweak] = useTweaks(TWEAK_DEFAULTS);
  const [screen, setScreen] = useState('title'); // title | garage | map | combat | event | scrap | gameover
  const [build, setBuild] = useState(DEFAULT_BUILD);
  const [runState, setRunState] = useState(() => makeNewRun());
  const [pendingEncounter, setPendingEncounter] = useState(null);

  function makeNewRun() {
    return {
      runNum: 1,
      day: 1,
      hp: 18, maxHp: 18,
      fuel: 12, maxFuel: 12,
      scrap: 3,
      map: generateMap(Math.floor(Math.random() * 9999) + 1),
      currentNodeId: null,
      visited: [],
      events: [],
    };
  }

  const startNewRun = () => {
    const chassis = CHASSIS_OPTIONS.find(c => c.id === build.chassis);
    const armor = ARMOR_OPTIONS.find(a => a.id === build.armor);
    const engine = ENGINE_OPTIONS.find(e => e.id === build.engine);
    const totalHp = chassis.stats.HP + armor.stats.HP;
    setRunState(s => ({
      ...s,
      hp: totalHp, maxHp: totalHp,
      fuel: engine.stats.FUEL, maxFuel: engine.stats.FUEL,
    }));
    setScreen('map');
  };

  const onPickNode = (node) => {
    const visited = [...runState.visited, node.id];
    const newState = { ...runState, currentNodeId: node.id, visited };
    setRunState(newState);
    if (node.type === 'fight' || node.type === 'elite' || node.type === 'boss') {
      const seed = (runState.runNum * 31 + node.col * 7 + node.row * 3) | 0;
      const enemies = makeEncounter(node.type, seed);
      const obstacles = makeObstacles(seed);
      setPendingEncounter({ nodeType: node.type, enemies, obstacles, nodeId: node.id });
      setScreen('combat');
    } else if (node.type === 'scrap') {
      setScreen('scrap');
    } else if (node.type === 'event') {
      setScreen('event');
    }
  };

  const onVictory = (result) => {
    const isBoss = pendingEncounter.nodeType === 'boss';
    const scrapReward = pendingEncounter.nodeType === 'elite' ? 5 : (isBoss ? 10 : 3);
    setRunState(s => ({
      ...s,
      hp: Math.max(1, result.playerHp),
      scrap: s.scrap + scrapReward,
      events: [...s.events, `Wrecked ${pendingEncounter.enemies.length} hostiles at ${NODE_TYPES[pendingEncounter.nodeType].label}. +${scrapReward} scrap.`],
    }));
    setPendingEncounter(null);
    if (isBoss) setScreen('gameover-win');
    else setScreen('map');
  };

  const onDefeat = () => {
    setRunState(s => ({ ...s, hp: 0, events: [...s.events, `KIA at ${NODE_TYPES[pendingEncounter.nodeType].label}.`] }));
    setPendingEncounter(null);
    setScreen('gameover-lose');
  };

  const onScrapComplete = (effects) => {
    setRunState(s => {
      let hp = s.hp, maxHp = s.maxHp, scrap = s.scrap;
      const events = [...s.events];
      if (effects.repair) { hp = Math.min(maxHp, hp + effects.repair); scrap -= effects.cost; events.push(`Repaired ${effects.repair} hull (-${effects.cost} scrap).`); }
      if (effects.maxHp) { maxHp += effects.maxHp; hp += effects.maxHp; scrap -= effects.cost; events.push(`Upgraded chassis +${effects.maxHp} max HP.`); }
      return { ...s, hp, maxHp, scrap, events };
    });
    setScreen('map');
  };

  const onEventComplete = (effects) => {
    setRunState(s => {
      let hp = s.hp, scrap = s.scrap;
      const events = [...s.events];
      if (effects.hp) hp = Math.max(0, Math.min(s.maxHp, hp + effects.hp));
      if (effects.scrap) scrap = Math.max(0, scrap + effects.scrap);
      events.push(effects.log);
      return { ...s, hp, scrap, events };
    });
    setScreen('map');
  };

  // global background
  const paletteVar = tweaks.palette;
  const themeStyle = useMemo(() => {
    if (paletteVar === 'cold') {
      return { '--rust': '#3a7a9a', '--rust-bright': '#5aaecf', '--ink-dim': '#9ab0c0', '--bone': '#cfe2e8', '--bg-0': '#070a0e', '--bg-1': '#0c131a', '--bg-2': '#101a23', '--bg-3': '#172530', '--line': '#1f3340' };
    }
    if (paletteVar === 'toxic') {
      return { '--rust': '#7a9a3a', '--rust-bright': '#b6c43a', '--ink-dim': '#a0b070', '--bone': '#d8e090', '--bg-0': '#080a04', '--bg-1': '#0e120a', '--bg-2': '#141a0e', '--bg-3': '#1c2614', '--line': '#2a3618' };
    }
    return {}; // default rust
  }, [paletteVar]);

  return (
    <div className={tweaks.showScanlines ? 'scanlines' : ''} style={{ position: 'relative', height: '100%', width: '100%', ...themeStyle }} data-screen-label={screen}>
      {screen === 'title' && <TitleScreen onStart={() => setScreen('garage')} />}
      {screen === 'garage' && (
        <GarageScreen
          build={build} setBuild={setBuild}
          onStart={startNewRun}
          runState={runState}
        />
      )}
      {screen === 'map' && (
        <MapScreen
          runState={runState}
          build={build}
          onPickNode={onPickNode}
          onReturnGarage={() => setScreen('garage')}
        />
      )}
      {screen === 'combat' && pendingEncounter && (
        <CombatScreen
          runState={runState}
          build={build}
          encounter={pendingEncounter}
          onVictory={onVictory}
          onDefeat={onDefeat}
        />
      )}
      {screen === 'scrap' && (
        <ScrapScreen runState={runState} build={build} onComplete={onScrapComplete} />
      )}
      {screen === 'event' && (
        <EventScreen runState={runState} build={build} onComplete={onEventComplete} seed={Date.now() % 1000} />
      )}
      {screen === 'gameover-win' && <EndScreen win runState={runState} onRetry={() => { setRunState(makeNewRun()); setScreen('garage'); }} />}
      {screen === 'gameover-lose' && <EndScreen win={false} runState={runState} onRetry={() => { setRunState(makeNewRun()); setScreen('garage'); }} />}

      <TweaksPanel title="TWEAKS">
        <TweakSection label="WORLD">
          <TweakRadio label="Palette" value={tweaks.palette} onChange={(v) => setTweak('palette', v)} options={[
            { value: 'rust', label: 'Rust' },
            { value: 'cold', label: 'Cold' },
            { value: 'toxic', label: 'Toxic' },
          ]} />
          <TweakToggle label="Scanlines" value={tweaks.showScanlines} onChange={(v) => setTweak('showScanlines', v)} />
        </TweakSection>
        <TweakSection label="DIFFICULTY">
          <TweakRadio label="Mode" value={tweaks.difficulty} onChange={(v) => setTweak('difficulty', v)} options={[
            { value: 'easy', label: 'Easy' },
            { value: 'normal', label: 'Normal' },
            { value: 'hard', label: 'Hard' },
          ]} />
        </TweakSection>
        <TweakSection label="JUMP TO">
          <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
            <TweakButton label="Title" onClick={() => setScreen('title')} />
            <TweakButton label="Garage" onClick={() => setScreen('garage')} />
            <TweakButton label="New Map" onClick={() => { setRunState(makeNewRun()); setScreen('map'); }} />
            <TweakButton label="Combat" onClick={() => {
              const enemies = makeEncounter('fight', Date.now() % 1000);
              setPendingEncounter({ nodeType: 'fight', enemies, obstacles: makeObstacles(Date.now() % 1000), nodeId: 'tweak' });
              setScreen('combat');
            }} />
          </div>
        </TweakSection>
      </TweaksPanel>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// TITLE
// ─────────────────────────────────────────────────────────────────────

function TitleScreen({ onStart }) {
  return (
    <div style={{
      height: '100%', width: '100%', position: 'relative',
      display: 'flex', alignItems: 'center', justifyContent: 'center',
      flexDirection: 'column', gap: 30,
      background: 'radial-gradient(ellipse at 50% 70%, #3a1a08 0%, #1a0c04 50%, #060402 100%)',
      overflow: 'hidden',
    }} data-screen-label="title">
      <Dust />
      <TitleHorizon />
      <div style={{ position: 'relative', textAlign: 'center', zIndex: 2 }}>
        <div className="silkscreen" style={{ fontSize: 14, color: 'var(--ink-dim)', letterSpacing: '0.4em', marginBottom: 16 }}>
          ── A TACTICAL WASTELAND ROGUELIKE ──
        </div>
        <h1 className="silkscreen" style={{
          fontSize: 78, margin: 0, letterSpacing: '0.06em',
          color: 'var(--rust-bright)', lineHeight: 0.95,
          textShadow: '4px 4px 0 var(--bg-0), 8px 8px 0 var(--blood)',
        }}>
          WASTELAND<br />RUNNERS
        </h1>
        <div style={{ fontSize: 22, color: 'var(--ink-dim)', marginTop: 18, maxWidth: 540, textAlign: 'center' }}>
          Weld a rig. Pick a road. Outlive the dust.
        </div>
      </div>
      <div style={{ display: 'flex', gap: 14, zIndex: 2 }}>
        <PixelButton onClick={onStart}>▶ NEW RUN</PixelButton>
        <PixelButton onClick={onStart}>HOW TO DRIVE</PixelButton>
      </div>
      <div style={{ position: 'absolute', bottom: 14, left: 14, fontSize: 14, color: 'var(--ink-faint)' }}>
        v0.1 — PROTOTYPE BUILD · {new Date().toISOString().slice(0,10)}
      </div>
      <div style={{ position: 'absolute', bottom: 14, right: 14, fontSize: 14, color: 'var(--ink-faint)' }}>
        toggle TWEAKS in the toolbar for palette + jumps
      </div>
    </div>
  );
}

function TitleHorizon() {
  // big chassis silhouette + horizon
  return (
    <div style={{ position: 'absolute', inset: 0, zIndex: 1, pointerEvents: 'none' }}>
      <div style={{ position: 'absolute', left: 0, right: 0, top: '55%', height: 2, background: 'linear-gradient(to right, transparent, var(--rust) 40%, var(--rust-bright) 50%, var(--rust) 60%, transparent)' }} />
      <div style={{ position: 'absolute', left: 0, right: 0, top: '56%', bottom: 0, background: 'repeating-linear-gradient(to right, transparent 0 32px, rgba(184,154,106,0.08) 32px 38px)' }} />
      <div style={{ position: 'absolute', left: '50%', top: '50%', transform: 'translate(-50%, -50%) translateY(80px)' }}>
        <PixelCanvas sprite={Sprites.CHASSIS.hauler} scale={14} style={{ opacity: 0.5 }} />
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// SCRAP YARD
// ─────────────────────────────────────────────────────────────────────

function ScrapScreen({ runState, build, onComplete }) {
  const repairAmt = 5;
  const repairCost = 2;
  const upgradeCost = 4;
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14, position: 'relative' }}>
      <Dust />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 className="silkscreen" style={{ fontSize: 22, margin: 0, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>SCRAPYARD</h1>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>// rust merchants. patch up. trade scrap.</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 1fr 1fr', gap: 14 }}>
        <Panel title="REPAIR HULL" subtitle="// quick patch">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <PixelCanvas sprite={Sprites.ICONS.scrap} scale={6} />
            <div style={{ fontSize: 18, color: 'var(--ink-dim)', textAlign: 'center' }}>
              Restore <span style={{ color: 'var(--rust-bright)' }}>+{repairAmt} HULL</span><br />
              for <span style={{ color: 'var(--rust-bright)' }}>{repairCost} SCRAP</span>
            </div>
            <PixelButton onClick={() => onComplete({ repair: repairAmt, cost: repairCost })} disabled={runState.scrap < repairCost || runState.hp >= runState.maxHp}>
              {runState.hp >= runState.maxHp ? 'HULL FULL' : 'BANG ON IT'}
            </PixelButton>
          </div>
        </Panel>
        <Panel title="WELD PLATING" subtitle="// permanent">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <PixelCanvas sprite={Sprites.TILES.wreck.slice(2, 14)} scale={3} />
            <div style={{ fontSize: 18, color: 'var(--ink-dim)', textAlign: 'center' }}>
              <span style={{ color: 'var(--rust-bright)' }}>+3 MAX HULL</span><br />
              for <span style={{ color: 'var(--rust-bright)' }}>{upgradeCost} SCRAP</span>
            </div>
            <PixelButton onClick={() => onComplete({ maxHp: 3, cost: upgradeCost })} disabled={runState.scrap < upgradeCost}>WELD ON</PixelButton>
          </div>
        </Panel>
        <Panel title="LEAVE" subtitle="// move out">
          <div style={{ padding: 20, display: 'flex', flexDirection: 'column', gap: 12, alignItems: 'center' }}>
            <div style={{ fontSize: 18, color: 'var(--ink-dim)', textAlign: 'center' }}>
              Hit the road empty-handed.<br />Save your scrap for the boss.
            </div>
            <div style={{ flex: 1 }} />
            <PixelButton onClick={() => onComplete({})}>ROLL OUT →</PixelButton>
          </div>
        </Panel>
      </div>
      <div style={{ fontSize: 18, color: 'var(--ink-dim)' }}>
        HULL {runState.hp}/{runState.maxHp} · SCRAP {runState.scrap}
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// EVENT
// ─────────────────────────────────────────────────────────────────────

const EVENTS = [
  {
    title: 'A LIMPING WANDERER',
    body: 'A figure shambles out of the heat-haze, dragging a bundle. "Water. Just water," they rasp.',
    choices: [
      { label: 'GIVE WATER (-1 scrap)', effects: { scrap: -1, hp: 0, log: 'Gave water to a wanderer. They blessed your axles.' } },
      { label: 'DRIVE PAST', effects: { scrap: 0, hp: 0, log: 'Left the wanderer to the dust.' } },
      { label: 'TAKE THEIR BUNDLE', effects: { scrap: 2, hp: -2, log: 'Took the wanderer\'s bundle. They cursed you. Hull lost 2 in the scuffle.' } },
    ],
  },
  {
    title: 'A BURIED CACHE',
    body: 'Half-buried in the dunes — a hatch, hinges rusted but readable. Spray-paint: "DO NOT".',
    choices: [
      { label: 'PRY IT OPEN', effects: { scrap: 4, hp: -3, log: 'Cracked the cache. +4 scrap. A trap took 3 HP.' } },
      { label: 'CRACK IT CAREFULLY', effects: { scrap: 2, hp: 0, log: 'Pried it slow. +2 scrap.' } },
      { label: 'LEAVE IT BURIED', effects: { scrap: 0, hp: 1, log: 'Walked away. The dust takes its share.' } },
    ],
  },
  {
    title: 'A CONVOY OFFER',
    body: 'Three rigs roll alongside, hailing on the same band. Their windsock is bone-white. "Ride with us to the next outpost?"',
    choices: [
      { label: 'CONVOY UP (+2 HP, -1 fuel)', effects: { scrap: -1, hp: 2, log: 'Rode with the white-sock convoy. Got patched up.' } },
      { label: 'BREAK OFF', effects: { scrap: 0, hp: 0, log: 'Broke off from the convoy. The wasteland is wide.' } },
    ],
  },
];

function EventScreen({ runState, build, onComplete, seed }) {
  const ev = EVENTS[seed % EVENTS.length];
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14, position: 'relative' }}>
      <Dust />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 className="silkscreen" style={{ fontSize: 22, margin: 0, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>WAYPOINT</h1>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>// something on the road ahead</span>
      </div>
      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '320px 1fr', gap: 14 }}>
        <Panel title="SIGHTING">
          <div style={{ padding: 18, display: 'flex', flexDirection: 'column', alignItems: 'center', gap: 12 }}>
            <PixelCanvas sprite={Sprites.ICONS.event} scale={8} />
            <div className="silkscreen" style={{ fontSize: 13, color: 'var(--rust-bright)', letterSpacing: '0.08em', textAlign: 'center' }}>{ev.title}</div>
          </div>
        </Panel>
        <Panel title="LOG ENTRY" subtitle={`// scrap ${runState.scrap} · hull ${runState.hp}/${runState.maxHp}`}>
          <div style={{ padding: 24, fontSize: 20, color: 'var(--ink)', lineHeight: 1.4 }}>
            "{ev.body}"
          </div>
          <div style={{ flex: 1 }} />
          <div style={{ padding: 18, borderTop: '2px solid var(--line)', background: 'var(--bg-2)', display: 'flex', flexDirection: 'column', gap: 8 }}>
            {ev.choices.map((c, i) => (
              <PixelButton key={i} wide onClick={() => onComplete(c.effects)}
                disabled={c.effects.scrap < 0 && runState.scrap + c.effects.scrap < 0}>
                {c.label}
              </PixelButton>
            ))}
          </div>
        </Panel>
      </div>
    </div>
  );
}

// ─────────────────────────────────────────────────────────────────────
// END SCREEN
// ─────────────────────────────────────────────────────────────────────

function EndScreen({ win, runState, onRetry }) {
  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', alignItems: 'center', justifyContent: 'center', flexDirection: 'column', gap: 24, position: 'relative', background: 'radial-gradient(ellipse at 50% 50%, #1a0c04 0%, #060402 100%)' }}>
      <Dust />
      <h1 className="silkscreen" style={{ fontSize: 64, margin: 0, color: win ? 'var(--rust-bright)' : 'var(--blood)', letterSpacing: '0.1em', textShadow: '4px 4px 0 var(--bg-0)' }}>
        {win ? 'THE BARON FALLS' : 'BURIED IN DUST'}
      </h1>
      <div style={{ fontSize: 20, color: 'var(--ink-dim)', maxWidth: 560, textAlign: 'center' }}>
        {win
          ? 'You crested the dune at dusk. The Oil Baron\'s rig burned for three days. The crows ate well.'
          : 'Your engine seized at noon. The crows did not wait long.'}
      </div>
      <div style={{ display: 'flex', gap: 14 }}>
        <div style={{ fontSize: 16, color: 'var(--ink)', textAlign: 'center' }}>
          ENCOUNTERS: {runState.visited.length} · SCRAP: {runState.scrap}
        </div>
      </div>
      <PixelButton onClick={onRetry}>{win ? 'NEW RUN ▶' : 'TRY AGAIN ▶'}</PixelButton>
    </div>
  );
}

// Boot
ReactDOM.createRoot(document.getElementById('root')).render(<App />);
