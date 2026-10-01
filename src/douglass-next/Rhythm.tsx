import { useEffect, useRef, useState } from 'react';
import type { Stage } from './data';
/** A forgiving timing mechanic: retries are unlimited and earlier successful beats are retained. */
export const inBeatWindow = (phase: number) => phase >= 0.54 && phase <= 0.88;
export default function Rhythm({
  activity,
  reduced,
  onBeat,
  onComplete,
}: {
  activity: NonNullable<Stage['rhythm']>;
  reduced: boolean;
  onBeat: () => void;
  onComplete: () => void;
}) {
  const [phase, setPhase] = useState(0),
    [hits, setHits] = useState(0),
    [feedback, setFeedback] = useState('Watch the gold window.');
  const start = useRef(performance.now()),
    current = useRef(0),
    last = useRef(-1),
    action = useRef(() => {});
  action.current = () => {
    if (hits >= 4) return;
    const cycle = Math.floor((performance.now() - start.current) / 2200);
    if (last.current === cycle) return;
    last.current = cycle;
    if (inBeatWindow(current.current)) {
      setHits((h) => h + 1);
      setFeedback(
        hits === 3 ? 'Complete. Carry it forward.' : `${hits + 1} / 4 · Keep the rhythm.`,
      );
      onBeat();
    } else setFeedback('A little early or late. Try the next pass.');
  };
  useEffect(() => {
    let frame = 0;
    const tick = () => {
      const p = ((performance.now() - start.current) % 2200) / 2200;
      current.current = p;
      setPhase(p);
      frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    const key = (e: KeyboardEvent) => {
      if (
        ['Space', 'KeyE'].includes(e.code) &&
        !e.repeat &&
        !document.querySelector('dialog[open]')
      ) {
        e.preventDefault();
        action.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => {
      cancelAnimationFrame(frame);
      window.removeEventListener('keydown', key);
    };
  }, []);
  return (
    <div className="dn-shade">
      <section className="dn-rhythm" aria-label={activity.title}>
        <p className="dn-kicker">{activity.title}</p>
        <h2>{hits === 4 ? 'You held the rhythm.' : activity.verb + '.'}</h2>
        <p>{activity.caption}</p>
        <div className="dn-beat-track" aria-hidden="true">
          <i className="dn-beat-window" />
          <b style={{ left: `${phase * 100}%` }} />
        </div>
        <div className="dn-beat-pips" aria-label={`${hits} of 4 successful beats`}>
          {[0, 1, 2, 3].map((i) => (
            <i key={i} className={i < hits ? 'lit' : ''} />
          ))}
        </div>
        <p role="status">{feedback}</p>
        {hits < 4 ? (
          <>
            <button className="dn-primary" onClick={() => action.current()}>
              {activity.verb} <kbd>Space / E</kbd>
            </button>
            {reduced && (
              <button
                className="dn-text-button"
                onClick={() => {
                  setHits((h) => Math.min(4, h + 1));
                  setFeedback('Beat complete.');
                  onBeat();
                }}
              >
                Use untimed input
              </button>
            )}
          </>
        ) : (
          <button className="dn-primary" onClick={onComplete}>
            Carry on →
          </button>
        )}
      </section>
    </div>
  );
}
