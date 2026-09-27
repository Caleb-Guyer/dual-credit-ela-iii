import manifest from './voice-manifest.json' with { type: 'json' };
import { speak, stopSpeech, type SpeechOptions } from '../lib/speech';

export function voiceKey(speaker: string, text: string) {
  let hash = 2166136261;
  for (const char of speaker + '|' + text) {
    hash ^= char.charCodeAt(0);
    hash = Math.imul(hash, 16777619);
  }
  return (hash >>> 0).toString(16);
}
/** Bundled, locally generated speech; browser synthesis is a resilient fallback. */
export function perform(text: string, options: SpeechOptions = {}): () => void {
  stopSpeech();
  const clip = (manifest as Record<string, { file: string; duration: number; voice: string }>)[
    voiceKey(options.speaker ?? 'Narrator', text)
  ];
  if (!clip) return speak(text, options);
  const audio = new Audio(`${import.meta.env.BASE_URL}douglass-next/voice/${clip.file}`);
  audio.preload = 'auto';
  let cancelled = false,
    fallbackStop: (() => void) | undefined,
    fallingBack = false;
  const announce = (value: boolean) =>
    window.dispatchEvent(new CustomEvent('franklin-speech', { detail: value }));
  const stop = () => {
    if (cancelled) return;
    cancelled = true;
    audio.onended = null;
    audio.onerror = null;
    audio.onplaying = null;
    audio.ontimeupdate = null;
    audio.pause();
    audio.removeAttribute('src');
    audio.load();
    fallbackStop?.();
    window.removeEventListener('franklin-speech-stop', stop);
    announce(false);
  };
  const fallback = () => {
    if (cancelled || fallingBack) return;
    fallingBack = true;
    window.removeEventListener('franklin-speech-stop', stop);
    audio.pause();
    announce(false);
    fallbackStop = speak(text, options);
  };
  window.addEventListener('franklin-speech-stop', stop);
  audio.onplaying = () => {
    if (!cancelled) {
      announce(true);
      options.onStart?.();
    }
  };
  audio.ontimeupdate = () => {
    if (!cancelled) options.onWord?.(Math.floor((audio.currentTime / clip.duration) * text.length));
  };
  audio.onended = () => {
    if (!cancelled) {
      window.removeEventListener('franklin-speech-stop', stop);
      announce(false);
      options.onEnd?.();
    }
  };
  audio.onerror = fallback;
  void audio.play().catch(fallback);
  return stop;
}
