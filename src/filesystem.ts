type WatchEvent =
  | { type: "rename"; from: string; to: string }
  | { type: "change"; filename: string };

export interface FileSystem {
  watch(
    path: string,
    signal: AbortSignal,
  ): AsyncIterable<WatchEvent, void, void>;
}
