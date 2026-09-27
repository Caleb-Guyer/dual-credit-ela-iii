export interface SpeechOptions {
  speaker?: string;
  onStart?: () => void;
  onEnd?: () => void;
  onError?: () => void;
  onWord?: (index: number) => void;
}
let active: symbol | null = null;
let utterance: SpeechSynthesisUtterance | null = null;
const announce = (speaking: boolean) =>
  window.dispatchEvent(new CustomEvent('franklin-speech', { detail: speaking }));
export const speechAvailable = () =>
  typeof window !== 'undefined' &&
  'speechSynthesis' in window &&
  'SpeechSynthesisUtterance' in window;
export function stopSpeech() {
  window.dispatchEvent(new Event('franklin-speech-stop'));
  active = null;
  utterance = null;
  if (speechAvailable()) window.speechSynthesis.cancel();
  announce(false);
}
/** One speaker at a time; a stale component cannot cancel a newer conversation. */
export function speak(text: string, options: SpeechOptions = {}): () => void {
  stopSpeech();
  if (!speechAvailable()) {
    options.onError?.();
    return () => {};
  }
  const token = Symbol('speech');
  active = token;
  const line = new SpeechSynthesisUtterance(text);
  utterance = line;
  const voices = speechSynthesis.getVoices().filter((v) => /^en[-_]/i.test(v.lang));
  const local = voices.filter((v) => v.localService),
    available = local.length ? local : voices;
  const seed = [...(options.speaker ?? 'Narrator')].reduce((n, c) => n + c.charCodeAt(0), 0);
  if (available.length) line.voice = available[seed % available.length];
  line.lang = line.voice?.lang ?? 'en-US';
  line.rate = 0.97 + (seed % 3) * 0.025;
  line.pitch = options.speaker === 'Franklin' ? 0.88 : 0.96 + (seed % 4) * 0.045;
  line.onstart = () => {
    if (active === token) {
      announce(true);
      options.onStart?.();
    }
  };
  line.onboundary = (e) => {
    if (active === token) options.onWord?.(e.charIndex);
  };
  const finish = (failed: boolean) => {
    if (active !== token) return;
    active = null;
    utterance = null;
    announce(false);
    if (failed) options.onError?.();
    else options.onEnd?.();
  };
  line.onend = () => finish(false);
  line.onerror = () => finish(true);
  try {
    speechSynthesis.resume();
    speechSynthesis.speak(utterance);
  } catch {
    finish(true);
  }
  return () => {
    if (active === token) stopSpeech();
  };
}

/** Keep the original wording intact, pausing at sentences or natural clause boundaries. */
export function dialogueBeats(text: string, limit = 175): string[] {
  const words = text.trim().split(/\s+/),
    lines: string[] = [];
  let line = '';
  for (const word of words) {
    if (line && line.length + word.length + 1 > limit) {
      lines.push(line);
      line = '';
    }
    line += (line ? ' ' : '') + word;
    if (line.length > 65 && /[.!?]$/.test(word) && !/^(?:Mr|Mrs|Dr|St)\.$/i.test(word)) {
      lines.push(line);
      line = '';
    }
  }
  if (line) lines.push(line);
  return lines;
}
