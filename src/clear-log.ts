#!/usr/bin/env bun
import { createWriteStream, WriteStream } from "fs";

if (process.argv.length < 3) {
  console.error("Usage: thing.ts <logfile>");
  process.exit(1);
}

const LOGFILE = process.argv[2];
const CLEAR_CHAR = "\x0c"; // ASCII 0x0C, the Control-L character

let logFile: WriteStream = createWriteStream(LOGFILE, { flags: "w" });

// Ensure standard input is treated as UTF-8 text.
process.stdin.setEncoding("utf8");

// Read from standard input in chunks.
for await (const chunk of process.stdin) {
  // Ensure we are working with a string.
  let data = chunk as string;

  process.stdout.write(data);

  // Process every occurrence of the clear character.
  while (data.indexOf(CLEAR_CHAR) !== -1) {
    const idx = data.indexOf(CLEAR_CHAR);
    const before = data.substring(0, idx);
    const after = data.substring(idx + 1);

    if (before) {
      logFile.write(before);
    }

    // "Clear" the file: close the current stream and reopen in truncate mode.
    logFile.end();
    logFile = createWriteStream(LOGFILE, { flags: "w" });

    // Continue processing what comes after the clear character.
    data = after;
  }

  // Write any remaining data.
  if (data) {
    logFile.write(data);
  }
}

// When stdin ends, close the file.
logFile.end();
