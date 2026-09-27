/** Procedural wind, water, footsteps and birds. No external audio service or sampled music. */
export class Soundscape {
  private bus: GainNode;
  private ambience: AudioBufferSourceNode;
  private noise: AudioBuffer;
  private lastStep = 0;
  private lastBird = 0;
  private paused = false;
  private speaking = false;
  constructor(
    private context: AudioContext,
    private chapter: number,
    private enabled: boolean,
  ) {
    this.bus = context.createGain();
    this.bus.gain.value = 0;
    this.bus.connect(context.destination);
    this.noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
    const buffer = this.noise.getChannelData(0);
    let last = 0;
    for (let i = 0; i < buffer.length; i++) {
      last = (last + Math.random() * 0.06 - 0.03) / 1.015;
      buffer[i] = last;
    }
    this.ambience = context.createBufferSource();
    this.ambience.buffer = this.noise;
    this.ambience.loop = true;
    const filter = context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = chapter === 5 ? 950 : 450;
    const level = context.createGain();
    level.gain.value = chapter === 6 ? 0.16 : 0.5;
    this.ambience.connect(filter);
    filter.connect(level);
    level.connect(this.bus);
    this.ambience.start();
    window.addEventListener('franklin-speech', this.speech);
    this.mix();
  }
  private speech = (e: Event) => {
    this.speaking = (e as CustomEvent<boolean>).detail;
    this.mix();
  };
  private mix() {
    this.bus.gain.setTargetAtTime(
      this.enabled && !this.paused ? (this.speaking ? 0.18 : 0.42) : 0,
      this.context.currentTime,
      0.3,
    );
  }
  update(enabled: boolean, paused: boolean, steps: number) {
    if (this.enabled !== enabled || this.paused !== paused) {
      this.enabled = enabled;
      this.paused = paused;
      this.mix();
    }
    if (!enabled || paused) return;
    const now = this.context.currentTime;
    if (steps - this.lastStep > Math.PI) {
      this.lastStep = steps;
      this.footstep(now);
    }
    if (this.chapter !== 6 && now - this.lastBird > 8) {
      this.lastBird = now;
      this.bird(now);
    }
  }
  private footstep(at: number) {
    const noise = this.context.createBufferSource();
    noise.buffer = this.noise;
    const filter = this.context.createBiquadFilter();
    filter.type = 'lowpass';
    filter.frequency.value = this.chapter === 5 ? 350 : 1000;
    const envelope = this.context.createGain();
    envelope.gain.setValueAtTime(0.0001, at);
    envelope.gain.exponentialRampToValueAtTime(0.8, at + 0.008);
    envelope.gain.exponentialRampToValueAtTime(0.0001, at + 0.13);
    noise.connect(filter);
    filter.connect(envelope);
    envelope.connect(this.bus);
    noise.start(at, Math.random() * 2);
    noise.stop(at + 0.15);
    noise.onended = () => {
      noise.disconnect();
      filter.disconnect();
      envelope.disconnect();
    };
  }
  private bird(at: number) {
    const osc = this.context.createOscillator(),
      env = this.context.createGain();
    osc.type = 'sine';
    osc.frequency.setValueAtTime(this.chapter === 5 ? 900 : 1900, at);
    osc.frequency.exponentialRampToValueAtTime(this.chapter === 5 ? 1400 : 2900, at + 0.15);
    osc.frequency.exponentialRampToValueAtTime(1100, at + 0.35);
    env.gain.setValueAtTime(0.0001, at);
    env.gain.exponentialRampToValueAtTime(0.028, at + 0.06);
    env.gain.exponentialRampToValueAtTime(0.0001, at + 0.45);
    osc.connect(env);
    env.connect(this.bus);
    osc.start(at);
    osc.stop(at + 0.5);
    osc.onended = () => {
      osc.disconnect();
      env.disconnect();
    };
  }
  dispose() {
    window.removeEventListener('franklin-speech', this.speech);
    this.ambience.stop();
    this.ambience.disconnect();
    this.bus.disconnect();
  }
}
