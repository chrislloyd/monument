const urlInput = document.getElementById("url-input")! as HTMLInputElement;
const loadButton = document.getElementById("load-button")!;
const toggleSseButton = document.getElementById("toggle-sse-button")!;
const statusDot = document.getElementById("status-dot")!;
const statusText = document.getElementById("status-text")!;
const statusIndicator = document.getElementById("status-indicator")!;
const statusFrequency = document.getElementById("status-frequency")!;
const contentFrame = document.getElementById(
  "content-frame",
)! as HTMLIFrameElement;

let currentClient: MonumentClient | null = null;
let isLoading = false;
let pendingReload = false;
let currentUrl = "";

loadButton.addEventListener("click", () => {
  loadUrl();
});

urlInput.addEventListener("keydown", (e) => {
  if (e.key === "Enter") {
    loadUrl();
  }
});

toggleSseButton.addEventListener("click", () => {
  if (!currentClient) return;
  if (currentClient.state === "open") {
    disconnectSse();
  } else {
    connectSse();
  }
});

contentFrame.addEventListener("load", () => {
  isLoading = false;

  if (pendingReload) {
    pendingReload = false;
    reloadFrame();
  }
});

async function loadUrl() {
  const url = urlInput.value.trim();

  if (!url) return;

  currentUrl = url;
  currentClient = new MonumentClient(
    new URL(url, window.location.href),
    (event) => {
      handleSseEvent(event);
    },
    (event) => {
      updateStatus("Connection error", "disconnected");
      toggleSseButton.textContent = "Reconnect";
    },
  );

  // Disconnect existing SSE connection
  if (currentClient.state === "open") {
    disconnectSse();
  }

  // Load the URL in the iframe
  contentFrame.src = url;

  // Connect to SSE
  await connectSse();
}

async function connectSse() {
  try {
    await currentClient?.connect();
    updateStatus("Connected", "connected");
    toggleSseButton.textContent = "Disconnect";
  } catch (error) {
    console.error("Failed to connect to SSE:", error);
    updateStatus("Connection failed", "disconnected");
  }
}

function disconnectSse() {
  currentClient?.close();
  updateStatus("Disconnected", "disconnected");
  toggleSseButton.textContent = "Reconnect";
}

function handleSseEvent(event: MessageEvent<any>) {
  // Flash the status indicator
  flashStatusIndicator();

  // Throttled reload
  if (!isLoading) {
    reloadFrame();
  } else {
    pendingReload = true;
  }
}

function reloadFrame() {
  isLoading = true;
  contentFrame.src = currentUrl;
}

function updateStatus(message: string, state: string) {
  console.log(message);
  statusText.textContent = message;
  statusDot.className = "status-dot " + state;
}

function flashStatusIndicator() {
  const originalBackground = statusIndicator.style.backgroundColor;
  statusIndicator.style.backgroundColor = "#fffacd";
  statusDot.classList.add("flash");

  setTimeout(() => {
    statusIndicator.style.backgroundColor = originalBackground;
    statusDot.classList.remove("flash");
  }, 500);
}

class MonumentClient {
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
