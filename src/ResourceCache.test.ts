import { test, expect } from "bun:test";
import ResourceCache from "./ResourceCache";
import type Watcher from "./Watcher";
import { TestClock, timeout } from "./clocks";
import Scheduler from "./Scheduler";

test("1", async () => {
  const clock = new TestClock();
  using scheduler = new Scheduler(clock);
  const watcher = {
    async *watch(url, signal) {
      while (clock.now() < 300) {
        await timeout(clock, 100);
        switch (clock.now()) {
          case 100:
            yield { url, content: "Hello" };
            break;
          case 200:
            yield { url, content: "World" };
            break;
        }
      }
    },
  } as Watcher;
  using cache = new ResourceCache(watcher, scheduler);

  const url = new URL("file://hello.txt");

  clock.tick(100);
  const readPromise = cache.read(url);
  clock.tick(100);
  const result = await readPromise;

  expect(result).not.toBeUndefined();
  expect(result.content).toBe("Hello");
});
