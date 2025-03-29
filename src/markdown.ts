import { marked, type Tokens } from "marked";

export function markdown(content: string): string {
  // Define common image extensions
  const imageExtensions = [
    ".jpg",
    ".jpeg",
    ".png",
    ".gif",
    ".svg",
    ".webp",
    ".avif",
    ".bmp",
    ".tiff",
  ];

  const renderer = {
    image({ href, title, text }: Tokens.Image) {
      const hasImageExtension = imageExtensions.some((ext) =>
        href.toLowerCase().endsWith(ext),
      );

      if (hasImageExtension) {
        const titleAttr = title ? ` title="${title}"` : "";
        const altAttr = text ? ` alt="${text}"` : "";
        return `<img src="${href}"${altAttr}${titleAttr}>`;
      } else {
        const titleAttr = title ? ` title="${title}"` : "";
        return `<iframe src="${href}"${titleAttr} frameborder="0" allowfullscreen></iframe>`;
      }
    },
  };

  marked.use({ renderer });

  return marked.parse(content, { async: false });
}
