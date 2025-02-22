import debuggerHtml from "./debugger.html";
import { createMomumentServerHandler } from "./server";

async function* clock(interval: number) {
  while (true) {
    const now = new Date();
    console.log("tick", now);
    yield Response.json(now.toISOString());
    await Bun.sleep(interval);
  }
}

Bun.serve({
  routes: {
    "/": debuggerHtml,
    "/clock": createMomumentServerHandler(clock(2000)),
  },
});
