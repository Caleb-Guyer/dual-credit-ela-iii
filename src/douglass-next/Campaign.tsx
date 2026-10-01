import DefaultChapterArt from './Art';
import Rhythm from './Rhythm';
import { useEffect, useRef, useState, type CSSProperties, type ComponentType } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  Check,
  ChevronUp,
  Headphones,
  Music2,
  Pause,
  Play,
  RotateCcw,
  Settings,
  Volume2,
  VolumeX,
  X,
} from 'lucide-react';
import { Dialog } from '../components/Common';
import { stopSpeech } from '../lib/speech';
import { perform } from './voice';
import { Soundscape } from './soundscape';
import { CampaignAudio } from '../douglass/audio';
import {
  missions,
  chapterQuestions,
  passage,
  questions,
  source,
  type Chapter,
  type Line,
  type Mission,
  type Question,
  type Ref,
  type Task,
} from './data';
import { AdventureEngine } from './engine';
import { AdventureWorld } from './world';
import { freshSave, readSave, recordResult, SAVE_KEY, type Save } from './save';
import './campaign.css';

function SpokenLine({
  line,
  voice,
  reduced,
  last,
  onNext,
  onVoice,
  onSource,
  autoplay,
}: {
  line: Line;
  voice: boolean;
  reduced: boolean;
  last: boolean;
  onNext: () => void;
  onVoice: () => void;
  onSource: (refs: Ref[]) => void;
  autoplay: boolean;
}) {
  const [shown, setShown] = useState(0);
  const [unavailable, setUnavailable] = useState(false);
  const stop = useRef<() => void>(() => {});
  const autoTimer = useRef<number | undefined>(undefined);
  const advance = useRef(onNext);
  advance.current = onNext;
  const play = () => {
    clearTimeout(autoTimer.current);
    stop.current();
    setUnavailable(false);
    stop.current = perform(line.text, {
      speaker: line.speaker,
      onError: () => setUnavailable(true),
      onEnd: () => {
        setShown(line.text.length);
        if (autoplay) autoTimer.current = window.setTimeout(() => advance.current(), 700);
      },
    });
  };
  useEffect(() => {
    setShown(0);
  }, [line]);
  useEffect(() => {
    if (voice) play();
    return () => {
      stop.current();
      clearTimeout(autoTimer.current);
    };
  }, [line, voice, autoplay]);
  useEffect(() => {
    if (reduced || shown >= line.text.length) return;
    const id = window.setInterval(() => setShown((n) => Math.min(n + 2, line.text.length)), 25);
    return () => clearInterval(id);
  }, [line, reduced, shown >= line.text.length]);
  const complete = reduced || shown >= line.text.length;
  const next = () => {
    clearTimeout(autoTimer.current);
    if (!complete) setShown(line.text.length);
    else {
      stop.current();
      onNext();
    }
  };
  const callback = useRef(next);
  callback.current = next;
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (e.code === 'Enter' && !(e.target instanceof HTMLButtonElement)) {
        e.preventDefault();
        callback.current();
      }
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  return (
    <section className="dn-dialogue" aria-label="Douglass narration">
      <div className="dn-dialogue-label">
        <span className="dn-voice-mark">
          <Headphones size={16} />
        </span>
        <strong>{line.speaker}</strong>
        <span>
          {line.refs[0].startsWith('12.') ? 'APPENDIX' : `CH. ${line.refs[0].split('.')[0]}`}
        </span>
      </div>
      <p aria-label={line.text}>
        {[...line.text].map((c, i) => (
          <span aria-hidden="true" key={i} className={reduced || i < shown ? 'visible' : ''}>
            {c}
          </span>
        ))}
      </p>
      <div className="dn-dialogue-footer">
        <button onClick={() => onSource(line.refs)}>
          {line.exact ? 'Reported speech' : 'Source paraphrase'} ↗
        </button>
        <button aria-label="Replay narration" onClick={play}>
          <RotateCcw size={15} />
        </button>
        <button aria-label={voice ? 'Mute narration' : 'Enable narration'} onClick={onVoice}>
          {voice ? <Volume2 size={17} /> : <VolumeX size={17} />}
        </button>
        {unavailable && <small>Voice unavailable on this device</small>}
        <button className="dn-primary dn-next" onClick={next}>
          {complete ? (last ? 'Continue' : 'Next') : 'Reveal'}
          <ArrowRight size={16} />
        </button>
      </div>
    </section>
  );
}

function Activity({
  tasks,
  onComplete,
  onSound,
  voice,
}: {
  tasks: Task[];
  onComplete: () => void;
  onSound: () => void;
  voice: boolean;
}) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [solved, setSolved] = useState(false);
  const current = tasks[index];
  useEffect(() => {
    if (voice) return perform(solved ? current.why : current.instruction, { speaker: 'Narrator' });
  }, [current, voice, solved]);
  const choose = (i: number) => {
    if (solved) return;
    setSelected(i);
    if (i === current.answer) {
      setSolved(true);
      onSound();
    }
  };
  return (
    <section className="dn-activity" aria-label="Chapter activity">
      <p className="dn-kicker">
        {current.title} · {index + 1}/{tasks.length}
      </p>
      <h2>{current.instruction}</h2>
      <div className="dn-answers">
        {current.choices.map((c, i) => (
          <button
            key={c}
            disabled={solved}
            className={selected === i ? (solved ? 'correct' : 'incorrect') : ''}
            onClick={() => choose(i)}
          >
            <span>{i + 1}</span>
            {c}
          </button>
        ))}
      </div>
      {selected !== null && (
        <p className="dn-feedback" role="status">
          {solved ? current.why : 'Try another connection. You can work this out.'}
        </p>
      )}
      {solved && (
        <button
          className="dn-primary"
          onClick={() => {
            if (index + 1 === tasks.length) onComplete();
            else {
              setIndex(index + 1);
              setSelected(null);
              setSolved(false);
            }
          }}
        >
          Continue
          <ArrowRight size={17} />
        </button>
      )}
    </section>
  );
}

function GameView({
  mission,
  stage,
  save,
  audio,
  onCheckpoint,
  onFinish,
  onExit,
  onSettings,
  onSource,
  onVoice,
}: {
  mission: Mission;
  stage: number;
  save: Save;
  audio: CampaignAudio;
  onCheckpoint: (stage: number) => void;
  onFinish: () => void;
  onExit: () => void;
  onSettings: () => void;
  onSource: (refs: Ref[]) => void;
  onVoice: () => void;
}) {
  const canvas = useRef<HTMLCanvasElement>(null),
    game = useRef(new AdventureEngine(mission.id, stage, mission));
  const [error, setError] = useState(''),
    [paused, setPaused] = useState(false),
    [line, setLine] = useState<number | null>(null),
    [activity, setActivity] = useState(false),
    [rhythm, setRhythm] = useState(false);
  const [hud, setHud] = useState({
    stage,
    range: 0,
    bearing: 0,
    ready: false,
    herded: 0,
    collected: 0,
  });
  const keys = useRef(new Set<string>()),
    touch = useRef({ forward: 0, strafe: 0 });
  const settings = useRef(save);
  settings.current = save;
  const blocked = useRef(false);
  blocked.current = paused || line !== null || activity || rhythm;
  const cinematic = useRef<string | undefined>(undefined);
  cinematic.current =
    line !== null && !paused
      ? mission.stages[Math.min(hud.stage, mission.stages.length - 1)].lines[line]?.speaker
      : undefined;
  const speaking = useRef(false);
  const interactRef = useRef<() => void>(() => {});
  const interaction = () => {
    if (blocked.current) return;
    if (game.current.interact()) {
      document.exitPointerLock?.();
      keys.current.clear();
      touch.current = { forward: 0, strafe: 0 };
      setLine(0);
      audio.effect('memory');
    } else if (game.current.target?.herd) audio.effect('ring');
  };
  interactRef.current = interaction;
  const release = () => {
    keys.current.clear();
    touch.current = { forward: 0, strafe: 0 };
  };
  useEffect(() => {
    let world: AdventureWorld;
    try {
      world = new AdventureWorld(canvas.current!, game.current);
    } catch {
      setError(
        'This browser could not start 3D graphics. Turn on hardware acceleration or try a current browser. Your progress is safe.',
      );
      return;
    }
    let frame = 0,
      previous = performance.now(),
      lastHUD = 0,
      lastWorld = 0,
      previousCinematic: string | undefined;
    const soundscape = audio.context
      ? new Soundscape(audio.context, mission.id, settings.current.music)
      : undefined;
    const speech = (e: Event) => {
      speaking.current = (e as CustomEvent<boolean>).detail;
    };
    window.addEventListener('franklin-speech', speech);
    const update = (now: number) => {
      const dt = (now - previous) / 1000;
      previous = now;
      const engine = game.current;
      engine.paused = blocked.current || document.hidden;
      const k = keys.current;
      const collected = engine.collected.length;
      engine.update(dt, {
        forward:
          (k.has('KeyW') || k.has('ArrowUp') ? 1 : 0) -
          (k.has('KeyS') || k.has('ArrowDown') ? 1 : 0) +
          touch.current.forward,
        strafe: (k.has('KeyD') ? 1 : 0) - (k.has('KeyA') ? 1 : 0) + touch.current.strafe,
        turn: (k.has('ArrowRight') ? 1 : 0) - (k.has('ArrowLeft') ? 1 : 0),
        sprint: k.has('ShiftLeft') || k.has('ShiftRight'),
      });
      if (engine.collected.length > collected) audio.effect('ring');
      // Paused activities need responsive input, not a full 3D redraw on every animation frame.
      // Conversations keep their character animation; an occasional redraw handles canvas resizing.
      if (
        !blocked.current ||
        cinematic.current ||
        previousCinematic !== cinematic.current ||
        now - lastWorld > 1000
      ) {
        world.render(now / 1000, settings.current.reduced, cinematic.current, speaking.current);
        lastWorld = now;
      }
      previousCinematic = cinematic.current;
      soundscape?.update(settings.current.music, engine.paused && !cinematic.current, engine.steps);
      if (now - lastHUD > 80) {
        lastHUD = now;
        setHud({
          stage: engine.stage,
          range: engine.range,
          bearing: engine.bearing,
          ready: engine.ready,
          herded: engine.herded,
          collected: engine.collected.length,
        });
      }
      frame = requestAnimationFrame(update);
    };
    frame = requestAnimationFrame(update);
    const keydown = (e: KeyboardEvent) => {
      if (e.code === 'Escape') {
        release();
        stopSpeech();
        setPaused(true);
        return;
      }
      if (blocked.current || e.target instanceof HTMLInputElement) return;
      if (['Space', 'ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight', 'KeyE'].includes(e.code))
        e.preventDefault();
      keys.current.add(e.code);
      if (e.code === 'Space' && !e.repeat) {
        engineJump();
      }
      if (e.code === 'KeyE' && !e.repeat) interactRef.current();
    };
    const engineJump = () => {
      game.current.jump();
      audio.effect('jump');
    };
    const keyup = (e: KeyboardEvent) => keys.current.delete(e.code);
    const move = (e: MouseEvent) => {
      if (document.pointerLockElement === canvas.current && !blocked.current)
        game.current.look(
          e.movementX * 0.0025 * settings.current.sensitivity,
          e.movementY * 0.002 * settings.current.sensitivity,
        );
    };
    const hidden = () => {
      if (document.hidden) {
        release();
        stopSpeech();
        setPaused(true);
      }
    };
    const blur = () => {
      release();
      stopSpeech();
      setPaused(true);
    };
    window.addEventListener('keydown', keydown);
    window.addEventListener('keyup', keyup);
    window.addEventListener('mousemove', move);
    window.addEventListener('blur', blur);
    document.addEventListener('visibilitychange', hidden);
    return () => {
      cancelAnimationFrame(frame);
      world.dispose();
      soundscape?.dispose();
      window.removeEventListener('franklin-speech', speech);
      release();
      document.exitPointerLock?.();
      window.removeEventListener('keydown', keydown);
      window.removeEventListener('keyup', keyup);
      window.removeEventListener('mousemove', move);
      window.removeEventListener('blur', blur);
      document.removeEventListener('visibilitychange', hidden);
    };
  }, []);
  useEffect(() => {
    audio.setPaused(paused || line !== null || activity || rhythm);
  }, [audio, paused, line, activity, rhythm]);
  const complete = () => {
    game.current.completeStage();
    const next = game.current.stage;
    setLine(null);
    setActivity(false);
    setRhythm(false);
    setHud((h) => ({ ...h, stage: next, collected: 0 }));
    onCheckpoint(next);
    audio.effect('finish');
    if (next === mission.stages.length) onFinish();
  };
  const current = mission.stages[hud.stage] ?? mission.stages[mission.stages.length - 1];
  const nextLine = () => {
    if (line !== null && line + 1 < current.lines.length) setLine(line + 1);
    else {
      setLine(null);
      if (current.rhythm) setRhythm(true);
      else if (current.task) setActivity(true);
      else complete();
    }
  };
  const drag = useRef<{ id: number; x: number; y: number } | null>(null);
  const stick = useRef<{ id: number; x: number; y: number } | null>(null);
  return (
    <div className={`dn-game ${line !== null ? 'dn-cinematic' : ''}`}>
      <canvas
        className="dn-canvas"
        ref={canvas}
        aria-label={`${mission.label ?? `Chapter ${mission.id}`}: ${mission.title}, first-person 3D world`}
        tabIndex={0}
        onClick={() => {
          if (!blocked.current && matchMedia('(pointer: fine)').matches) {
            canvas.current?.focus();
            void canvas.current?.requestPointerLock?.()?.catch(() => {});
          }
        }}
        onPointerDown={(e) => {
          if (!blocked.current && document.pointerLockElement !== canvas.current) {
            drag.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
            e.currentTarget.setPointerCapture(e.pointerId);
          }
        }}
        onPointerMove={(e) => {
          const d = drag.current;
          if (d && d.id === e.pointerId && !blocked.current) {
            game.current.look(
              (e.clientX - d.x) * 0.005 * save.sensitivity,
              (e.clientY - d.y) * 0.004 * save.sensitivity,
            );
            d.x = e.clientX;
            d.y = e.clientY;
          }
        }}
        onPointerUp={() => (drag.current = null)}
        onPointerCancel={() => (drag.current = null)}
      />
      <div className="dn-vignette" />
      {!save.reduced && (
        <div className="dn-chapter-arrival" aria-hidden="true">
          <span>{mission.label ?? `Chapter ${mission.id}`}</span>
          <strong>{mission.title}</strong>
          <i>{mission.subtitle}</i>
        </div>
      )}
      <header className="dn-hud">
        <div>
          <span>
            FREDERICK DOUGLASS /{' '}
            {mission.id === 12 ? 'APPENDIX' : mission.id.toString().padStart(2, '0')}
          </span>
          <strong>{mission.title}</strong>
        </div>
        <button
          aria-label="Pause chapter"
          onClick={() => {
            release();
            document.exitPointerLock?.();
            stopSpeech();
            setPaused(true);
          }}
        >
          <Pause size={20} />
        </button>
      </header>
      {!blocked.current && !error && (
        <>
          <div className="dn-objective">
            <div
              className="dn-stage-dots"
              aria-label={`${hud.stage} of ${mission.stages.length} moments complete`}
            >
              {mission.stages.map((_, i) => (
                <i key={i} className={i <= hud.stage ? 'lit' : ''} />
              ))}
            </div>
            <span>{current.title}</span>
            {current.collect && (
              <small>
                {hud.collected}/{current.collect.points.length}{' '}
                {current.collect.label.toLowerCase()} · Walk close to collect
              </small>
            )}
            {current.herd && (
              <small>{hud.herded}/3 sheep delivered · Stay nearby; press E to call</small>
            )}
          </div>
          <div className="dn-compass" aria-label="Objective direction">
            <ChevronUp style={{ transform: `rotate(${hud.bearing}rad)` }} />
            <span>{Math.round(hud.range)} m</span>
          </div>
          <span className="dn-crosshair" />
          {(hud.ready || current.herd) && (
            <button className="dn-interact" onClick={interaction}>
              <kbd>E</kbd>
              {current.herd && hud.herded < 3 ? 'Call the sheep' : current.action}
            </button>
          )}
          <div className="dn-controls-hint">
            WASD move <b>·</b> Mouse / arrows look <b>·</b> Shift run <b>·</b> Space jump <b>·</b> E
            interact
          </div>
          <div className="dn-touch">
            <div
              className="dn-stick"
              role="button"
              aria-label="Movement joystick"
              tabIndex={0}
              onPointerDown={(e) => {
                e.preventDefault();
                e.currentTarget.setPointerCapture(e.pointerId);
                stick.current = { id: e.pointerId, x: e.clientX, y: e.clientY };
              }}
              onPointerMove={(e) => {
                const s = stick.current;
                if (s?.id === e.pointerId) {
                  touch.current = {
                    strafe: Math.max(-1, Math.min(1, (e.clientX - s.x) / 30)),
                    forward: Math.max(-1, Math.min(1, (s.y - e.clientY) / 30)),
                  };
                }
              }}
              onPointerUp={() => {
                stick.current = null;
                touch.current = { forward: 0, strafe: 0 };
              }}
              onPointerCancel={() => {
                stick.current = null;
                touch.current = { forward: 0, strafe: 0 };
              }}
              onLostPointerCapture={() => {
                stick.current = null;
                touch.current = { forward: 0, strafe: 0 };
              }}
            >
              <span>MOVE</span>
              <i />
            </div>
            <span className="dn-look-hint">Drag the world to look</span>
            <button
              aria-label="Jump"
              onPointerDown={(e) => {
                e.preventDefault();
                game.current.jump();
                audio.effect('jump');
              }}
            >
              ↑
            </button>
          </div>
        </>
      )}
      {line !== null && !paused && (
        <SpokenLine
          key={`${hud.stage}-${line}`}
          line={current.lines[line]}
          voice={save.voice}
          reduced={save.reduced}
          autoplay={save.autoplay}
          last={line === current.lines.length - 1}
          onNext={nextLine}
          onVoice={onVoice}
          onSource={(refs) => {
            stopSpeech();
            setPaused(true);
            onSource(refs);
          }}
        />
      )}
      {rhythm && !paused && current.rhythm && (
        <Rhythm
          activity={current.rhythm}
          reduced={save.reduced}
          onBeat={() => audio.effect('ring')}
          onComplete={() => {
            setRhythm(false);
            if (current.task) setActivity(true);
            else complete();
          }}
        />
      )}
      {activity && !paused && current.task && (
        <Activity
          tasks={current.task}
          voice={save.voice}
          onComplete={complete}
          onSound={() => audio.effect('ring')}
        />
      )}
      {paused && !error && (
        <div className="dn-shade">
          <section className="dn-pause">
            <p className="dn-kicker">{mission.label ?? `Chapter ${mission.id}`}</p>
            <h2>A moment to breathe.</h2>
            <p>Your last completed story moment is saved.</p>
            <button className="dn-primary" onClick={() => setPaused(false)}>
              <Play size={16} />
              Resume
            </button>
            <button onClick={onSettings}>
              <Settings size={17} />
              Settings
            </button>
            <button onClick={onExit}>
              <ArrowLeft size={17} />
              Chapter select
            </button>
          </section>
        </div>
      )}
      {error && (
        <div className="dn-shade">
          <section className="dn-pause" role="alert">
            <h2>3D couldn’t start</h2>
            <p>{error}</p>
            <button className="dn-primary" onClick={onExit}>
              Back to chapters
            </button>
          </section>
        </div>
      )}
    </div>
  );
}

function ChapterQuiz({
  pool,
  voice,
  onSource,
  onFinish,
}: {
  pool: Question[];
  voice: boolean;
  onSource: (refs: Ref[]) => void;
  onFinish: (correct: number, missed: Question[]) => void;
}) {
  const [index, setIndex] = useState(0),
    [selected, setSelected] = useState<number | null>(null),
    [answers, setAnswers] = useState<number[]>([]);
  const question = pool[index];
  useEffect(() => {
    if (voice)
      return perform(selected === null ? question.prompt : question.explanation, {
        speaker: 'Narrator',
      });
  }, [question, voice, selected]);
  const selectRef = useRef<(i: number) => void>(() => {});
  selectRef.current = (i) => {
    if (selected === null) {
      stopSpeech();
      setSelected(i);
    }
  };
  useEffect(() => {
    const key = (e: KeyboardEvent) => {
      if (
        /^[1-4]$/.test(e.key) &&
        !(e.target instanceof HTMLInputElement) &&
        !document.querySelector('dialog[open]')
      )
        selectRef.current(Number(e.key) - 1);
    };
    window.addEventListener('keydown', key);
    return () => window.removeEventListener('keydown', key);
  }, []);
  const next = () => {
    if (selected === null) return;
    const result = [...answers, selected];
    if (index + 1 === pool.length)
      onFinish(
        pool.filter((q, i) => result[i] === q.answer).length,
        pool.filter((q, i) => result[i] !== q.answer),
      );
    else {
      setAnswers(result);
      setIndex(index + 1);
      setSelected(null);
    }
  };
  return (
    <section className="dn-quiz">
      <p className="dn-kicker">
        AFTER THE JOURNEY · {index + 1} / {pool.length}
      </p>
      <div className="dn-quiz-progress">
        <i style={{ width: `${(index / pool.length) * 100}%` }} />
      </div>
      <h1>{question.prompt}</h1>
      <div className="dn-answers">
        {question.choices.map((choice, i) => (
          <button
            disabled={selected !== null}
            className={
              selected !== null
                ? i === question.answer
                  ? 'correct'
                  : i === selected
                    ? 'incorrect'
                    : ''
                : ''
            }
            key={choice}
            onClick={() => selectRef.current(i)}
          >
            <span>{i + 1}</span>
            {choice}
          </button>
        ))}
      </div>
      {selected !== null && (
        <div className="dn-explanation" role="status">
          <strong>
            {selected === question.answer ? 'You’ve got it.' : 'Take this one with you.'}
          </strong>
          <p>{question.explanation}</p>
          <button className="dn-text-button" onClick={() => onSource(question.refs)}>
            Read the source ↗
          </button>
          <button className="dn-primary" onClick={next}>
            {index + 1 === pool.length ? 'See results' : 'Next question'}
            <ArrowRight size={17} />
          </button>
        </div>
      )}
    </section>
  );
}

export interface CampaignConfig {
  missions: Mission[];
  questions: Question[];
  source: {
    url: string;
    chapters: { chapter: number; label?: string; paragraphs: { ref: string; text: string }[] }[];
  };
  passage: (ref: Ref) => string;
  chapterQuestions: (chapter: Chapter) => Question[];
  readSave: () => Save;
  freshSave: () => Save;
  recordResult: typeof recordResult;
  SAVE_KEY: string;
  Art: ComponentType<{ chapter: Chapter }>;
  unit: string;
  part: string;
  heading: [string, string];
  tagline: string;
  previous: { href: string; label: string };
  ending: string;
  exam?: () => Question[];
}
const defaultConfig: CampaignConfig = {
  missions,
  questions,
  source,
  passage,
  chapterQuestions,
  readSave,
  freshSave,
  recordResult,
  SAVE_KEY,
  Art: DefaultChapterArt,
  unit: 'Chapters 4–8',
  part: 'PART II',
  heading: ['Knowledge is', 'a way forward.'],
  tagline: 'Five chapters. Five worlds. See through his eyes.',
  previous: { href: '#douglass', label: 'Chapters 1–3' },
  ending:
    'At the end of Chapter VIII, Douglass is still enslaved. The direction north and his determination remain with him.',
};
export default function NextDouglassCampaign({
  config = defaultConfig,
}: { config?: CampaignConfig } = {}) {
  const {
    missions,
    questions,
    source,
    passage,
    chapterQuestions,
    readSave,
    freshSave,
    recordResult,
    SAVE_KEY,
    Art: ChapterArt,
  } = config;
  const label = (id: number) => missions.find((m) => m.id === id)?.label ?? `Chapter ${id}`;
  const [exam, setExam] = useState(false);
  const [save, setSave] = useState(readSave),
    [storageError, setStorageError] = useState(false);
  const [screen, setScreen] = useState<'menu' | 'brief' | 'game' | 'quiz' | 'results'>('menu');
  const [chapter, setChapter] = useState<Chapter>(config.missions[0].id),
    [run, setRun] = useState(0),
    [startStage, setStartStage] = useState(0);
  const [settings, setSettings] = useState(false),
    [reset, setReset] = useState(false),
    [refs, setRefs] = useState<Ref[] | null>(null);
  const [pool, setPool] = useState<Question[]>([]),
    [result, setResult] = useState<{
      correct: number;
      total: number;
      missed: Question[];
      review: boolean;
    }>({ correct: 0, total: 0, missed: [], review: false });
  const [review, setReview] = useState(false);
  const audio = useRef<CampaignAudio | null>(null);
  const mission = missions.find((m) => m.id === chapter)!;
  useEffect(() => {
    audio.current = new CampaignAudio();
    return () => {
      audio.current?.dispose();
      stopSpeech();
    };
  }, []);
  useEffect(() => {
    try {
      localStorage.setItem(SAVE_KEY, JSON.stringify(save));
      setStorageError(false);
    } catch {
      setStorageError(true);
    }
  }, [save]);
  useEffect(() => {
    audio.current?.setEnabled(save.music);
  }, [save.music]);
  useEffect(() => {
    if (screen !== 'game') audio.current?.setPaused(true);
    stopSpeech();
  }, [screen]);
  const update = (fn: (current: Save) => Save) => setSave(fn);
  const startQuiz = (retry?: Question[]) => {
    setExam(false);
    setPool(retry ?? chapterQuestions(chapter));
    setReview(!!retry);
    setRun((n) => n + 1);
    setScreen('quiz');
  };
  const startExam = () => {
    if (!config.exam) return;
    setPool(config.exam());
    setReview(true);
    setExam(true);
    setRun((n) => n + 1);
    setScreen('quiz');
  };
  const select = (id: Chapter, replay = false) => {
    setChapter(id);
    setStartStage(replay ? 0 : save.chapters[id].stage);
    setScreen('brief');
  };
  const enter = () => {
    audio.current?.start([1, 2, 3, 2, 1][missions.findIndex((m) => m.id === chapter)], save.music);
    if (startStage === mission.stages.length) startQuiz();
    else {
      setRun((n) => n + 1);
      setScreen('game');
    }
  };
  const finish = (correct: number, missed: Question[]) => {
    if (exam) update((s) => ({ ...s, examScores: [...(s.examScores ?? []), correct].slice(-20) }));
    if (!review)
      update((s) =>
        recordResult(
          s,
          chapter,
          correct,
          pool.map((q) => q.id),
          missed.map((q) => q.id),
        ),
      );
    else
      update((s) => ({
        ...s,
        missed: [
          ...s.missed.filter((id) => !pool.some((q) => q.id === id)),
          ...missed.map((q) => q.id),
        ],
      }));
    setResult({ correct, total: pool.length, missed, review });
    audio.current?.effect('finish');
    setScreen('results');
  };
  return (
    <main
      className={`dn-app ${config.exam ? 'dn-final' : ''} ${save.reduced ? 'dn-reduced' : ''}`}
      style={{ '--dn-accent': mission.color } as CSSProperties}
    >
      {screen !== 'game' && (
        <header className="dn-topbar">
          <a href="#course">
            <ArrowLeft size={16} />
            <span>ELA III</span>
          </a>
          <span>
            FREDERICK DOUGLASS <i>{config.unit.toUpperCase()}</i>
          </span>
          <button aria-label="Campaign settings" onClick={() => setSettings(true)}>
            <Settings size={18} />
          </button>
        </header>
      )}
      {storageError && (
        <div className="dn-storage" role="alert">
          Browser storage is unavailable. Keep this tab open to retain this session’s progress.
        </div>
      )}
      {screen === 'menu' && (
        <section className="dn-select">
          <div className="dn-intro">
            <div>
              <p className="dn-kicker">A VOICE UNBROKEN / {config.part}</p>
              <h1>
                {config.heading[0]}
                <br />
                <em>{config.heading[1]}</em>
              </h1>
            </div>
            <p>{config.tagline}</p>
          </div>
          <div className="dn-chapters">
            {missions.map((m) => {
              const p = save.chapters[m.id];
              return (
                <button
                  className={`dn-chapter ch-${m.id}`}
                  key={m.id}
                  aria-label={`${p.completed ? 'Replay' : p.stage ? 'Continue' : 'Play'} ${label(m.id)}`}
                  onClick={() => select(m.id, p.completed)}
                  style={{ '--dn-accent': m.color } as CSSProperties}
                >
                  <div className="dn-chapter-image">
                    <ChapterArt chapter={m.id} />
                    <span className="dn-chapter-number">
                      {m.id === 12 ? 'A' : m.id.toString().padStart(2, '0')}
                    </span>
                    {p.completed && (
                      <span className="dn-chapter-complete">
                        <Check size={15} />
                        {p.best}/5
                      </span>
                    )}
                  </div>
                  <div className="dn-chapter-copy">
                    <p>{m.genre}</p>
                    <h2>{m.title}</h2>
                    <span>
                      {p.completed
                        ? 'Replay chapter'
                        : p.stage
                          ? 'Continue journey'
                          : 'Enter chapter'}
                      <ArrowRight size={17} />
                    </span>
                  </div>
                </button>
              );
            })}
          </div>
          {config.exam && (
            <div className="dn-campaign-tools">
              <button className="dn-primary" onClick={startExam}>
                Final challenge · 20 questions
              </button>
              {save.missed.length > 0 && (
                <button
                  onClick={() => startQuiz(questions.filter((q) => save.missed.includes(q.id)))}
                >
                  Review missed ({save.missed.length})
                </button>
              )}
              <button
                onClick={() =>
                  setRefs(source.chapters.flatMap((c) => c.paragraphs.map((p) => p.ref as Ref)))
                }
              >
                Read the complete text ↗
              </button>
              {save.examScores?.length ? (
                <span>Best final: {Math.max(...save.examScores) * 5}%</span>
              ) : null}
            </div>
          )}
          <footer className="dn-select-footer">
            <span>
              <Headphones size={15} /> Best with sound
            </span>
            <p>
              A first-person retelling. Scenery and challenges are imagined; narration follows the
              1845 text.
            </p>
            <a href={config.previous.href}>{config.previous.label} ↗</a>
          </footer>
        </section>
      )}
      {screen === 'brief' && (
        <section className="dn-brief">
          <div className="dn-brief-art">
            <ChapterArt chapter={chapter} />
            <span>{chapter === 12 ? 'A' : chapter.toString().padStart(2, '0')}</span>
          </div>
          <div className="dn-brief-copy">
            <p className="dn-kicker">
              {label(chapter)} / {mission.genre}
            </p>
            <h1>{mission.title}</h1>
            <p>{mission.summary}</p>
            <div className="dn-brief-controls">
              <span>
                <kbd>W A S D</kbd> Move
              </span>
              <span>
                <kbd>Mouse / ← →</kbd> Look
              </span>
              <span>
                <kbd>Space</kbd> Jump
              </span>
              <span>
                <kbd>E</kbd> Interact
              </span>
            </div>
            <small>
              Touch: left thumb moves, drag the world to look. Your progress saves after each story
              moment.
            </small>
            <button className="dn-primary" onClick={enter}>
              {startStage === mission.stages.length
                ? 'Take chapter challenge'
                : startStage
                  ? `Resume ${label(chapter)}`
                  : `Enter ${label(chapter)}`}
              <ArrowRight size={18} />
            </button>
            <button className="dn-text-button" onClick={() => setScreen('menu')}>
              Back to chapters
            </button>
          </div>
        </section>
      )}
      {screen === 'game' && audio.current && (
        <GameView
          key={run}
          mission={mission}
          stage={startStage}
          save={save}
          audio={audio.current}
          onCheckpoint={(stage) =>
            update((s) => ({
              ...s,
              chapters: { ...s.chapters, [chapter]: { ...s.chapters[chapter], stage } },
            }))
          }
          onFinish={() => startQuiz()}
          onExit={() => setScreen('menu')}
          onSettings={() => setSettings(true)}
          onSource={setRefs}
          onVoice={() => update((s) => ({ ...s, voice: !s.voice }))}
        />
      )}
      {screen === 'quiz' && (
        <ChapterQuiz
          key={run}
          pool={pool}
          voice={save.voice && !refs && !settings}
          onSource={setRefs}
          onFinish={finish}
        />
      )}
      {screen === 'results' && (
        <section className="dn-results">
          <p className="dn-kicker">
            {exam
              ? 'FINAL CHALLENGE COMPLETE'
              : result.review
                ? 'REVIEW COMPLETE'
                : `${label(chapter)} COMPLETE`}
          </p>
          <div className="dn-score">
            {Math.round((result.correct / result.total) * 100)}
            <span>%</span>
          </div>
          <h1>
            {result.correct === result.total
              ? 'The story stays with you.'
              : result.correct / result.total >= 0.6
                ? 'Keep the story moving.'
                : 'Let’s make it stick.'}
          </h1>
          <p>
            {result.correct} of {result.total} connections made.
          </p>
          {exam && (
            <div className="dn-exam-topics">
              <strong>
                Grade{' '}
                {result.correct / result.total >= 0.9
                  ? 'A'
                  : result.correct / result.total >= 0.8
                    ? 'B'
                    : result.correct / result.total >= 0.7
                      ? 'C'
                      : result.correct / result.total >= 0.6
                        ? 'D'
                        : 'F'}
              </strong>
              {missions.map((m) => {
                const asked = pool.filter((q) => q.chapter === m.id).length,
                  wrong = result.missed.filter((q) => q.chapter === m.id).length;
                return (
                  <span key={m.id}>
                    {label(m.id)}{' '}
                    <b>
                      {asked - wrong}/{asked}
                    </b>{' '}
                    {wrong === 0 ? '· Strong' : '· Review next'}
                  </span>
                );
              })}
            </div>
          )}
          <div className="dn-result-actions">
            {chapter !== missions[missions.length - 1].id && !result.review && (
              <button
                className="dn-primary"
                onClick={() =>
                  select((chapter + 1) as Chapter, save.chapters[chapter + 1].completed)
                }
              >
                {label(chapter + 1)}
                <ArrowRight size={17} />
              </button>
            )}
            {result.missed.length > 0 && (
              <button onClick={() => startQuiz(result.missed)}>
                Retry missed ({result.missed.length})
              </button>
            )}
            <button onClick={() => (exam ? startExam() : startQuiz())}>
              {exam ? 'New final challenge' : 'New challenge'}
            </button>
            <button onClick={() => setScreen('menu')}>Chapter select</button>
          </div>
          {result.missed.length > 0 && (
            <div className="dn-review">
              <h2>Take these with you</h2>
              {result.missed.map((q) => (
                <article key={q.id}>
                  <h3>{q.prompt}</h3>
                  <strong>{q.choices[q.answer]}</strong>
                  <p>{q.explanation}</p>
                  <button onClick={() => setRefs(q.refs)}>From the text ↗</button>
                </article>
              ))}
            </div>
          )}
          {chapter === missions[missions.length - 1].id && !result.review && (
            <p className="dn-ending">{config.ending}</p>
          )}
        </section>
      )}
      {settings && (
        <Dialog
          title="Make yourself comfortable"
          onClose={() => setSettings(false)}
          className="dn-settings"
        >
          <label>
            <span>
              <Music2 size={17} />
              Music & sound
            </span>
            <input
              type="checkbox"
              checked={save.music}
              onChange={(e) => update((s) => ({ ...s, music: e.target.checked }))}
            />
          </label>
          <label>
            <span>
              <Volume2 size={17} />
              Spoken narration
            </span>
            <input
              type="checkbox"
              checked={save.voice}
              onChange={(e) => update((s) => ({ ...s, voice: e.target.checked }))}
            />
          </label>
          <label>
            <span>Auto-advance spoken dialogue</span>
            <input
              type="checkbox"
              checked={save.autoplay}
              onChange={(e) => update((s) => ({ ...s, autoplay: e.target.checked }))}
            />
          </label>
          <label>
            <span>Reduced motion</span>
            <input
              type="checkbox"
              checked={save.reduced}
              onChange={(e) => update((s) => ({ ...s, reduced: e.target.checked }))}
            />
          </label>
          <label>
            Look sensitivity
            <input
              type="range"
              min="0.4"
              max="2"
              step="0.1"
              value={save.sensitivity}
              onChange={(e) => update((s) => ({ ...s, sensitivity: Number(e.target.value) }))}
            />
          </label>
          <button className="dn-reset" onClick={() => setReset(true)}>
            Reset {config.unit} progress
          </button>
          {reset && (
            <div className="dn-reset-confirm">
              <p>Erase only this campaign’s checkpoints and scores?</p>
              <button
                onClick={() => {
                  setSave(freshSave());
                  setReset(false);
                  setSettings(false);
                  setScreen('menu');
                }}
              >
                Erase {config.unit}
              </button>
              <button onClick={() => setReset(false)}>Keep my progress</button>
            </div>
          )}
        </Dialog>
      )}
      {refs && (
        <Dialog
          title={`From the Narrative · ${label(Number(refs[0].split('.')[0]))}`}
          onClose={() => setRefs(null)}
          wide
          className="dn-source"
        >
          <p className="dn-source-note">
            Narration is paraphrased; reported speech uses Douglass’s wording. Below is the original
            text. Paragraph numbers refer to this bundled edition.
          </p>
          {refs.map((ref) => (
            <section key={ref}>
              <h3>
                {label(Number(ref.split('.')[0]))} · paragraph {ref.split('.')[1]}
              </h3>
              <p>{passage(ref)}</p>
            </section>
          ))}
          <a
            href={`${source.url}#${refs[0].startsWith('12.') ? 'link2H_APPE' : `link2HCH${refs[0].split('.')[0].padStart(4, '0')}`}`}
            target="_blank"
            rel="noreferrer"
          >
            Open the complete primary text ↗
          </a>
        </Dialog>
      )}
    </main>
  );
}
