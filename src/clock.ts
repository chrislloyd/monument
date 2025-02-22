export interface Clock {
  setTimeout(handler: Function, timeout: number): number;
  clearTimeout(id: number): void;
  now(): number;
}

// ---

export class Clock implements Clock {
  setTimeout(handler: Function, timeout: number): number {
    return globalThis.setTimeout(handler, timeout);
  }

  clearTimeout(id: number): void {
    globalThis.clearTimeout(id);
  }

  now(): number {
    return Date.now();
  }
}

/**
 * @internal
 */
export class TestClock implements Clock {
  private timeouts: Map<
    number,
    { callback: Function; scheduledAt: number; delay: number }
  > = new Map();
  private nextTimerId: number = 1;
  private currentTime: number = 0;

  setTimeout(callback: Function, delay: number): number {
    const id = this.nextTimerId++;
    this.timeouts.set(id, {
      callback,
      scheduledAt: this.currentTime,
      delay,
    });
    return id;
  }

  clearTimeout(id: number): void {
    this.timeouts.delete(id);
  }

  now(): number {
    return this.currentTime;
  }

  tick(ms: number = 0): void {
    const endTime = this.currentTime + ms;

    // Continue processing timeouts until we reach the target time
    while (this.currentTime < endTime) {
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
        this.currentTime = endTime;
        break;
      }

      // Advance time to the next execution
      this.currentTime = nextTimeoutTime;

      // Execute the timeout
      const { callback } = this.timeouts.get(nextTimeoutId)!;
      this.timeouts.delete(nextTimeoutId);
      callback();
    }
  }
}

// ---

export async function timeout(clock: Clock, ms: number): Promise<void> {
  return new Promise((resolve) => clock.setTimeout(resolve, ms));
}
