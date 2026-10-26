import { useEffect, useRef, useState, type ReactNode } from 'react';
import World, { hotspots } from './World';
import Frontispiece from './Frontispiece';
import Study, { SourcePanel } from './Study';
import { evidence, type Evidence } from './data';
import Conversation, { type SpeechAnchor } from './ConversationView';
import {
  advanceConversation,
  conversationActors,
  startConversation,
  type ConversationAction,
  type ConversationState,
} from './conversation';
import type { ConversationPose } from './scene';
import type { SpeechProgress } from './speech';
import { freshTownMemory } from './exploration';
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
    [ending, setEnding] = useState(false),
    [paragraph, setParagraph] = useState<number | null>(null);
  const [storageError, setStorageError] = useState(false),
    [confirmReset, setConfirmReset] = useState(false);
  const [interacting, setInteracting] = useState(false);
  const discussions = useRef<Record<number, ConversationState>>({});
  const [discussion, setDiscussion] = useState<ConversationState | null>(null);
  const [delivery, setDelivery] = useState<ConversationPose | null>(null);
  const speechMemory = useRef<Record<number, SpeechProgress>>({});
  const townMemory = useRef(freshTownMemory());
  const [initialSpeech, setInitialSpeech] = useState<SpeechProgress | null>(null);
  const [speechAnchor, setSpeechAnchor] = useState<SpeechAnchor>({ x: 0, y: 0, visible: false });
  const returnView = useRef<'home' | 'play'>('home'),
    audio = useRef<ConcordAudio | null>(null);
  const positions = useRef<Record<number, { x: number; z: number; yaw: number; pitch?: number }>>(
    {},
  );
  const act = acts[playAct],
    cards = evidence.slice(playAct * 3, playAct * 3 + 3),
    found = cards.filter((e) => save.collected.includes(e.id)).length;
  const blocked = intro || settings || paused || !!inspected || paragraph !== null;
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
      audio.current?.configure(save.sound, save.music, playAct, view === 'play' && !blocked);
      if ((save.sound || save.music) && !document.hidden) audio.current?.start();
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
  }, [save.music, save.sound, playAct, view, blocked]);
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        view !== 'play' ||
        interacting ||
        e.defaultPrevented ||
        intro ||
        settings ||
        inspected ||
        debate ||
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
  }, [view, intro, settings, inspected, debate, paragraph, paused, interacting]);
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
    setDebate(false);
    setDelivery(null);
    setInitialSpeech(null);
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
  function startTalking() {
    const previous = discussions.current[playAct];
    const resuming = previous && previous.stage !== 'complete';
    const next = resuming
      ? advanceConversation(previous, { type: 'resume' })
      : startConversation(playAct);
    const remembered = resuming ? (speechMemory.current[playAct] ?? null) : null;
    setInitialSpeech(remembered);
    discussions.current[playAct] = next;
    setDiscussion(next);
    setDebate(true);
    setDelivery({
      actorId: conversationActors[playAct].id,
      phase: 'speaking',
      beat: next.attempts * 100 + next.round * 10,
      speaking: !remembered || remembered.revealed < remembered.text.length,
      text: remembered?.text,
      revealed: remembered?.revealed,
    });
  }
  function rememberDelivery(pose: ConversationPose) {
    const speaker = conversationActors.findIndex((actor) => actor.id === pose.actorId);
    if (speaker >= 0 && pose.text !== undefined && pose.revealed !== undefined)
      speechMemory.current[speaker] = { text: pose.text, revealed: pose.revealed };
    setDelivery(pose);
  }
  function conversationAction(action: ConversationAction) {
    const previous = discussions.current[playAct];
    if (!previous) return;
    const next = advanceConversation(previous, action);
    discussions.current[playAct] = next;
    setDiscussion(next);
    if (next.stage === 'farewell' && previous.stage !== 'farewell') recordDebate();
  }
  function stepAway() {
    conversationAction({ type: 'leave' });
    setDebate(false);
    setDelivery(null);
  }
  function continueJourney() {
    setDebate(false);
    setDelivery(null);
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
            key={`world-${playAct}`}
            act={playAct}
            collected={save.collected}
            paused={blocked}
            reduced={save.reduced}
            onInspect={inspect}
            onInteractionActive={setInteracting}
            talkAvailable={found === 3}
            talkResuming={
              !!discussions.current[playAct] && discussions.current[playAct].stage !== 'complete'
            }
            speakerFamiliar={save.debates.includes(playAct) || !!discussions.current[playAct]}
            onTalk={startTalking}
            onStepAway={stepAway}
            conversation={debate ? delivery : null}
            onConversationAnchor={setSpeechAnchor}
            onSound={(cue, surface, speed) => audio.current?.play(cue, surface, speed)}
            initialPose={positions.current[playAct]}
            initialTownMemory={townMemory.current}
            onTownMemory={(memory) => {
              townMemory.current = memory;
            }}
            onPosition={(x, z, yaw, pitch) => {
              positions.current[playAct] = { x, z, yaw, pitch };
            }}
          />
          <header className="cn-game-header">
            <button onClick={() => setPaused(true)} aria-label="Pause game">
              Pause <kbd>Esc</kbd>
            </button>
            <button
              disabled={interacting || debate}
              onClick={() => openStudy('journal')}
              aria-label="Open evidence journal"
            >
              Notebook <kbd>J</kbd>
            </button>
          </header>
          <div className="cn-chapter-caption" key={`chapter-${playAct}`}>
            <p>
              {['I', 'II', 'III', 'IV'][playAct]} · {act.time}
            </p>
            <h1>{act.name}</h1>
          </div>
          {found === 3 && !blocked && !interacting && !debate && save.debates.includes(playAct) && (
            <div className="cn-ready-action">
              <button className="cn-button" onClick={continueJourney}>
                {playAct === 3
                  ? 'See your journey'
                  : `Continue to ${acts[playAct + 1].time.toLowerCase()}`}{' '}
                →
              </button>
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
                    <kbd>Shift</kbd> walk briskly
                  </span>
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
          {debate && discussion && (
            <Conversation
              state={discussion}
              reduced={save.reduced}
              paused={blocked}
              anchor={speechAnchor}
              ending={act.ending}
              initialSpeech={initialSpeech}
              onAction={conversationAction}
              onDelivery={rememberDelivery}
              onClose={stepAway}
              onContinue={continueJourney}
            />
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
            <span>World sounds</span>
            <input
              type="checkbox"
              checked={save.sound}
              onChange={(e) => setSave((s) => ({ ...s, sound: e.target.checked }))}
            />
          </label>
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
              WASD or arrows to walk; Shift walks briskly. Drag to look, use Q/R to turn, or choose
              Free look to follow the mouse. E begins an encounter; hold E when prompted, or use the
              on-screen buttons. Number keys choose a reply. Escape steps away or pauses. H shows
              directions. J opens the notebook.
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
                      discussions.current = {};
                      speechMemory.current = {};
                      townMemory.current = freshTownMemory();
                      setInitialSpeech(null);
                      setDiscussion(null);
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
