import { marked, type Tokens } from "marked";

export default function markdown(content: string): string {
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

  // Create a custom renderer

  // Override the image renderer
  const renderer = {
    image({ href, title, text }: Tokens.Image) {
      // Check if the URL has a common image extension
      const hasImageExtension = imageExtensions.some((ext) =>
        href.toLowerCase().endsWith(ext),
      );

      if (hasImageExtension) {
        // Render as a regular image
        const titleAttr = title ? ` title="${title}"` : "";
        const altAttr = text ? ` alt="${text}"` : "";
        return `<img src="${href}"${altAttr}${titleAttr}>`;
      } else {
        // Render as an iframe
        const titleAttr = title ? ` title="${title}"` : "";
        return `<iframe src="${href}"${titleAttr} frameborder="0" allowfullscreen></iframe>`;
      }
    },
  };

  marked.use({ renderer });

  // Set the custom renderer and convert markdown to HTML
  const html = marked.parse(content, { async: false });

  return html;
}
