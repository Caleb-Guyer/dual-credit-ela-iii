import { useEffect, useRef, useState } from 'react';
import { ConcordWorld, hotspots, type Hotspot } from './scene';
import { clueBearing, nearestClue, spawns } from './navigation';
import ConcordArt from './Art';
export { hotspots } from './scene';

export type WorldProps = {
  act: number;
  collected: string[];
  paused: boolean;
  reduced: boolean;
  onInspect: (id: string) => void;
  onNear?: (label: string | null) => void;
  onReady?: (ready: boolean) => void;
  onPosition?: (x: number, z: number, yaw: number) => void;
  preview?: boolean;
};

export default function World(props: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const worldRef = useRef<ConcordWorld | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [near, setNear] = useState<Hotspot | null>(null);
  const [error, setError] = useState(false);
  const [position, setPosition] = useState(() => spawns[props.act] ?? spawns[0]);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(false);
    setNear(null);
    setPosition(spawns[props.act] ?? spawns[0]);
    const lost = (event: Event) => {
      event.preventDefault();
      setError(true);
      propsRef.current.onReady?.(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    try {
      const world = new ConcordWorld(
        canvas,
        props.act,
        !!props.preview,
        () => propsRef.current,
        (point) => {
          setNear(point);
          propsRef.current.onNear?.(point?.label ?? null);
        },
        (x, z, yaw) => {
          setPosition({ x, z, yaw });
          propsRef.current.onPosition?.(x, z, yaw);
        },
      );
      worldRef.current = world;
      propsRef.current.onReady?.(true);
    } catch (cause) {
      console.warn('Concord 3D could not initialize; showing the accessible scene.', cause);
      setError(true);
      propsRef.current.onReady?.(false);
    }
    const down = (e: KeyboardEvent) => {
      if (
        propsRef.current.paused ||
        propsRef.current.preview ||
        e.ctrlKey ||
        e.metaKey ||
        e.altKey ||
        /INPUT|TEXTAREA|SELECT/.test((e.target as HTMLElement)?.tagName) ||
        (e.target as HTMLElement)?.isContentEditable
      )
        return;
      if (
        [
          'KeyW',
          'KeyA',
          'KeyS',
          'KeyD',
          'ArrowUp',
          'ArrowDown',
          'ArrowLeft',
          'ArrowRight',
          'ShiftLeft',
          'ShiftRight',
          'KeyE',
          'KeyQ',
          'KeyR',
          'PageUp',
          'PageDown',
        ].includes(e.code)
      )
        e.preventDefault();
      if (
        e.code === 'KeyE' &&
        !e.repeat &&
        worldRef.current?.near &&
        !propsRef.current.collected.includes(worldRef.current.near.id)
      )
        propsRef.current.onInspect(worldRef.current.near.id);
      else worldRef.current?.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => worldRef.current?.keys.delete(e.code);
    const clear = () => worldRef.current?.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      worldRef.current?.dispose();
      worldRef.current = null;
    };
  }, [props.act, props.preview]);
  useEffect(() => {
    if (props.paused) {
      worldRef.current?.keys.clear();
      drag.current = null;
    } else if (!props.preview && !error) {
      const frame = requestAnimationFrame(() => canvasRef.current?.focus({ preventScroll: true }));
      return () => cancelAnimationFrame(frame);
    }
  }, [props.paused, props.preview, error]);
  const inspect = () => {
    if (!props.paused && near && !props.collected.includes(near.id)) props.onInspect(near.id);
  };
  const tracker = nearestClue(props.act, props.collected, position.x, position.z);
  const bearing = tracker ? clueBearing(position.x, position.z, position.yaw, tracker.point) : 0;
  const direction =
    Math.abs(bearing) < 0.4
      ? 'Ahead'
      : Math.abs(bearing) > 2.5
        ? 'Behind you'
        : bearing > 0
          ? 'To your right'
          : 'To your left';
  return (
    <div className="cn-world" style={{ position: 'absolute', inset: 0, overflow: 'hidden' }}>
      <canvas
        ref={canvasRef}
        aria-label={
          props.preview
            ? 'Cinematic view of Concord at night'
            : props.act === 2
              ? 'Explore the jail cell in 3D'
              : 'Explore Concord in 3D'
        }
        tabIndex={props.preview ? -1 : 0}
        style={{
          display: 'block',
          width: '100%',
          height: '100%',
          touchAction: 'none',
          cursor: props.preview ? 'default' : 'grab',
        }}
        onPointerDown={(e) => {
          if (props.paused || props.preview) return;
          e.currentTarget.focus();
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId) return;
          worldRef.current?.look(e.clientX - d.x, e.clientY - d.y);
          drag.current = { ...d, x: e.clientX, y: e.clientY };
        }}
        onPointerUp={() => {
          drag.current = null;
        }}
        onPointerCancel={() => {
          drag.current = null;
        }}
      />
      {error && props.preview && (
        <div
          className="cn-preview-fallback"
          style={{ position: 'absolute', inset: 0, background: '#172f3b' }}
        >
          <ConcordArt />
        </div>
      )}
      {error && !props.preview && (
        <div
          className="cn-world-fallback"
          role="status"
          style={{
            position: 'absolute',
            inset: 0,
            padding: '100px 24px',
            background: 'linear-gradient(140deg,#193541,#1c282b)',
            overflow: 'auto',
          }}
        >
          <h2>Explore the scene</h2>
          <p>Your device could not open the 3D view. Every encounter remains available here.</p>
          {hotspots
            .filter((h) => h.act === props.act)
            .map((h) => (
              <button
                key={h.id}
                disabled={props.paused || props.collected.includes(h.id)}
                onClick={() => props.onInspect(h.id)}
              >
                {props.collected.includes(h.id) ? '✓ ' : ''}
                {h.label}
              </button>
            ))}
        </div>
      )}
      {!props.preview && !props.paused && !error && (
        <>
          {tracker && (
            <div
              className="cn-tracker"
              aria-label={`Next evidence: ${tracker.point.label}, ${Math.round(tracker.distance)} metres, ${direction.toLowerCase()}`}
              style={{
                position: 'absolute',
                bottom: 116,
                right: 24,
                display: 'flex',
                alignItems: 'center',
                gap: 12,
                maxWidth: 'min(275px,calc(100% - 48px))',
                padding: '12px 15px',
                background: '#102832d9',
                border: '1px solid #aec0aa45',
                borderRadius: 6,
                color: '#e5dec7',
                pointerEvents: 'none',
                backdropFilter: 'blur(8px)',
              }}
            >
              <span
                aria-hidden="true"
                style={{
                  display: 'grid',
                  placeItems: 'center',
                  width: 31,
                  height: 31,
                  flexShrink: 0,
                  border: '1px solid #d4b77b80',
                  borderRadius: '50%',
                  color: '#e1bd80',
                  fontSize: 22,
                  transform: `rotate(${(bearing * 180) / Math.PI}deg)`,
                }}
              >
                ↑
              </span>
              <div>
                <span
                  style={{
                    display: 'block',
                    fontSize: 7,
                    letterSpacing: '1.5px',
                    color: '#b4c7bb',
                    marginBottom: 6,
                  }}
                >
                  NEXT EVIDENCE · {Math.round(tracker.distance)} M
                </span>
                <strong style={{ fontWeight: 400, fontSize: 11, lineHeight: 1.4 }}>
                  {tracker.point.label}
                </strong>
                <span style={{ display: 'block', fontSize: 9, color: '#b4c7bb', marginTop: 5 }}>
                  {tracker.distance < 3.25 ? 'Within reach · press E or Inspect' : direction}
                </span>
              </div>
            </div>
          )}
          <div
            className="cn-crosshair"
            aria-hidden="true"
            style={{
              position: 'absolute',
              top: '50%',
              left: '50%',
              width: 4,
              height: 4,
              border: '1px solid #f1e5c5a0',
              borderRadius: '50%',
              pointerEvents: 'none',
            }}
          />
          {near && !props.collected.includes(near.id) && (
            <button
              className="cn-inspect"
              onClick={inspect}
              style={{
                position: 'absolute',
                bottom: '24%',
                left: '50%',
                transform: 'translateX(-50%)',
                background: '#152b32ed',
                border: '1px solid #d8bb82',
                borderRadius: 7,
                padding: '13px 20px',
                color: '#f1e4c8',
                whiteSpace: 'nowrap',
              }}
            >
              <kbd>E</kbd> {near.label} <span aria-hidden="true">↗</span>
            </button>
          )}
          <div
            className="cn-world-controls"
            aria-label="Movement controls"
            style={{
              position: 'absolute',
              bottom: 24,
              left: 24,
              display: 'grid',
              gridTemplateColumns: 'repeat(3,42px)',
              gap: 5,
            }}
          >
            {[
              ['KeyW', '↑', 'Walk forward', 2],
              ['KeyA', '←', 'Walk left', 1],
              ['KeyS', '↓', 'Walk backward', 2],
              ['KeyD', '→', 'Walk right', 3],
            ].map(([code, symbol, label, column], i) => (
              <button
                key={code}
                aria-label={String(label)}
                style={{
                  gridColumn: Number(column),
                  gridRow: i === 0 ? 1 : 2,
                  width: 42,
                  height: 42,
                  background: '#142a34c9',
                  border: '1px solid #a1b5b455',
                  borderRadius: 6,
                  color: '#e2dfcd',
                  touchAction: 'none',
                  userSelect: 'none',
                }}
                onPointerDown={(e) => {
                  e.preventDefault();
                  e.currentTarget.setPointerCapture(e.pointerId);
                  worldRef.current?.keys.add(String(code));
                }}
                onPointerUp={() => worldRef.current?.keys.delete(String(code))}
                onPointerCancel={() => worldRef.current?.keys.delete(String(code))}
                onLostPointerCapture={() => worldRef.current?.keys.delete(String(code))}
              >
                {symbol}
              </button>
            ))}
          </div>
        </>
      )}
    </div>
  );
}
