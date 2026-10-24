import { useEffect, useMemo, useRef, useState } from 'react';
import {
  ArrowLeft,
  ArrowRight,
  BookOpen,
  Check,
  CheckCircle2,
  ChevronDown,
  ExternalLink,
  FileText,
  RotateCcw,
  Search,
  Target,
  X,
} from 'lucide-react';
import { evidence, passage, questions, source, topics, type Question } from './data';
import type { ConcordSave } from './save';

export function shuffle<T>(items: readonly T[], random: () => number = Math.random): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [result[i], result[j]] = [result[j], result[i]];
  }
  return result;
}

/** Sample weak and unseen items first; a balanced exam takes turns across all topics. */
export function chooseQuestions(
  pool: Question[],
  count: number,
  save: Pick<ConcordSave, 'mastery' | 'missed'>,
  balanced = false,
  random: () => number = Math.random,
): Question[] {
  const unique = [...new Map(pool.map((q) => [q.id, q])).values()];
  const ranked = unique
    .map((q) => {
      const history = save.mastery[q.id];
      return {
        q,
        weight:
          (save.missed.includes(q.id) ? 30 : 0) +
          (!history ? 15 : Math.max(0, 2 - history.streak) * 6) +
          random() * 5,
      };
    })
    .sort((a, b) => b.weight - a.weight)
    .map(({ q }) => q);
  const limit = Math.max(0, Math.min(Math.floor(count), ranked.length));
  if (!balanced) return ranked.slice(0, limit);
  const buckets = shuffle([...new Set(ranked.map((q) => q.topic))], random).map((topic) =>
    ranked.filter((q) => q.topic === topic),
  );
  const selected: Question[] = [];
  while (selected.length < limit) {
    for (const bucket of buckets) {
      if (selected.length >= limit) break;
      const q = bucket.shift();
      if (q) selected.push(q);
    }
  }
  return shuffle(selected, random);
}

type Answer = { question: Question; selected: number; order: number[] };
type Mode = 'practice' | 'exam' | 'missed' | 'all';
type Tab = 'practice' | 'source' | 'journal';
type Session = {
  mode: Mode;
  rounds: { question: Question; order: number[] }[];
  index: number;
  answers: Answer[];
  finished: boolean;
};

const modeNames: Record<Mode, string> = {
  practice: 'Focused practice',
  exam: 'Reading-check rehearsal',
  missed: 'Review missed questions',
  all: 'Complete reading review',
};

export default function Study({
  save,
  onSave,
  onBack,
  initialTab = 'practice',
}: {
  save: ConcordSave;
  onSave: (save: ConcordSave) => void;
  onBack: () => void;
  initialTab?: Tab;
}) {
  const [tab, setTab] = useState<Tab>(initialTab);
  const [topic, setTopic] = useState('All topics');
  const [session, setSession] = useState<Session | null>(null);
  const [sourceParagraph, setSourceParagraph] = useState<number | null>(null);
  const [confirmExit, setConfirmExit] = useState(false);
  const latestSave = useRef(save);
  const answerLock = useRef(false);
  const heading = useRef<HTMLHeadingElement>(null);
  latestSave.current = save;
  const seen = questions.filter((q) => (save.mastery[q.id]?.seen ?? 0) > 0).length;
  const secure = questions.filter((q) => (save.mastery[q.id]?.streak ?? 0) >= 2).length;
  const bestExam = save.exams.reduce(
    (best, exam) => Math.max(best, Math.round((exam.score / exam.total) * 100)),
    0,
  );

  function start(mode: Mode, override?: Question[]) {
    const pool =
      override ??
      questions.filter(
        (q) =>
          (mode === 'exam' || topic === 'All topics' || q.topic === topic) &&
          (mode !== 'missed' || latestSave.current.missed.includes(q.id)),
      );
    if (!pool.length) {
      if (mode === 'missed') start('practice');
      return;
    }
    const selected = chooseQuestions(
      pool,
      mode === 'exam' ? 24 : mode === 'practice' ? 10 : pool.length,
      latestSave.current,
      mode === 'exam',
    );
    answerLock.current = false;
    setSession({
      mode,
      rounds: selected.map((question) => ({
        question,
        order: shuffle(question.options.map((_, i) => i)),
      })),
      index: 0,
      answers: [],
      finished: false,
    });
    setConfirmExit(false);
    window.scrollTo({ top: 0, behavior: 'instant' });
  }

  function answer(selected: number) {
    if (!session || session.finished || answerLock.current) return;
    if (session.answers.length > session.index) return;
    const round = session.rounds[session.index];
    if (!round.question.options[selected]) return;
    answerLock.current = true;
    const correct = selected === round.question.answer;
    const current = latestSave.current;
    const previous = current.mastery[round.question.id] ?? { seen: 0, correct: 0, streak: 0 };
    const next = {
      ...current,
      mastery: {
        ...current.mastery,
        [round.question.id]: {
          seen: previous.seen + 1,
          correct: previous.correct + (correct ? 1 : 0),
          streak: correct ? previous.streak + 1 : 0,
        },
      },
      missed: correct
        ? current.missed.filter((id) => id !== round.question.id)
        : [...new Set([...current.missed, round.question.id])],
    };
    latestSave.current = next;
    onSave(next);
    setSession({
      ...session,
      answers: [...session.answers, { ...round, selected }],
    });
  }

  function nextQuestion() {
    if (!session || session.answers.length <= session.index) return;
    if (session.index === session.rounds.length - 1) {
      if (session.mode === 'exam' && !session.finished) {
        const current = latestSave.current;
        const next = {
          ...current,
          exams: [
            ...current.exams,
            {
              score: session.answers.filter((a) => a.selected === a.question.answer).length,
              total: session.rounds.length,
              date: new Date().toISOString(),
            },
          ].slice(-20),
        };
        latestSave.current = next;
        onSave(next);
      }
      setSession({ ...session, finished: true });
    } else {
      setSession({ ...session, index: session.index + 1 });
      answerLock.current = false;
    }
    window.scrollTo({ top: 0, behavior: 'instant' });
    requestAnimationFrame(() => heading.current?.focus());
  }

  useEffect(() => {
    if (!session || session.finished || sourceParagraph !== null || confirmExit) return;
    function keydown(event: KeyboardEvent) {
      if (
        event.target instanceof HTMLElement &&
        (event.target.matches('input, textarea, select') || event.target.isContentEditable)
      )
        return;
      if (event.altKey || event.ctrlKey || event.metaKey || event.repeat) return;
      const answered = session!.answers.length > session!.index;
      if (/^[1-4]$/.test(event.key) && !answered) {
        event.preventDefault();
        const option = session!.rounds[session!.index].order[Number(event.key) - 1];
        if (option !== undefined) answer(option);
      } else if (
        event.key === 'Enter' &&
        answered &&
        !(event.target instanceof HTMLElement && event.target.closest('button, a'))
      ) {
        event.preventDefault();
        nextQuestion();
      }
    }
    window.addEventListener('keydown', keydown);
    return () => window.removeEventListener('keydown', keydown);
  });

  const active = session && !session.finished;
  return (
    <section className="cn-study">
      <header className="cn-study-header">
        <button
          className="cn-link"
          onClick={() => {
            if (active) setConfirmExit(true);
            else if (session) setSession(null);
            else onBack();
          }}
        >
          <ArrowLeft size={16} /> {session ? 'Study desk' : 'Back to Concord'}
        </button>
        <span className="cn-eyebrow">THE STUDY DESK · HENRY DAVID THOREAU</span>
      </header>
      {!session && (
        <>
          <div className="cn-study-intro">
            <div>
              <p className="cn-eyebrow">KNOW THE WORDS. UNDERSTAND THE ARGUMENT.</p>
              <h1>Prepare with purpose.</h1>
              <p>
                Close reading, clear explanations, and a place for every question you miss.
                Available at any point in the story.
              </p>
            </div>
            <BookOpen size={44} strokeWidth={1} aria-hidden="true" />
          </div>
          <div className="cn-study-stats" aria-label="Reading progress">
            <div>
              <strong>
                {seen}
                <span> / {questions.length}</span>
              </strong>
              <small>QUESTIONS EXPLORED</small>
            </div>
            <div>
              <strong>{secure}</strong>
              <small>SECURE · 2 CORRECT IN A ROW</small>
            </div>
            <div>
              <strong>{save.missed.length}</strong>
              <small>READY TO REVISIT</small>
            </div>
            <div>
              <strong>{save.exams.length ? `${bestExam}%` : '—'}</strong>
              <small>BEST REHEARSAL</small>
            </div>
          </div>
          <nav className="cn-tabs" aria-label="Study sections">
            {(
              [
                ['practice', 'Practice', Target],
                ['source', 'Read the essay', FileText],
                ['journal', 'Evidence journal', BookOpen],
              ] as const
            ).map(([id, label, Icon]) => (
              <button
                key={id}
                className={tab === id ? 'active' : ''}
                aria-current={tab === id ? 'page' : undefined}
                onClick={() => setTab(id)}
              >
                <Icon size={16} /> {label}
              </button>
            ))}
          </nav>
          {tab === 'practice' && (
            <>
              <div className="cn-study-filter">
                <label htmlFor="cn-topic">Focus your practice</label>
                <select
                  id="cn-topic"
                  value={topic}
                  onChange={(event) => setTopic(event.target.value)}
                >
                  <option>All topics</option>
                  {topics.map((name) => (
                    <option key={name}>{name}</option>
                  ))}
                </select>
              </div>
              <div className="cn-practice-grid">
                <PracticeCard
                  icon={<Target size={24} />}
                  label="10 QUESTIONS · FEEDBACK AS YOU GO"
                  title="Build your understanding"
                  description="A fresh selection that favors missed and unfamiliar questions. Find out why every answer works or fails."
                  action="Start focused practice"
                  onClick={() => start('practice')}
                  primary
                />
                <PracticeCard
                  icon={<FileText size={24} />}
                  label="24 QUESTIONS · ANSWERS AT THE END"
                  title="Rehearse the reading check"
                  description="A balanced mix from the full essay. Choose carefully, finish the session, then inspect your complete report."
                  action="Begin rehearsal"
                  onClick={() => start('exam')}
                />
                <PracticeCard
                  icon={<RotateCcw size={24} />}
                  label={`${save.missed.length} QUESTIONS IN YOUR REVIEW QUEUE`}
                  title={
                    save.missed.length ? 'Turn mistakes into progress' : 'A clear review queue'
                  }
                  description={
                    save.missed.length
                      ? 'Return to questions you have missed. A correct response removes an item from this queue.'
                      : 'Missed questions will appear here. Try focused practice to find your next learning opportunity.'
                  }
                  action={save.missed.length ? 'Review missed questions' : 'Try focused practice'}
                  onClick={() => start(save.missed.length ? 'missed' : 'practice')}
                />
                <PracticeCard
                  icon={<BookOpen size={24} />}
                  label="NO TIME LIMIT · FULL EXPLANATIONS"
                  title="Leave no passage unexplored"
                  description="Work through every question in your selected topic. Pause to read the original essay whenever you need it."
                  action="Review all questions"
                  onClick={() => start('all')}
                />
              </div>
              <div className="cn-study-note">
                <BookOpen size={18} />
                <p>
                  Coverage follows the complete 1849 essay. Your class may use an excerpt. Match
                  your teacher’s assigned text and notes before your quiz; rehearsal scores measure
                  this question bank.
                </p>
              </div>
              <div className="cn-topic-progress">
                <h2>Your reading map</h2>
                <p>A topic becomes secure through accurate recall, not through story completion.</p>
                {topics.map((name) => {
                  const group = questions.filter((q) => q.topic === name);
                  const mastered = group.filter(
                    (q) => (save.mastery[q.id]?.streak ?? 0) >= 2,
                  ).length;
                  const touched = group.filter((q) => (save.mastery[q.id]?.seen ?? 0) > 0).length;
                  return (
                    <div className="cn-topic-row" key={name}>
                      <span>{name}</span>
                      <div
                        className="cn-meter"
                        role="progressbar"
                        aria-label={`${name} secure questions`}
                        aria-valuenow={mastered}
                        aria-valuemin={0}
                        aria-valuemax={group.length}
                      >
                        <i
                          style={{
                            width: `${group.length ? (mastered / group.length) * 100 : 0}%`,
                          }}
                        />
                      </div>
                      <small>
                        {mastered}/{group.length} secure · {touched} seen
                      </small>
                    </div>
                  );
                })}
              </div>
            </>
          )}
          {tab === 'source' && <SourceReader />}
          {tab === 'journal' && (
            <Journal collected={save.collected} onSource={setSourceParagraph} />
          )}
        </>
      )}
      {session &&
        !session.finished &&
        (() => {
          const round = session.rounds[session.index];
          const recorded = session.answers[session.index];
          const reveal = !!recorded && session.mode !== 'exam';
          return (
            <div className="cn-question-session">
              <div className="cn-question-meta">
                <span>{modeNames[session.mode]}</span>
                <span>
                  {session.index + 1} / {session.rounds.length}
                </span>
              </div>
              <div className="cn-meter">
                <i
                  style={{ width: `${(session.answers.length / session.rounds.length) * 100}%` }}
                />
              </div>
              <p className="cn-eyebrow">{round.question.topic}</p>
              <h1 tabIndex={-1} ref={heading}>
                {round.question.prompt}
              </h1>
              <div className="cn-quiz-options" role="group" aria-label="Answer choices">
                {round.order.map((original, index) => (
                  <button
                    key={`${round.question.id}-${original}`}
                    disabled={!!recorded}
                    className={`cn-quiz-option ${recorded?.selected === original ? 'selected' : ''} ${reveal && original === round.question.answer ? 'correct' : ''} ${reveal && recorded?.selected === original && original !== round.question.answer ? 'incorrect' : ''}`}
                    onClick={() => answer(original)}
                  >
                    <kbd>{index + 1}</kbd>
                    <span>{round.question.options[original]}</span>
                    {reveal && original === round.question.answer && (
                      <CheckCircle2 size={20} aria-label="Correct answer" />
                    )}
                  </button>
                ))}
              </div>
              {recorded && (
                <div aria-live="polite" className="cn-answer-feedback">
                  {reveal ? (
                    <AnswerExplanation answer={recorded} onSource={setSourceParagraph} />
                  ) : (
                    <p>
                      <Check size={17} /> Answer recorded. Explanations will appear in your final
                      report.
                    </p>
                  )}
                  <button className="cn-button primary" onClick={nextQuestion}>
                    {session.index === session.rounds.length - 1
                      ? 'See my report'
                      : 'Next question'}
                    <ArrowRight size={17} />
                  </button>
                </div>
              )}
              {!recorded && (
                <p className="cn-key-hint">
                  Choose an answer, or use keys 1–4. There is no time limit.
                </p>
              )}
            </div>
          );
        })()}
      {session?.finished && (
        <Results
          session={session}
          onSource={setSourceParagraph}
          onAgain={() => start(session.mode)}
          onMissed={() =>
            start(
              'missed',
              session.answers
                .filter((a) => a.selected !== a.question.answer)
                .map((a) => a.question),
            )
          }
          onDesk={() => setSession(null)}
        />
      )}
      {sourceParagraph !== null && (
        <SourcePanel paragraph={sourceParagraph} onClose={() => setSourceParagraph(null)} />
      )}
      {confirmExit && (
        <StudyDialog title="Return to the study desk?" onClose={() => setConfirmExit(false)}>
          <p>
            Your answered questions have been saved. This unfinished session will close; a rehearsal
            score is saved only when you finish.
          </p>
          <div className="cn-actions">
            <button className="cn-button" onClick={() => setConfirmExit(false)}>
              Keep studying
            </button>
            <button
              className="cn-button primary"
              onClick={() => {
                setSession(null);
                setConfirmExit(false);
              }}
            >
              Return to desk
            </button>
          </div>
        </StudyDialog>
      )}
    </section>
  );
}

function PracticeCard({
  icon,
  label,
  title,
  description,
  action,
  onClick,
  primary = false,
}: {
  icon: React.ReactNode;
  label: string;
  title: string;
  description: string;
  action: string;
  onClick: () => void;
  primary?: boolean;
}) {
  return (
    <article className={`cn-practice-card ${primary ? 'featured' : ''}`}>
      <div className="cn-practice-icon">{icon}</div>
      <p className="cn-eyebrow">{label}</p>
      <h2>{title}</h2>
      <p>{description}</p>
      <button className={`cn-button ${primary ? 'primary' : ''}`} onClick={onClick}>
        {action}
        <ArrowRight size={16} />
      </button>
    </article>
  );
}

function AnswerExplanation({
  answer,
  onSource,
}: {
  answer: Answer;
  onSource: (id: number) => void;
}) {
  const { question, selected, order } = answer;
  const correct = selected === question.answer;
  return (
    <div className="cn-explanation">
      <h2 className={correct ? 'cn-correct-text' : 'cn-incorrect-text'}>
        {correct ? 'Well reasoned.' : 'A useful distinction.'}
      </h2>
      <p>{question.explanation}</p>
      <div className="cn-answer-reasons">
        {order.map((option, index) => (
          <div className={option === question.answer ? 'correct' : ''} key={option}>
            <span className="cn-reason-label">
              {index + 1}
              {option === question.answer
                ? ' · CORRECT'
                : option === selected
                  ? ' · YOUR ANSWER'
                  : ''}
            </span>
            <p>
              <strong>{question.options[option]}</strong> {question.distractors[option]}
            </p>
          </div>
        ))}
      </div>
      <details className="cn-passage-preview">
        <summary>Supporting passage · paragraph {question.paragraph}</summary>
        <blockquote>{passage(question.paragraph)}</blockquote>
      </details>
      <button className="cn-link" onClick={() => onSource(question.paragraph)}>
        <BookOpen size={16} /> Read in context · paragraph {question.paragraph}
      </button>
    </div>
  );
}

function Results({
  session,
  onSource,
  onAgain,
  onMissed,
  onDesk,
}: {
  session: Session;
  onSource: (id: number) => void;
  onAgain: () => void;
  onMissed: () => void;
  onDesk: () => void;
}) {
  const correct = session.answers.filter((a) => a.selected === a.question.answer).length;
  const percent = Math.round((correct / session.answers.length) * 100);
  return (
    <div className="cn-results">
      <div className="cn-results-hero">
        <div className="cn-score-ring">
          <strong>
            {percent}
            <small>%</small>
          </strong>
          <span>
            {correct} / {session.answers.length} correct
          </span>
        </div>
        <div>
          <p className="cn-eyebrow">{modeNames[session.mode]} · COMPLETE</p>
          <h1>
            {percent === 100
              ? 'Every answer, supported.'
              : percent >= 80
                ? 'Your argument is taking shape.'
                : 'Understanding starts here.'}
          </h1>
          <p>
            {percent === 100
              ? 'A strong result for this set. Return later and try unfamiliar questions to test what lasts.'
              : `${session.answers.length - correct} ${session.answers.length - correct === 1 ? 'question gives' : 'questions give'} you a clear next step. Review the reasoning below, then try ${session.answers.length - correct === 1 ? 'it' : 'them'} again.`}
          </p>
        </div>
      </div>
      <div className="cn-actions">
        <button className="cn-button primary" onClick={onAgain}>
          <RotateCcw size={16} /> New {session.mode === 'exam' ? 'rehearsal' : 'session'}
        </button>
        {correct < session.answers.length && (
          <button className="cn-button" onClick={onMissed}>
            Practice these missed questions
          </button>
        )}
        <button className="cn-link" onClick={onDesk}>
          Return to study desk
        </button>
      </div>
      <div className="cn-report-topics">
        {[...new Set(session.answers.map((a) => a.question.topic))].map((topic) => {
          const group = session.answers.filter((a) => a.question.topic === topic);
          const right = group.filter((a) => a.selected === a.question.answer).length;
          return (
            <div key={topic}>
              <span>{topic}</span>
              <strong>
                {right} / {group.length}
              </strong>
            </div>
          );
        })}
      </div>
      <h2>Your complete answer review</h2>
      <p>
        Open any question for the correct answer, every alternative, and the supporting passage.
      </p>
      <div className="cn-result-list">
        {session.answers.map((answer, index) => (
          <details key={answer.question.id}>
            <summary>
              <span
                className={`cn-result-mark ${answer.selected === answer.question.answer ? 'correct' : 'incorrect'}`}
              >
                {answer.selected === answer.question.answer ? <Check size={16} /> : <X size={16} />}
              </span>
              <span>
                {index + 1}. {answer.question.prompt}
              </span>
              <ChevronDown size={16} />
            </summary>
            <AnswerExplanation answer={answer} onSource={onSource} />
          </details>
        ))}
      </div>
    </div>
  );
}

function SourceReader() {
  const [search, setSearch] = useState('');
  const [jump, setJump] = useState('1');
  const [active, setActive] = useState<number | null>(null);
  const blocks = useRef(new Map<number, HTMLElement>());
  const matches = useMemo(
    () =>
      source.filter(
        (paragraph) =>
          !search.trim() || paragraph.text.toLowerCase().includes(search.trim().toLowerCase()),
      ),
    [search],
  );
  function go() {
    const id = Number(jump);
    if (!source.some((p) => p.id === id)) return;
    setSearch('');
    setActive(id);
    requestAnimationFrame(() => {
      const block = blocks.current.get(id);
      block?.scrollIntoView({ behavior: 'smooth', block: 'center' });
      block?.focus({ preventScroll: true });
    });
  }
  return (
    <section className="cn-source-reader">
      <div className="cn-source-title">
        <p className="cn-eyebrow">THE COMPLETE ESSAY · 1849</p>
        <h2>Civil Disobedience</h2>
        <p>
          Henry David Thoreau · first published as <em>Resistance to Civil Government</em>
        </p>
        <a
          className="cn-link"
          href="https://www.gutenberg.org/files/71/71-h/71-h.htm"
          target="_blank"
          rel="noreferrer"
        >
          Project Gutenberg source <ExternalLink size={13} />
        </a>
        <p className="cn-source-numbering">
          Paragraph numbers are this game’s internal reference system, not page numbers in your
          class edition. The narrative and debates adapt the essay; this reader preserves the
          original text.
        </p>
      </div>
      <div className="cn-source-tools">
        <label className="cn-search">
          <Search size={17} />
          <input
            aria-label="Search the essay"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Search a word or phrase…"
          />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go();
          }}
        >
          <label htmlFor="cn-paragraph-jump">Paragraph</label>
          <input
            id="cn-paragraph-jump"
            type="number"
            min={1}
            max={source.length}
            value={jump}
            onChange={(event) => setJump(event.target.value)}
          />
          <button className="cn-button" type="submit">
            Go
          </button>
        </form>
      </div>
      <p className="cn-source-count" role="status">
        {matches.length} {matches.length === 1 ? 'paragraph' : 'paragraphs'}
        {search.trim() ? ` containing “${search.trim()}”` : ' in the essay'}
      </p>
      {!matches.length && (
        <div className="cn-empty">
          <Search size={25} />
          <h3>No matching passage.</h3>
          <p>Try a shorter phrase or a different spelling.</p>
          <button className="cn-button" onClick={() => setSearch('')}>
            Show the full essay
          </button>
        </div>
      )}
      <div className="cn-source-text">
        {matches.map((paragraph) => (
          <p
            key={paragraph.id}
            tabIndex={-1}
            className={active === paragraph.id ? 'highlighted' : ''}
            ref={(element) => {
              if (element) blocks.current.set(paragraph.id, element);
              else blocks.current.delete(paragraph.id);
            }}
          >
            <span className="cn-paragraph-number">{paragraph.id}</span>
            {paragraph.text}
          </p>
        ))}
      </div>
    </section>
  );
}

function Journal({ collected, onSource }: { collected: string[]; onSource: (id: number) => void }) {
  const [all, setAll] = useState(false);
  const entries = evidence.filter((card) => all || collected.includes(card.id));
  return (
    <section className="cn-journal">
      <div className="cn-journal-heading">
        <div>
          <h2>Words worth carrying.</h2>
          <p>
            {collected.length} / {evidence.length} evidence cards discovered in the story. You can
            study every card here at any time.
          </p>
        </div>
        <label className="cn-toggle">
          <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
          Show all study cards
        </label>
      </div>
      {!entries.length && (
        <div className="cn-empty">
          <BookOpen size={30} />
          <h3>Your journal is waiting.</h3>
          <p>Inspect objects in Concord to collect evidence, or open all study cards now.</p>
          <button className="cn-button" onClick={() => setAll(true)}>
            Browse all evidence
          </button>
        </div>
      )}
      <div className="cn-journal-grid">
        {entries.map((card) => (
          <article className="cn-journal-card" key={card.id}>
            <p className="cn-eyebrow">
              {card.topic} · {collected.includes(card.id) ? 'DISCOVERED' : 'STUDY CARD'}
            </p>
            <h3>{card.title}</h3>
            <blockquote>“{card.quote}”</blockquote>
            <p>{card.meaning}</p>
            <button className="cn-link" onClick={() => onSource(card.paragraph)}>
              <BookOpen size={15} />
              Paragraph {card.paragraph}
              <ArrowRight size={14} />
            </button>
          </article>
        ))}
      </div>
    </section>
  );
}

export function SourcePanel({ paragraph, onClose }: { paragraph: number; onClose: () => void }) {
  const context = source.filter((p) => Math.abs(p.id - paragraph) <= 1);
  return (
    <StudyDialog title={`The essay · paragraph ${paragraph}`} onClose={onClose}>
      <p className="cn-source-numbering">
        Internal paragraph references · Henry David Thoreau, 1849
      </p>
      <div className="cn-source-context">
        {context.map((p) => (
          <p key={p.id} className={p.id === paragraph ? 'highlighted' : ''}>
            <span className="cn-paragraph-number">{p.id}</span>
            {p.text}
          </p>
        ))}
      </div>
      <a
        className="cn-link"
        href="https://www.gutenberg.org/files/71/71-h/71-h.htm"
        target="_blank"
        rel="noreferrer"
      >
        Read the original source
        <ExternalLink size={14} />
      </a>
    </StudyDialog>
  );
}

function StudyDialog({
  title,
  children,
  onClose,
}: {
  title: string;
  children: React.ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null);
  const closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    const close = () => closeRef.current();
    node?.addEventListener('close', close);
    return () => {
      node?.removeEventListener('close', close);
      // Removing the element closes it on unmount. Calling close() here queues a close event
      // that can reach the replacement listener during React StrictMode's effect replay.
      previous?.focus();
    };
  }, []);
  return (
    <dialog
      ref={dialog}
      className="cn-dialog"
      aria-label={title}
      onClick={(event) => {
        if (event.target === event.currentTarget) onClose();
      }}
    >
      <div className="cn-dialog-content">
        <header>
          <h2>{title}</h2>
          <button className="cn-icon-button" aria-label="Close passage" onClick={onClose} autoFocus>
            <X size={20} />
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
