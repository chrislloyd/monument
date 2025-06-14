import { describe, test, expect } from "bun:test";
import { MonotonicClock } from "./clock";
import { MemoryStorage } from "./storage";
import { Run, StatusType, type Status, type Action } from "./build";

describe("Run", () => {
  test("builds value for uncached key", async () => {
    const clock = new MonotonicClock(1);
    const db = new MemoryStorage<Status>();
    const controller = new AbortController();

    const action: Action = async () => "hello world";
    const run = new Run(clock, action, db, controller.signal);

    const result = await run.need(new URL("file:///test"));

    expect(result).toBe("hello world");

    const status = await db.get("file:///test");
    expect(status?.type).toBe(StatusType.READY);
    if (status?.type === StatusType.READY) {
      expect(status.result.value).toBe("hello world");
      expect(status.result.built).toBe(1);
      expect(status.result.changed).toBe(1);
      expect(status.result.depends).toEqual([]);
    }
  });

  test("fails when action throws", async () => {
    const clock = new MonotonicClock(1);
    const db = new MemoryStorage<Status>();
    const controller = new AbortController();

    const action: Action = async () => {
      throw new Error("build failed");
    };

    const run = new Run(clock, action, db, controller.signal);

    await expect(run.need(new URL("file:///test"))).rejects.toThrow(
      "build failed",
    );

    const status = await db.get("file:///test");
    expect(status?.type).toBe(StatusType.FAILED);
    expect(status?.error.message).toEqual("build failed");
  });

  test("reuses cached value when dependencies haven't changed", async () => {
    const clock = new MonotonicClock(1);
    const db = new MemoryStorage<Status>();
    const controller = new AbortController();

    // Store a test dependency
    await db.put("file:///dep", {
      type: StatusType.READY,
      result: {
        value: "dependency",
        built: 1,
        changed: 1,
        depends: [],
      },
    });

    // First create a value that depends on another value
    let needCalled = 0;
    const action: Action = async (ctx) => {
      needCalled++;
      await ctx.need(new URL("file:///dep"));
      return "result";
    };

    const run1 = new Run(clock, action, db, controller.signal);
    const result1 = await run1.need(new URL("file:///test"));
    expect(result1).toBe("result");
    expect(needCalled).toBe(1);

    // Now run again, it should reuse the value
    clock.advance(1); // Time passes
    const run2 = new Run(clock, action, db, controller.signal);
    const result2 = await run2.need(new URL("file:///test"));

    expect(result2).toBe("result");
    expect(needCalled).toBe(1); // Action should not have been called again

    const status = await db.get("file:///test");
    expect(status?.type).toBe(StatusType.READY);
  });

  test("rebuilds when dependencies have changed", async () => {
    const clock = new MonotonicClock(1);
    const db = new MemoryStorage<Status>();
    const controller = new AbortController();

    // Store a test dependency
    await db.put("file:///dep", {
      type: StatusType.READY,
      result: {
        value: "dependency",
        built: 1,
        changed: 1,
        depends: [],
      },
    });

    // First create a value that depends on another value
    let needCalled = 0;
    const action: Action = async (ctx) => {
      needCalled++;
      await ctx.need(new URL("file:///dep"));
      return "result";
    };

    const run1 = new Run(clock, action, db, controller.signal);
    await run1.need(new URL("file:///test"));
    expect(needCalled).toBe(1);

    // Update the dependency
    clock.advance(1);
    await db.put("file:///dep", {
      type: StatusType.READY,
      result: {
        value: "updated dependency",
        built: 2,
        changed: 2,
        depends: [],
      },
    });

    // Now run again, it should rebuild
    clock.advance(1);
    const run2 = new Run(clock, action, db, controller.signal);
    await run2.need(new URL("file:///test"));

    expect(needCalled).toBe(2); // Action should be called again
  });
});
