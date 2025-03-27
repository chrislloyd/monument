import { describe, test, expect, mock } from "bun:test";
import { TestScheduler, timeout } from "./scheduler";
import { MonotonicClock } from "./clock";

describe(TestScheduler.name, () => {
  describe(TestScheduler.prototype.setTimeout.name, () => {
    test("executes callback after specified delay", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const callback = mock(() => {});

      scheduler.setTimeout(callback, 1000);
      expect(callback).not.toHaveBeenCalled();

      scheduler.tick(999);
      expect(callback).not.toHaveBeenCalled();

      scheduler.tick(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("handles multiple timeouts correctly", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});
      const callback3 = mock(() => {});

      scheduler.setTimeout(callback1, 1000);
      scheduler.setTimeout(callback2, 2000);
      scheduler.setTimeout(callback3, 500);

      scheduler.tick(500);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);

      scheduler.tick(500);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      scheduler.tick(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("returns unique ids", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const id1 = scheduler.setTimeout(() => {}, 1000);
      const id2 = scheduler.setTimeout(() => {}, 1000);

      expect(id1).not.toBe(id2);
    });
  });

  describe(TestScheduler.prototype.clearTimeout.name, () => {
    test("prevents timeout from executing", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const callback = mock(() => {});

      const id = scheduler.setTimeout(callback, 1000);
      scheduler.clearTimeout(id);
      scheduler.tick(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    test("does nothing when clearing non-existent timeout", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      expect(() => scheduler.clearTimeout(999)).not.toThrow();
    });
  });

  describe(TestScheduler.prototype.tick.name, () => {
    test("advances time correctly", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      expect(clock.now()).toBe(0);

      scheduler.tick(1000);
      expect(clock.now()).toBe(1000);

      scheduler.tick(500);
      expect(clock.now()).toBe(1500);
    });

    test("executes timeouts in correct order", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const order: number[] = [];

      scheduler.setTimeout(() => {
        order.push(2);
      }, 200);
      scheduler.setTimeout(() => {
        order.push(1);
      }, 100);
      scheduler.setTimeout(() => {
        order.push(3);
      }, 300);

      scheduler.tick(300);
      expect(order).toEqual([1, 2, 3]);
    });

    test("executes nested timeouts correctly", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const order: number[] = [];

      scheduler.setTimeout(() => {
        order.push(1);
        scheduler.setTimeout(() => {
          order.push(2);
        }, 100);
      }, 100);

      scheduler.tick(100);
      expect(order).toEqual([1]);

      scheduler.tick(100);
      expect(order).toEqual([1, 2]);
    });

    test("handles timeout that creates another timeout", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const callback = mock(() => {});

      scheduler.setTimeout(() => {
        scheduler.setTimeout(callback, 500);
      }, 1000);

      scheduler.tick(1000);
      expect(callback).not.toHaveBeenCalled();

      scheduler.tick(499);
      expect(callback).not.toHaveBeenCalled();

      scheduler.tick(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("handles large time jumps with multiple timeouts", () => {
      const clock = new MonotonicClock();
      const scheduler = new TestScheduler(clock);
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});
      const callback3 = mock(() => {});

      scheduler.setTimeout(callback1, 1000);
      scheduler.setTimeout(callback2, 3000);
      scheduler.setTimeout(callback3, 5000);

      scheduler.tick(10000); // Jump far ahead

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  test("async generator", async () => {
    const clock = new MonotonicClock();
    const scheduler = new TestScheduler(clock);
    async function* createGenerator() {
      for (let count = 0; count < 3; count += 1) {
        await new Promise((resolve) => scheduler.setTimeout(resolve, 1000));
        yield count;
      }
    }

    const generator = createGenerator();

    const promise1 = generator.next();
    scheduler.tick(10000);
    expect((await promise1).value).toBe(0);

    const promise2 = generator.next();
    scheduler.tick(10000);
    expect((await promise2).value).toBe(1);

    const promise3 = generator.next();
    scheduler.tick(10000);
    expect((await promise3).value).toBe(2);
  });

  test("Promise.race", async () => {
    const clock = new MonotonicClock();
    const scheduler = new TestScheduler(clock);
    const results: string[] = [];

    const promise1 = new Promise((resolve) => {
      scheduler.setTimeout(() => resolve("promise1"), 100);
    });

    const promise2 = new Promise((resolve) => {
      scheduler.setTimeout(() => resolve("promise2"), 200);
    });

    const racePromise = Promise.race([promise1, promise2]).then((result) => {
      results.push(result as string);
    });

    scheduler.tick(100);
    await racePromise;

    expect(results).toEqual(["promise1"]);
  });

  test("chained promises", async () => {
    const clock = new MonotonicClock();
    const scheduler = new TestScheduler(clock);
    let result = "";

    const promise1 = new Promise<void>((resolve) => {
      scheduler.setTimeout(() => resolve(), 100);
    });

    const promise2 = promise1.then(
      () =>
        new Promise<string>((resolve) => {
          scheduler.setTimeout(() => resolve("done"), 200);
        }),
    );

    const promise3 = promise2.then((value) => {
      result = value;
    });

    scheduler.tick(100);
    await promise1;
    expect(result).toBe("");

    scheduler.tick(200);
    await promise2;

    await promise3;
    expect(result).toBe("done");
  });
});

test(timeout.name, async () => {
  const clock = new MonotonicClock();
  const scheduler = new TestScheduler(clock);

  let resolved = false;
  const promise = timeout(scheduler, 100).then(() => {
    resolved = true;
  });

  expect(resolved).toBe(false);
  scheduler.tick(100);
  await promise;
  expect(resolved).toBe(true);
});
