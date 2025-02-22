import { type Clock } from "./clock";

export default class Scheduler implements Disposable {
  private timeoutIds: Set<number> = new Set();

  constructor(private clock: Clock) {}

  schedule<T = void>(callback: () => T, timeout: number): Promise<T> {
    return new Promise<T>((resolve) => {
      const id = this.clock.setTimeout(() => {
        this.timeoutIds.delete(id);
        const result = callback();
        resolve(result);
      }, timeout);
      this.timeoutIds.add(id);
    });
  }

  [Symbol.dispose](): void {
    for (const id of this.timeoutIds) {
      this.clock.clearTimeout(id);
    }
    this.timeoutIds.clear();
  }
}
