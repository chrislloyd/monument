import indexHtml from "./index.html";
import debugHtml from "./debug.html";
import buildHtml from "./build.html";
import exploreHtml from "./explore.html";
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
    "/": indexHtml,
    "/debug": debugHtml,
    "/explore": exploreHtml,
    "/build": buildHtml,
    "/clock": createMomumentServerHandler(clock(2000)),
  },
});
