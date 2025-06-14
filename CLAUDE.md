# CLAUDE.md

This file provides guidance to Claude Code (claude.ai/code) when working with code in this repository.

## Project Overview

Monument is an experimental programming environment that reimagines how we interact with documents and programs. It reactively processes Markdown documents through Claude (Anthropic's LLM), using transclusion to create dynamic knowledge graphs.

## Key Commands

```bash
# Install dependencies
bun install

# Run tests
bun test

# Run a single test file
bun test src/build.test.ts

# Run Monument on example files
bun run bin/monument.ts --directory examples --output-directory examples/out

# Type check (TypeScript is a peer dependency)
bun x tsc --noEmit
```

## Architecture

### Core Concepts

1. **Reactive Document Processing**: Documents are processed through OpenAI's models when they change, creating a live programming environment similar to spreadsheets.

2. **Transclusion**: Markdown image syntax `![description](source)` is repurposed to include content from other documents (local or remote), creating knowledge graphs.

3. **Signal-Based Architecture**: Uses `signal-polyfill` and `signal-utils` for reactive state management throughout the system.

### Key Components

- **bin/monument.ts**: CLI entry point that orchestrates document processing
- **src/build.ts**: Handles dependency tracking and reactive rebuilding
- **src/document.ts**: Core document representation
- **src/model.ts**: Anthropic Claude integration for LLM processing
- **src/resolver.ts**: Resolves transclusions and manages document dependencies
- **src/rule.ts**: Defines how different file types are processed
- **src/storage.ts**: Persistence layer for caching and state

### Processing Flow

1. Monument watches a directory for Markdown files
2. When files change, it parses them for transclusions
3. Transclusions are resolved (fetching remote content if needed)
4. Documents are processed through Claude models
5. Results are written to the output directory with `.txt` extension
6. The reactive system automatically updates dependent documents

## Code Style Guidelines

From docs/styleguide.md:
- Files are namespaces with singular names
- Export interfaces for classes with side effects
- Test-only exports use `TestOnly` prefix
- Use `// ---` separator comments liberally
- Function naming: prefer `xFromY` for conversion functions
- Test naming: use `Function.prototype.name` for resilience to refactoring

## Important Notes

1. **Experimental Nature**: This is a research prototype prioritizing rapid iteration. Minimal testing and CI are intentional choices.

2. **Environment Variable**: Requires `ANTHROPIC_API_KEY` for LLM processing.

3. **Reactive System**: Changes propagate automatically through the document graph. Be mindful of potential infinite loops when creating circular transclusions.

4. **Output Files**: Processed documents are saved with `.txt` extension in the output directory. AI-processed content uses `.ai.txt` extension.

5. **TypeScript Configuration**: Strict mode enabled, ESNext target, bundler module resolution.