import React from "react";
import { useEffect, useState, useRef, useCallback } from "react";

export interface FetchState<T> {
  data: T | null;
  error: Error | null;
  isFetching: boolean;
  isSSEConnected: boolean;
  lastUpdated: number | null;
  status: "idle" | "fetching" | "sse-connected" | "error";
}

/**
 * useFetchWithInvalidation:
 * - Makes a HTTP request to the given URL.
 * - Opens an SSE connection on that URL. If a message is received, the current data is invalidated.
 * - If SSE fails, schedules an invalidation based on cache headers (or pollInterval).
 * - Only one request is active per URL.
 */
export function useFetchWithInvalidation<T = any>(
  url: string,
  pollInterval: number = 60000,
) {
  const [state, setState] = useState<FetchState<T>>({
    data: null,
    error: null,
    isFetching: false,
    isSSEConnected: false,
    lastUpdated: null,
    status: "idle",
  });

  // A trigger value to force re-fetching (when invalidation happens)
  const [trigger, setTrigger] = useState(0);

  // Refs to hold our current AbortController, EventSource, and any timer IDs.
  const abortControllerRef = useRef<AbortController | null>(null);
  const eventSourceRef = useRef<EventSource | null>(null);
  const timerRef = useRef<ReturnType<typeof setTimeout> | null>(null);

  // Manual revalidation function.
  const revalidate = useCallback(() => {
    setTrigger((prev) => prev + 1);
  }, []);

  useEffect(() => {
    // Cleanup any previous timers, SSE connections, or fetches.
    if (timerRef.current) {
      clearTimeout(timerRef.current);
      timerRef.current = null;
    }
    if (eventSourceRef.current) {
      eventSourceRef.current.close();
      eventSourceRef.current = null;
    }
    if (abortControllerRef.current) {
      abortControllerRef.current.abort();
    }

    const abortController = new AbortController();
    abortControllerRef.current = abortController;

    // Begin fetching, but don't clear existing data
    setState((prev) => ({
      ...prev,
      isFetching: true,
      status: "fetching",
      error: null,
    }));

    fetch(url, { signal: abortController.signal })
      .then((response) => {
        if (!response.ok) {
          throw new Error(`HTTP error! status: ${response.status}`);
        }
        // Determine the invalidation timeout from caching headers.
        const cacheControl = response.headers.get("cache-control");
        const expires = response.headers.get("expires");
        let invalidateAfter = pollInterval; // default fallback

        if (cacheControl) {
          const match = cacheControl.match(/max-age=(\d+)/);
          if (match) {
            const maxAge = parseInt(match[1], 10);
            invalidateAfter = maxAge * 1000; // convert seconds to ms
          }
        } else if (expires) {
          const expiresTime = new Date(expires).getTime();
          const now = Date.now();
          if (expiresTime > now) {
            invalidateAfter = expiresTime - now;
          }
        }
        // Assume a JSON response (adjust as needed)
        return response.text().then((data) => ({ data, invalidateAfter }));
      })
      .then(({ data, invalidateAfter }) => {
        // Update with fetched data.
        setState((prev) => ({
          ...prev,
          data,
          isFetching: false,
          lastUpdated: Date.now(),
          status: "idle",
        }));

        // Attempt to open an SSE connection.
        try {
          const eventSource = new EventSource(url);
          eventSourceRef.current = eventSource;
          setState((prev) => ({
            ...prev,
            isSSEConnected: true,
            status: "sse-connected",
          }));

          // When a message is received, invalidate the current data.
          eventSource.onmessage = (event) => {
            revalidate();
            // Optionally, close the SSE after receiving one update.
            eventSource.close();
            eventSourceRef.current = null;
          };

          eventSource.onerror = (error) => {
            // SSE failed – mark as not connected and schedule re-fetch.
            setState((prev) => ({
              ...prev,
              isSSEConnected: false,
              status: "error",
            }));
            eventSource.close();
            eventSourceRef.current = null;
            timerRef.current = setTimeout(() => {
              revalidate();
            }, invalidateAfter);
          };
        } catch (e) {
          // If EventSource fails immediately, schedule re-fetch.
          timerRef.current = setTimeout(() => {
            revalidate();
          }, invalidateAfter);
        }
      })
      .catch((error) => {
        console.error(error);
        if (abortController.signal.aborted) {
          // If the fetch was aborted, ignore the error.
          return;
        }
        setState((prev) => ({
          ...prev,
          error,
          isFetching: false,
          status: "error",
        }));
        // Fallback: schedule re-fetch after the poll interval.
        timerRef.current = setTimeout(() => {
          revalidate();
        }, pollInterval);
      });

    // Cleanup effect on unmount or if URL/trigger changes.
    return () => {
      if (abortControllerRef.current) {
        abortControllerRef.current.abort();
        abortControllerRef.current = null;
      }
      if (eventSourceRef.current) {
        eventSourceRef.current.close();
        eventSourceRef.current = null;
      }
      if (timerRef.current) {
        clearTimeout(timerRef.current);
        timerRef.current = null;
      }
    };
  }, [url, trigger, pollInterval, revalidate]);

  return { state, revalidate };
}
