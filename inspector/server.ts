import indexHtml from "./index.html";
// import buildHtml from "./build/index.html";

Bun.serve({
  routes: {
    "/": indexHtml,
    // "/build": buildHtml,
  },
});
