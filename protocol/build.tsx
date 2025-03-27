import ReactDOM from "react-dom/client";
import React, { useState, useRef } from "react";
import { Run, Action, Rules } from "../build";

// Example build rules
const createRules = () => {
  const rules = new Rules();

  // Rule for text files
  rules.rule({
    predicate: (id) => id.endsWith(".txt"),
    fn: async ({ out, need }) => {
      // Simulate fetching a text file content
      return `Content of ${out}`;
    },
  });

  // Rule for data processing
  rules.rule({
    predicate: (id) => id.startsWith("process:"),
    fn: async ({ need }) => {
      // Process depends on raw data
      const rawData = await need("data.txt");
      return `Processed: ${rawData}`;
    },
  });

  // Rule for combined outputs
  rules.rule({
    predicate: (id) => id === "combined",
    fn: async ({ needN }) => {
      // Combine multiple dependencies
      const results = await needN(["process:data", "extra.txt"]);
      return results.join(" + ");
    },
  });

  return rules;
};

// BuildView Component
const BuildView: React.FC = () => {
  const [buildResults, setBuildResults] = useState<Record<string, any>>({});
  const [targetInput, setTargetInput] = useState("combined");
  const [isBuilding, setIsBuilding] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const databaseRef = useRef<Map<string, any>>(new Map());
  const rulesRef = useRef(createRules());

  // Function to perform the build
  const performBuild = async (target: string) => {
    setIsBuilding(true);
    setError(null);

    try {
      const run = new Run(rulesRef.current.action(), databaseRef.current);
      const result = await run.need(target);

      // Update the results
      setBuildResults((prev) => ({
        ...prev,
        [target]: {
          value: result,
          timestamp: new Date().toLocaleTimeString(),
        },
      }));
    } catch (err) {
      setError(err instanceof Error ? err.message : String(err));
      console.error("Build error:", err);
    } finally {
      setIsBuilding(false);
    }
  };

  // Reset the database
  const resetDatabase = () => {
    databaseRef.current = new Map();
    setBuildResults({});
    setError(null);
  };

  return (
    <div style={{ maxWidth: "800px", margin: "0 auto", padding: "20px" }}>
      <h1>Build System Demo</h1>

      <div style={{ marginBottom: "20px" }}>
        <label htmlFor="target" style={{ marginRight: "10px" }}>
          Build Target:
        </label>
        <input
          id="target"
          type="text"
          value={targetInput}
          onChange={(e) => setTargetInput(e.target.value)}
          style={{ marginRight: "10px", padding: "5px" }}
        />
        <button
          onClick={() => performBuild(targetInput)}
          disabled={isBuilding}
          style={{
            padding: "5px 10px",
            backgroundColor: isBuilding ? "#cccccc" : "#4CAF50",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: isBuilding ? "not-allowed" : "pointer",
          }}
        >
          {isBuilding ? "Building..." : "Build"}
        </button>
        <button
          onClick={resetDatabase}
          style={{
            marginLeft: "10px",
            padding: "5px 10px",
            backgroundColor: "#f44336",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Reset Cache
        </button>
      </div>

      {error && (
        <div
          style={{
            backgroundColor: "#ffebee",
            color: "#c62828",
            padding: "10px",
            borderRadius: "4px",
            marginBottom: "20px",
          }}
        >
          <strong>Error:</strong> {error}
        </div>
      )}

      <div>
        <h2>Build Results</h2>
        {Object.keys(buildResults).length === 0 ? (
          <p>No builds have been run yet.</p>
        ) : (
          <div
            style={{
              backgroundColor: "#f5f5f5",
              borderRadius: "4px",
              padding: "10px",
            }}
          >
            {Object.entries(buildResults).map(([target, data]) => (
              <div key={target} style={{ marginBottom: "10px" }}>
                <h3>{target}</h3>
                <p>
                  <strong>Built at:</strong> {data.timestamp}
                </p>
                <pre
                  style={{
                    backgroundColor: "#e0e0e0",
                    padding: "10px",
                    borderRadius: "4px",
                    overflow: "auto",
                  }}
                >
                  {JSON.stringify(data.value, null, 2)}
                </pre>
              </div>
            ))}
          </div>
        )}
      </div>

      <div style={{ marginTop: "30px" }}>
        <h2>Database State</h2>
        <button
          onClick={() => {
            const currentState = {};
            databaseRef.current.forEach((value, key) => {
              currentState[key] = value;
            });
            setBuildResults((prev) => ({
              ...prev,
              _database: {
                value: currentState,
                timestamp: new Date().toLocaleTimeString(),
              },
            }));
          }}
          style={{
            padding: "5px 10px",
            backgroundColor: "#2196F3",
            color: "white",
            border: "none",
            borderRadius: "4px",
            cursor: "pointer",
          }}
        >
          Show Database State
        </button>
      </div>
    </div>
  );
};

const root = ReactDOM.createRoot(document.getElementById("root")!);
root.render(
  <React.StrictMode>
    <BuildView />
  </React.StrictMode>,
);
