import { useEffect, useRef, useState } from 'react';
import { ConcordWorld, hotspots, type Hotspot } from './scene';
import { clueBearing, nearestClue, spawns } from './navigation';
import Frontispiece from './Frontispiece';
import {
  advanceInteraction,
  interactionDefs,
  startInteraction,
  INTERACTION_DIALOGUE_NOTE,
  type InteractionAction,
  type InteractionState,
} from './interactions';
export { hotspots } from './scene';

export type WorldProps = {
  act: number;
  collected: string[];
  paused: boolean;
  reduced: boolean;
  onInspect: (id: string) => void;
  onNear?: (label: string | null) => void;
  onReady?: (ready: boolean) => void;
  onInteractionActive?: (active: boolean) => void;
  onSound?: (cue: string, surface?: 'road' | 'wood' | 'stone', speed?: number) => void;
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
  const [interaction, setInteraction] = useState<InteractionState | null>(null);
  const interactionRef = useRef<InteractionState | null>(null);
  const actionPanel = useRef<HTMLElement>(null);
  const [freeLook, setFreeLook] = useState(false);
  function updateInteraction(next: InteractionState | null) {
    interactionRef.current = next;
    setInteraction(next);
    if (next) worldRef.current?.setInteraction(next.id, next.progress, next.step, next.cue);
    else worldRef.current?.clearInteraction();
  }
  function endInteraction() {
    updateInteraction(null);
    propsRef.current.onInteractionActive?.(false);
    canvasRef.current?.focus({ preventScroll: true });
  }
  function act(action: InteractionAction, dt = 0) {
    const current = interactionRef.current;
    if (!current || propsRef.current.paused) return;
    const next = advanceInteraction(current, action, dt);
    if (next === current) return;
    if (action.type === 'press' || action.type === 'choose')
      propsRef.current.onSound?.(next.cue ?? `${current.id}:${current.step}`);
    if (next.step !== current.step && action.type === 'tick')
      propsRef.current.onSound?.(`${current.id}:step-${current.step}`);
    if (next.complete && !current.complete) propsRef.current.onSound?.(`${current.id}:finish`);
    updateInteraction(next);
  }
  function beginInteraction(id: string) {
    if (propsRef.current.paused || interactionRef.current) return;
    if (document.pointerLockElement) void document.exitPointerLock();
    worldRef.current?.keys.clear();
    drag.current = null;
    setDirections(false);
    updateInteraction(startInteraction(id));
    propsRef.current.onInteractionActive?.(true);
    propsRef.current.onSound?.(`${id}:start`);
    requestAnimationFrame(() => actionPanel.current?.focus({ preventScroll: true }));
  }
  function revealPassage() {
    const current = interactionRef.current;
    if (!current?.complete) return;
    const id = current.id;
    endInteraction();
    propsRef.current.onInspect(id);
  }
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
        () => ({
          ...propsRef.current,
          movementLocked: !!interactionRef.current,
          posture: interactionRef.current
            ? (interactionDefs[interactionRef.current.id].steps[interactionRef.current.step]
                .posture ?? 'stand')
            : 'stand',
        }),
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
      const active = interactionRef.current;
      if (active) {
        if (e.code === 'Tab') {
          const buttons =
            actionPanel.current?.querySelectorAll<HTMLButtonElement>('button:not(:disabled)');
          if (buttons?.length) {
            const first = buttons[0],
              last = buttons[buttons.length - 1];
            if (
              e.shiftKey &&
              (document.activeElement === first || document.activeElement === actionPanel.current)
            ) {
              e.preventDefault();
              last.focus();
            } else if (!e.shiftKey && document.activeElement === last) {
              e.preventDefault();
              first.focus();
            }
          }
          return;
        }
        if (e.code === 'Escape') {
          e.preventDefault();
          endInteraction();
        } else if (['KeyE', 'Space'].includes(e.code)) {
          if (e.code === 'Space' && (e.target as HTMLElement).closest('button')) return;
          e.preventDefault();
          if (e.repeat) return;
          if (active.complete) revealPassage();
          else {
            const step = interactionDefs[active.id].steps[active.step];
            act(step.kind === 'hold' ? { type: 'hold', pressed: true } : { type: 'press' });
          }
        } else if (/^Digit[1-4]$/.test(e.code) && !e.repeat) {
          const choice =
            interactionDefs[active.id].steps[active.step].choices?.[Number(e.code.slice(-1)) - 1];
          if (choice) {
            e.preventDefault();
            act({ type: 'choose', choiceId: choice.id });
          }
        }
        return;
      }
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
      if (e.code === 'KeyE' && !e.repeat && worldRef.current?.near)
        beginInteraction(worldRef.current.near.id);
      else worldRef.current?.keys.add(e.code);
    };
    const up = (e: KeyboardEvent) => {
        worldRef.current?.keys.delete(e.code);
        if (['KeyE', 'Space'].includes(e.code)) act({ type: 'hold', pressed: false });
      },
      clear = () => {
        worldRef.current?.keys.clear();
        act({ type: 'hold', pressed: false });
        drag.current = null;
      };
    const mouse = (e: MouseEvent) => {
      if (
        document.pointerLockElement === canvas &&
        !propsRef.current.paused &&
        !interactionRef.current
      )
        worldRef.current?.look(e.movementX, e.movementY);
    };
    const lock = () => setFreeLook(document.pointerLockElement === canvas);
    let frame = 0,
      last = performance.now();
    const visibility = () => {
      last = performance.now();
      if (document.hidden) clear();
    };
    const tick = (now: number) => {
      // A one-second gesture takes one second even when software graphics miss frames.
      // Visibility and pause events release the hold rather than banking hidden time.
      const dt = Math.max(0, (now - last) / 1000);
      last = now;
      if (!document.hidden && !propsRef.current.paused) {
        if (interactionRef.current?.holding) act({ type: 'tick' }, dt);
        for (const step of worldRef.current?.drainFootsteps() ?? [])
          propsRef.current.onSound?.('footstep', step.surface, step.speed);
      } else worldRef.current?.drainFootsteps();
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('mousemove', mouse);
    document.addEventListener('pointerlockchange', lock);
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('keydown', down);
    window.addEventListener('keyup', up);
    window.addEventListener('blur', clear);
    return () => {
      canvas.removeEventListener('webglcontextlost', lost);
      window.removeEventListener('keydown', down);
      window.removeEventListener('keyup', up);
      window.removeEventListener('blur', clear);
      document.removeEventListener('mousemove', mouse);
      document.removeEventListener('pointerlockchange', lock);
      document.removeEventListener('visibilitychange', visibility);
      cancelAnimationFrame(frame);
      if (document.pointerLockElement === canvas) void document.exitPointerLock();
      interactionRef.current = null;
      propsRef.current.onInteractionActive?.(false);
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
      if (document.pointerLockElement === canvasRef.current) void document.exitPointerLock();
      const current = interactionRef.current;
      if (current?.holding)
        updateInteraction(advanceInteraction(current, { type: 'hold', pressed: false }));
    } else if (!props.preview && !error) {
      const frame = requestAnimationFrame(() => {
        const active = interactionRef.current;
        if (active?.complete)
          actionPanel.current
            ?.querySelector<HTMLButtonElement>('.cn-interaction-action')
            ?.focus({ preventScroll: true });
        else if (active) actionPanel.current?.focus({ preventScroll: true });
        else canvasRef.current?.focus({ preventScroll: true });
      });
      return () => cancelAnimationFrame(frame);
    }
  }, [props.paused, props.preview, error]);
  useEffect(() => {
    if (!interaction) return;
    if (interaction.complete)
      actionPanel.current
        ?.querySelector<HTMLButtonElement>('.cn-interaction-action')
        ?.focus({ preventScroll: true });
    else actionPanel.current?.focus({ preventScroll: true });
  }, [interaction?.step, interaction?.complete]);
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
          cursor: props.preview ? 'default' : freeLook ? 'none' : 'grab',
        }}
        onPointerDown={(e) => {
          if (props.paused || props.preview || interactionRef.current || freeLook) return;
          e.currentTarget.focus();
          drag.current = { x: e.clientX, y: e.clientY, id: e.pointerId };
          e.currentTarget.setPointerCapture(e.pointerId);
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (!d || d.id !== e.pointerId || freeLook) return;
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
                disabled={props.paused || !!interaction}
                onClick={() => beginInteraction(h.id)}
              >
                {props.collected.includes(h.id) ? 'Revisit · ' : ''}
                {h.label}
              </button>
            ))}
        </div>
      )}
      {!props.preview && !props.paused && !error && (
        <>
          {directions && tracker && !interaction && (
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
          {near && !interaction && (
            <button className="cn-inspect" onClick={() => beginInteraction(near.id)}>
              <kbd>E</kbd>
              {props.collected.includes(near.id) && 'Revisit · '}
              {near.label}
            </button>
          )}
          {tracker && !interaction && (
            <button
              className="cn-directions-toggle"
              aria-expanded={directions}
              onClick={() => setDirections((v) => !v)}
            >
              {directions ? 'Hide directions' : 'Directions'} <kbd>H</kbd>
            </button>
          )}
          {!interaction && (
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
          )}
          {!interaction && (
            <button
              className="cn-look-toggle"
              onClick={() => {
                if (freeLook) void document.exitPointerLock();
                else {
                  const result = canvasRef.current?.requestPointerLock?.();
                  if (result) void result.catch(() => {});
                }
              }}
            >
              {freeLook ? 'Release mouse · Esc' : 'Free look'}
            </button>
          )}
        </>
      )}
      {interaction && !props.paused && (
        <section
          className="cn-interaction"
          role="dialog"
          aria-modal="true"
          aria-label={interactionDefs[interaction.id].title}
          ref={actionPanel}
          tabIndex={-1}
        >
          <button className="cn-interaction-leave" aria-label="Step away" onClick={endInteraction}>
            ×
          </button>
          <p className="cn-interaction-place">{interactionDefs[interaction.id].title}</p>
          {['c02', 'c04', 'c05', 'c09'].includes(interaction.id) && (
            <small className="cn-dialogue-note">{INTERACTION_DIALOGUE_NOTE}</small>
          )}
          {interaction.complete ? (
            <>
              {interaction.response && (
                <p className="cn-interaction-response" role="status">
                  {interaction.response}
                </p>
              )}
              <p>{interactionDefs[interaction.id].completion}</p>
              <button className="cn-interaction-action" onClick={revealPassage}>
                <kbd>E</kbd> Read Thoreau’s passage
              </button>
            </>
          ) : (
            (() => {
              const step = interactionDefs[interaction.id].steps[interaction.step];
              return (
                <>
                  {step.dialogue ? (
                    <div className="cn-scene-dialogue">
                      <span>{step.speaker}</span>
                      <p>{step.dialogue}</p>
                      {!['c02', 'c04', 'c05', 'c09'].includes(interaction.id) && (
                        <small>{INTERACTION_DIALOGUE_NOTE}</small>
                      )}
                    </div>
                  ) : null}
                  {interaction.step === 0 && (!step.dialogue || interaction.id === 'c04') && (
                    <p className="cn-interaction-intro">{interactionDefs[interaction.id].intro}</p>
                  )}
                  {interaction.response && (
                    <p className="cn-interaction-response" role="status">
                      {interaction.response}
                    </p>
                  )}
                  <p className="cn-interaction-prompt">{step.prompt}</p>
                  {step.kind === 'choose' ? (
                    <div className="cn-interaction-choices">
                      {step.choices?.map((choice, i) => (
                        <button
                          key={choice.id}
                          onClick={() => act({ type: 'choose', choiceId: choice.id })}
                        >
                          <kbd>{i + 1}</kbd>
                          {choice.label}
                        </button>
                      ))}
                    </div>
                  ) : (
                    <button
                      key={`${interaction.id}-${interaction.step}`}
                      className={`cn-interaction-action ${interaction.holding ? 'holding' : ''}`}
                      style={
                        {
                          '--action-progress': `${interaction.progress * 100}%`,
                        } as React.CSSProperties
                      }
                      onClick={(e) => {
                        if (step.kind === 'press') act({ type: 'press' });
                        else if (e.detail === 0)
                          act({ type: 'hold', pressed: !interactionRef.current?.holding });
                      }}
                      onPointerDown={(e) => {
                        if (step.kind !== 'hold') return;
                        e.preventDefault();
                        e.currentTarget.setPointerCapture(e.pointerId);
                        act({ type: 'hold', pressed: true });
                      }}
                      onPointerUp={() => act({ type: 'hold', pressed: false })}
                      onPointerCancel={() => act({ type: 'hold', pressed: false })}
                      onLostPointerCapture={() => act({ type: 'hold', pressed: false })}
                    >
                      <kbd>E</kbd>
                      {step.actionLabel}
                      {step.kind === 'hold' && (
                        <small>{interaction.holding ? 'Keep holding…' : 'Hold'}</small>
                      )}
                    </button>
                  )}
                  {step.kind === 'hold' && (
                    <span
                      className="cn-action-progress"
                      role="progressbar"
                      aria-label={step.actionLabel}
                      aria-valuemin={0}
                      aria-valuemax={100}
                      aria-valuenow={Math.round(interaction.progress * 100)}
                    />
                  )}
                </>
              );
            })()
          )}
        </section>
      )}
    </div>
  );
}
