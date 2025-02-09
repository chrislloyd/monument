import { watch } from 'node:fs/promises';

function sniffContentTypeFromFileExtension(url: URL): 'text/markdown' | 'text/plain' | 'text/html' {
  const pathname = url.pathname;
  const ext = pathname.split('.').pop();
  switch (ext) {
    case 'md': return 'text/markdown';
    case 'txt': return 'text/plain';
    case 'html': return 'text/html';
    default:
      return "text/plain";
  }
}

function parseContentType(a: string): ContentType | undefined {
  const id = a.split(';', 2)[0].trim();
  if (!id.startsWith('text/')) {
    return undefined;
  }
  return id as ContentType;
}

export type Content = string;
export type ContentType = `text/${string}`;

async function* filesystem(url: URL, signal: AbortSignal) {
  const watcher = watch(url, { signal });
  for await (const event of watcher) {
    if (event.eventType !== 'change') {
      break;
    }
    const contentType = sniffContentTypeFromFileExtension(url);
    const text = await Bun.file(url).text();
    yield [contentType, text];
  }
}


// export class HttpsTransport implements Transport {
//   readonly protocol = "https:";
//   async load(url: URL): Promise<[ContentType, Content]> {
//     const response = await Bun.fetch(url);
//     const text = await response.text();
//     const contentType = parseContentType(response.headers.get("content-type") || "") || "text/plain";
//     return [contentType, text];
//   }

//   async *watch(url: URL): AsyncGenerator<[ContentType, Content], void, unknown> {
//     // No-op implementation for now - could be implemented with polling or WebSocket
//     yield await this.load(url);
//   }
// }
