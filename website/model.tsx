import { createContext, use, useState } from "react";
import { type Model, OpenAiModel } from "../src/model";
import * as assert from "../src/assert";
import OpenAI from "openai";

type Data = [provider: string, modelId: string, apiKey: string];

const ModelContext = createContext<Model | null>(null);

const LocalStorageKey = "MONUMENT_MODEL";

function modelFromData(data: Data): Model {
  const [provider, modelId, apiKey] = data;
  switch (provider) {
    case "openai":
      return new OpenAiModel(modelId as OpenAI.ChatModel, apiKey);
    default:
      throw new Error(`Unknown provider: ${provider}`);
  }
}

function modelFromLocalStorage(): Model | null {
  const raw = localStorage.getItem(LocalStorageKey);
  if (!raw) return null;
  const data = JSON.parse(raw) as Data;
  return modelFromData(data);
}

function ModelPicker({ onChange }: { onChange: (spec: Data) => void }) {
  return (
    <form
      className="flex flex-col gap-2 p-2"
      action={(formData) => {
        const provider = formData.get("provider");
        const modelId = formData.get("modelId");
        const apiKey = formData.get("apiKey");
        assert.ok(provider);
        assert.ok(modelId);
        assert.ok(apiKey);
        assert.ok(typeof provider === "string");
        assert.ok(typeof modelId === "string");
        assert.ok(typeof apiKey === "string");
        const data: Data = [provider, modelId, apiKey];
        onChange(data);
      }}
    >
      <div>
        <div>Provider:</div>
        <label>
          <input type="radio" name="provider" value="openai" checked readOnly />
          OpenAI
        </label>
      </div>

      <label>
        <div>Model:</div>
        <select name="modelId">
          <option value="gpt-4o-mini">gpt-4o-mini</option>
        </select>
      </label>

      <label>
        <div>API Key:</div>
        <input type="password" name="apiKey" autoComplete="off" />
      </label>

      <div>
        <button type="submit">Submit</button>
      </div>
    </form>
  );
}

export function ModelProvider({ children }: { children: React.ReactNode }) {
  const [model, setModel] = useState<Model | null>(modelFromLocalStorage);
  return (
    <ModelContext.Provider value={model}>
      {model ? (
        children
      ) : (
        <ModelPicker
          onChange={(data) => {
            localStorage.setItem(LocalStorageKey, JSON.stringify(data));
            const model = modelFromData(data);
            setModel(model);
          }}
        />
      )}
    </ModelContext.Provider>
  );
}

export function useModel(): Model {
  const model = use(ModelContext);
  if (!model) {
    throw new Error("useModel not wrapped in ModelProvider");
  }
  return model;
}
