// Wasteland map — node-based path picker

const NODE_TYPES = {
  fight: { label: 'RAIDERS',   icon: 'fight', color: 'var(--blood)' },
  elite: { label: 'WARLORD',   icon: 'elite', color: 'var(--rust-bright)' },
  scrap: { label: 'SCRAPYARD', icon: 'scrap', color: 'var(--bone)' },
  event: { label: 'WANDERER',  icon: 'event', color: 'var(--acid)' },
  boss:  { label: 'OIL BARON', icon: 'boss',  color: 'var(--blood)' },
};

// Generate a layered node graph. Columns left→right, each with N nodes.
function generateMap(seed = 1) {
  let s = seed;
  const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
  const cols = 6;
  const layout = [];
  for (let c = 0; c < cols; c++) {
    let count;
    if (c === 0) count = 1;
    else if (c === cols - 1) count = 1;
    else count = 2 + Math.floor(rand() * 2); // 2-3
    const nodes = [];
    for (let i = 0; i < count; i++) {
      let type;
      if (c === 0) type = 'fight';
      else if (c === cols - 1) type = 'boss';
      else {
        const r = rand();
        if (c >= 3 && r < 0.25) type = 'elite';
        else if (r < 0.45) type = 'fight';
        else if (r < 0.70) type = 'scrap';
        else if (r < 0.88) type = 'fight';
        else type = 'event';
      }
      nodes.push({ id: `c${c}n${i}`, col: c, row: i, type, count });
    }
    layout.push(nodes);
  }
  // Edges: each non-last column connects to 1-2 nodes in next column
  const edges = [];
  for (let c = 0; c < cols - 1; c++) {
    for (const n of layout[c]) {
      const next = layout[c + 1];
      const options = [...next.keys()];
      // sort by row-distance
      options.sort((a, b) => Math.abs(next[a].row / Math.max(1, next.length - 1) - n.row / Math.max(1, layout[c].length - 1))
                          - Math.abs(next[b].row / Math.max(1, next.length - 1) - n.row / Math.max(1, layout[c].length - 1)));
      const k = 1 + Math.floor(rand() * 2);
      for (let j = 0; j < Math.min(k, options.length); j++) {
        edges.push({ from: n.id, to: next[options[j]].id });
      }
    }
    // ensure every next-col node has at least one incoming
    for (const m of layout[c + 1]) {
      if (!edges.find(e => e.to === m.id)) {
        const from = layout[c][Math.floor(rand() * layout[c].length)];
        edges.push({ from: from.id, to: m.id });
      }
    }
  }
  return { cols: layout, edges };
}

function nodePos(node, totalCols, W, H) {
  const x = 70 + (W - 140) * (node.col / (totalCols - 1));
  const count = node.count;
  let yFrac;
  if (count === 1) yFrac = 0.5;
  else yFrac = 0.18 + (0.64) * (node.row / (count - 1));
  const y = 60 + (H - 120) * yFrac;
  return { x, y };
}

function MapScreen({ runState, onPickNode, build, onReturnGarage }) {
  const map = runState.map;
  const flatNodes = useMemo(() => map.cols.flat(), [map]);
  const allowedIds = useMemo(() => {
    if (!runState.currentNodeId) {
      return map.cols[0].map(n => n.id);
    }
    return map.edges.filter(e => e.from === runState.currentNodeId).map(e => e.to);
  }, [runState.currentNodeId, map]);

  const containerRef = useRef(null);
  const [size, setSize] = useState({ w: 1000, h: 500 });
  useEffect(() => {
    const update = () => {
      if (!containerRef.current) return;
      const r = containerRef.current.getBoundingClientRect();
      setSize({ w: r.width, h: r.height });
    };
    update();
    window.addEventListener('resize', update);
    return () => window.removeEventListener('resize', update);
  }, []);

  return (
    <div style={{ height: '100%', width: '100%', display: 'flex', flexDirection: 'column', padding: 20, gap: 14, position: 'relative' }}>
      <Dust />
      <div style={{ display: 'flex', alignItems: 'baseline', gap: 16 }}>
        <h1 className="silkscreen" style={{ fontSize: 22, margin: 0, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>THE WASTELAND</h1>
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>// chart a route. nothing west but oil and bone.</span>
        <div style={{ flex: 1 }} />
        <span style={{ fontSize: 18, color: 'var(--ink-dim)' }}>HULL {runState.hp}/{runState.maxHp} · FUEL {runState.fuel}/{runState.maxFuel} · SCRAP {runState.scrap}</span>
      </div>

      <div style={{ flex: 1, minHeight: 0, display: 'grid', gridTemplateColumns: '1fr 280px', gap: 14 }}>
        <Panel title="ROUTE MAP" subtitle={`// sector ${runState.day}`}>
          <div ref={containerRef} style={{
            flex: 1, position: 'relative',
            background: 'radial-gradient(ellipse at 50% 50%, #2a1c10 0%, #14100a 80%)',
            overflow: 'hidden',
          }}>
            {/* terrain decals */}
            <TerrainBackdrop seed={runState.runNum * 17 + runState.day} />

            {/* SVG edges */}
            <svg width={size.w} height={size.h} style={{ position: 'absolute', inset: 0, pointerEvents: 'none' }}>
              {map.edges.map((e, i) => {
                const a = flatNodes.find(n => n.id === e.from);
                const b = flatNodes.find(n => n.id === e.to);
                if (!a || !b) return null;
                const pa = nodePos(a, map.cols.length, size.w, size.h);
                const pb = nodePos(b, map.cols.length, size.w, size.h);
                const isPath = runState.visited.includes(e.from) && runState.visited.includes(e.to);
                const isReachable = e.from === runState.currentNodeId && allowedIds.includes(e.to);
                const color = isPath ? 'var(--rust-bright)' : (isReachable ? 'var(--rust)' : 'var(--line)');
                // dashed line drawn as series of small rects
                return <DashedLine key={i} x1={pa.x} y1={pa.y} x2={pb.x} y2={pb.y} color={color} bright={isPath || isReachable} />;
              })}
            </svg>

            {/* nodes */}
            {flatNodes.map(n => {
              const p = nodePos(n, map.cols.length, size.w, size.h);
              const visited = runState.visited.includes(n.id);
              const isCurrent = runState.currentNodeId === n.id;
              const reachable = !runState.currentNodeId ? n.col === 0 : allowedIds.includes(n.id);
              const meta = NODE_TYPES[n.type];
              return (
                <MapNode
                  key={n.id}
                  x={p.x} y={p.y}
                  node={n}
                  visited={visited}
                  current={isCurrent}
                  reachable={reachable}
                  onClick={() => reachable && onPickNode(n)}
                />
              );
            })}

            {/* legend */}
            <div style={{ position: 'absolute', left: 12, bottom: 12, background: 'rgba(10,6,4,0.7)', border: '1px solid var(--line)', padding: 8, fontSize: 15, color: 'var(--ink-dim)', display: 'flex', flexDirection: 'column', gap: 2 }}>
              {Object.entries(NODE_TYPES).map(([id, t]) => (
                <div key={id} style={{ display: 'flex', alignItems: 'center', gap: 6 }}>
                  <span style={{ display: 'inline-block', width: 10, height: 10, background: t.color, border: '1px solid var(--bg-0)' }} />
                  <span style={{ width: 90, color: 'var(--ink)' }}>{t.label}</span>
                  <span>{nodeBlurb(id)}</span>
                </div>
              ))}
            </div>
          </div>
        </Panel>

        <Panel title="LOGBOOK">
          <div style={{ padding: 14, display: 'flex', flexDirection: 'column', gap: 10, flex: 1, overflow: 'auto' }}>
            <div className="silkscreen" style={{ fontSize: 11, color: 'var(--rust-bright)' }}>{build.callsign} — RUN {runState.runNum}</div>
            <div style={{ fontSize: 16, color: 'var(--ink-dim)', lineHeight: 1.3 }}>
              The convoy split at the bone arch. {runState.events.length === 0 ? 'No engagements yet.' : `${runState.events.length} entries logged.`}
            </div>
            <hr style={{ border: 'none', borderTop: '1px dashed var(--line)', width: '100%' }} />
            <div style={{ display: 'flex', flexDirection: 'column', gap: 6 }}>
              {runState.events.length === 0 && (
                <div style={{ color: 'var(--ink-faint)', fontStyle: 'italic' }}>// no log entries //</div>
              )}
              {runState.events.slice().reverse().map((e, i) => (
                <div key={i} style={{ fontSize: 15, color: 'var(--ink-dim)' }}>
                  <span style={{ color: 'var(--rust)' }}>›</span> {e}
                </div>
              ))}
            </div>
            <div style={{ flex: 1 }} />
            <PixelButton wide small onClick={onReturnGarage}>↩ BACK TO GARAGE</PixelButton>
          </div>
        </Panel>
      </div>
    </div>
  );
}

function nodeBlurb(id) {
  return ({
    fight: 'standard scrap',
    elite: '+rewards, hard',
    scrap: 'repair / upgrade',
    event: 'choice; risk',
    boss: 'end of sector',
  })[id];
}

function DashedLine({ x1, y1, x2, y2, color, bright }) {
  const dx = x2 - x1, dy = y2 - y1;
  const len = Math.sqrt(dx*dx + dy*dy);
  const steps = Math.floor(len / 8);
  const dots = [];
  for (let i = 0; i <= steps; i++) {
    const t = i / steps;
    const x = x1 + dx * t, y = y1 + dy * t;
    dots.push(<rect key={i} x={x - 1.5} y={y - 1.5} width={3} height={3} fill={color} opacity={bright ? 1 : 0.5} />);
  }
  return <g>{dots}</g>;
}

function MapNode({ x, y, node, visited, current, reachable, onClick }) {
  const meta = NODE_TYPES[node.type];
  const size = node.type === 'boss' ? 56 : 44;
  return (
    <div
      onClick={onClick}
      className="noselect"
      style={{
        position: 'absolute',
        left: x - size/2, top: y - size/2,
        width: size, height: size,
        cursor: reachable ? 'pointer' : 'default',
        opacity: visited && !current ? 0.4 : 1,
        filter: reachable ? 'none' : (visited ? 'none' : 'grayscale(0.5)'),
      }}
    >
      <div style={{
        position: 'absolute', inset: 0,
        background: 'var(--bg-1)',
        border: `2px solid ${current ? 'var(--rust-bright)' : (reachable ? meta.color : 'var(--line)')}`,
        boxShadow: reachable ? `0 0 0 1px ${meta.color}, 0 0 14px ${meta.color}66` : 'none',
        display: 'flex', alignItems: 'center', justifyContent: 'center',
        animation: reachable && !current ? 'wrPulse 1.6s ease-in-out infinite' : 'none',
      }}>
        <PixelCanvas sprite={Sprites.ICONS[meta.icon]} scale={2} />
      </div>
      <div style={{
        position: 'absolute', top: '100%', left: '50%', transform: 'translateX(-50%)',
        marginTop: 4, whiteSpace: 'nowrap',
        fontFamily: '"Silkscreen", monospace', fontSize: 10, letterSpacing: '0.06em',
        color: current ? 'var(--rust-bright)' : (reachable ? 'var(--ink)' : 'var(--ink-faint)'),
        textShadow: '1px 1px 0 var(--bg-0)',
      }}>{meta.label}</div>
      {current && (
        <div style={{
          position: 'absolute', bottom: '100%', left: '50%', transform: 'translateX(-50%)',
          marginBottom: 4, fontSize: 16, color: 'var(--rust-bright)',
        }}>▼</div>
      )}
      <style>{`@keyframes wrPulse { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.06); } }`}</style>
    </div>
  );
}

function TerrainBackdrop({ seed }) {
  // a handful of scattered rock/wreck/barrel tiles drawn as decor
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    canvas.width = canvas.clientWidth;
    canvas.height = canvas.clientHeight;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    let s = seed;
    const rand = () => { s = (s * 9301 + 49297) % 233280; return s / 233280; };
    // base sand
    const w = canvas.width, h = canvas.height;
    const tileScale = 3;
    const tileW = 16 * tileScale;
    for (let y = 0; y < h; y += tileW) {
      for (let x = 0; x < w; x += tileW) {
        if (rand() < 0.18) {
          const t = Sprites.TILES.sand[Math.floor(rand() * Sprites.TILES.sand.length)];
          Sprites.drawSprite(ctx, t, x, y, tileScale);
        }
      }
    }
    // wrecks / rocks scattered
    for (let i = 0; i < 8; i++) {
      const x = Math.floor(rand() * (w - 80));
      const y = Math.floor(rand() * (h - 80));
      const pick = rand();
      const sprite = pick < 0.4 ? Sprites.TILES.rock : (pick < 0.75 ? Sprites.TILES.wreck : Sprites.TILES.barrel);
      Sprites.drawSprite(ctx, sprite, x, y, tileScale);
    }
  }, [seed]);
  return <canvas ref={ref} style={{ position: 'absolute', inset: 0, width: '100%', height: '100%', opacity: 0.18 }} />;
}

window.MapScreen = MapScreen;
window.generateMap = generateMap;
window.NODE_TYPES = NODE_TYPES;
