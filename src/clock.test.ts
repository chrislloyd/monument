import { describe, test, expect, mock } from "bun:test";
import { TestClock, timeout } from "./clock";

describe(TestClock.name, () => {
  describe(TestClock.prototype.setTimeout.name, () => {
    test("executes callback after specified delay", () => {
      const clock = new TestClock();
      const callback = mock(() => {});

      clock.setTimeout(callback, 1000);
      expect(callback).not.toHaveBeenCalled();

      clock.tick(999);
      expect(callback).not.toHaveBeenCalled();

      clock.tick(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("handles multiple timeouts correctly", () => {
      const clock = new TestClock();
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});
      const callback3 = mock(() => {});

      clock.setTimeout(callback1, 1000);
      clock.setTimeout(callback2, 2000);
      clock.setTimeout(callback3, 500);

      clock.tick(500);
      expect(callback1).not.toHaveBeenCalled();
      expect(callback2).not.toHaveBeenCalled();
      expect(callback3).toHaveBeenCalledTimes(1);

      clock.tick(500);
      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).not.toHaveBeenCalled();

      clock.tick(1000);
      expect(callback2).toHaveBeenCalledTimes(1);
    });

    test("returns unique ids", () => {
      const clock = new TestClock();
      const id1 = clock.setTimeout(() => {}, 1000);
      const id2 = clock.setTimeout(() => {}, 1000);

      expect(id1).not.toBe(id2);
    });
  });

  describe(TestClock.prototype.clearTimeout.name, () => {
    test("prevents timeout from executing", () => {
      const clock = new TestClock();
      const callback = mock(() => {});

      const id = clock.setTimeout(callback, 1000);
      clock.clearTimeout(id);
      clock.tick(1000);

      expect(callback).not.toHaveBeenCalled();
    });

    test("does nothing when clearing non-existent timeout", () => {
      const clock = new TestClock();
      expect(() => clock.clearTimeout(999)).not.toThrow();
    });
  });

  describe(TestClock.prototype.now.name, () => {
    test("returns the current fake time", () => {
      const clock = new TestClock();
      expect(clock.now()).toBe(0);

      clock.tick(1000);
      expect(clock.now()).toBe(1000);

      clock.tick(500);
      expect(clock.now()).toBe(1500);
    });
  });

  describe(TestClock.prototype.tick.name, () => {
    test("advances time correctly", () => {
      const clock = new TestClock();
      expect(clock.now()).toBe(0);

      clock.tick(1000);
      expect(clock.now()).toBe(1000);

      clock.tick(500);
      expect(clock.now()).toBe(1500);
    });

    test("executes timeouts in correct order", () => {
      const clock = new TestClock();
      const order: number[] = [];

      clock.setTimeout(() => {
        order.push(2);
      }, 200);
      clock.setTimeout(() => {
        order.push(1);
      }, 100);
      clock.setTimeout(() => {
        order.push(3);
      }, 300);

      clock.tick(300);
      expect(order).toEqual([1, 2, 3]);
    });

    test("executes nested timeouts correctly", () => {
      const clock = new TestClock();
      const order: number[] = [];

      clock.setTimeout(() => {
        order.push(1);
        clock.setTimeout(() => {
          order.push(2);
        }, 100);
      }, 100);

      clock.tick(100);
      expect(order).toEqual([1]);

      clock.tick(100);
      expect(order).toEqual([1, 2]);
    });

    test("handles timeout that creates another timeout", () => {
      const clock = new TestClock();
      const callback = mock(() => {});

      clock.setTimeout(() => {
        clock.setTimeout(callback, 500);
      }, 1000);

      clock.tick(1000);
      expect(callback).not.toHaveBeenCalled();

      clock.tick(499);
      expect(callback).not.toHaveBeenCalled();

      clock.tick(1);
      expect(callback).toHaveBeenCalledTimes(1);
    });

    test("handles large time jumps with multiple timeouts", () => {
      const clock = new TestClock();
      const callback1 = mock(() => {});
      const callback2 = mock(() => {});
      const callback3 = mock(() => {});

      clock.setTimeout(callback1, 1000);
      clock.setTimeout(callback2, 3000);
      clock.setTimeout(callback3, 5000);

      clock.tick(10000); // Jump far ahead

      expect(callback1).toHaveBeenCalledTimes(1);
      expect(callback2).toHaveBeenCalledTimes(1);
      expect(callback3).toHaveBeenCalledTimes(1);
    });
  });

  test("async generator", async () => {
    const clock = new TestClock();
    async function* createGenerator() {
      for (let count = 0; count < 3; count += 1) {
        await new Promise((resolve) => clock.setTimeout(resolve, 1000));
        yield count;
      }
    }

    const generator = createGenerator();

    const promise1 = generator.next();
    clock.tick(10000);
    expect((await promise1).value).toBe(0);

    const promise2 = generator.next();
    clock.tick(10000);
    expect((await promise2).value).toBe(1);

    const promise3 = generator.next();
    clock.tick(10000);
    expect((await promise3).value).toBe(2);
  });

  test("Promise.race", async () => {
    const clock = new TestClock();
    const results: string[] = [];

    const promise1 = new Promise((resolve) => {
      clock.setTimeout(() => resolve("promise1"), 100);
    });

    const promise2 = new Promise((resolve) => {
      clock.setTimeout(() => resolve("promise2"), 200);
    });

    const racePromise = Promise.race([promise1, promise2]).then((result) => {
      results.push(result as string);
    });

    clock.tick(100);
    await racePromise;

    expect(results).toEqual(["promise1"]);
  });

  test("chained promises", async () => {
    const clock = new TestClock();
    let result = "";

    const promise1 = new Promise<void>((resolve) => {
      clock.setTimeout(() => resolve(), 100);
    });

    const promise2 = promise1.then(
      () =>
        new Promise<string>((resolve) => {
          clock.setTimeout(() => resolve("done"), 200);
        }),
    );

    const promise3 = promise2.then((value) => {
      result = value;
    });

    clock.tick(100);
    await promise1;
    expect(result).toBe("");

    clock.tick(200);
    await promise2;

    await promise3;
    expect(result).toBe("done");
  });
});

test(timeout.name, async () => {
  const testClock = new TestClock();

  let resolved = false;
  const promise = timeout(testClock, 100).then(() => {
    resolved = true;
  });

  expect(resolved).toBe(false);
  testClock.tick(100);
  await promise;
  expect(resolved).toBe(true);
});
