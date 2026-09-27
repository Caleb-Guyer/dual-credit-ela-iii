import { lazy, Suspense, useEffect, useRef, useState } from 'react';
import {
  BookOpen,
  Compass,
  Feather,
  Flame,
  GraduationCap,
  Map,
  Medal,
  Menu,
  ScrollText,
  Settings,
  Sparkles,
  Swords,
  Users,
  X,
} from 'lucide-react';
import Platformer from './pages/Platformer';
import { questions } from './data/questions';
import { freshSave, level, levelProgress, rank } from './lib/game';
import { GameProvider, useGame } from './components/GameContext';
import { Dialog, Progress, SourceViewer } from './components/Common';
import Story from './pages/Story';
import Quiz, { bossConfig, type SessionConfig } from './pages/Quiz';
import { Characters, Collection, Journal, LocationMap, Study, Timeline } from './pages/Library';
import SettingsPage from './pages/Settings';
import CourseHub from './pages/CourseHub';
import DouglassCampaign from './douglass/Campaign';
const NextDouglassCampaign = lazy(() => import('./douglass-next/Campaign'));
const nav = [
  ['home', 'Play', Feather],
  ['story', 'Story', Compass],
  ['quiz', 'Quiz', Swords],
  ['journal', 'Memory journal', BookOpen],
  ['timeline', 'Timeline', ScrollText],
  ['characters', 'Characters', Users],
  ['map', 'Locations', Map],
  ['collection', 'Collection', Medal],
  ['study', 'Study mode', Sparkles],
  ['exam', 'Final exam', GraduationCap],
  ['settings', 'Settings', Settings],
] as const;
const routes = new Set<string>([
  ...nav.map((x) => x[0]),
  'arena',
  'course',
  'douglass',
  'douglass-4-8',
]);
export default function App() {
  const [source, setSource] = useState<number[] | null>(null);
  const [sourceIndex, setSourceIndex] = useState(0);
  const [resetOpen, setResetOpen] = useState(false);
  return (
    <GameProvider
      onSource={(pages) => {
        setSource([...new Set(pages)].sort((a, b) => a - b));
        setSourceIndex(0);
      }}
      onReset={() => setResetOpen(true)}
    >
      <AppShell />
      {source && (
        <SourceViewer
          pages={source}
          index={sourceIndex}
          setIndex={setSourceIndex}
          onClose={() => setSource(null)}
        />
      )}{' '}
      {resetOpen && <ResetDialog onClose={() => setResetOpen(false)} />}
    </GameProvider>
  );
}
function readRoute() {
  const hash = location.hash.slice(1);
  return routes.has(hash) || /^story\/(?:[1-9]|1[0-2])$/.test(hash) ? hash : 'course';
}
function AppShell() {
  const [path, setPath] = useState(readRoute);
  const [route, chapterSegment] = path.split('/');
  const [menu, setMenu] = useState(false);
  const [session, setSession] = useState<SessionConfig | null>(null);
  const [run, setRun] = useState(0);
  const { save, storageError } = useGame();
  const saveRef = useRef(save);
  saveRef.current = save;
  useEffect(() => {
    const handle = () => {
      setPath(readRoute());
      setMenu(false);
      window.scrollTo({ top: 0, behavior: 'instant' });
    };
    window.addEventListener('hashchange', handle);
    return () => window.removeEventListener('hashchange', handle);
  }, []);
  useEffect(() => {
    if (route === 'course' || route === 'douglass' || route === 'douglass-4-8') {
      document.title =
        route === 'course'
          ? 'Dual Credit ELA III · Choose your story'
          : route === 'douglass-4-8'
            ? 'Chapters 4–8 · Frederick Douglass'
            : 'A Voice Unbroken · Frederick Douglass';
      return;
    }
    document.title =
      (route === 'home'
        ? 'FRANKLIN'
        : (nav.find((x) => x[0] === route)?.[1] ?? 'The Recall Arena')) + ' · The Path to Print';
  }, [route]);
  useEffect(() => {
    type ModelContext = {
      registerTool: (t: unknown, o: { signal: AbortSignal }) => Promise<void> | void;
    };
    const context = (document as Document & { modelContext?: ModelContext }).modelContext;
    if (!context?.registerTool) return;
    const controller = new AbortController();
    const registered = [
      {
        name: 'read_franklin_progress',
        description:
          'Read device-local game progress without changing scores or revealing answers.',
        inputSchema: { type: 'object', properties: {}, additionalProperties: false },
        annotations: { readOnlyHint: true },
        execute: () => {
          const s = saveRef.current;
          return {
            xp: s.xp,
            level: level(s.xp),
            currentChapter: s.currentChapter,
            completedChapters: s.completedChapters,
            unlockedCards: s.unlockedCards.length,
            missedQuestions: s.mistakes.length,
          };
        },
      },
      {
        name: 'open_franklin_section',
        description: 'Navigate to a game section without answering questions or changing scores.',
        inputSchema: {
          type: 'object',
          properties: { section: { type: 'string', enum: nav.map((n) => n[0]) } },
          required: ['section'],
          additionalProperties: false,
        },
        annotations: { readOnlyHint: false },
        execute: async (input: unknown) => {
          const section = (input as { section?: string })?.section;
          if (!section || !nav.some((n) => n[0] === section)) throw new Error('Unknown section');
          location.hash = section;
          await new Promise<void>((r) =>
            requestAnimationFrame(() => requestAnimationFrame(() => r())),
          );
          return { section };
        },
      },
    ];
    for (const tool of registered) {
      try {
        void Promise.resolve(context.registerTool(tool, { signal: controller.signal })).catch(
          () => {},
        );
      } catch {
        /* Optional browser capability. */
      }
    }
    return () => controller.abort();
  }, []);
  function start(config: SessionConfig) {
    setSession(config);
    setRun((n) => n + 1);
    location.hash = 'arena';
    setPath('arena');
    window.scrollTo({ top: 0, behavior: 'instant' });
  }
  if (route === 'course') return <CourseHub />;
  if (route === 'douglass') return <DouglassCampaign />;
  if (route === 'douglass-4-8')
    return (
      <Suspense
        fallback={
          <div className="campaign-loading" role="status">
            Opening your next chapter…
          </div>
        }
      >
        <NextDouglassCampaign />
      </Suspense>
    );
  if (route === 'home') return <Platformer />;
  return (
    <div className="app-shell">
      <a
        className="skip-link"
        href="#main-content"
        onClick={(e) => {
          e.preventDefault();
          document.getElementById('main-content')?.focus();
        }}
      >
        Skip to game
      </a>
      {menu && (
        <button
          aria-label="Close navigation"
          className="menu-scrim"
          onClick={() => setMenu(false)}
        />
      )}
      <aside className={'sidebar ' + (menu ? 'open' : '')}>
        <a className="course-back" href="#course">
          ← ELA III collection
        </a>
        <a href="#home" className="brand-mark">
          F
          <span>
            THE PATH
            <br />
            TO PRINT
          </span>
        </a>
        <nav aria-label="Game sections">
          {nav.map(([id, label, Icon]) => (
            <a
              className={route === id ? 'active' : ''}
              aria-current={route === id ? 'page' : undefined}
              key={id}
              href={'#' + id}
            >
              <Icon size={18} />
              <span>{label}</span>
            </a>
          ))}
        </nav>
      </aside>
      <main className="main" id="main-content" tabIndex={-1}>
        <header className="topbar">
          <button
            className="mobile-toggle"
            onClick={() => setMenu(!menu)}
            aria-label={menu ? 'Close navigation' : 'Open navigation'}
            aria-expanded={menu}
          >
            {menu ? <X size={21} /> : <Menu size={21} />}
          </button>
          <div className="breadcrumb">Part One</div>
          <div className="player-meta">
            <span>
              <Flame size={16} />
              {save.streak}
              <small>STREAK</small>
            </span>
            <span className="level-medal">{level(save.xp)}</span>
            <div>
              {rank(save.xp)}
              <small>{save.xp.toLocaleString()} XP</small>
              <Progress value={levelProgress(save.xp)} label="Progress to next level" />
            </div>
          </div>
        </header>
        {storageError && (
          <div className="storage-warning" role="alert">
            {storageError}
          </div>
        )}
        <div key={path} className="route-enter">
          {route === 'story' ? (
            <Story
              initialChapter={Math.min(
                save.currentChapter,
                Number(chapterSegment) || save.currentChapter,
              )}
              startBoss={(id) => start(bossConfig(id))}
            />
          ) : route === 'quiz' ? (
            <Quiz />
          ) : route === 'exam' ? (
            <Quiz
              initial={{
                title: 'Final Exam',
                pool: questions,
                count: 20,
                difficulty: 'FINAL EXAM',
                balanced: true,
              }}
            />
          ) : route === 'arena' ? (
            <Quiz
              key={run}
              initial={session ?? bossConfig(save.currentChapter)}
              onBack={() => setSession(null)}
            />
          ) : route === 'journal' ? (
            <Journal start={start} />
          ) : route === 'characters' ? (
            <Characters />
          ) : route === 'timeline' ? (
            <Timeline start={start} />
          ) : route === 'map' ? (
            <LocationMap start={start} />
          ) : route === 'collection' ? (
            <Collection />
          ) : route === 'study' ? (
            <Study start={start} />
          ) : (
            <SettingsPage />
          )}
        </div>
      </main>
    </div>
  );
}
function ResetDialog({ onClose }: { onClose: () => void }) {
  const { setSave } = useGame();
  return (
    <Dialog title="Begin with a clean page?" onClose={onClose}>
      <p>
        This erases your Franklin save: journey, XP, cards, achievements, question history and exam
        results. Export a copy from Settings first if you want to keep it.
      </p>
      <div className="button-row">
        <button className="button" onClick={onClose}>
          Keep my progress
        </button>
        <button
          className="button danger"
          onClick={() => {
            setSave(freshSave());
            location.hash = 'home';
            onClose();
          }}
        >
          Reset Franklin progress
        </button>
      </div>
    </Dialog>
  );
}
