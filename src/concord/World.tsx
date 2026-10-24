import { useEffect, useRef, useState } from 'react';
import { ConcordWorld, hotspots, type Hotspot } from './scene';
import { clueBearing, nearestClue, spawns } from './navigation';
import Frontispiece from './Frontispiece';
export { hotspots } from './scene';

export type WorldProps = {
  act: number;
  collected: string[];
  paused: boolean;
  reduced: boolean;
  onInspect: (id: string) => void;
  onNear?: (label: string | null) => void;
  onReady?: (ready: boolean) => void;
  onPosition?: (x: number, z: number, yaw: number, pitch?: number) => void;
  initialPose?: { x: number; z: number; yaw: number; pitch?: number };
  preview?: boolean;
};

export default function World(props: WorldProps) {
  const canvasRef = useRef<HTMLCanvasElement>(null),
    worldRef = useRef<ConcordWorld | null>(null);
  const propsRef = useRef(props);
  propsRef.current = props;
  const [near, setNear] = useState<Hotspot | null>(null),
    [error, setError] = useState(false),
    [directions, setDirections] = useState(false);
  const [position, setPosition] = useState(() => spawns[props.act] ?? spawns[0]);
  const drag = useRef<{ x: number; y: number; id: number } | null>(null);
  useEffect(() => {
    const canvas = canvasRef.current;
    if (!canvas) return;
    setError(false);
    setNear(null);
    setDirections(false);
    setPosition(spawns[props.act] ?? spawns[0]);
    const lost = (event: Event) => {
      event.preventDefault();
      setError(true);
      propsRef.current.onReady?.(false);
    };
    canvas.addEventListener('webglcontextlost', lost);
    try {
      worldRef.current = new ConcordWorld(
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
          propsRef.current.onPosition?.(x, z, yaw, worldRef.current?.pitch ?? 0);
        },
      );
      const pose = propsRef.current.initialPose;
      if (pose && !props.preview) {
        worldRef.current.camera.position.set(pose.x, 1.68, pose.z);
        worldRef.current.yaw = pose.yaw;
        worldRef.current.pitch = pose.pitch ?? -0.03;
      }
      propsRef.current.onReady?.(true);
    } catch (cause) {
      console.warn('Concord 3D could not initialize.', cause);
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
      if (e.code === 'KeyH' && !e.repeat) {
        e.preventDefault();
        setDirections((v) => !v);
        return;
      }
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
    const up = (e: KeyboardEvent) => worldRef.current?.keys.delete(e.code),
      clear = () => worldRef.current?.keys.clear();
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      const world = worldRef.current;
      if (world && !props.preview)
        propsRef.current.onPosition?.(
          world.camera.position.x,
          world.camera.position.z,
          world.yaw,
          world.pitch,
        );
      world?.dispose();
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
            ? 'Concord at night'
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
        <div className="cn-preview-fallback">
          <Frontispiece />
        </div>
      )}
      {error && !props.preview && (
        <div className="cn-world-fallback" role="status">
          <h2>Explore the scene</h2>
          <p>
            This browser could not open the 3D view. You can still examine each object and continue
            the story.
          </p>
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
          {directions && tracker && (
            <div
              className="cn-tracker"
              role="status"
              aria-label={`Next evidence: ${tracker.point.label}, ${Math.round(tracker.distance)} metres, ${direction.toLowerCase()}`}
            >
              <span
                className="cn-tracker-arrow"
                aria-hidden="true"
                style={{ transform: `rotate(${(bearing * 180) / Math.PI}deg)` }}
              >
                ↑
              </span>
              <div>
                <strong>{tracker.point.label.replace(/^The /, '')}</strong>
                <small>
                  {Math.round(tracker.distance)} metres ·{' '}
                  {tracker.distance < 3.25 ? 'Within reach' : direction}
                </small>
              </div>
            </div>
          )}
          {near && !props.collected.includes(near.id) && (
            <button className="cn-inspect" onClick={() => props.onInspect(near.id)}>
              <kbd>E</kbd>
              {near.label}
            </button>
          )}
          {tracker && (
            <button
              className="cn-directions-toggle"
              aria-expanded={directions}
              onClick={() => setDirections((v) => !v)}
            >
              {directions ? 'Hide directions' : 'Directions'} <kbd>H</kbd>
            </button>
          )}
          <div className="cn-world-controls" aria-label="Movement controls">
            {[
              ['KeyW', '↑', 'Walk forward', 2],
              ['KeyA', '←', 'Walk left', 1],
              ['KeyS', '↓', 'Walk backward', 2],
              ['KeyD', '→', 'Walk right', 3],
            ].map(([code, symbol, label, column], i) => (
              <button
                key={code}
                aria-label={String(label)}
                style={{ gridColumn: Number(column), gridRow: i === 0 ? 1 : 2 }}
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
