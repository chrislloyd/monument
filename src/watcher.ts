import { type Cache } from "./cache";
import { type Transport, FilesystemTransport, HttpsTransport } from "./transports";
import { load } from "./process-doc";
import { type Document, type Transclusion } from "./document";

interface WatchState {
  abortController: AbortController;
  transclusions: Set<string>;
  status: 'active' | 'error' | 'cleaning';
  healthCheck?: ReturnType<typeof setInterval>;
}

export class DocumentWatcher {
  private watchStates = new Map<string, WatchState>();
  private debouncedReloads = new Map<string, ReturnType<typeof setTimeout>>();
  private loadingStack = new Set<string>();
  private transports: { [key: string]: Transport };

  constructor(private cache: Cache) {
    this.transports = {
      "file:": new FilesystemTransport(),
      "https:": new HttpsTransport()
    };
  }

  private debounceReload(url: URL, fn: () => Promise<void>, delay = 250) {
    const key = url.href;
    if (this.debouncedReloads.has(key)) {
      clearTimeout(this.debouncedReloads.get(key)!);
    }
    this.debouncedReloads.set(key, setTimeout(async () => {
      await fn();
      this.debouncedReloads.delete(key);
    }, delay));
  }

  private async ensureCleanState(url: URL): Promise<boolean> {
    const state = this.watchStates.get(url.href);
    if (state?.status === 'cleaning') {
      await new Promise(resolve => setTimeout(resolve, 100)); // Wait for cleanup
    }
    return state?.status === 'active';
  }

  private async ensureWatcherHealth(url: URL) {
    const currentState = this.watchStates.get(url.href);
    if (!currentState || currentState.status !== 'active') return;

    const checkHealth = async () => {
      try {
        if (url.protocol === 'file:') {
          const exists = await Bun.file(url).exists();
          if (!exists) {
            await this.unwatchDocument(url);
          }
        }
      } catch {
        await this.rewatchDocument(url);
      }
    };

    // Store the health check interval in the watch state
    const watchState = this.watchStates.get(url.href);
    if (watchState) {
      watchState.healthCheck = setInterval(checkHealth, 30000); // Check every 30s
    }
  }

  async watchDocument(url: URL, isTransclusion: boolean = false): Promise<void> {
    // Check for circular dependencies
    if (this.loadingStack.has(url.href)) {
      const cycle = Array.from(this.loadingStack).join(' -> ');
      throw new Error(`Circular dependency detected: ${cycle} -> ${url.href}`);
    }

    const transport = this.transports[url.protocol];
    if (!transport) {
      throw new Error(`Unsupported protocol ${url.protocol} for ${url.href}`);
    }

    // Ensure clean state before proceeding
    await this.ensureCleanState(url);

    this.loadingStack.add(url.href);
    try {
      // If we're already watching this document, clean up first
      await this.unwatchDocument(url);

      // Watch the document using async generator
      const abortController = new AbortController();
      const watchIterator = transport.watch(url);

      // Start watching in background
      (async () => {
        try {
          for await (const [contentType, content] of watchIterator) {
            if (abortController.signal.aborted) break;

            console.clear();
            this.debounceReload(url, async () => {
              try {
                // Find all documents that directly or indirectly include this document
                if (isTransclusion) {
                  const documentsToReload = new Set<string>();

                  // Helper function to find all documents that include a given URL
                  const findDependentDocuments = (targetUrl: string) => {
                    for (const [docUrl, doc] of this.cache.entries()) {
                      if (doc && doc.some(f => f.type === 'transclusion' && f.url.href === targetUrl)) {
                        documentsToReload.add(docUrl);
                        // Recursively check if this document is itself transcluded
                        findDependentDocuments(docUrl);
                      }
                    }
                  };

                  findDependentDocuments(url.href);

                  // Reload all affected documents from the top down
                  for (const docUrl of documentsToReload) {
                    await this.safeReload(new URL(docUrl));
                  }
                } else {
                  await this.safeReload(url);
                }
                this.printCache();
              } catch (error) {
                console.error(`Error reloading ${url.href}:`, error);
                const state = this.watchStates.get(url.href);
                if (state) state.status = 'error';
              }
            });
          }
        } catch (error) {
          console.error(`Watch error for ${url.href}:`, error);
          const state = this.watchStates.get(url.href);
          if (state) state.status = 'error';
        }
      })();

      // Setup watch state with abort controller
      this.watchStates.set(url.href, {
        abortController,
        transclusions: new Set(),
        status: 'active'
      });

      // Setup health checks
      await this.ensureWatcherHealth(url);

      // Watch all transclusions in the document recursively
      const document = this.cache.get(url.href);
      if (document) {
        const state = this.watchStates.get(url.href)!;
        for (const fragment of document) {
          if (fragment.type === 'transclusion') {
            state.transclusions.add(fragment.url.href);
            // Load the transclusion if it's not in the cache
            if (!this.cache.has(fragment.url.href)) {
              await load(this.cache, fragment.url);
            }
            await this.watchDocument(fragment.url, true);
          }
        }
      }
    } finally {
      this.loadingStack.delete(url.href);
    }
  }

  private async safeReload(url: URL): Promise<void> {
    const snapshot = new Map(this.cache);
    try {
      await this.reloadDocument(url);
    } catch (error) {
      // Restore cache to previous state on error
      for (const [key, value] of snapshot) {
        this.cache.set(key, value);
      }
      throw error;
    }
  }

  async rewatchDocument(url: URL): Promise<void> {
    await this.unwatchDocument(url);
    await this.watchDocument(url);
  }

  async unwatchDocument(url: URL): Promise<void> {
    const state = this.watchStates.get(url.href);
    if (state) {
      state.status = 'cleaning';
      try {
        state.abortController.abort();
        if (state.healthCheck) {
          clearInterval(state.healthCheck);
        }
        // Clean up any transclusion watchers
        for (const transclusion of state.transclusions) {
          await this.unwatchDocument(new URL(transclusion));
        }
      } finally {
        this.watchStates.delete(url.href);
      }
    }
  }

  private async reloadDocument(url: URL): Promise<void> {
    try {
      // Get the old document to compare transclusions
      const oldDocument = this.cache.get(url.href);
      const oldTransclusions = new Set(
        oldDocument?.filter(f => f.type === 'transclusion').map(f => (f as Transclusion).url.href) || []
      );

      // Clear cache and reload document
      this.cache.delete(url.href);
      await load(this.cache, url);

      // Get new document and its transclusions
      const newDocument = this.cache.get(url.href);
      const newTransclusions = new Set(
        newDocument?.filter(f => f.type === 'transclusion').map(f => (f as Transclusion).url.href) || []
      );

      // Remove watchers for transclusions that no longer exist
      for (const oldTransclusion of oldTransclusions) {
        if (!newTransclusions.has(oldTransclusion)) {
          const transclustionUrl = new URL(oldTransclusion);
          await this.unwatchDocument(transclustionUrl);
          this.cache.delete(oldTransclusion);
        }
      }

      // Update watchers for current transclusions
      if (newDocument) {
        const state = this.watchStates.get(url.href) || {
          abortController: new AbortController(),
          transclusions: new Set<string>(),
          status: 'active'
        };

        state.transclusions = newTransclusions;
        this.watchStates.set(url.href, state);

        for (const fragment of newDocument) {
          if (fragment.type === 'transclusion') {
            await this.watchDocument(fragment.url, true);
          }
        }
      }
    } catch (error) {
      console.error(`Failed to reload ${url.href}:`, error);
      throw error;
    }
  }

  printCache(): void {
    console.log(JSON.stringify(Object.fromEntries(this.cache)));
  }

  async cleanup(): Promise<void> {
    // Cancel any pending debounced reloads
    for (const timeout of this.debouncedReloads.values()) {
      clearTimeout(timeout);
    }
    this.debouncedReloads.clear();

    // Clean up all watchers
    for (const [url] of this.watchStates) {
      await this.unwatchDocument(new URL(url));
    }
    this.watchStates.clear();
    this.loadingStack.clear();
  }
}
