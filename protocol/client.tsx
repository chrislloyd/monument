export class MonumentClient {
  #eventSource: EventSource | undefined;

  constructor(
    private readonly url: URL,
    private onChange: (event: MessageEvent) => void,
    private onError: (error: Event) => void,
  ) {}

  get state(): "connecting" | "open" | "closed" {
    switch (this.#eventSource?.readyState) {
      case EventSource.CONNECTING:
        return "connecting";
      case EventSource.OPEN:
        return "open";
      case EventSource.CLOSED:
      default:
        return "closed";
    }
  }

  connect(): Promise<void> {
    if (this.state !== "closed") {
      return Promise.resolve();
    }

    const { promise, resolve, reject } = Promise.withResolvers<void>();

    try {
      this.#eventSource = new EventSource(this.url);
      this.#eventSource.addEventListener("open", () => {
        resolve();
      });
      this.#eventSource.addEventListener("message", (event) => {
        this.onChange(event);
      });
      this.#eventSource.addEventListener("error", (event) => {
        this.onError(event);
      });
    } catch (error) {
      reject(error);
    }
    return promise;
  }

  close() {
    if (this.state === "closed") {
      return;
    }
    this.#eventSource?.close();
  }
}
