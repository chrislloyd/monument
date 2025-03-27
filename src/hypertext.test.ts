import { describe, test } from "bun:test";
import assert from "node:assert";
import { hypertext } from "./hypertext";
import { text, action, image, transclusion, link } from "./hmc";

describe(hypertext.name, () => {
  test("whitespace", () => {
    const html = `<p>  </p>`;
    const fragments = Array.from(hypertext(html));
    assert.deepStrictEqual(fragments, []);
  });

  test(text.name, () => {
    const html = `<p>Hello, world!</p>`;
    const fragments = Array.from(hypertext(html));
    assert.deepStrictEqual(fragments, [text("Hello, world!")]);
  });

  test(image.name, () => {
    const html = `<img src="/image.jpg" alt="A description">`;
    const fragments = Array.from(hypertext(html));
    assert.deepStrictEqual(fragments, [image("/image.jpg", "A description")]);
  });

  test(link.name, () => {
    const html = `<a href="/foo">Click me</a>`;
    const fragments = Array.from(hypertext(html));
    assert.deepStrictEqual(fragments, [link("/foo", "Click me")]);
  });

  test("parses forms as actions", () => {
    const html = `<form action="/submit" method="POST"></form>`;
    const fragments = Array.from(hypertext(html));
    assert.deepStrictEqual(fragments, [action("POST /submit", "Submit")]);
  });

  test("parses form inputs into action parameters", () => {
    const html = `
      <form action="/submit" method="POST">
        <input type="text" name="username">
        <input type="number" name="age">
      </form>
    `;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, [
      action("POST /submit", "Submit", {
        type: "object",
        properties: {
          username: { type: "string" },
          age: { type: "number" },
        },
      }),
    ]);
  });

  test("ignores inputs with empty names", () => {
    const html = `
      <form action="/submit" method="POST">
        <input type="text" name="">
        <input type="number" name="age">
      </form>
    `;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, [
      action("POST /submit", "Submit", {
        type: "object",
        properties: {
          age: { type: "number" },
        },
      }),
    ]);
  });

  test("parses iframes as transclusions", () => {
    const html = `<iframe src="https://example.com" title="Example"></iframe>`;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, [
      transclusion("https://example.com", "Example"),
    ]);
  });

  test("handles iframes without title", () => {
    const html = `<iframe src="https://example.com"></iframe>`;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, [
      transclusion("https://example.com", undefined),
    ]);
  });

  test("parses complex mixed content", () => {
    const html = `
      <div>
        <h1>My Page</h1>
        <p>Welcome to my page!</p>
        <a href="/about">About</a>
        <img src="/profile.jpg" alt="Profile picture">
        <form action="/contact" method="POST">
          <input type="text" name="name">
          <input type="number" name="age">
        </form>
        <iframe src="https://example.com" title="Example"></iframe>
      </div>
    `;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, [
      text("My Page"),
      text("Welcome to my page!"),
      text("About"),
      action("GET /about", ""),
      image("/profile.jpg", "Profile picture"),
      action("POST /contact", "Submit", {
        type: "object",
        properties: {
          name: { type: "string" },
          age: { type: "number" },
        },
      }),
      transclusion("https://example.com", "Example"),
    ]);
  });

  test("handles empty HTML", () => {
    const html = ``;
    const fragments = Array.from(hypertext(html));

    assert.deepStrictEqual(fragments, []);
  });

  test("handles malformed HTML gracefully", () => {
    // This isn't a comprehensive test of malformed HTML handling,
    // but it checks that the parser doesn't throw on unclosed tags
    const html = `<p>Unclosed paragraph`;
    const fragments = Array.from(hypertext(html));

    // Should at least extract the text
    assert.deepStrictEqual(fragments, [text("Unclosed paragraph")]);
  });
});
