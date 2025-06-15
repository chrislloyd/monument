export class Instant {
  constructor(public epochMilliseconds: number) {}
}

export interface Clock {
  now(): Instant;
}

export class SystemClock implements Clock {
  now(): Instant {
    return new Instant(Date.now());
  }
}

export class MonotonicClock implements Clock {
  constructor(private t: number = 0) {}

  now(): Instant {
    return new Instant(this.t);
  }

  advance(n: number) {
    this.t += Math.max(0, n);
  }

  tick() {
    return this.advance(1);
  }
}
