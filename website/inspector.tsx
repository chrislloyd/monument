"use client";

import {
  QueryClient,
  QueryClientProvider,
  useQuery,
  useQueryClient,
} from "@tanstack/react-query";
import {
  Fragment,
  StrictMode,
  use,
  useCallback,
  useEffect,
  useRef,
  useState,
  type ReactNode,
} from "react";
import { createRoot } from "react-dom/client";
import { Action, Run, type Status } from "../src/build";
import { MonotonicClock } from "../src/clock";
import * as doc from "../src/document";
import { parseHtml } from "../src/html";
import { MemoryStorage } from "../src/storage";
import { ModelProvider, useModel } from "./model";

type Value = {
  id: string;
  date: number;
  ttl: number;
  body: string;
};

function dateFromResponse(_: Response): Value["date"] {
  return Date.now();
}

function ttlFromResponse(response: Response): Value["ttl"] {
  // const headers = new Headers(response.headers);
  const headers = response.headers;

  const cacheControl = headers.get("cache-control");
  if (cacheControl) {
    const match = cacheControl.match(/max-age=(\d+)/);
    if (match && match[1]) {
      return parseInt(match[1], 10) * 1000; // convert seconds to ms
    }
  }

  const expires = headers.get("expires");
  if (expires) {
    const expiresTime = new Date(expires).getTime();
    const now = Date.now();
    if (expiresTime > now) {
      return expiresTime - now;
    }
  }

  return Infinity;
}

function clamp(n: number, lower: number, upper: number): number {
  return Math.min(lower, Math.max(upper, n));
}

export function useFetchWithInvalidation(
  url: string,
  minTTL: number = 10 * 1_000,
  maxTTL: number = 24 * 60 * 60 * 1_000,
) {
  const queryClient = useQueryClient();

  // The main query hook
  const query = useQuery<Value>({
    queryKey: [url],
    queryFn: async ({ signal }) => {
      const response = await fetch(url, {
        method: "GET",
        redirect: "follow",
        signal,
      });

      if (!response.ok) {
        throw new Error(`HTTP error! status: ${response.status}`);
      }

      return {
        id: self.crypto.randomUUID(),
        date: dateFromResponse(response),
        ttl: ttlFromResponse(response),
        body: await response.text(),
      };
    },
    refetchInterval(query) {
      const {
        state: { data },
      } = query;
      if (!data) return maxTTL;
      return clamp(data.ttl, minTTL, maxTTL);
    },
    refetchIntervalInBackground: false,
  });

  // Map React Query state to match the original API
  return {
    ...query,
    revalidate() {
      queryClient.invalidateQueries({ queryKey: [url] });
    },
  };
}

function UrlInput({
  value,
  onChange,
}: {
  value: string;
  onChange: (value: string) => void;
}) {
  return (
    <input
      name="url"
      type="url"
      value={value}
      onChange={(e) => onChange(e.target.value)}
      className="bg-white w-full py-1 px-2 rounded shadow text-sm"
    />
  );
}

function EmojiButton({
  disabled = false,
  emoji,
  onAction,
}: {
  disabled?: boolean;
  emoji: string;
  onAction: () => void;
}) {
  const cs = new Set();
  if (disabled) {
    cs.add("opacity-50");
  } else {
    cs.add("cursor-pointer");
    cs.add("hover:scale-110");
    cs.add("active:scale-90");
  }
  return (
    <button
      disabled={disabled}
      onClick={() => onAction()}
      className={Array.from(cs.values()).join(" ")}
    >
      {emoji}
    </button>
  );
}

function bytes(str: string): number {
  return new Blob([str]).size;
}

function History({ history }: { history: Value[] }) {
  return (
    <div className="h-[10rem] p-4 bg-stone-800 text-white overflow-hidden overflow-y-auto">
      <div className="grid grid-cols-[max-content_max-content_max-content_auto] gap-2">
        <div className="text-xs text-neutral-400">Time</div>
        <div className="text-xs text-neutral-400">TTL</div>
        <div className="text-xs text-neutral-400">Size</div>
        <div className="text-xs text-neutral-400">Body</div>

        {history.map((item) => (
          <Fragment key={item.id}>
            <div className="">
              <div className="text-xs">
                {new Date(item.date).toLocaleTimeString()}
              </div>
            </div>
            <div>
              <div className="text-xs">{item.ttl}ms</div>
            </div>
            <div>
              <div className="text-xs">{bytes(item.body)}b</div>
            </div>
            <div className="text-ellipsis truncate">
              <div className="text-xs">{item.body}</div>
            </div>
          </Fragment>
        ))}
      </div>
    </div>
  );
}

function Toolbar({ children }: { children?: ReactNode }) {
  return (
    <div className="flex gap-3 py-2 px-3 bg-stone-100 h-10">{children}</div>
  );
}

function PropertyBag({ object }: { object: Record<string, string> }) {
  return (
    <dl
      className="grid grid-cols-2 gap-x-4 text-sm"
      style={{ gridTemplateColumns: "min-content auto" }}
    >
      {Object.entries(object).map(([key, value]) => (
        <Fragment key={key}>
          <dt>{key}:</dt>
          <dd className="font-mono truncate">{JSON.stringify(value)}</dd>
        </Fragment>
      ))}
    </dl>
  );
}

function DocumentIr({ document: fragments }: { document: doc.Fragment[] }) {
  return (
    <div className="divide-y-1">
      {fragments.map((fragment, index) => {
        const { type, ...rest } = fragment;

        let colors;
        switch (type) {
          case "text":
            colors = ["text-neutral-900", "bg-stone-100"];
            break;
          case "image":
            colors = ["text-yellow-900", "bg-yellow-100"];
            break;
          case "link":
            colors = ["text-blue-900", "bg-blue-100"];
            break;
          case "transclusion":
            colors = ["text-purple-900", "bg-purple-100"];
            break;
          case "action":
            colors = ["text-red-500"];
            break;
          default:
            colors = ["text-gray-500"];
        }

        return (
          <div
            className="border-neutral-200 p-2 flex flex-col gap-1"
            key={index}
          >
            <div className="">
              <span className={["text-xs", "px-1", ...colors].join(" ")}>
                {type}
              </span>
            </div>
            <div className="border-neutral-200">
              <PropertyBag object={rest} />
            </div>
          </div>
        );
      })}
    </div>
  );
}

function DocumentView({ document: fragments }: { document: doc.Fragment[] }) {
  return (
    <div className="p-2 flex flex-col gap-2">
      {fragments.map((fragment, index) => {
        const { type } = fragment;

        let body;
        switch (type) {
          case "text":
            body = <p>{fragment.text}</p>;
            break;
          case "image":
            body = (
              <img
                src={fragment.url}
                alt={fragment.description}
                className="block w-full aspect-square object-contain border border-black"
              />
            );
            break;
          case "link":
            body = (
              <a href={fragment.href} className="text-blue-500">
                {fragment.description}
              </a>
            );
            break;
          case "transclusion":
            body = <DataComponent url={fragment.url} />;
            break;
          default:
            throw new Error(`Unknown fragment type: ${type}`);
        }

        return <Fragment key={index}>{body}</Fragment>;
      })}
    </div>
  );
}

export function Inspector({
  home,
  historyBufferSize = 10,
}: {
  home: string;
  historyBufferSize?: number;
}) {
  const [url, setUrl] = useState(home);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const query = useFetchWithInvalidation(url);
  const [history, setHistory] = useState<Value[]>([]);

  useEffect(() => {
    if (!query.data) return;
    setHistory((prev) => [...prev, query.data].slice(-historyBufferSize));
  }, [query.data]);

  let emojiFromStatus;
  if (query.isError) {
    emojiFromStatus = "🔴";
  } else if (query.isFetching) {
    emojiFromStatus = "🟠";
  } else {
    emojiFromStatus = "🟢";
  }

  console.log(query?.data?.body);

  let doc;
  if (query?.data?.body) {
    doc = parseHtml(query.data.body);
    console.log(doc);
  }

  return (
    <div className="border border-solid border-neutral-300 rounded overflow-hidden">
      <div className="bg-stone-100 border-b border-stone-200">
        <Toolbar>
          <EmojiButton emoji="🏠" onAction={() => setUrl(home)} />
          <UrlInput value={url} onChange={setUrl} />
          <EmojiButton
            emoji="🔄"
            onAction={() => query.revalidate()}
            disabled={query.isFetching}
          />
          <EmojiButton emoji={emojiFromStatus} onAction={() => {}} />
        </Toolbar>
      </div>

      <History history={history} />

      <div className="aspect-video">
        {query.isError ? (
          <div className="text-red-500 p-4">
            <div>{query.failureReason?.name}</div>
            <div>{query.failureReason?.message}</div>
            <div>{query.failureReason?.stack}</div>
          </div>
        ) : (
          <iframe
            srcDoc={query.data?.body.replace(
              "<head>",
              `<head><base href="${url}" />`,
            )}
            className="w-full aspect-video"
            sandbox=""
            ref={iframeRef}
          />
        )}
      </div>

      <hr className="border-gray-200" />

      {doc && (
        <div className="aspect-video">
          <DocumentIr document={doc} />
        </div>
      )}
    </div>
  );
}

const queryClient = new QueryClient();

const EXAMPLE = `It is currently ![](https://chrislloyd.net/utc.md).

What time is it in Sydney? Time only.
`;

function Output({ promise }: { promise: Promise<string[]> }) {
  const output = use(promise);
  return <div>{output.join("")}</div>;
}

function App() {
  const abortController = useRef(new AbortController());
  const clock = useRef(new MonotonicClock(0));
  const [text, setText] = useState("");
  const [promise, setPromise] = useState<Promise<string[]> | null>(null);
  const model = useModel();

  const action = useCallback<Action>(() => {
    const doc: doc.ModelDocument = {
      body: [
        {
          type: "blob",
          blob: new Blob([text], { type: "text/plain;charset=utf-8" }),
        },
      ],
    };
    return Array.fromAsync(model.stream(doc, abortController.current.signal));
  }, [text, abortController]);

  const handleRun = useCallback(() => {
    const storage = new MemoryStorage<Status>();
    const run = new Run(
      clock.current,
      action,
      storage,
      abortController.current.signal,
    );
    const url = new URL(window.location.href);
    setPromise(
      run.need(url).then((thing) => {
        clock.current.tick();
        return thing as string[];
      }),
    );
  }, [clock, action, setPromise]);
  return (
    <div className="p-6">
      <Toolbar>
        <button onClick={() => setText(EXAMPLE)}>Load example</button>
        <button onClick={() => handleRun()}>Run</button>
        <div>t = {clock.current.now()}</div>
      </Toolbar>
      <div className="grid grid-cols-2">
        <div className="h-full">
          <textarea
            className="w-full border px-3 py-2 font-mono h-full"
            value={text}
            onChange={(e) => setText(e.target.value)}
            rows={5}
          />
        </div>

        <div className="px-3 py-2">
          {promise && <Output promise={promise} />}
        </div>
      </div>
    </div>
  );
}

const root = createRoot(document.getElementById("root")!);
root.render(
  <StrictMode>
    <QueryClientProvider client={queryClient}>
      <ModelProvider>
        <App />
      </ModelProvider>
    </QueryClientProvider>
  </StrictMode>,
);
