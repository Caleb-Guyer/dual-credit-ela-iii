/** Original, quiet procedural night ambience. Starts only after a player gesture. */
export class ConcordAudio {
  private context?: AudioContext;
  private master?: GainNode;
  private timer?: ReturnType<typeof setInterval>;
  private step = 0;
  start() {
    if (typeof AudioContext === 'undefined') return;
    if (!this.context) {
      this.context = new AudioContext();
      this.master = this.context.createGain();
      this.master.gain.value = 0.045;
      this.master.connect(this.context.destination);
      this.timer = setInterval(() => this.note(), 2100);
    }
    if (this.context.state !== 'closed') void this.context.resume().catch(() => {});
  }
  private note() {
    const context = this.context,
      master = this.master;
    if (!context || !master || context.state !== 'running') return;
    const notes = [146.83, 220, 293.66, 174.61, 261.63, 220, 196, 130.81];
    const oscillator = context.createOscillator(),
      gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.value = notes[this.step++ % notes.length];
    const now = context.currentTime;
    gain.gain.setValueAtTime(0, now);
    gain.gain.linearRampToValueAtTime(0.5, now + 0.7);
    gain.gain.exponentialRampToValueAtTime(0.001, now + 4);
    oscillator.connect(gain);
    gain.connect(master);
    oscillator.start();
    oscillator.stop(now + 4.1);
    oscillator.onended = () => {
      oscillator.disconnect();
      gain.disconnect();
    };
  }
  stop() {
    if (this.context?.state !== 'closed') void this.context?.suspend().catch(() => {});
  }
  dispose() {
    clearInterval(this.timer);
    if (this.context?.state !== 'closed') void this.context?.close().catch(() => {});
  }
}
