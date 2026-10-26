import type { CSSProperties } from 'react';
import {
  townActionLabel,
  townInteractionLabel,
  townInteractionPrompt,
  type TownActivity,
  type TownInteraction,
  type TownMemory,
} from './exploration';

type Props = {
  activity: TownActivity;
  session: TownInteraction | null;
  memory: TownMemory;
  notice: string | null;
  cooling: boolean;
  onBegin: (holding: boolean) => void;
  onRelease: () => void;
  onCancel: () => void;
};

/** A hand-sized affordance stays in the street, without opening a reading or quiz panel. */
export default function TownControls(props: Props) {
  const { activity, session, memory, notice, cooling } = props;
  const working = !!session && !session.complete;
  const label = working ? townInteractionLabel(session) : townActionLabel(activity.id, memory);
  return (
    <div
      className="cn-town-affordance"
      data-town-id={activity.id}
      aria-label={activity.title}
      style={{ '--town-progress': `${(session?.progress ?? 0) * 100}%` } as CSSProperties}
    >
      <button
        className={`cn-town-action ${session?.holding ? 'holding' : ''}`}
        disabled={cooling}
        aria-label={label}
        onPointerDown={(event) => {
          if (activity.kind !== 'hold') return;
          event.preventDefault();
          event.currentTarget.setPointerCapture(event.pointerId);
          props.onBegin(true);
        }}
        onPointerUp={props.onRelease}
        onPointerCancel={props.onRelease}
        onLostPointerCapture={props.onRelease}
        onClick={(event) => {
          if (activity.kind === 'press') props.onBegin(false);
          else if (event.detail === 0) {
            if (session?.holding) props.onRelease();
            else props.onBegin(true);
          }
        }}
      >
        <kbd>E</kbd>
        <span>{label}</span>
        {activity.kind === 'hold' && <small>{session?.holding ? 'Keep holding…' : 'Hold'}</small>}
      </button>
      {working && (
        <>
          <span
            className="cn-town-progress"
            role="progressbar"
            aria-label={label}
            aria-valuemin={0}
            aria-valuemax={100}
            aria-valuenow={Math.round(session.progress * 100)}
          />
          <div className="cn-town-working">
            <span>{townInteractionPrompt(session)}</span>
            <button onClick={props.onCancel} aria-label={`Step away from ${activity.title}`}>
              Step away <kbd>Esc</kbd>
            </button>
          </div>
        </>
      )}
      {notice && (
        <p className="cn-town-notice" role="status">
          {notice}
        </p>
      )}
    </div>
  );
}
