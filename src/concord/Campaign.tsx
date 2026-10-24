import { useEffect, useRef, useState, type ReactNode } from 'react';
import World, { hotspots } from './World';
import Frontispiece from './Frontispiece';
import Study, { SourcePanel } from './Study';
import { debates, evidence, type Debate, type Evidence } from './data';
import { freshSave, readSave, SAVE_KEY, type ConcordSave } from './save';
import { ConcordAudio } from './audio';
import './concord.css';

export const acts = [
  {
    name: 'The common',
    place: 'Concord village',
    time: 'Dusk',
    intro:
      'A notice has been posted on the common. Read it, listen to the neighbors, and call at the print shop before you meet the tax collector.',
    ending: 'The law has the town behind it. You have begun to ask whether that makes it right.',
  },
  {
    name: 'The tax collector',
    place: 'The tax office',
    time: 'Evening',
    intro:
      'The collector is waiting outside his office. Read the papers on his table, the merchant’s ledger, and the notice by the jail door before you answer him.',
    ending:
      'Thoreau refused the poll tax because he would not give his allegiance to a government that sustained slavery and the war against Mexico. His refusal brought him to jail.',
  },
  {
    name: 'The county jail',
    place: 'The county jail',
    time: 'Night',
    intro:
      'The door closes behind you. Examine the desk, the window, and the bed. There are limits to what these walls can hold.',
    ending:
      'Someone else paid the tax, and Thoreau was released the next morning. He left with less respect for the State’s power, not less confidence in his own judgment.',
  },
  {
    name: 'The road home',
    place: 'The river road',
    time: 'Morning',
    intro:
      'It is morning in Concord. Read the newspaper, visit the river overlook, and check the letterbox on the road back to town. Consider what kind of government could earn your respect.',
    ending:
      'After his release, Thoreau collected his mended shoe and joined a huckleberry party. The night was over. The questions remained.',
  },
];

function Modal({
  title,
  children,
  onClose,
  wide = false,
}: {
  title: string;
  children: ReactNode;
  onClose: () => void;
  wide?: boolean;
}) {
  const panel = useRef<HTMLDivElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const previous = document.activeElement as HTMLElement | null;
    panel.current?.focus();
    const key = (e: KeyboardEvent) => {
      if (document.querySelector('dialog[open]')) return;
      if (e.key === 'Escape') {
        e.stopPropagation();
        closeRef.current();
      }
      if (e.key !== 'Tab') return;
      const nodes = panel.current?.querySelectorAll<HTMLElement>(
        'button:not(:disabled),a[href],input,select,textarea,[tabindex="0"]',
      );
      if (!nodes?.length) {
        e.preventDefault();
        return;
      }
      const first = nodes[0],
        last = nodes[nodes.length - 1];
      if (
        e.shiftKey &&
        (document.activeElement === first || document.activeElement === panel.current)
      ) {
        e.preventDefault();
        last.focus();
      } else if (
        !e.shiftKey &&
        (document.activeElement === last || document.activeElement === panel.current)
      ) {
        e.preventDefault();
        first.focus();
      }
    };
    document.addEventListener('keydown', key, true);
    return () => {
      document.removeEventListener('keydown', key, true);
      previous?.focus();
    };
  }, []);
  return (
    <div className="cn-modal-backdrop">
      <div
        className={`cn-modal ${wide ? 'cn-wide' : ''}`}
        role="dialog"
        aria-modal="true"
        aria-label={title}
        ref={panel}
        tabIndex={-1}
      >
        <button className="cn-close" onClick={onClose} aria-label={`Close ${title}`}>
          ×
        </button>
        {children}
      </div>
    </div>
  );
}

function Portrait({ kind }: { kind: number }) {
  return (
    <svg
      className="cn-portrait"
      viewBox="0 0 120 150"
      aria-hidden="true"
      fill="none"
      stroke="currentColor"
      strokeWidth="1.4"
      strokeLinecap="round"
      strokeLinejoin="round"
    >
      <path d="M14 144q5-28 30-34l2-19m30 1 2 18q24 8 29 34" fill="#b8b8a1" />
      <path d="M44 111l16 13-9 18-14-28m41-3-18 13 9 18 16-27" fill="#e8dfc8" />
      <path d="M43 57q-7 24 4 40 12 13 25 0 12-14 7-40" fill="#d7c8a9" />
      {kind % 2 === 0 ? (
        <path d="M29 56q34-12 63-1l-1 7q-36 7-63 0zm11-3 4-31 34 1 8 30" fill="#5d6858" />
      ) : (
        <path d="M40 59q-8-32 20-31 27-2 23 31l-10-9-13-6-12 9z" fill="#5c6657" />
      )}
      <path d="M45 68q7-4 12 0m8 0q6-4 12 0m-27 3 2 1m17-1 2 1m-11-1-3 13 6 1m-9 7q8 3 14-1" />
      <path
        d={
          kind === 2
            ? 'M45 87q1 24 16 25 15-8 16-25l-8 12-10 3-7-8z'
            : 'M44 88q2 10 6 13m25-14q-1 9-6 15'
        }
      />
      {Array.from({ length: 12 }, (_, i) => (
        <path
          key={i}
          d={`M${18 + i * 7} 142l${i < 6 ? 9 : -8} -${13 + (i % 4) * 4}`}
          opacity=".5"
        />
      ))}
      <path d="M48 38l21 2m-24 5 29 1m-16 82-1 14m-26-23-8 15m68-17 9 16" opacity=".4" />
    </svg>
  );
}

function DebateEncounter({
  debate,
  onWin,
  onResolved,
  onClose,
}: {
  debate: Debate;
  onWin: () => void;
  onResolved: () => void;
  onClose: () => void;
}) {
  const [round, setRound] = useState(0),
    [claim, setClaim] = useState<number | null>(null),
    [card, setCard] = useState<string | null>(null);
  const [step, setStep] = useState<'reply' | 'passage'>('reply');
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null),
    [won, setWon] = useState(false);
  const [paragraph, setParagraph] = useState<number | null>(null);
  const current = debate.rounds[round];
  const hand = useRef<Evidence[][]>(
    debate.rounds.map((r, i) => {
      const target = evidence.find((e) => e.id === r.evidenceId)!;
      const others = evidence.slice(0, (debate.id + 1) * 3).filter((e) => e.id !== target.id);
      return [target, ...[...others.slice(i), ...others.slice(0, i)].slice(0, 3)].sort((a, b) =>
        a.id.localeCompare(b.id),
      );
    }),
  );
  function submit() {
    if (claim === null || !card || feedback) return;
    const correct = current.claims[claim].correct && card === current.evidenceId;
    setFeedback({
      correct,
      text: correct
        ? current.explanation
        : !current.claims[claim].correct
          ? current.claims[claim].explanation
          : 'Your reply fits Thoreau’s position, but this passage does not support it. Look for the words that answer this particular objection.',
    });
  }
  function advance() {
    if (feedback?.correct && round === debate.rounds.length - 1) {
      onResolved();
      setWon(true);
      return;
    }
    if (feedback?.correct) setRound((n) => n + 1);
    setClaim(null);
    setCard(null);
    setFeedback(null);
    setStep('reply');
  }
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (won || feedback || paragraph !== null || e.altKey || e.ctrlKey || e.metaKey || e.repeat)
        return;
      if (/^[1-4]$/.test(e.key)) {
        const i = Number(e.key) - 1;
        if (step === 'reply' && i < current.claims.length) {
          e.preventDefault();
          setClaim(i);
        } else if (step === 'passage' && i < hand.current[round].length) {
          e.preventDefault();
          setCard(hand.current[round][i].id);
        }
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [won, feedback, paragraph, step, current, round]);
  return (
    <Modal title={debate.title} onClose={won ? onWin : onClose} wide>
      {won ? (
        <div className="cn-debate-victory">
          <Portrait kind={debate.id} />
          <p className="cn-margin-note">The conversation ends</p>
          <h2>{debate.title}</h2>
          <p>You have answered all three objections using the essay.</p>
          <button className="cn-button cn-primary" onClick={onWin}>
            Continue the night
          </button>
        </div>
      ) : (
        <>
          <div className="cn-conversation-heading">
            <Portrait kind={debate.id} />
            <div>
              <p className="cn-margin-note">{debate.speaker}</p>
              <blockquote>{current.objection}</blockquote>
            </div>
          </div>
          <p className="cn-conversation-step">
            {round + 1} of 3 <span aria-hidden="true">—</span>{' '}
            {step === 'reply' ? 'What do you say?' : 'Which passage supports your reply?'}
          </p>
          {step === 'reply' ? (
            <>
              <div className="cn-claim-grid">
                {current.claims.map((choice, i) => (
                  <button
                    className={`cn-claim ${claim === i ? 'selected' : ''}`}
                    key={choice.text}
                    aria-pressed={claim === i}
                    onClick={() => setClaim(i)}
                  >
                    <span>{i + 1}.</span>
                    {choice.text}
                  </button>
                ))}
              </div>
              <div className="cn-conversation-actions">
                <button
                  className="cn-button cn-primary"
                  disabled={claim === null}
                  onClick={() => setStep('passage')}
                >
                  Choose a supporting passage
                </button>
              </div>
            </>
          ) : (
            <>
              <details className="cn-your-reply">
                <summary>Your reply</summary>
                <p>{claim !== null ? current.claims[claim].text : ''}</p>
              </details>
              <div className="cn-evidence-hand">
                {hand.current[round].map((e, i) => (
                  <button
                    className={`cn-evidence-card ${card === e.id ? 'selected' : ''}`}
                    key={e.id}
                    aria-pressed={card === e.id}
                    disabled={!!feedback}
                    onClick={() => setCard(e.id)}
                  >
                    <span className="cn-passage-number">{i + 1}.</span>
                    <q>{e.quote}</q>
                    <span className="cn-passage-reference">Paragraph {e.paragraph}</span>
                  </button>
                ))}
              </div>
              {!feedback && (
                <details className="cn-debate-hint">
                  <summary>Need a hint?</summary>
                  <p>
                    Look for the passage about{' '}
                    {evidence.find((e) => e.id === current.evidenceId)?.title.toLowerCase()}.
                  </p>
                </details>
              )}
              {feedback && (
                <div
                  className={`cn-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
                  role="status"
                >
                  <p>{feedback.text}</p>
                  <button
                    className="cn-text-button"
                    onClick={() =>
                      setParagraph(evidence.find((e) => e.id === current.evidenceId)!.paragraph)
                    }
                  >
                    Read the supporting passage
                  </button>
                </div>
              )}
              <div className="cn-conversation-actions">
                {feedback ? (
                  <button className="cn-button cn-primary" onClick={advance}>
                    {feedback.correct
                      ? round === 2
                        ? 'Finish the debate'
                        : 'Next objection'
                      : 'Revise your argument'}
                  </button>
                ) : (
                  <>
                    <button
                      className="cn-text-button"
                      onClick={() => {
                        setStep('reply');
                        setCard(null);
                      }}
                    >
                      Change your reply
                    </button>
                    <button
                      className="cn-button cn-primary"
                      disabled={card === null}
                      onClick={submit}
                    >
                      Commit argument
                    </button>
                  </>
                )}
              </div>
            </>
          )}
          {paragraph !== null && (
            <SourcePanel paragraph={paragraph} onClose={() => setParagraph(null)} />
          )}
        </>
      )}
    </Modal>
  );
}

export default function ConcordCampaign() {
  const [save, setSave] = useState<ConcordSave>(readSave),
    [view, setView] = useState<'home' | 'play' | 'study'>('home');
  const [studyTab, setStudyTab] = useState<'practice' | 'source' | 'journal'>('practice'),
    [playAct, setPlayAct] = useState(save.act);
  const [inspected, setInspected] = useState<Evidence | null>(null),
    [intro, setIntro] = useState(false),
    [settings, setSettings] = useState(false),
    [paused, setPaused] = useState(false);
  const [debate, setDebate] = useState(false),
    [actComplete, setActComplete] = useState(false),
    [ending, setEnding] = useState(false),
    [paragraph, setParagraph] = useState<number | null>(null);
  const [storageError, setStorageError] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const returnView = useRef<'home' | 'play'>('home'),
    audio = useRef<ConcordAudio | null>(null);
  const positions = useRef<Record<number, { x: number; z: number; yaw: number; pitch?: number }>>(
    {},
  );
  const act = acts[playAct],
    cards = evidence.slice(playAct * 3, playAct * 3 + 3),
    found = cards.filter((e) => save.collected.includes(e.id)).length;
  const blocked =
    intro || settings || paused || !!inspected || debate || actComplete || paragraph !== null;
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [save]);
  useEffect(() => {
    audio.current = new ConcordAudio();
    return () => audio.current?.dispose();
  }, []);
  useEffect(() => {
    const sound = () => {
      if (save.music && !document.hidden) audio.current?.start();
      else audio.current?.stop();
    };
    sound();
    document.addEventListener('visibilitychange', sound);
    window.addEventListener('pointerdown', sound);
    window.addEventListener('keydown', sound);
    return () => {
      document.removeEventListener('visibilitychange', sound);
      window.removeEventListener('pointerdown', sound);
      window.removeEventListener('keydown', sound);
    };
  }, [save.music]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        view !== 'play' ||
        intro ||
        settings ||
        inspected ||
        debate ||
        actComplete ||
        paragraph !== null
      )
        return;
      if (e.key === 'Escape') setPaused((p) => !p);
      if (e.code === 'KeyJ' && !paused && !e.ctrlKey && !e.metaKey) {
        e.preventDefault();
        openStudy('journal');
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view, intro, settings, inspected, debate, actComplete, paragraph, paused]);
  function openStudy(tab: 'practice' | 'source' | 'journal') {
    returnView.current = view === 'play' ? 'play' : 'home';
    setStudyTab(tab);
    setView('study');
  }
  function begin(index = save.act) {
    delete positions.current[index];
    setPlayAct(index);
    setView('play');
    setIntro(true);
    setEnding(false);
  }
  function inspect(id: string) {
    const item = evidence.find((e) => e.id === id);
    if (!item) return;
    setInspected(item);
    setSave((s) => ({ ...s, collected: [...new Set([...s.collected, id])] }));
  }
  function recordDebate() {
    setSave((s) => ({
      ...s,
      debates: [...new Set([...s.debates, playAct])],
      completed: playAct === 3 || s.completed,
      act: Math.max(s.act, Math.min(3, playAct + 1)),
    }));
  }
  function finishDebate() {
    recordDebate();
    setDebate(false);
    setActComplete(true);
  }
  function continueJourney() {
    setActComplete(false);
    if (playAct === 3) {
      setEnding(true);
      setView('home');
    } else {
      delete positions.current[playAct + 1];
      setPlayAct(playAct + 1);
      setIntro(true);
    }
  }
  const warning = storageError && (
    <p className="cn-storage" role="alert">
      Progress cannot be saved in this browser. You can keep playing for this session.
    </p>
  );
  if (view === 'study')
    return (
      <div className="cn-root">
        <Study
          save={save}
          onSave={setSave}
          onBack={() => setView(returnView.current)}
          initialTab={studyTab}
        />
        {warning}
      </div>
    );
  return (
    <main className={`cn-root ${view === 'play' ? 'cn-playing' : ''}`}>
      {view === 'home' ? (
        <div className="cn-title-screen">
          <Frontispiece />
          <a href="#course" className="cn-collection-link">
            ← ELA III collection
          </a>
          <section className="cn-title-copy">
            <p className="cn-byline">
              Henry David Thoreau’s <i>Civil Disobedience</i>
            </p>
            <h1>
              One Night
              <br />
              in Concord
            </h1>
            <p className="cn-title-setting">Massachusetts, 1846</p>
            <nav className="cn-title-menu" aria-label="Game menu">
              <button className="cn-menu-begin" onClick={() => begin()}>
                {save.collected.length || save.debates.length ? 'Continue' : 'Begin'}{' '}
                <span aria-hidden="true">→</span>
              </button>
              <button onClick={() => openStudy('practice')}>Reading practice</button>
              <button onClick={() => setSettings(true)}>Options</button>
            </nav>
          </section>
          <p className="cn-title-credit">An adaptation of the 1849 essay</p>
        </div>
      ) : (
        <div className="cn-game-shell">
          <World
            key={playAct}
            act={playAct}
            collected={save.collected}
            paused={blocked}
            reduced={save.reduced}
            onInspect={inspect}
            initialPose={positions.current[playAct]}
            onPosition={(x, z, yaw, pitch) => {
              positions.current[playAct] = { x, z, yaw, pitch };
            }}
          />
          <header className="cn-game-header">
            <button onClick={() => setPaused(true)} aria-label="Pause game">
              Pause <kbd>Esc</kbd>
            </button>
            <button onClick={() => openStudy('journal')} aria-label="Open evidence journal">
              Notebook <kbd>J</kbd>
            </button>
          </header>
          <div className="cn-chapter-caption" key={playAct}>
            <p>
              {['I', 'II', 'III', 'IV'][playAct]} · {act.time}
            </p>
            <h1>{act.name}</h1>
          </div>
          {found === 3 && !blocked && (
            <div className="cn-ready-action">
              {save.debates.includes(playAct) ? (
                <>
                  <button className="cn-button" onClick={continueJourney}>
                    {playAct === 3
                      ? 'See your journey'
                      : `Continue to ${acts[playAct + 1].time.toLowerCase()}`}{' '}
                    →
                  </button>
                  <button className="cn-text-button" onClick={() => setDebate(true)}>
                    Revisit the conversation
                  </button>
                </>
              ) : (
                <button className="cn-button" onClick={() => setDebate(true)}>
                  Enter the debate →
                </button>
              )}
            </div>
          )}
          {intro && (
            <Modal title={`Act ${playAct + 1}: ${act.name}`} onClose={() => setIntro(false)}>
              <p className="cn-margin-note">
                {['I', 'II', 'III', 'IV'][playAct]} · {act.time}
              </p>
              <h2>{act.name}</h2>
              <p className="cn-story-text">{act.intro}</p>
              {playAct === 0 && (
                <p className="cn-control-lesson">
                  <span>
                    <kbd>W A S D</kbd> walk
                  </span>
                  <span>Drag to look</span>
                  <span>
                    <kbd>E</kbd> examine
                  </span>
                  <span>
                    <kbd>H</kbd> directions
                  </span>
                </p>
              )}
              <button className="cn-button cn-primary" onClick={() => setIntro(false)}>
                Step into the scene
              </button>
            </Modal>
          )}
          {inspected && (
            <Modal title={inspected.title} onClose={() => setInspected(null)}>
              <p className="cn-margin-note">
                {hotspots.find((h) => h.id === inspected.id)?.label.replace(/^The /, '')}
              </p>
              <blockquote className="cn-quotation">“{inspected.quote}”</blockquote>
              <p className="cn-source-credit">Thoreau · paragraph {inspected.paragraph}</p>
              <p className="cn-meaning">{inspected.meaning}</p>
              <div className="cn-modal-actions">
                <button
                  className="cn-text-button"
                  onClick={() => setParagraph(inspected.paragraph)}
                >
                  Read the passage
                </button>
                <button className="cn-button cn-primary" onClick={() => setInspected(null)}>
                  Keep exploring
                </button>
              </div>
            </Modal>
          )}
          {debate && (
            <DebateEncounter
              debate={debates[playAct]}
              onWin={finishDebate}
              onResolved={recordDebate}
              onClose={() => setDebate(false)}
            />
          )}
          {actComplete && (
            <Modal title="Act complete" onClose={() => setActComplete(false)}>
              <p className="cn-margin-note">{act.place}</p>
              <h2>{playAct === 3 ? 'Morning in Concord' : 'Later that night'}</h2>
              <p className="cn-story-text">{act.ending}</p>
              <button className="cn-button cn-primary" onClick={continueJourney}>
                {playAct === 3
                  ? 'See your journey'
                  : `Continue to ${acts[playAct + 1].time.toLowerCase()}`}{' '}
                →
              </button>
              <button
                className="cn-text-button cn-block"
                onClick={() => {
                  setActComplete(false);
                  openStudy('practice');
                }}
              >
                Practice before moving on
              </button>
            </Modal>
          )}
          {paused && (
            <Modal title="Paused" onClose={() => setPaused(false)}>
              <h2>Paused</h2>
              <nav className="cn-pause-menu">
                <button onClick={() => setPaused(false)}>Resume</button>
                <button
                  onClick={() => {
                    setPaused(false);
                    openStudy('practice');
                  }}
                >
                  Reading practice
                </button>
                <button
                  onClick={() => {
                    setPaused(false);
                    setSettings(true);
                  }}
                >
                  Options
                </button>
                <button
                  onClick={() => {
                    setPaused(false);
                    setView('home');
                  }}
                >
                  Return to title
                </button>
              </nav>
            </Modal>
          )}
        </div>
      )}
      {settings && (
        <Modal
          title="Options"
          onClose={() => {
            setSettings(false);
            setConfirmReset(false);
          }}
        >
          <h2>Options</h2>
          <label className="cn-toggle">
            <span>Night ambience</span>
            <input
              type="checkbox"
              checked={save.music}
              onChange={(e) => setSave((s) => ({ ...s, music: e.target.checked }))}
            />
          </label>
          <label className="cn-toggle">
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={save.reduced}
              onChange={(e) => setSave((s) => ({ ...s, reduced: e.target.checked }))}
            />
          </label>
          {save.debates.length > 0 && (
            <details className="cn-options-section">
              <summary>Return to a chapter</summary>
              <div className="cn-chapter-menu">
                {acts.map((a, i) => (
                  <button
                    key={a.name}
                    disabled={i > save.act}
                    onClick={() => {
                      setSettings(false);
                      begin(i);
                    }}
                  >
                    {['I', 'II', 'III', 'IV'][i]}. {a.name}
                  </button>
                ))}
              </div>
            </details>
          )}
          <details className="cn-options-section">
            <summary>Controls &amp; source</summary>
            <p>
              WASD or arrows to walk. Drag to look around, or use Q/R to turn. E examines nearby
              objects. H shows directions. J opens the notebook. Escape pauses.
            </p>
            <p>
              This game adapts Thoreau’s essay into four scenes. The conversations and village are
              fictional; quoted passages and reading questions refer to the complete essay.
              Paragraph numbers belong to the bundled text.
            </p>
            <button
              className="cn-text-button"
              onClick={() => {
                setSettings(false);
                openStudy('source');
              }}
            >
              Read Civil Disobedience
            </button>
          </details>
          <div className="cn-reset-area">
            {confirmReset ? (
              <>
                <p>Erase your Concord story progress and reading history?</p>
                <div className="cn-modal-actions">
                  <button className="cn-button" onClick={() => setConfirmReset(false)}>
                    Keep my progress
                  </button>
                  <button
                    className="cn-button cn-danger"
                    onClick={() => {
                      positions.current = {};
                      setSave(freshSave());
                      setPlayAct(0);
                      setConfirmReset(false);
                      setSettings(false);
                      setView('home');
                    }}
                  >
                    Reset Concord
                  </button>
                </div>
              </>
            ) : (
              <button className="cn-text-button" onClick={() => setConfirmReset(true)}>
                Reset Concord progress
              </button>
            )}
          </div>
        </Modal>
      )}
      {ending && (
        <Modal title="Your night in Concord" onClose={() => setEnding(false)}>
          <p className="cn-margin-note">The end</p>
          <h2>Morning in Concord</h2>
          <p className="cn-story-text">{acts[3].ending}</p>
          <p>
            You have collected twelve passages and completed four conversations. The reading
            notebook is available whenever you want to return to the essay.
          </p>
          <button
            className="cn-button cn-primary"
            onClick={() => {
              setEnding(false);
              openStudy('practice');
            }}
          >
            Open reading practice
          </button>
        </Modal>
      )}
      {paragraph !== null && (
        <SourcePanel paragraph={paragraph} onClose={() => setParagraph(null)} />
      )}
      {warning}
    </main>
  );
}
