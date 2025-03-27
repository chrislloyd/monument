import type { MonotonicClock } from "./clock";

export interface Scheduler {
  setTimeout(handler: Function, timeout: number): number;
  clearTimeout(id: number): void;
}

// ---

export class SystemScheduler implements Scheduler {
  setTimeout(handler: Function, timeout: number): number {
    return globalThis.setTimeout(handler, timeout);
  }

  clearTimeout(id: number): void {
    globalThis.clearTimeout(id);
  }
}

export class TestScheduler implements Scheduler {
  private timeouts: Map<
    number,
    { callback: Function; scheduledAt: number; delay: number }
  > = new Map();
  private nextTimerId: number = 1;
  // private currentTime: number = 0;

  constructor(private readonly clock: MonotonicClock) {}

  setTimeout(callback: Function, delay: number): number {
    const id = this.nextTimerId++;
    this.timeouts.set(id, {
      callback,
      scheduledAt: this.clock.now(),
      delay,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.timeouts.delete(id);
  }

  tick(ms: number = 0): void {
    const endTime = this.clock.now() + ms;

    // Continue processing timeouts until we reach the target time
    while (this.clock.now() < endTime) {
      // Find the next timeout that needs to execute
      let nextTimeoutTime = Infinity;
      let nextTimeoutId: number | null = null;

      // Find the earliest timeout
      for (const [id, { scheduledAt, delay }] of this.timeouts.entries()) {
        const executionTime = scheduledAt + delay;
        if (executionTime <= endTime && executionTime < nextTimeoutTime) {
          nextTimeoutTime = executionTime;
          nextTimeoutId = id;
        }
      }

      // No more timers to execute within our time range
      if (nextTimeoutId === null) {
        this.clock.advance(ms);
        break;
      }

      // Advance time to the next execution
      this.clock.advance(nextTimeoutTime - this.clock.now());

      // Execute the timeout
      const { callback } = this.timeouts.get(nextTimeoutId)!;
      this.timeouts.delete(nextTimeoutId);
      callback();
    }
  }
}

// ---

export async function timeout(scheduler: Scheduler, ms: number): Promise<void> {
  return new Promise((resolve) => scheduler.setTimeout(resolve, ms));
}
