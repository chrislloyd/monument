import React from "react";
import ReactDOM from "react-dom/client";
import markdown2html from "../markdown";
import { hypertext as html2doc } from "../hypertext";
import { postprocessdocument } from "../postprocessdocument";
import DataComponent, { useFetchWithInvalidation } from "./transclusion";

function PropertyBag({ object }: { object: Record<string, string> }) {
  return (
    <dl
      className="grid grid-cols-2 gap-x-4 text-sm"
      style={{ gridTemplateColumns: "min-content auto" }}
    >
      {Object.entries(object).map(([key, value]) => (
        <React.Fragment key={key}>
          <dt>{key}:</dt>
          <dd className="font-mono truncate">{JSON.stringify(value)}</dd>
        </React.Fragment>
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
            colors = ["text-neutral-900", "bg-neutral-100"];
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

function DataComponent({ url }) {
  // Replace with your actual URL
  const { state, revalidate } = useFetchWithInvalidation(url, 60000);
  const [view, setView] = React.useState<"json" | "iframe">("iframe");
  const iframeRef = React.useRef<HTMLIFrameElement>(null);

  return (
    <div className="border border-black">
      {state.error && (
        <p style={{ color: "red" }}>Error: {state.error.message}</p>
      )}

      <div className="text-xs bg-neutral-100 p-1">
        {state.status}
        {" | "}
        {state.isFetching ? (
          <>Updating...</>
        ) : (
          <>
            {state.lastUpdated
              ? new Date(state.lastUpdated).toLocaleTimeString()
              : "Never"}
          </>
        )}
        {" | "}

        <button
          onClick={() => {
            revalidate();
            iframeRef.current?.contentWindow?.location.reload();
          }}
          disabled={state.isFetching}
        >
          {state.isFetching ? "Refreshing..." : "Refresh"}
        </button>

        {" | "}

        <select value={view} onChange={(e) => setView(e.target.value)}>
          <option value="iframe">Preview</option>
          <option value="json">Raw</option>
        </select>
      </div>

      {view === "json" ? (
        <pre className="aspect-video text-sm overflow-y-scroll">
          {state.data}
        </pre>
      ) : (
        <iframe src={url} className="w-full aspect-video" ref={iframeRef} />
      )}
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

        return <React.Fragment key={index}>{body}</React.Fragment>;
      })}
    </div>
  );
}

const DEFAULT_MARKDOWN = `![transclusion](/clock)

# Hello

Some *emphasis*, **importance**, a [link](/debug) and a dash of \`code\`.

---

\`\`\`javascript
console.log('!');
\`\`\`


![image](https://i.pinimg.com/1200x/6d/bf/02/6dbf0243e1b31d0a73b52b5b4cd4a028.jpg)

* foo
* bar
* baz
`;

function Slide({ children }) {
  return (
    <div className="flex flex-col divide-y border-neutral-200 max-w-100 w-content">
      {/* <Toolbar>{toolbar}</Toolbar> */}
      {children}
    </div>
  );
}

function Toolbar({ children }) {
  return (
    <div className="p-2 border-b border-neutral-200 w-full font-bold">
      {children}
    </div>
  );
}

function zip<A, B>(a: A[], b: B[]): [a: A | undefined, b: B | undefined][] {
  const length = Math.max(a.length, b.length);
  return Array.from(Array(length), (_, i) => [a[i], b[i]]);
}

function Table({ children, headings }) {
  const cols = zip(headings, React.Children.toArray(children));
  return (
    <div
      className="grid h-screen divide-x"
      style={{
        gridTemplateColumns: `repeat(${cols.length}, 1fr)`,
        gridTemplateRows: "max-content auto",
      }}
    >
      {cols.map(([heading, _], i) => (
        <Toolbar key={`heading-${i}`}>{heading}</Toolbar>
      ))}
      {cols.map(([_, content], i) => (
        <Slide key={`slide-${i}`}>{content}</Slide>
      ))}
    </div>
  );
}

function Editor({
  value,
  onChange,
  readonly = false,
}: {
  value: string;
  onChange?: (e: React.ChangeEvent<HTMLTextAreaElement>) => void;
  readonly?: boolean;
}) {
  return (
    <textarea
      value={value}
      disabled={readonly}
      onChange={onChange}
      className="border-none p-2 focus:outline-none h-full resize-none font-mono text-sm"
    />
  );
}

function App() {
  const [input, setInput] = React.useState(DEFAULT_MARKDOWN);
  const html = markdown2html(input.trim());
  const document = postprocessdocument(Array.from(html2doc(html)));

  const handleInputChange: React.ComponentProps<typeof Editor>["onChange"] = (
    e,
  ) => {
    setInput(e.target.value);
  };

  return (
    <Table
      headings={[
        "Markdown",
        // "HTML",
        "Model Context",
        "Document",
      ]}
    >
      <Editor value={input} onChange={handleInputChange} />
      {/* <Editor value={html} readonly /> */}
      <DocumentIr document={document} />
      <DocumentView document={document} />
    </Table>
  );
}

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <App />
  </React.StrictMode>,
);
