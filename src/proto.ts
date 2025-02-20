import type { Tokens } from "marked";
import type { MarkedExtension } from "marked";
import { Marked } from "marked";

function createTransclusionExtension(): MarkedExtension {
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".webp",
    ".svg",
    ".bmp",
  ];
  return {
    renderer: {
      image(image: Tokens.Image): string {
        if (
          imageExtensions.some((ext) => image.href.toLowerCase().endsWith(ext))
        ) {
          return `<img src="${image.href}" alt="${image.text}" />`;
        }
        return `<iframe src="${image.href}" title="${image.text}" />`;
      },
    },
  };
}

const md = `
![A group of foos](foo.jpg)
![The current UTC time](/utc.md)
`;
const marked = new Marked();
const transclusion = createTransclusionExtension();
marked.use(transclusion);
const html = marked.parse(md);
console.log(html);
