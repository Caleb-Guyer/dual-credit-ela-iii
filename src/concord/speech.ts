export type SpeechProgress = { text: string; revealed: number };

/** Character reveal times, including the small breaths a reader takes at punctuation. */
export function speechSchedule(text: string): readonly number[] {
  const times: number[] = [];
  let elapsed = 0;
  for (let index = 0; index < text.length; index++) {
    const previous = text[index - 1] ?? '';
    const punctuation = /[.!?…]/.test(previous) ? 0.25 : /[,;:—]/.test(previous) ? 0.14 : 0;
    // A cluster such as "..." is one pause, taken after its last mark.
    elapsed += 1 / 42 + (/[.!?…]/.test(text[index]) ? 0 : punctuation);
    times.push(elapsed);
  }
  return times;
}

/** Sampling elapsed time keeps the same delivery at every rendering frame rate. */
export function speechCountAt(schedule: readonly number[], elapsed: number): number {
  let low = 0,
    high = schedule.length;
  while (low < high) {
    const middle = (low + high) >>> 1;
    if (schedule[middle] <= elapsed) low = middle + 1;
    else high = middle;
  }
  return low;
}
