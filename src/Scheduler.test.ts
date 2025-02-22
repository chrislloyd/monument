import { expect, describe, test } from "bun:test";
import Scheduler from "./Scheduler";
import { TestClock } from "./clocks";

describe(Scheduler.name, () => {
  test(Scheduler.prototype[Symbol.dispose].name, () => {
    const testClock = new TestClock();
    const disposableClock = new Scheduler(testClock);

    let called = false;
    disposableClock.schedule(() => {
      called = true;
    }, 100);

    disposableClock[Symbol.dispose]();

    testClock.tick(200);

    expect(called).toBe(false);
  });

  test(Scheduler.prototype.schedule.name, async () => {
    const testClock = new TestClock();
    const scheduler = new Scheduler(testClock);

    const promise = scheduler.schedule(() => "result", 100);

    testClock.tick(100);

    const result = await promise;
    expect(result).toBe("result");
  });
});
