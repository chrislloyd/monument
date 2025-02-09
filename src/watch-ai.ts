#!/usr/bin/env bun
import OpenAI from "openai";
import { watch } from 'node:fs/promises';
import { parseArgs } from 'util';

const { values, positionals } = parseArgs({
  args: Bun.argv,
  options: {
    apiKey: {
      type: "string",
      default: process.env.OPENAI_API_KEY,
    },
    debounce: {
      type: "string",
      default: "300"
    },
    model: {
      type: "string",
      default: "gpt-4o-mini"
    }
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

const filePath = positionals[2];
const openai = new OpenAI({ apiKey: OPENAI_API_KEY });

let state = {
  debounceTimer: null as Timer | null,
  activeAbortController: null as AbortController | null,
}

async function processFileUpdate() {
  console.clear();

  const prompt = await Bun.file(filePath).text();

  state.activeAbortController = new AbortController();

  try {
    const response = await openai.chat.completions.create(
      {
        model: "gpt-4o-mini",
        messages: [{ role: "user", content: prompt }],
        stream: true,
      },
      {
        signal: state.activeAbortController.signal,
      }
    );

    for await (let chunk of response) {
      const content = chunk.choices[0].delta.content;
      if (!content) continue;
      process.stdout.write(content);
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
