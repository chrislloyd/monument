export interface Clock {
  now(): number;
}

export class SystemClock implements Clock {
  now(): number {
    return Date.now();
  }
}

export class MonotonicClock implements Clock {
  #t: number = 0;

  now(): number {
    return this.#t;
  }

  advance(n: number) {
    this.#t += Math.max(0, n);
  }

  tick() {
    return this.advance(1);
  }
}
