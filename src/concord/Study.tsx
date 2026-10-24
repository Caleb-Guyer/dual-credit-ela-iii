import { useEffect, useMemo, useRef, useState, type ReactNode } from 'react';
import { evidence, passage, questions, source, topics, type Question } from './data';
import type { ConcordSave } from './save';
import './study.css';

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
  practice: 'Practice',
  exam: 'Quiz rehearsal',
  missed: 'Missed questions',
  all: 'Complete review',
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
    <section className="cn-study-page">
      <div className="cn-study">
        <header className="cn-study-header">
          <button
            className="cn-link"
            onClick={() => {
              if (active) setConfirmExit(true);
              else if (session) setSession(null);
              else onBack();
            }}
          >
            ← {session ? 'Notebook' : 'Back to game'}
          </button>
          <span>One Night in Concord</span>
        </header>
        {!session && (
          <>
            <div className="cn-study-intro">
              <h1>Reading notebook</h1>
              <p>Read a passage, test what you remember, or return to a question you missed.</p>
            </div>
            <nav className="cn-tabs" aria-label="Study sections">
              {(
                [
                  ['practice', 'Practice'],
                  ['source', 'The essay'],
                  ['journal', 'Collected passages'],
                ] as const
              ).map(([id, label]) => (
                <button
                  key={id}
                  className={tab === id ? 'active' : ''}
                  aria-current={tab === id ? 'page' : undefined}
                  onClick={() => setTab(id)}
                >
                  {label}
                </button>
              ))}
            </nav>
            {tab === 'practice' && (
              <>
                <div className="cn-study-filter">
                  <label htmlFor="cn-topic">Topic</label>
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
                <div className="cn-practice-menu">
                  <button
                    className="cn-practice-choice"
                    aria-label="Practice ten questions"
                    onClick={() => start('practice')}
                  >
                    <span>
                      <strong>Practice ten questions</strong>
                      <small>Read the explanation after each answer.</small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                  <button
                    className="cn-practice-choice"
                    aria-label="Rehearse the quiz"
                    onClick={() => start('exam')}
                  >
                    <span>
                      <strong>Rehearse the quiz</strong>
                      <small>
                        24 questions from the whole essay. Review your answers at the end.
                      </small>
                    </span>
                    <span aria-hidden="true">→</span>
                  </button>
                </div>
                <div className="cn-review-links">
                  {save.missed.length ? (
                    <button className="cn-link" onClick={() => start('missed')}>
                      Review missed questions ({save.missed.length})
                    </button>
                  ) : (
                    <span>No missed questions yet.</span>
                  )}
                  <button className="cn-link" onClick={() => start('all')}>
                    Review all questions
                  </button>
                </div>
                <details className="cn-progress-details">
                  <summary>
                    Your progress{' '}
                    <span>
                      {seen} of {questions.length} questions attempted
                    </span>
                  </summary>
                  <p>
                    {secure} answered correctly twice in a row.
                    {save.exams.length ? ` Best rehearsal: ${bestExam}%.` : ''} Story progress does
                    not affect these results.
                  </p>
                  <div className="cn-topic-progress">
                    {topics.map((name) => {
                      const group = questions.filter((q) => q.topic === name);
                      const mastered = group.filter(
                        (q) => (save.mastery[q.id]?.streak ?? 0) >= 2,
                      ).length;
                      const touched = group.filter(
                        (q) => (save.mastery[q.id]?.seen ?? 0) > 0,
                      ).length;
                      return (
                        <div className="cn-topic-row" key={name}>
                          <span>{name}</span>
                          <small>
                            {mastered}/{group.length} secure · {touched} attempted
                          </small>
                        </div>
                      );
                    })}
                  </div>
                </details>
                <p className="cn-study-note">
                  These questions cover the complete essay. If your class uses an excerpt, compare
                  it with your assigned pages and notes.
                </p>
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
            const round = session.rounds[session.index],
              recorded = session.answers[session.index];
            const reveal = !!recorded && session.mode !== 'exam';
            return (
              <div className="cn-question-session">
                <div className="cn-question-meta">
                  <span>{modeNames[session.mode]}</span>
                  <span>
                    Question {session.index + 1} of {session.rounds.length}
                  </span>
                </div>
                <p className="cn-question-topic">{round.question.topic}</p>
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
                        <small aria-label="Correct answer">Correct</small>
                      )}
                    </button>
                  ))}
                </div>
                {recorded ? (
                  <div aria-live="polite" className="cn-answer-feedback">
                    {reveal ? (
                      <AnswerExplanation answer={recorded} onSource={setSourceParagraph} />
                    ) : (
                      <p>Answer recorded. You can review the explanation when you finish.</p>
                    )}
                    <button className="cn-button primary" onClick={nextQuestion}>
                      {session.index === session.rounds.length - 1
                        ? 'See my report'
                        : 'Next question'}{' '}
                      <span aria-hidden="true">→</span>
                    </button>
                  </div>
                ) : (
                  <p className="cn-key-hint">Choose an answer, or use keys 1–4. Take your time.</p>
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
          <StudyDialog title="Close this practice session?" onClose={() => setConfirmExit(false)}>
            <p>
              Answers already given are saved. An unfinished rehearsal does not receive a score.
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
                Return to notebook
              </button>
            </div>
          </StudyDialog>
        )}
      </div>
    </section>
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
        {correct ? 'Correct.' : 'Not quite.'}
      </h2>
      <p>{question.explanation}</p>
      <details className="cn-answer-reasons">
        <summary>Why each answer works or fails</summary>
        {order.map((option, index) => (
          <div className={option === question.answer ? 'correct' : ''} key={option}>
            <span className="cn-reason-label">
              {index + 1}
              {option === question.answer
                ? ' — correct'
                : option === selected
                  ? ' — your answer'
                  : ''}
            </span>
            <p>
              <strong>{question.options[option]}</strong> {question.distractors[option]}
            </p>
          </div>
        ))}
      </details>
      <details className="cn-passage-preview">
        <summary>Supporting passage · paragraph {question.paragraph}</summary>
        <blockquote>{passage(question.paragraph)}</blockquote>
      </details>
      <button className="cn-link" onClick={() => onSource(question.paragraph)}>
        Read in context · paragraph {question.paragraph}
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
      <p className="cn-results-label">{modeNames[session.mode]} complete</p>
      <div className="cn-score-ring">
        <h1>
          {percent}
          <small>%</small>
        </h1>
        <p>
          {correct} of {session.answers.length} correct.
        </p>
      </div>
      <div className="cn-actions">
        {correct < session.answers.length && (
          <button className="cn-button primary" onClick={onMissed}>
            Practice these missed questions
          </button>
        )}
        <button className="cn-button" onClick={onAgain}>
          New {session.mode === 'exam' ? 'rehearsal' : 'session'}
        </button>
        <button className="cn-link" onClick={onDesk}>
          Return to notebook
        </button>
      </div>
      <details className="cn-progress-details">
        <summary>Results by topic</summary>
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
      </details>
      <h2>Your answers</h2>
      <p>Open a question to read the explanation and its source.</p>
      <div className="cn-result-list">
        {session.answers.map((answer, index) => (
          <details key={answer.question.id}>
            <summary>
              <span
                className={`cn-result-mark ${answer.selected === answer.question.answer ? 'correct' : 'incorrect'}`}
              >
                {answer.selected === answer.question.answer ? 'Correct' : 'Missed'}
              </span>
              <span>
                {index + 1}. {answer.question.prompt}
              </span>
            </summary>
            <AnswerExplanation answer={answer} onSource={onSource} />
          </details>
        ))}
      </div>
    </div>
  );
}

function SourceReader() {
  const [search, setSearch] = useState(''),
    [jump, setJump] = useState('1');
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
      block?.scrollIntoView({ behavior: 'instant', block: 'center' });
      block?.focus({ preventScroll: true });
    });
  }
  return (
    <section className="cn-source-reader">
      <div className="cn-source-title">
        <h2>Civil Disobedience</h2>
        <p>Henry David Thoreau, 1849</p>
        <p className="cn-source-publication">
          First published as <em>Resistance to Civil Government</em>.
        </p>
        <p className="cn-source-numbering">
          Paragraph numbers identify this copy, not pages in your classroom edition.
        </p>
        <a
          className="cn-link"
          href="https://www.gutenberg.org/files/71/71-h/71-h.htm"
          target="_blank"
          rel="noreferrer"
        >
          Project Gutenberg source ↗
        </a>
      </div>
      <div className="cn-source-tools">
        <label className="cn-search">
          <span>Find a passage</span>
          <input
            aria-label="Search the essay"
            value={search}
            onChange={(event) => setSearch(event.target.value)}
            placeholder="Word or phrase"
          />
        </label>
        <form
          onSubmit={(event) => {
            event.preventDefault();
            go();
          }}
        >
          <label htmlFor="cn-paragraph-jump">Paragraph</label>
          <div>
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
          </div>
        </form>
      </div>
      <p className="cn-source-count" role="status">
        {matches.length} {matches.length === 1 ? 'paragraph' : 'paragraphs'}
        {search.trim() ? ` containing “${search.trim()}”` : ''}
      </p>
      {!matches.length && (
        <div className="cn-empty">
          <h3>No matching passage.</h3>
          <p>Try a shorter phrase or a different spelling.</p>
          <button className="cn-link" onClick={() => setSearch('')}>
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
        <h2>Collected passages</h2>
        <p>
          {collected.length} of {evidence.length} found in Concord.
        </p>
        <label className="cn-toggle">
          <input type="checkbox" checked={all} onChange={(event) => setAll(event.target.checked)} />
          Show all passages
        </label>
      </div>
      {!entries.length && (
        <div className="cn-empty">
          <p>
            Nothing collected yet. Inspect the noticeboard, papers, and other objects in the town,
            or browse the passages here.
          </p>
          <button className="cn-link" onClick={() => setAll(true)}>
            Browse all passages
          </button>
        </div>
      )}
      <div className="cn-journal-grid">
        {entries.map((card) => (
          <article className="cn-journal-card" key={card.id}>
            <p className="cn-journal-topic">
              {card.topic}
              {!collected.includes(card.id) ? ' · not yet collected' : ''}
            </p>
            <h3>{card.title}</h3>
            <blockquote>“{card.quote}”</blockquote>
            <p>{card.meaning}</p>
            <button className="cn-link" onClick={() => onSource(card.paragraph)}>
              Read paragraph {card.paragraph} →
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
        Henry David Thoreau, 1849 · paragraph references for this copy
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
        Read the original source ↗
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
  children: ReactNode;
  onClose: () => void;
}) {
  const dialog = useRef<HTMLDialogElement>(null),
    closeRef = useRef(onClose);
  closeRef.current = onClose;
  useEffect(() => {
    const node = dialog.current;
    const previous = document.activeElement instanceof HTMLElement ? document.activeElement : null;
    node?.showModal();
    const close = () => closeRef.current();
    node?.addEventListener('close', close);
    return () => {
      node?.removeEventListener('close', close);
      // DOM removal closes the dialog. close() here queues a stale event during StrictMode replay.
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
            ×
          </button>
        </header>
        {children}
      </div>
    </dialog>
  );
}
