import { useEffect, useRef, useState, type ReactNode } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  ChevronRight,
  Compass,
  Feather,
  Library,
  Moon,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Shield,
  Sparkles,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import World from './World';
import Study, { SourcePanel } from './Study';
import { debates, evidence, type Debate, type Evidence } from './data';
import { freshSave, readSave, SAVE_KEY, type ConcordSave } from './save';
import { ConcordAudio } from './audio';
import './concord.css';

export const acts = [
  {
    name: 'The voice within',
    place: 'Concord village',
    time: 'DUSK',
    subtitle: 'When the crowd is certain, who decides what is right?',
    goal: 'Explore the village. Find three arguments about conscience and government.',
    intro:
      'You enter a town where every familiar institution asks for obedience. Listen closely: a law can command your body, but can it decide what is right?',
    ending:
      'A majority can possess the power to rule without possessing the truth. Your conscience is a responsibility you cannot hand away.',
  },
  {
    name: 'The price of consent',
    place: 'The tax office',
    time: 'EVENING',
    subtitle: 'An opinion is easy. What does it mean to act on it?',
    goal: 'Examine the demand. Gather three arguments about action and complicity.',
    intro:
      'An ordinary demand for a tax becomes a moral confrontation. The question is not simply whether you dislike an injustice. It is whether your own support helps sustain it.',
    ending:
      'Refusal carries a cost. For Thoreau, obedience can carry a deeper one: becoming an agent of the injustice you condemn.',
  },
  {
    name: 'A freer place',
    place: 'The county jail',
    time: 'MIDNIGHT',
    subtitle: 'The door is locked. The mind is not.',
    goal: 'Examine the cell. Discover what the State can—and cannot—confine.',
    intro:
      'Thoreau spent one night in jail for refusing the poll tax. This symbolic room brings together his reflections on force, conscience, and the strange meaning of freedom.',
    ending:
      'The State can imprison a body. Thoreau argues that physical strength gives it no superior claim to moral or intellectual authority.',
  },
  {
    name: 'A majority of one',
    place: 'The road at dawn',
    time: 'FIRST LIGHT',
    subtitle: 'You return to the same town. You see it differently.',
    goal: 'Collect the final three arguments. Define the government that could earn your respect.',
    intro:
      'Someone else paid the tax, and Thoreau was released. The essay moves beyond the cell toward a harder question: what would a State look like if it respected the individual?',
    ending:
      'The essay asks its reader to carry an argument into life: withdraw your own support from injustice and imagine a government worthy of your respect.',
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
  const panel = useRef<HTMLDivElement>(null);
  const closeRef = useRef(onClose);
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
          <X size={20} />
        </button>
        {children}
      </div>
    </div>
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
  const [feedback, setFeedback] = useState<{ correct: boolean; text: string } | null>(null);
  const [attempts, setAttempts] = useState(0),
    [hint, setHint] = useState(false),
    [won, setWon] = useState(false);
  const [paragraph, setParagraph] = useState<number | null>(null);
  const current = debate.rounds[round];
  const hand = useRef<Evidence[][]>(
    debate.rounds.map((r, i) => {
      const target = evidence.find((e) => e.id === r.evidenceId)!;
      const alternatives = evidence.slice(0, (debate.id + 1) * 3).filter((e) => e.id !== target.id);
      const rotated = [...alternatives.slice(i), ...alternatives.slice(0, i)];
      const cards = [target, ...rotated.slice(0, 3)];
      return cards.sort((a, b) => a.id.localeCompare(b.id));
    }),
  );
  function submit() {
    if (claim === null || !card || feedback) return;
    const chosen = current.claims[claim];
    const correct = chosen.correct && card === current.evidenceId;
    setAttempts((n) => n + 1);
    setFeedback({
      correct,
      text: correct
        ? current.explanation
        : !chosen.correct
          ? chosen.explanation
          : 'Your claim is sound, but this passage does not supply the strongest support for it. Read what each card actually establishes, then connect the evidence to this objection.',
    });
  }
  function advance() {
    if (!feedback?.correct) {
      setFeedback(null);
      setClaim(null);
      setCard(null);
      return;
    }
    if (round === debate.rounds.length - 1) {
      onResolved();
      setWon(true);
      return;
    }
    setRound((n) => n + 1);
    setClaim(null);
    setCard(null);
    setFeedback(null);
    setHint(false);
  }
  return (
    <Modal title={debate.title} onClose={won ? onWin : onClose} wide>
      {won ? (
        <div className="cn-debate-victory">
          <div className="cn-seal">
            <Feather size={35} />
          </div>
          <p className="cn-kicker">ARGUMENT RESOLVED</p>
          <h2>
            A conviction,
            <br />
            <em>well defended.</em>
          </h2>
          <p>
            You answered all three objections with a defensible claim and its supporting passage.
          </p>
          <div className="cn-victory-stats">
            <span>
              <strong>3 / 3</strong>Arguments defended
            </span>
            <span>
              <strong>{attempts === 3 ? 'Precise' : 'Persistent'}</strong>
              {attempts} argument attempts
            </span>
          </div>
          <button className="cn-button cn-primary" onClick={onWin}>
            Continue the night <ArrowRight size={17} />
          </button>
        </div>
      ) : (
        <>
          <div className="cn-debate-heading">
            <span className="cn-kicker">A MAJORITY OF ONE · DEBATE {debate.id + 1}</span>
            <div className="cn-round-dots" aria-label={`Objection ${round + 1} of 3`}>
              {debate.rounds.map((_, i) => (
                <i key={i} className={i < round ? 'done' : i === round ? 'active' : ''} />
              ))}
            </div>
          </div>
          <h2>{debate.title}</h2>
          <p className="cn-muted cn-debate-intro">{debate.intro}</p>
          <div className="cn-opponent">
            <div className="cn-avatar">{debate.speaker.slice(0, 1)}</div>
            <div>
              <p className="cn-kicker">
                {debate.speaker} <span>· {debate.role}</span>
              </p>
              <blockquote>{current.objection}</blockquote>
            </div>
          </div>
          <div className="cn-debate-rule">
            <Shield size={16} />
            <span>
              Build your reply: choose a claim, pair it with evidence, then commit your argument.
            </span>
          </div>
          <div className="cn-claim-grid">
            {current.claims.map((c, i) => (
              <button
                key={c.text}
                className={`cn-claim ${claim === i ? 'selected' : ''}`}
                aria-pressed={claim === i}
                disabled={!!feedback}
                onClick={() => setClaim(i)}
              >
                <span>0{i + 1}</span>
                {c.text}
                {claim === i && <Check size={16} />}
              </button>
            ))}
          </div>
          <div className="cn-deck-heading">
            <p className="cn-kicker">
              YOUR EVIDENCE HAND <span>· CHOOSE ONE</span>
            </p>
            <button className="cn-text-button" onClick={() => setHint(!hint)} aria-expanded={hint}>
              <Sparkles size={13} /> Consider the connection
            </button>
          </div>
          {hint && (
            <p className="cn-hint">
              Find the card that explains “
              {evidence.find((e) => e.id === current.evidenceId)?.title.toLowerCase()}.” A quotation
              earns its place by supporting your specific claim.
            </p>
          )}
          <div className="cn-evidence-hand">
            {hand.current[round].map((e) => (
              <button
                key={e.id}
                className={`cn-evidence-card ${card === e.id ? 'selected' : ''}`}
                onClick={() => setCard(e.id)}
                disabled={!!feedback}
                aria-pressed={card === e.id}
              >
                <span className="cn-card-number">
                  {e.id.slice(1)} <Feather size={13} />
                </span>
                <strong>{e.title}</strong>
                <q>{e.quote}</q>
                <span className="cn-card-topic">{e.topic}</span>
              </button>
            ))}
          </div>
          {feedback && (
            <div
              className={`cn-feedback ${feedback.correct ? 'correct' : 'incorrect'}`}
              role="status"
            >
              <strong>
                {feedback.correct ? 'The evidence holds.' : 'Rethink the connection.'}
              </strong>
              <p>{feedback.text}</p>
              <button
                className="cn-text-button"
                onClick={() =>
                  setParagraph(evidence.find((e) => e.id === current.evidenceId)!.paragraph)
                }
              >
                Read the supporting passage <BookOpen size={14} />
              </button>
            </div>
          )}
          <div className="cn-debate-footer">
            <span>Interpret Thoreau’s position. Your personal agreement is not scored.</span>
            {feedback ? (
              <button className="cn-button cn-primary" onClick={advance}>
                {feedback.correct
                  ? round === 2
                    ? 'Finish the debate'
                    : 'Next objection'
                  : 'Revise your argument'}{' '}
                <ArrowRight size={16} />
              </button>
            ) : (
              <button
                className="cn-button cn-primary"
                disabled={claim === null || card === null}
                onClick={submit}
              >
                Commit argument <ArrowRight size={16} />
              </button>
            )}
          </div>
          {paragraph !== null && (
            <SourcePanel paragraph={paragraph} onClose={() => setParagraph(null)} />
          )}
        </>
      )}
    </Modal>
  );
}

export default function ConcordCampaign() {
  const [save, setSave] = useState<ConcordSave>(readSave);
  const [view, setView] = useState<'home' | 'play' | 'study'>('home');
  const [studyTab, setStudyTab] = useState<'practice' | 'source' | 'journal'>('practice');
  const [playAct, setPlayAct] = useState(save.act);
  const [inspected, setInspected] = useState<Evidence | null>(null),
    [intro, setIntro] = useState(false),
    [settings, setSettings] = useState(false),
    [paused, setPaused] = useState(false);
  const [debate, setDebate] = useState(false),
    [actComplete, setActComplete] = useState(false),
    [ending, setEnding] = useState(false);
  const [paragraph, setParagraph] = useState<number | null>(null),
    [storageError, setStorageError] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const [near, setNear] = useState<string | null>(null);
  const returnView = useRef<'home' | 'play'>('home'),
    audio = useRef<ConcordAudio | null>(null);
  const act = acts[playAct],
    cards = evidence.slice(playAct * 3, playAct * 3 + 3);
  const found = cards.filter((e) => save.collected.includes(e.id)).length;
  const mastered = Object.values(save.mastery).filter((m) => m.streak >= 2).length;
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
    if (save.music && !document.hidden) audio.current?.start();
    else audio.current?.stop();
    const visibility = () => {
      if (document.hidden) audio.current?.stop();
      else if (save.music) audio.current?.start();
    };
    const unlock = () => {
      if (save.music && !document.hidden) audio.current?.start();
    };
    document.addEventListener('visibilitychange', visibility);
    window.addEventListener('pointerdown', unlock);
    window.addEventListener('keydown', unlock);
    return () => {
      document.removeEventListener('visibilitychange', visibility);
      window.removeEventListener('pointerdown', unlock);
      window.removeEventListener('keydown', unlock);
    };
  }, [save.music]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        e.key === 'Escape' &&
        view === 'play' &&
        !intro &&
        !settings &&
        !inspected &&
        !debate &&
        !actComplete &&
        paragraph === null
      )
        setPaused((p) => !p);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, [view, intro, settings, inspected, debate, actComplete, paragraph]);
  function openStudy(tab: 'practice' | 'source' | 'journal') {
    returnView.current = view === 'play' ? 'play' : 'home';
    setStudyTab(tab);
    setView('study');
  }
  function begin(index = save.act) {
    setPlayAct(index);
    setView('play');
    setIntro(true);
    setEnding(false);
  }
  function inspect(id: string) {
    const e = evidence.find((e) => e.id === id);
    if (!e) return;
    setInspected(e);
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
      setPlayAct(playAct + 1);
      setIntro(true);
    }
  }
  if (view === 'study')
    return (
      <div className="cn-root">
        <Study
          save={save}
          onSave={setSave}
          onBack={() => setView(returnView.current)}
          initialTab={studyTab}
        />
        {storageError && (
          <p className="cn-storage" role="alert">
            Browser storage is unavailable. This session works, but progress cannot be saved on this
            device.
          </p>
        )}
      </div>
    );
  return (
    <main className={`cn-root ${view === 'play' ? 'cn-playing' : ''}`}>
      {view === 'home' ? (
        <>
          <div className="cn-hero-world" aria-hidden="true">
            <World
              act={0}
              collected={[]}
              paused={settings || ending}
              reduced={save.reduced}
              onInspect={() => {}}
              preview
            />
          </div>
          <div className="cn-hero-shade" />
          <header className="cn-header">
            <a href="#course" className="cn-brand">
              <span>
                <Moon size={18} />
              </span>
              <div>
                DUAL CREDIT<small>ELA III COLLECTION</small>
              </div>
            </a>
            <nav aria-label="Concord navigation">
              <button onClick={() => openStudy('source')}>
                <BookOpen size={15} /> The essay
              </button>
              <button onClick={() => openStudy('practice')}>
                <Library size={15} /> Study room
              </button>
              <button
                className="cn-icon-button"
                onClick={() => setSettings(true)}
                aria-label="Open settings"
              >
                <Settings size={18} />
              </button>
            </nav>
          </header>
          <section className="cn-hero">
            <div className="cn-kicker">
              <i /> HENRY DAVID THOREAU · CIVIL DISOBEDIENCE
            </div>
            <h1>
              One Night
              <br />
              in <em>Concord.</em>
            </h1>
            <p className="cn-hero-tagline">
              The town sleeps.
              <br />
              Your conscience doesn’t.
            </p>
            <p className="cn-hero-description">
              Walk the streets. Follow the evidence.
              <br />
              Defend an idea powerful enough to outlive a prison wall.
            </p>
            <div className="cn-hero-actions">
              <button className="cn-button cn-primary" onClick={() => begin()}>
                <Play size={16} />
                {save.collected.length ? 'Continue your night' : 'Enter Concord'}
                <ArrowRight size={17} />
              </button>
              <button className="cn-button cn-secondary" onClick={() => openStudy('practice')}>
                Practice the reading <BookOpen size={16} />
              </button>
            </div>
            <div className="cn-hero-details">
              <span>
                <Compass size={14} /> 3D EXPLORATION
              </span>
              <span>
                <Feather size={14} /> STRATEGIC DEBATES
              </span>
              <span>
                <BookOpen size={14} /> CLOSE READING
              </span>
            </div>
          </section>
          <div className="cn-scene-caption">
            <span className="cn-cross">+</span>
            <div>
              CONCORD, MASSACHUSETTS<small>A small town. A radical question.</small>
            </div>
            <span className="cn-caption-line" />
          </div>
          <section className="cn-night-path" aria-label="The four acts">
            <div className="cn-path-label">
              <span className="cn-kicker">ONE NIGHT. FOUR QUESTIONS.</span>
              <span className="cn-muted">Your progress saves on this device.</span>
            </div>
            <div className="cn-acts">
              {acts.map((a, i) => (
                <button
                  key={a.name}
                  className={`cn-act ${save.debates.includes(i) ? 'complete' : ''}`}
                  onClick={() => begin(i)}
                  disabled={i > save.act}
                >
                  <span className="cn-act-number">
                    {save.debates.includes(i) ? <Check size={17} /> : `0${i + 1}`}
                  </span>
                  <div>
                    <small>{a.time}</small>
                    <h3>{a.name}</h3>
                    <p>{a.place}</p>
                  </div>
                  <ChevronRight size={16} />
                </button>
              ))}
            </div>
          </section>
          <section className="cn-study-strip">
            <div className="cn-study-icon">
              <BookOpen size={22} />
            </div>
            <div>
              <p className="cn-kicker">KNOW THE TEXT. OWN THE ARGUMENT.</p>
              <h2>Your reading check starts here.</h2>
              <p>
                72 questions, passage-backed explanations, and practice that returns to what you
                miss.
              </p>
            </div>
            <button className="cn-button cn-secondary" onClick={() => openStudy('practice')}>
              Open study room <ArrowRight size={16} />
            </button>
            <div className="cn-mastery-tiny">
              <strong>
                {mastered}
                <span>/72</span>
              </strong>
              <small>CONCEPTS REINFORCED</small>
            </div>
          </section>
          <footer className="cn-footer">
            <a href="#course">
              <ArrowLeft size={13} /> Back to the ELA III collection
            </a>
            <p>
              Based on the full 1849 essay. Original dialogue and symbolic scenery interpret the
              text.
            </p>
            <span>EXPLORE · QUESTION · UNDERSTAND</span>
          </footer>
        </>
      ) : (
        <div className="cn-game-shell">
          <World
            key={playAct}
            act={playAct}
            collected={save.collected}
            paused={blocked}
            reduced={save.reduced}
            onInspect={inspect}
            onNear={setNear}
          />
          <header className="cn-game-header">
            <button
              className="cn-game-title"
              onClick={() => {
                setView('home');
                setPaused(false);
              }}
              aria-label="Return to Concord title screen"
            >
              <Moon size={22} />
              <span>
                ONE NIGHT<small>IN CONCORD</small>
              </span>
            </button>
            <div className="cn-act-heading">
              <span className="cn-kicker">
                ACT 0{playAct + 1} · {act.time}
              </span>
              <h1>{act.name}</h1>
            </div>
            <div className="cn-game-tools">
              <button onClick={() => openStudy('journal')} aria-label="Open evidence journal">
                <BookOpen size={19} />
                <span>{save.collected.length}/12</span>
              </button>
              <button
                onClick={() => setSave((s) => ({ ...s, music: !s.music }))}
                aria-label={save.music ? 'Mute ambience' : 'Enable ambience'}
              >
                {save.music ? <Volume2 size={19} /> : <VolumeX size={19} />}
              </button>
              <button onClick={() => setPaused(true)} aria-label="Pause game">
                <Pause size={20} />
              </button>
            </div>
          </header>
          <aside className="cn-objective">
            <p className="cn-kicker">
              <Compass size={13} /> {act.place.toUpperCase()}
            </p>
            <h2>
              {save.debates.includes(playAct)
                ? 'A conviction defended.'
                : found === 3
                  ? 'An argument awaits.'
                  : 'Follow your conscience.'}
            </h2>
            <p>
              {save.debates.includes(playAct)
                ? 'This act is complete. Continue your journey, or revisit the argument.'
                : found === 3
                  ? 'Your evidence is gathered. Put it to work in a debate.'
                  : act.goal}
            </p>
            <div className="cn-clue-list">
              {cards.map((e) => (
                <div key={e.id} className={save.collected.includes(e.id) ? 'found' : ''}>
                  <span>{save.collected.includes(e.id) ? <Check size={12} /> : <i />}</span>
                  {save.collected.includes(e.id) ? e.title : 'Undiscovered evidence'}
                </div>
              ))}
            </div>
            {found === 3 &&
              (save.debates.includes(playAct) ? (
                <>
                  <button className="cn-button cn-primary" onClick={continueJourney}>
                    {playAct === 3
                      ? 'See your journey'
                      : `Continue to ${acts[playAct + 1].time.toLowerCase()}`}{' '}
                    <ArrowRight size={16} />
                  </button>
                  <button className="cn-text-button cn-block" onClick={() => setDebate(true)}>
                    Replay this debate <RotateCcw size={12} />
                  </button>
                </>
              ) : (
                <button className="cn-button cn-primary" onClick={() => setDebate(true)}>
                  Enter the debate <ArrowRight size={16} />
                </button>
              ))}
          </aside>
          <div className="cn-location-pill">
            <i />
            {act.time} <span>·</span> {near ? `Near ${near}` : act.place}
          </div>
          <div className="cn-game-bottom">
            <span>
              <kbd>W A S D</kbd> Move <i /> Drag to look <i />
              <kbd>E</kbd> Inspect <i />
              <kbd>Esc</kbd> Pause
            </span>
            <button onClick={() => openStudy('practice')}>
              Reading practice <ArrowRight size={14} />
            </button>
          </div>
          {intro && (
            <Modal title={`Act ${playAct + 1}: ${act.name}`} onClose={() => setIntro(false)}>
              <p className="cn-kicker">
                ACT 0{playAct + 1} · {act.place.toUpperCase()}
              </p>
              <h2 className="cn-story-title">
                {act.name}
                <span>.</span>
              </h2>
              <p className="cn-story-subtitle">{act.subtitle}</p>
              <p className="cn-story-text">{act.intro}</p>
              <div className="cn-tutorial">
                <Compass size={20} />
                <p>
                  Walk with WASD or the arrow keys. Drag the scene to look around. Approach the
                  amber markers and press E or Inspect. Touch controls are available on phones.
                </p>
              </div>
              <button className="cn-button cn-primary" onClick={() => setIntro(false)}>
                Step into the scene <ArrowRight size={16} />
              </button>
              <p className="cn-adaptation">
                Scene dialogue and geography are an original adaptation. Evidence cards quote the
                essay.
              </p>
            </Modal>
          )}
          {inspected && (
            <Modal title={inspected.title} onClose={() => setInspected(null)}>
              <p className="cn-kicker">
                EVIDENCE {inspected.id.slice(1)} / 12 · ADDED TO YOUR JOURNAL
              </p>
              <h2>{inspected.title}</h2>
              <blockquote className="cn-quotation">“{inspected.quote}”</blockquote>
              <p className="cn-quote-author">HENRY DAVID THOREAU · ¶{inspected.paragraph}</p>
              <div className="cn-meaning">
                <p className="cn-kicker">WHAT THIS ESTABLISHES</p>
                <p>{inspected.meaning}</p>
              </div>
              <div className="cn-modal-actions">
                <button
                  className="cn-button cn-secondary"
                  onClick={() => setParagraph(inspected.paragraph)}
                >
                  Read the passage <BookOpen size={15} />
                </button>
                <button className="cn-button cn-primary" onClick={() => setInspected(null)}>
                  Keep exploring <ArrowRight size={16} />
                </button>
              </div>
            </Modal>
          )}
          {debate && (
            <DebateEncounter
              key={playAct}
              debate={debates[playAct]}
              onClose={() => setDebate(false)}
              onWin={finishDebate}
              onResolved={recordDebate}
            />
          )}
          {actComplete && (
            <Modal title="Act complete" onClose={() => setActComplete(false)}>
              <div className="cn-seal">
                <Feather size={29} />
              </div>
              <p className="cn-kicker">ACT 0{playAct + 1} COMPLETE</p>
              <h2>{playAct === 3 ? 'Morning comes.' : 'Carry the argument forward.'}</h2>
              <p className="cn-story-text">{act.ending}</p>
              <button className="cn-button cn-primary" onClick={continueJourney}>
                {playAct === 3
                  ? 'See your journey'
                  : `Continue to ${acts[playAct + 1]?.time.toLowerCase()}`}{' '}
                <ArrowRight size={16} />
              </button>
              <button
                className="cn-text-button cn-block"
                onClick={() => {
                  setActComplete(false);
                  openStudy('practice');
                }}
              >
                Practice before moving on <BookOpen size={14} />
              </button>
            </Modal>
          )}
          {paused && (
            <Modal title="The night can wait" onClose={() => setPaused(false)}>
              <p className="cn-kicker">PAUSED · PROGRESS SAVED</p>
              <h2>The night can wait.</h2>
              <p className="cn-story-text">Take a breath. Your place in the argument is safe.</p>
              <div className="cn-pause-actions">
                <button className="cn-button cn-primary" onClick={() => setPaused(false)}>
                  <Play size={16} /> Return to the night
                </button>
                <button
                  className="cn-button cn-secondary"
                  onClick={() => {
                    setPaused(false);
                    openStudy('practice');
                  }}
                >
                  <BookOpen size={16} /> Open study room
                </button>
                <button
                  className="cn-button cn-secondary"
                  onClick={() => {
                    setPaused(false);
                    setSettings(true);
                  }}
                >
                  <Settings size={16} /> Settings
                </button>
                <button
                  className="cn-text-button"
                  onClick={() => {
                    setPaused(false);
                    setView('home');
                  }}
                >
                  <ArrowLeft size={15} /> Return to title
                </button>
              </div>
            </Modal>
          )}
        </div>
      )}
      {storageError && (
        <p className="cn-storage" role="alert">
          Browser storage is unavailable. This session works, but progress cannot be saved on this
          device.
        </p>
      )}
      {settings && (
        <Modal
          title="Settings"
          onClose={() => {
            setSettings(false);
            setConfirmReset(false);
          }}
        >
          <p className="cn-kicker">MAKE THE NIGHT YOUR OWN</p>
          <h2>Settings</h2>
          <label className="cn-toggle">
            <span>
              <strong>Night ambience</strong>
              <small>Original, quiet instrumental tones</small>
            </span>
            <input
              type="checkbox"
              checked={save.music}
              onChange={(e) => setSave((s) => ({ ...s, music: e.target.checked }))}
            />
          </label>
          <label className="cn-toggle">
            <span>
              <strong>Reduced motion</strong>
              <small>Still title camera and gentler movement</small>
            </span>
            <input
              type="checkbox"
              checked={save.reduced}
              onChange={(e) => setSave((s) => ({ ...s, reduced: e.target.checked }))}
            />
          </label>
          <p className="cn-setting-note">
            Progress is stored on this browser. Practice and the complete essay are available at any
            time. Internal paragraph numbers identify the bundled text, not your teacher’s edition.
          </p>
          <div className="cn-reset-area">
            {confirmReset ? (
              <>
                <p>Erase this campaign’s discoveries, debates, and quiz history?</p>
                <div className="cn-modal-actions">
                  <button className="cn-button cn-secondary" onClick={() => setConfirmReset(false)}>
                    Keep my progress
                  </button>
                  <button
                    className="cn-button cn-danger"
                    onClick={() => {
                      setSave(freshSave());
                      setPlayAct(0);
                      setSettings(false);
                      setConfirmReset(false);
                      setView('home');
                    }}
                  >
                    Reset Concord
                  </button>
                </div>
              </>
            ) : (
              <button className="cn-text-button" onClick={() => setConfirmReset(true)}>
                <RotateCcw size={14} /> Reset Concord progress
              </button>
            )}
          </div>
        </Modal>
      )}
      {ending && (
        <Modal title="Your night in Concord" onClose={() => setEnding(false)}>
          <div className="cn-seal">
            <Moon size={34} />
          </div>
          <p className="cn-kicker">ONE NIGHT IN CONCORD · COMPLETE</p>
          <h2>
            The argument
            <br />
            <em>travels with you.</em>
          </h2>
          <p className="cn-story-text">
            Twelve pieces of evidence. Four debates. One question that refuses to stay behind a
            locked door: what will you do with what you believe?
          </p>
          <div className="cn-victory-stats">
            <span>
              <strong>12 / 12</strong>Evidence discovered
            </span>
            <span>
              <strong>4 / 4</strong>Debates resolved
            </span>
          </div>
          <button
            className="cn-button cn-primary"
            onClick={() => {
              setEnding(false);
              openStudy('practice');
            }}
          >
            Take the practice reading check <ArrowRight size={16} />
          </button>
        </Modal>
      )}
      {paragraph !== null && (
        <SourcePanel paragraph={paragraph} onClose={() => setParagraph(null)} />
      )}
    </main>
  );
}
