import { ArrowUpRight, ArrowRight } from 'lucide-react';
import { useGame } from '../components/GameContext';
import { readDouglassSave } from '../douglass/save';
import { readSave as readNextSave } from '../douglass-next/save';
import { readSave as readFinalSave } from '../douglass-final/save';
import FinalArt from '../douglass-final/Art';
import { NextDouglassArt } from '../douglass-next/Art';

export function StoryArt({
  kind,
}: {
  kind: 'franklin' | 'douglass' | 'douglass-next' | 'douglass-final';
}) {
  if (kind === 'douglass-final') return <FinalArt chapter={11} />;
  if (kind === 'douglass-next') return <NextDouglassArt />;
  const warm = kind === 'franklin';
  return (
    <svg
      className="course-art"
      viewBox="0 0 700 460"
      preserveAspectRatio="xMidYMid slice"
      fill="none"
      aria-hidden="true"
    >
      <defs>
        <linearGradient id={`${kind}-sky`} x2="0" y2="1">
          <stop stopColor={warm ? '#2b3447' : '#182d3e'} />
          <stop offset="1" stopColor={warm ? '#9e7764' : '#6c8c86'} />
        </linearGradient>
        <linearGradient id={`${kind}-water`} x2="0" y2="1">
          <stop stopColor="#94bdb0" />
          <stop offset="1" stopColor="#243b49" />
        </linearGradient>
        <radialGradient id={`${kind}-glow`}>
          <stop stopColor={warm ? '#ffcb86' : '#efc994'} stopOpacity=".5" />
          <stop offset="1" stopColor="#ffc987" stopOpacity="0" />
        </radialGradient>
      </defs>
      <path fill={`url(#${kind}-sky)`} d="M0 0h700v460H0z" />
      <circle cx={warm ? 485 : 355} cy="126" r="122" fill={`url(#${kind}-glow)`} />
      <circle cx={warm ? 485 : 355} cy="126" r="45" fill="#ebd4ad" />
      {[30, 78, 147, 234, 295, 409, 560, 651].map((x, i) => (
        <circle key={x} cx={x} cy={25 + (i % 3) * 29} r="1" fill="#e8e0c9" opacity=".6" />
      ))}
      {warm ? (
        <>
          <path
            d="M0 239l43-33 43 33v98H0zM68 226l65-48 66 48v125H68zM175 250l53-46 54 46v85H175zM487 238l66-57 68 57v120H487zM595 249l54-41 60 41v105H595z"
            fill="#364650"
          />
          <path d="M340 207V69h12v138m-23-102 39-14-21-46-18 60z" fill="#364650" />
          <path d="M0 333h700v127H0z" fill="#24343c" />
          <path d="M15 344h669M41 380h619M0 424h700" stroke="#63706d" opacity=".35" />
          <path
            d="M285 216h99v123h-99zM274 208h121v16H274zM312 186h47v31h-47zM297 261h74v12h-74zM322 226h25v35h-25zM282 329h108v14H282z"
            fill="#182830"
          />
          <path d="M307 281h53v28h-53z" fill="#d5ba90" />
          <path d="M312 287h36m-36 7h41m-41 7h32" stroke="#635b52" strokeWidth="2" />
          <path d="M441 275h37l17 82h-69z" fill="#c09365" />
          <path d="M452 349v45m25-45 7 45" stroke="#1a2831" strokeWidth="14" />
          <ellipse cx="460" cy="257" rx="19" ry="25" fill="#dcb894" />
          <path d="M442 245q-12 35 3 41m28-42q13 24 3 39" stroke="#dad7ca" strokeWidth="9" />
          <circle cx="452" cy="257" r="6" stroke="#273940" strokeWidth="2" />
          <circle cx="468" cy="257" r="6" stroke="#273940" strokeWidth="2" />
          <path d="M457 257h5" stroke="#273940" />
          <path d="M63 332V230m-15 8h31v44H48z" stroke="#182b33" strokeWidth="8" />
          <path d="M56 246h15v27H56z" fill="#f4c582" />
        </>
      ) : (
        <>
          <path d="M0 218q97-49 213-5t231-4 256 3v248H0z" fill="#344a4b" />
          <path
            d="M325 235q-23 61-111 88T51 460h552q-112-107-203-137t-37-88z"
            fill={`url(#${kind}-water)`}
          />
          <path
            d="M0 272q94-12 251-29L151 340 38 392 0 453zM700 271l-306-28 94 83 144 77 68 57z"
            fill="#203b3c"
          />
          {[42, 97, 157, 565, 621, 675].map((x, i) => (
            <g key={x} fill={i % 2 ? '#1a3035' : '#284245'}>
              <path d={`M${x} 200l-30 101h60zM${x} 149l-25 103h50z`} />
              <path d={`M${x - 3} 255h6v100h-6z`} />
            </g>
          ))}
          <path d="M349 285v-96m3 3 42 73h-42z" stroke="#dacba8" strokeWidth="2" fill="#dacba8" />
          <path d="M327 284h69l-14 13h-42z" fill="#24353d" />
          <path d="M247 390q92-83 178 0l-31 70H269z" fill="#1b2b32" />
          <path d="M302 356v-45h40v45" fill="#936747" />
          <ellipse cx="322" cy="296" rx="29" ry="34" fill="#9d7150" />
          <path d="M292 302q-15-64 33-55 43-5 33 46l-13-22-19 9-18-5-9 28z" fill="#16262d" />
          <path d="M302 352l20 18 21-18-11 65h-22z" fill="#d4c5a8" />
          <path d="M326 316h12" stroke="#513b31" strokeWidth="3" />
          <path d="M270 365l-15 52 46 18m72-70 25 52-45 18" stroke="#24383c" strokeWidth="22" />
        </>
      )}
      <path d="M0 439h700v21H0z" fill="#111b22" opacity=".3" />
    </svg>
  );
}
export default function CourseHub() {
  const { save } = useGame();
  const douglass = readDouglassSave();
  const next = readNextSave();
  const final = readFinalSave();
  const units = [
    {
      id: 'franklin' as const,
      href: '#home',
      eyebrow: 'The Autobiography · Part One',
      name: 'Benjamin Franklin',
      subtitle: 'The Path to Print',
      genre: 'Action platformer',
      detail: '12 levels',
      completed: save.completedChapters.length,
      total: 12,
    },
    {
      id: 'douglass' as const,
      href: '#douglass',
      eyebrow: 'The Narrative · Chapters 1–3',
      name: 'Frederick Douglass',
      subtitle: 'A Voice Unbroken',
      genre: 'Story campaign',
      detail: '3 perspectives',
      completed: douglass.completed.length,
      total: 3,
    },
    {
      id: 'douglass-next' as const,
      href: '#douglass-4-8',
      eyebrow: 'The Narrative · Chapters 4–8',
      name: 'Frederick Douglass',
      subtitle: 'A Voice Unbroken · Part II',
      genre: 'First-person 3D',
      detail: '5 playable chapters',
      completed: Object.values(next.chapters).filter((p) => p.completed).length,
      total: 5,
    },
    {
      id: 'douglass-final' as const,
      href: '#douglass-9-end',
      eyebrow: 'The Narrative · Chapters 9–end',
      name: 'Frederick Douglass',
      subtitle: 'A Voice Unbroken · The Final Act',
      genre: 'First-person 3D',
      detail: '3 chapters + Appendix',
      completed: Object.values(final.chapters).filter((p) => p.completed).length,
      total: 4,
    },
  ];
  return (
    <main className="course-hub">
      <header className="course-brand">
        <span className="course-monogram">III</span>
        <div>
          DUAL CREDIT <strong>ELA III</strong>
        </div>
        <span className="course-season">THE STORY COLLECTION</span>
      </header>
      <section className="course-intro">
        <div>
          <p className="course-kicker">READ THE WORLD DIFFERENTLY</p>
          <h1>
            Choose your story<span>.</span>
          </h1>
        </div>
        <p>
          Choose a work. Enter its world. <br />
          Step inside the literature.
        </p>
      </section>
      <div className="course-grid">
        {units.map((unit, i) => (
          <a
            className={`course-card ${unit.id}`}
            href={unit.href}
            key={unit.id}
            aria-label={`Play ${unit.name}${unit.id === 'douglass-final' ? ' Chapters 9–end' : unit.id === 'douglass-next' ? ' Chapters 4–8' : ''}`}
          >
            <div className="course-image">
              <StoryArt kind={unit.id} />
              <span className="course-number">0{i + 1}</span>
              <span className="course-genre">{unit.genre}</span>
              <span className="course-open">
                <ArrowUpRight size={25} />
              </span>
            </div>
            <div className="course-card-copy">
              <p>{unit.eyebrow}</p>
              <h2>{unit.name}</h2>
              <div className="course-card-footer">
                <span>{unit.subtitle}</span>
                <ArrowRight size={20} />
              </div>
              <div className="course-progress">
                <span>
                  {unit.completed ? `${unit.completed} / ${unit.total} complete` : unit.detail}
                </span>
                <div>
                  <i style={{ width: `${(unit.completed / unit.total) * 100}%` }} />
                </div>
              </div>
            </div>
          </a>
        ))}
      </div>
      <footer className="course-footer">
        <span>PLAY. LISTEN. UNDERSTAND.</span>
        <span>Your progress saves as you go.</span>
      </footer>
    </main>
  );
}
