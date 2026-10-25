/** Quiet, original Web Audio foley. No recordings, voices, or network requests. */
export class ConcordAudio {
  private context?: AudioContext;
  private effects?: GainNode;
  private ambienceTones?: GainNode;
  private wind?: GainNode;
  private noise?: AudioBuffer;
  private timer?: ReturnType<typeof setInterval>;
  private sound = true;
  private ambience = false;
  private active = false;
  private act = 0;
  private foot = 0;

  configure(sound: boolean, ambience: boolean, act: number, active: boolean) {
    this.sound = sound;
    this.ambience = ambience;
    this.act = act;
    this.active = active;
    this.levels();
  }
  start() {
    if (typeof AudioContext === 'undefined') return;
    try {
      if (!this.context) {
        const context = new AudioContext();
        this.context = context;
        this.effects = context.createGain();
        this.effects.connect(context.destination);
        this.ambienceTones = context.createGain();
        this.ambienceTones.gain.value = 0;
        this.ambienceTones.connect(context.destination);
        this.wind = context.createGain();
        this.wind.gain.value = 0;
        this.wind.connect(context.destination);
        this.noise = context.createBuffer(1, context.sampleRate * 3, context.sampleRate);
        const data = this.noise.getChannelData(0);
        let brown = 0;
        for (let i = 0; i < data.length; i++) {
          brown = (brown + (Math.random() * 2 - 1) * 0.025) / 1.025;
          data[i] = brown * 3.5;
        }
        const air = context.createBufferSource(),
          filter = context.createBiquadFilter();
        air.buffer = this.noise;
        air.loop = true;
        filter.type = 'lowpass';
        filter.frequency.value = 650;
        air.connect(filter);
        filter.connect(this.wind);
        air.start();
        this.timer = setInterval(() => {
          if (!this.active || !this.ambience || context.state !== 'running' || document.hidden)
            return;
          if (this.act !== 2 && Math.random() > 0.65) {
            if (this.act === 3) {
              this.tone(1900 + Math.random() * 900, 0.09, 0.012, 'sine', 0.03, 'ambience');
              this.tone(2600, 0.1, 0.008, 'sine', 0.15, 'ambience');
            } else this.tone(3300, 0.055, 0.008, 'sine', 0, 'ambience');
          }
        }, 900);
      }
      this.levels();
      if (this.context.state !== 'closed') void this.context.resume().catch(() => {});
    } catch {
      /* Sound is optional on browsers without a usable audio device. */
    }
  }
  private levels() {
    const context = this.context;
    if (!context) return;
    this.effects?.gain.setTargetAtTime(
      this.sound && this.active ? 0.48 : 0,
      context.currentTime,
      0.08,
    );
    this.ambienceTones?.gain.setTargetAtTime(
      this.ambience && this.active ? 0.48 : 0,
      context.currentTime,
      0.08,
    );
    this.wind?.gain.setTargetAtTime(
      this.ambience && this.active ? (this.act === 2 ? 0.015 : this.act === 3 ? 0.09 : 0.045) : 0,
      context.currentTime,
      0.4,
    );
  }
  private tone(
    frequency: number,
    duration: number,
    volume: number,
    type: OscillatorType = 'sine',
    delay = 0,
    channel: 'effects' | 'ambience' = 'effects',
  ) {
    const context = this.context;
    const destination = channel === 'ambience' ? this.ambienceTones : this.effects;
    if (!context || !destination || context.state !== 'running') return;
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    const now = context.currentTime + delay;
    oscillator.type = type;
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(
      Math.max(30, frequency * 0.64),
      now + duration,
    );
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.006);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    oscillator.connect(gain);
    gain.connect(destination);
    oscillator.start(now);
    oscillator.stop(now + duration + 0.02);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  private rustle(duration: number, volume: number, frequency: number) {
    const context = this.context;
    if (!context || !this.noise || !this.effects || context.state !== 'running') return;
    const source = context.createBufferSource(),
      gain = context.createGain(),
      filter = context.createBiquadFilter();
    source.buffer = this.noise;
    filter.type = 'bandpass';
    filter.frequency.value = frequency;
    filter.Q.value = 0.6;
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(volume, now + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + duration);
    source.connect(filter);
    filter.connect(gain);
    gain.connect(this.effects);
    source.start(now, Math.random());
    source.stop(now + duration + 0.03);
    source.onended = () => {
      source.disconnect();
      filter.disconnect();
      gain.disconnect();
    };
  }
  play(cue: string, surface: 'road' | 'wood' | 'stone' = 'road', speed = 3.2) {
    if (!this.sound || !this.active || document.hidden) return;
    if (cue === 'footstep') {
      this.foot++;
      const volume = Math.min(0.16, 0.055 + speed * 0.014);
      this.tone(
        surface === 'wood' ? 155 : surface === 'stone' ? 225 : 95,
        0.07,
        volume,
        'triangle',
      );
      this.rustle(0.09, surface === 'road' ? 0.55 : 0.15, this.foot % 2 ? 900 : 720);
    } else if (/offer-coin|refuse-tax/.test(cue)) {
      this.tone(1450, 0.22, 0.09);
      this.tone(2150, 0.13, 0.045, 'sine', 0.025);
    } else if (/^c06/.test(cue)) {
      this.tone(cue.endsWith('finish') ? 78 : 420, 0.18, 0.18, 'triangle');
      this.rustle(0.22, 0.4, 450);
    } else if (/^c03/.test(cue)) {
      this.tone(cue.endsWith('finish') ? 115 : 165, 0.15, 0.17, 'triangle');
      this.rustle(0.3, 0.38, 500);
    } else if (/^c08/.test(cue)) {
      if (cue.endsWith('finish')) {
        for (const [i, f] of [390, 780, 1045].entries())
          this.tone(f, 1.8 - i * 0.3, 0.055 / (i + 1));
      } else this.rustle(0.2, 0.3, 480);
    } else if (/^c09|^c11/.test(cue)) {
      this.tone(90, 0.16, 0.085, 'triangle');
      this.rustle(0.24, 0.18, 350);
    } else if (/^c07/.test(cue)) this.rustle(0.32, 0.34, 1800);
    else if (/^c12:start/.test(cue)) this.tone(185, 0.13, 0.1, 'triangle');
    else if (!/consider|reflect|study-ledger/.test(cue)) this.rustle(0.22, 0.6, 1400);
  }
  stop() {
    if (this.context?.state !== 'closed') void this.context?.suspend().catch(() => {});
  }
  dispose() {
    clearInterval(this.timer);
    if (this.context?.state !== 'closed') void this.context?.close().catch(() => {});
  }
}
