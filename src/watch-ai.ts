#!/usr/bin/env bun
import { watch } from "node:fs/promises";
import { parseArgs } from "util";
import { openai } from "./ai";
import { file } from "./load";

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    apiKey: {
      type: "string",
      default: process.env.OPENAI_API_KEY,
    },
    debounce: {
      type: "string",
      default: "300",
    },
    model: {
      type: "string",
      default: "gpt-4o-mini",
    },
  },
  strict: true,
  allowPositionals: true,
});

const OPENAI_API_KEY = values.apiKey!;
const DEBOUNCE_DELAY = parseInt(values.debounce!, 10);

if (positionals.length < 3) {
  console.error(`Usage: ${positionals[0]} ${positionals[1]} <path>`);
  process.exit(1);
}

const filePath = positionals[2]!;
const model = openai("gpt-4o-mini", OPENAI_API_KEY);

let state = {
  debounceTimer: null as Timer | null,
  activeAbortController: null as AbortController | null,
};

async function processFileUpdate() {
  console.clear();

  const prompt = await file(new URL(filePath));

  state.activeAbortController = new AbortController();

  try {
    for await (const chunk of model.stream(
      [prompt],
      state.activeAbortController.signal,
    )) {
      process.stdout.write(chunk);
    }
  } finally {
    state.activeAbortController = null;
  }
}

for await (const event of watch(filePath)) {
  switch (event.eventType) {
    case "rename":
      if (state.activeAbortController) {
        state.activeAbortController.abort();
      }
      process.exit(0);

    case "change":
      if (state.activeAbortController) {
        state.activeAbortController.abort();
      }
      if (state.debounceTimer) {
        clearTimeout(state.debounceTimer);
      }
      state.debounceTimer = setTimeout(() => {
        processFileUpdate();
        state.debounceTimer = null;
      }, DEBOUNCE_DELAY);
  }
}
