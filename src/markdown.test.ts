import { expect, test } from "bun:test";

import markdown from "./markdown";
import * as Document from "./documents";

test("text", () => {
  const parts = Array.from(markdown("Hello, world!"));
  expect(parts).toEqual([Document.text("Hello, world!")]);
});

test("transclusion", () => {
  const parts = Array.from(markdown("![include](file.md)"));
  expect(parts).toEqual([Document.transclusion("file.md", "include")]);
});

test("mixed", () => {
  const parts = Array.from(markdown("Hello ![world](world.md)"));
  expect(parts).toEqual([
    Document.text("Hello "),
    Document.transclusion("world.md", "world"),
  ]);
});

test("multiple transclusions", () => {
  const parts = Array.from(markdown("![one](one.md) ![two](two.md)"));
  expect(parts).toEqual([
    Document.transclusion("one.md", "one"),
    Document.text(" "),
    Document.transclusion("two.md", "two"),
  ]);
});

test.todo("transclusions in comments", () => {
  const parts = Array.from(markdown("<!-- ![include](file.md) -->"));
  expect(parts).toEqual([Document.text("<!-- ![include](file.md) -->")]);
});
