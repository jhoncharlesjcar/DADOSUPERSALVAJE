/** RAF timestamps and performance.now share the same monotonic time origin. */
export class ReplayClock {
  private previous: number | null = null;
  private running = true;
  private elapsed = 0;

  read(now: number) {
    if (this.previous !== null && this.running) this.elapsed += Math.max(0, now - this.previous) / 1000;
    this.previous = now;
    return this.elapsed;
  }

  setRunning(running: boolean, now: number) {
    this.read(now);
    this.running = running;
  }

  seek(seconds: number, now: number) {
    this.elapsed = seconds;
    this.previous = now;
  }
}
