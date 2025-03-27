import { test, expect } from "bun:test";
import * as hmc from "./hmc";

test("empty input", () => {
  const input: hmc.Fragment[] = [];
  const result = hmc.postprocessdocument(input);
  expect(result.length).toEqual(0);
});

test("merges adjacent text fragments", () => {
  const input = [hmc.text("Hello"), hmc.text("World"), hmc.text("!")];

  const result = hmc.postprocessdocument(input);

  expect(result.length).toEqual(1);
  expect(result[0]).toEqual(hmc.text("Hello\nWorld\n!"));
});

test("preserves non-text fragments", () => {
  const input = [
    hmc.text("Check out this image:"),
    hmc.image("http://example.com/image.jpg", "An example image"),
    hmc.text("And this link:"),
    hmc.link("http://example.com", "Example website"),
  ];

  const result = hmc.postprocessdocument(input);

  expect(result.length).toEqual(4);
  expect(result[0]).toEqual(hmc.text("Check out this image:"));
  expect(result[1]).toEqual(
    hmc.image("http://example.com/image.jpg", "An example image"),
  );
  expect(result[2]).toEqual(hmc.text("And this link:"));
  expect(result[3]).toEqual(hmc.link("http://example.com", "Example website"));
});

test("trims whitespace from text fragments", () => {
  const input = [
    hmc.text("  Hello  "),
    hmc.image("http://example.com/image.jpg"),
    hmc.text("  World  "),
  ];

  const result = hmc.postprocessdocument(input);

  expect(result.length).toEqual(3);
  expect(result[0]).toEqual(hmc.text("Hello"));
  expect(result[1]).toEqual(hmc.image("http://example.com/image.jpg"));
  expect(result[2]).toEqual(hmc.text("World"));
});

test("removes empty text fragments after trimming", () => {
  const input = [
    hmc.text("  "),
    hmc.image("http://example.com/image.jpg"),
    hmc.text(""),
    hmc.link("http://example.com", "Example"),
  ];

  const result = hmc.postprocessdocument(input);

  expect(result.length).toEqual(2);
  expect(result[0]).toEqual(hmc.image("http://example.com/image.jpg"));
  expect(result[1]).toEqual(hmc.link("http://example.com", "Example"));
});

test("handles mixed fragment types correctly", () => {
  const input = [
    hmc.text("Start"),
    hmc.text("of"),
    hmc.text("text"),
    hmc.image("http://example.com/image.jpg"),
    hmc.text("More"),
    hmc.text("text"),
    hmc.action("doSomething"),
    hmc.text("  "),
    hmc.transclusion("http://example.com/content", "Included content"),
  ];

  const result = hmc.postprocessdocument(input);

  expect(result.length).toEqual(5);
  expect(result[0]).toEqual(hmc.text("Start\nof\ntext"));
  expect(result[1]).toEqual(hmc.image("http://example.com/image.jpg"));
  expect(result[2]).toEqual(hmc.text("More\ntext"));
  expect(result[3]).toEqual(hmc.action("doSomething"));
  expect(result[4]).toEqual(
    hmc.transclusion("http://example.com/content", "Included content"),
  );
});
