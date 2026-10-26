import { useEffect, useMemo, useRef, useState } from 'react';
import { speechCountAt, speechSchedule, type SpeechProgress } from './speech';
import { debates, evidence } from './data';
import { SourcePanel } from './Study';
import {
  conversationActors,
  conversationLine,
  conversationExplanation,
  conversationHand,
  conversationReply,
  type ConversationAction,
  type ConversationState,
} from './conversation';
import type { ConversationPose } from './scene';

export type SpeechAnchor = { x: number; y: number; visible: boolean; clearance?: number };
type Props = {
  state: ConversationState;
  reduced: boolean;
  paused: boolean;
  anchor: SpeechAnchor;
  ending: string;
  initialSpeech?: SpeechProgress | null;
  onAction: (action: ConversationAction) => void;
  onDelivery: (pose: ConversationPose) => void;
  onClose: () => void;
  onContinue: () => void;
};

/** The conversation is a layer of the scene: the person and village remain in sight. */
export default function Conversation(props: Props) {
  const { state, reduced, paused, anchor, ending } = props;
  const actor = conversationActors[state.debateId];
  const round = debates[state.debateId].rounds[state.round];
  const opening =
    state.round === 0 && state.attempts === 0 && ['opening', 'reply'].includes(state.stage);
  const line = `${opening ? actor.introduction + ' ' : ''}${conversationLine(state)}`;
  const timing = useMemo(() => speechSchedule(line), [line]);
  const lineKey = `${state.debateId}:${state.round}:${state.stage === 'reply' ? 'opening' : state.stage}:${state.result ?? ''}`;
  const root = useRef<HTMLElement>(null);
  const callbacks = useRef(props);
  callbacks.current = props;
  const remembered = props.initialSpeech;
  const startingCount =
    remembered?.text === line && Number.isFinite(remembered.revealed)
      ? Math.max(0, Math.min(line.length, Math.floor(remembered.revealed)))
      : 0;
  const progress = useRef({
    key: lineKey,
    count: startingCount,
    elapsed: timing[startingCount - 1] ?? 0,
  });
  const [reveal, setReveal] = useState({ key: lineKey, count: startingCount });
  const [paragraph, setParagraph] = useState<number | null>(null);
  const hand = conversationHand(state.debateId, state.round);
  const quoteIndex = Math.max(
    0,
    hand.findIndex((card) => card.id === state.evidenceId),
  );
  const quote = hand[Math.min(quoteIndex, hand.length - 1)];
  const count = reduced ? line.length : reveal.key === lineKey ? reveal.count : 0;
  const revealed = count >= line.length;
  const explanation = conversationExplanation(state);
  const farewell = state.stage === 'farewell' || state.stage === 'complete';
  const nextName = ['evening', 'night', 'morning'][state.debateId];
  const showWholeLine = () => {
    progress.current = { key: lineKey, count: line.length, elapsed: timing.at(-1) ?? 0 };
    setReveal({ key: lineKey, count: line.length });
  };
  function usePassage() {
    if (!quote) return;
    callbacks.current.onAction({ type: 'evidence', id: quote.id });
    callbacks.current.onAction({ type: 'submit' });
  }
  function onward() {
    callbacks.current.onAction({ type: 'finish' });
    callbacks.current.onContinue();
  }
  function browseQuote(offset: number) {
    const index = (quoteIndex + offset + hand.length) % hand.length;
    callbacks.current.onAction({ type: 'evidence', id: hand[index].id });
  }
  useEffect(() => {
    if (paused || paragraph !== null) return;
    if (progress.current.key !== lineKey) progress.current = { key: lineKey, count: 0, elapsed: 0 };
    if (reduced) {
      progress.current.count = line.length;
      progress.current.elapsed = timing.at(-1) ?? 0;
      setReveal({ key: lineKey, count: line.length });
      return;
    }
    let frame = 0,
      last = performance.now();
    const visibility = () => {
      last = performance.now();
    };
    const tick = (now: number) => {
      const elapsed = (now - last) / 1000;
      last = now;
      if (!document.hidden) progress.current.elapsed += elapsed;
      progress.current.count = speechCountAt(timing, progress.current.elapsed);
      setReveal({ key: lineKey, count: Math.floor(progress.current.count) });
      if (progress.current.count < line.length) frame = requestAnimationFrame(tick);
    };
    frame = requestAnimationFrame(tick);
    document.addEventListener('visibilitychange', visibility);
    return () => {
      cancelAnimationFrame(frame);
      document.removeEventListener('visibilitychange', visibility);
    };
  }, [lineKey, line, timing, reduced, paused, paragraph]);
  useEffect(() => {
    if (state.stage === 'opening' && revealed && !paused && paragraph === null)
      callbacks.current.onAction({ type: 'listen' });
  }, [state.stage, revealed, paused, paragraph]);
  useEffect(() => {
    callbacks.current.onDelivery({
      actorId: actor.id,
      phase: farewell
        ? 'farewell'
        : state.stage === 'response'
          ? state.result === 'agree'
            ? 'agree'
            : 'disagree'
          : !revealed
            ? 'speaking'
            : state.stage === 'evidence'
              ? 'considering'
              : 'listening',
      beat:
        state.attempts * 100 +
        state.round * 10 +
        ['opening', 'reply', 'evidence', 'response', 'farewell', 'complete'].indexOf(state.stage),
      speaking: !revealed && !paused && paragraph === null,
      text: line,
      revealed: Math.min(count, line.length),
    });
  }, [
    actor.id,
    state.round,
    state.stage,
    state.result,
    state.attempts,
    farewell,
    revealed,
    count,
    line,
    paused,
    paragraph,
  ]);
  useEffect(() => {
    if (!paused && paragraph === null) root.current?.focus({ preventScroll: true });
  }, [state.stage, paused, paragraph]);
  useEffect(() => {
    const key = (event: KeyboardEvent) => {
      if (
        paused ||
        paragraph !== null ||
        event.ctrlKey ||
        event.metaKey ||
        event.altKey ||
        event.repeat
      )
        return;
      if (/INPUT|TEXTAREA|SELECT/.test((event.target as HTMLElement)?.tagName)) return;
      if (event.key === 'Escape') {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onClose();
        return;
      }
      if (event.key === 'Tab') {
        const buttons = Array.from(
          root.current?.querySelectorAll<HTMLElement>('button:not(:disabled), summary, a[href]') ??
            [],
        ).filter((node) => {
          const closedNote = node.closest('details:not([open])');
          if (closedNote && !(node.tagName === 'SUMMARY' && node.parentElement === closedNote))
            return false;
          return node.getClientRects().length > 0 && !node.closest('[inert],[hidden]');
        });
        if (!buttons?.length) return;
        const first = buttons[0],
          last = buttons[buttons.length - 1];
        if (
          event.shiftKey &&
          (document.activeElement === first || document.activeElement === root.current)
        ) {
          event.preventDefault();
          last.focus();
        } else if (!event.shiftKey && document.activeElement === last) {
          event.preventDefault();
          first.focus();
        }
        return;
      }
      if (revealed && state.stage === 'reply' && /^[1-3]$/.test(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        callbacks.current.onAction({ type: 'claim', index: Number(event.key) - 1 });
        return;
      }
      if (state.stage === 'evidence' && ['ArrowLeft', 'ArrowRight'].includes(event.key)) {
        event.preventDefault();
        event.stopPropagation();
        browseQuote(event.key === 'ArrowLeft' ? -1 : 1);
        return;
      }
      if (!['KeyE', 'Enter', 'Space'].includes(event.code)) return;
      if (event.code !== 'KeyE' && (event.target as HTMLElement).closest('button,summary')) return;
      event.preventDefault();
      event.stopPropagation();
      if (!revealed) showWholeLine();
      else if (state.stage === 'evidence') usePassage();
      else if (state.stage === 'response') callbacks.current.onAction({ type: 'continue' });
      else if (farewell) onward();
    };
    document.addEventListener('keydown', key, true);
    return () => document.removeEventListener('keydown', key, true);
  }, [paused, paragraph, state.stage, revealed, lineKey, quoteIndex, hand.length, farewell]);

  const viewportWidth = window.innerWidth;
  const speechWidth =
    viewportWidth > 900 ? Math.min(410, viewportWidth * 0.32) : Math.min(355, viewportWidth * 0.39);
  const clearance = anchor.clearance ?? 75;
  const bubbleLeft =
    anchor.x + clearance + speechWidth < viewportWidth - 20
      ? anchor.x + clearance
      : anchor.x - clearance - speechWidth;
  const bubbleStyle = anchor.visible
    ? {
        left: Math.max(15, Math.min(viewportWidth - speechWidth - 15, bubbleLeft)),
        top: Math.max(80, anchor.y - 30),
        transform: 'none',
      }
    : undefined;
  return (
    <section
      className={`cn-conversation ${paused || paragraph !== null ? 'cn-conversation-muted' : ''}`}
      ref={root}
      tabIndex={-1}
      role="region"
      aria-label={`Conversation with ${actor.name}`}
      aria-describedby={`cn-spoken-line-${state.debateId}`}
    >
      <div
        className={`cn-speech ${anchor.visible ? 'cn-speech-anchored' : 'cn-speech-fallback'}`}
        style={bubbleStyle}
      >
        <div className="cn-speech-heading">
          <span className="cn-speaker-name">{actor.name}</span>
          {!revealed && (
            <button className="cn-speech-skip" onClick={showWholeLine}>
              Show whole line <kbd>E</kbd>
            </button>
          )}
        </div>
        <p aria-hidden="true">
          {line.slice(0, count)}
          <span className="cn-speech-caret" aria-hidden="true">
            {!revealed ? '▏' : ''}
          </span>
        </p>
        <span
          id={`cn-spoken-line-${state.debateId}`}
          className="cn-speech-accessible"
          role="status"
          aria-live="polite"
          aria-atomic="true"
        >
          {line}
        </span>
      </div>
      <div className="cn-talk-controls">
        <div className="cn-talk-topline">
          <span>{actor.role}</span>
          <button onClick={props.onClose}>
            Step away <kbd>Esc</kbd>
          </button>
        </div>
        {revealed && state.stage === 'reply' && (
          <div className="cn-replies" aria-label="Your reply">
            {round.claims.map((claim, index) => (
              <button
                className="cn-reply"
                key={claim.text}
                onClick={() => props.onAction({ type: 'claim', index })}
              >
                <kbd>{index + 1}</kbd>
                <span>{conversationReply(state.debateId, state.round, index)}</span>
              </button>
            ))}
          </div>
        )}
        {state.stage === 'evidence' && (
          <div className="cn-pocket-notebook">
            <div className="cn-pocket-heading">
              <span>Your notebook</span>
              <small>
                {quoteIndex + 1} / {hand.length}
              </small>
            </div>
            <blockquote className="cn-conversation-quote" data-evidence={quote.id}>
              “{quote.quote}”
            </blockquote>
            <div className="cn-quote-reference">
              <span>Thoreau · paragraph {quote.paragraph}</span>
              <button onClick={() => setParagraph(quote.paragraph)}>Read in context</button>
            </div>
            <div className="cn-pocket-actions">
              <button aria-label="Previous passage" onClick={() => browseQuote(-1)}>
                ←
              </button>
              <button className="cn-use-passage" disabled={!revealed} onClick={usePassage}>
                Use this passage <kbd>E</kbd>
              </button>
              <button aria-label="Next passage" onClick={() => browseQuote(1)}>
                →
              </button>
            </div>
            <button className="cn-rethink" onClick={() => props.onAction({ type: 'back' })}>
              Change what you said
            </button>
          </div>
        )}
        {state.stage === 'response' && revealed && (
          <div className="cn-conversation-response">
            <button className="cn-talk-next" onClick={() => props.onAction({ type: 'continue' })}>
              {state.result === 'agree' ? 'Go on' : 'Let me try again'} <kbd>E</kbd>
            </button>
            <details className="cn-reading-note">
              <summary>Look closer at the passage</summary>
              <p>{explanation}</p>
              <button
                onClick={() =>
                  setParagraph(evidence.find((card) => card.id === round.evidenceId)!.paragraph)
                }
              >
                Read the supporting passage
              </button>
            </details>
          </div>
        )}
        {farewell && revealed && (
          <div className="cn-conversation-farewell">
            <p>{ending}</p>
            <button className="cn-talk-next" onClick={onward}>
              {nextName ? `Continue to ${nextName}` : 'Finish the journey'} →
            </button>
            <button
              className="cn-rethink"
              onClick={() => {
                props.onAction({ type: 'finish' });
                props.onClose();
              }}
            >
              Stay a little longer
            </button>
          </div>
        )}
      </div>
      {paragraph !== null && (
        <SourcePanel paragraph={paragraph} onClose={() => setParagraph(null)} />
      )}
    </section>
  );
}
