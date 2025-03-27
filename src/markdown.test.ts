import { expect, test } from "bun:test";

import markdown from "./markdown";

test("text", () => {
  const html = markdown("Hello, world!");
  expect(html).toMatchInlineSnapshot(`
    "<p>Hello, world!</p>
    "
  `);
});

test("transclusion", () => {
  const html = markdown("![include](file.md)");
  expect(html).toMatchInlineSnapshot(`
    "<p><iframe src="file.md" frameborder="0" allowfullscreen></iframe></p>
    "
  `);
});

test("mixed", () => {
  const html = markdown("Hello ![world](world.md)");
  expect(html).toMatchInlineSnapshot(`
    "<p>Hello <iframe src="world.md" frameborder="0" allowfullscreen></iframe></p>
    "
  `);
});

test("multiple transclusions", () => {
  const html = markdown("![one](one.md) ![two](two.md)");
  expect(html).toMatchInlineSnapshot(`
    "<p><iframe src="one.md" frameborder="0" allowfullscreen></iframe> <iframe src="two.md" frameborder="0" allowfullscreen></iframe></p>
    "
  `);
});

test("transclusions in comments", () => {
  const html = markdown("<!-- ![include](file.md) -->");
  expect(html).toMatchInlineSnapshot(`"<!-- ![include](file.md) -->"`);
});
