// Shared UI primitives for Wasteland Runners
const { useEffect, useRef, useState, useMemo, useCallback } = React;

// PixelCanvas: renders a sprite (array of strings) onto a canvas at the given scale.
function PixelCanvas({ sprite, scale = 4, palette, style, className, onClick, layers }) {
  const ref = useRef(null);
  useEffect(() => {
    const canvas = ref.current;
    if (!canvas) return;
    const ctx = canvas.getContext('2d');
    ctx.imageSmoothingEnabled = false;
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    if (sprite) Sprites.drawSprite(ctx, sprite, 0, 0, scale, palette);
    if (layers) {
      for (const l of layers) {
        if (!l || !l.sprite) continue;
        Sprites.drawSprite(ctx, l.sprite, (l.x || 0) * scale, (l.y || 0) * scale, scale, palette);
      }
    }
  }, [sprite, scale, palette, layers]);

  const base = sprite || (layers && layers[0] && layers[0].sprite);
  const sz = base ? Sprites.spriteSize(base) : { w: 0, h: 0 };
  return (
    <canvas
      ref={ref}
      width={sz.w * scale}
      height={sz.h * scale}
      onClick={onClick}
      className={className}
      style={{ imageRendering: 'pixelated', ...style }}
    />
  );
}

// PixelButton: rusted metal button style.
function PixelButton({ children, onClick, disabled, active, danger, wide, small }) {
  const bg = active ? 'var(--rust)' : (danger ? 'var(--blood)' : 'var(--bg-2)');
  const fg = active ? 'var(--bg-0)' : 'var(--ink)';
  const border = active ? 'var(--rust-bright)' : (danger ? 'var(--blood)' : 'var(--line)');
  return (
    <button
      className="silkscreen noselect"
      onClick={onClick}
      disabled={disabled}
      style={{
        background: bg,
        color: fg,
        border: `2px solid ${border}`,
        borderRadius: 0,
        padding: small ? '6px 10px' : '10px 18px',
        fontSize: small ? 11 : 13,
        cursor: disabled ? 'not-allowed' : 'pointer',
        opacity: disabled ? 0.4 : 1,
        boxShadow: active ? `inset 0 0 0 2px var(--bg-1), 3px 3px 0 var(--bg-0)` : `3px 3px 0 var(--bg-0)`,
        transition: 'transform 60ms ease, box-shadow 60ms ease',
        width: wide ? '100%' : 'auto',
        textTransform: 'uppercase',
        letterSpacing: '0.08em',
      }}
      onMouseDown={(e) => { e.currentTarget.style.transform = 'translate(2px, 2px)'; e.currentTarget.style.boxShadow = '1px 1px 0 var(--bg-0)'; }}
      onMouseUp={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 var(--bg-0)'; }}
      onMouseLeave={(e) => { e.currentTarget.style.transform = ''; e.currentTarget.style.boxShadow = '3px 3px 0 var(--bg-0)'; }}
    >{children}</button>
  );
}

// Bordered panel with rusty corners.
function Panel({ title, subtitle, children, style, flex }) {
  return (
    <div style={{
      background: 'var(--bg-1)',
      border: '2px solid var(--line)',
      position: 'relative',
      display: 'flex',
      flexDirection: 'column',
      ...(flex ? { flex } : {}),
      ...style,
    }}>
      {/* corner bolts */}
      <CornerBolt pos="tl" /><CornerBolt pos="tr" /><CornerBolt pos="bl" /><CornerBolt pos="br" />
      {title && (
        <div style={{
          padding: '8px 14px 6px',
          borderBottom: '2px solid var(--line)',
          background: 'var(--bg-2)',
          display: 'flex',
          alignItems: 'baseline',
          gap: 10,
        }}>
          <span className="silkscreen" style={{ fontSize: 12, color: 'var(--rust-bright)', letterSpacing: '0.1em' }}>
            {title}
          </span>
          {subtitle && <span style={{ fontSize: 16, color: 'var(--ink-dim)' }}>{subtitle}</span>}
        </div>
      )}
      <div style={{ flex: 1, minHeight: 0, display: 'flex', flexDirection: 'column' }}>
        {children}
      </div>
    </div>
  );
}

function CornerBolt({ pos }) {
  const map = { tl: { top: -3, left: -3 }, tr: { top: -3, right: -3 }, bl: { bottom: -3, left: -3 }, br: { bottom: -3, right: -3 } };
  return <div style={{ position: 'absolute', width: 6, height: 6, background: 'var(--rust)', border: '1px solid var(--bg-0)', ...map[pos] }} />;
}

// Stat bar (HP, fuel, armor)
function StatBar({ label, value, max, color, width = 180 }) {
  const pct = Math.max(0, Math.min(1, value / max));
  return (
    <div style={{ display: 'flex', alignItems: 'center', gap: 8, fontSize: 18 }}>
      <span style={{ color: 'var(--ink-dim)', width: 56, fontSize: 11, fontFamily: '"Silkscreen", monospace', letterSpacing: '0.06em' }}>{label}</span>
      <div style={{
        position: 'relative', width, height: 14,
        background: 'var(--bg-0)',
        border: '1px solid var(--line)',
      }}>
        <div style={{
          position: 'absolute', inset: 1, width: `calc(${pct * 100}% - 2px)`,
          background: color,
          boxShadow: `inset 0 -2px 0 rgba(0,0,0,0.35)`,
        }} />
        <div style={{
          position: 'absolute', inset: 0, display: 'flex', alignItems: 'center', justifyContent: 'center',
          fontSize: 14, color: 'var(--ink)', textShadow: '1px 1px 0 var(--bg-0)',
        }}>{value}/{max}</div>
      </div>
    </div>
  );
}

// Choice card for parts
function PartCard({ sprite, layers, name, stats, selected, onClick, locked, palette }) {
  return (
    <div
      onClick={locked ? null : onClick}
      className="noselect"
      style={{
        background: selected ? 'var(--bg-3)' : 'var(--bg-2)',
        border: `2px solid ${selected ? 'var(--rust-bright)' : 'var(--line)'}`,
        padding: 10,
        cursor: locked ? 'not-allowed' : 'pointer',
        display: 'flex',
        flexDirection: 'column',
        alignItems: 'center',
        gap: 6,
        position: 'relative',
        opacity: locked ? 0.4 : 1,
        boxShadow: selected ? '0 0 0 1px var(--rust-bright), 3px 3px 0 var(--bg-0)' : '3px 3px 0 var(--bg-0)',
        transition: 'transform 80ms ease',
        minWidth: 140,
      }}
    >
      <div style={{ height: 60, display: 'flex', alignItems: 'center', justifyContent: 'center' }}>
        <PixelCanvas sprite={sprite} layers={layers} scale={3} palette={palette} />
      </div>
      <div className="silkscreen" style={{ fontSize: 11, color: selected ? 'var(--rust-bright)' : 'var(--ink)', letterSpacing: '0.06em' }}>
        {name.toUpperCase()}
      </div>
      <div style={{ display: 'flex', flexWrap: 'wrap', justifyContent: 'center', gap: '2px 8px', fontSize: 14, color: 'var(--ink-dim)' }}>
        {Object.entries(stats).map(([k, v]) => (
          <span key={k}>{k} <span style={{ color: 'var(--ink)' }}>{v > 0 ? `+${v}` : v}</span></span>
        ))}
      </div>
      {locked && <div style={{ position: 'absolute', top: 4, right: 4, fontSize: 14, color: 'var(--blood)' }}>LOCKED</div>}
    </div>
  );
}

// dust/wind background ambience — a few drifting horizontal lines
function Dust() {
  return (
    <div style={{ position: 'absolute', inset: 0, pointerEvents: 'none', overflow: 'hidden' }}>
      {Array.from({ length: 14 }).map((_, i) => {
        const top = (i * 73) % 100;
        const dur = 8 + (i % 5) * 2;
        return (
          <div key={i} style={{
            position: 'absolute',
            top: `${top}%`,
            left: '-20%',
            width: '40%',
            height: 1,
            background: 'linear-gradient(to right, transparent, rgba(244,225,179,0.06), transparent)',
            animation: `wrDust ${dur}s linear ${i * 0.7}s infinite`,
          }} />
        );
      })}
      <style>{`@keyframes wrDust { 0% { transform: translateX(0); } 100% { transform: translateX(400%); } }`}</style>
    </div>
  );
}

Object.assign(window, { PixelCanvas, PixelButton, Panel, StatBar, PartCard, Dust });
