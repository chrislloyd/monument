import { test, expect } from "bun:test";
import { parseHtml } from "./html";

test("1", () => {
  const doc = parseHtml(`<p>hello world</p>`);
  expect(doc).toMatchInlineSnapshot(`
    [
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
      {
        "text": "hello world",
        "type": "text",
      },
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
    ]
  `);
});

test("1", () => {
  const doc = parseHtml(`<p>hello <strong>world</strong></p>`);
  expect(doc).toMatchInlineSnapshot(`
    [
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
      {
        "text": "hello ",
        "type": "text",
      },
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
    ]
  `);
});

test("3", () => {
  const doc = parseHtml(`<ul>
    <li>1</li>
    <li>2</li>
    <li>3</li>
  </ul>`);
  expect(doc).toMatchInlineSnapshot(`
    [
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
      {
        "text": 
    "
        "
    ,
        "type": "text",
      },
      {
        "text": 
    "
        "
    ,
        "type": "text",
      },
      {
        "text": 
    "
        "
    ,
        "type": "text",
      },
      {
        "text": 
    "
      "
    ,
        "type": "text",
      },
      {
        "text": 
    "

    "
    ,
        "type": "text",
      },
    ]
  `);
});
