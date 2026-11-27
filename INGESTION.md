# Textbook Ingestion Pipeline

This document describes the textbook ingestion workflow for openphysics.wiki.

## Overview

The ingestion pipeline extracts atomic physics results from textbooks and converts them into wiki entries with explicit assumptions, dependencies, and derivations.

## Architecture

```
Textbook (PDF) 
    ↓
Text Extraction
    ↓
Chunking/Section Detection
    ↓
LLM Prompt (extract atomic results)
    ↓
JSON Structure
    ↓
Validation & Refinement
    ↓
Entry Files (Markdown)
```

## Atomic Result Types

- **definition**: A precise statement of what something is
- **axiom**: A foundational assumption taken as true without proof
- **principle**: A broad guiding rule or concept
- **theorem**: A result proven from axioms/principles/other theorems
- **technique**: A method or approach for solving problems

## Requirements

### For Local LLM (Recommended)

The script talks to any **OpenAI-compatible** endpoint (`/v1/chat/completions`). The default is the llama.cpp `llama-server` on the Strix Halo (`kronos-ubuntu`) running Qwen3-Coder-Next:

- The server binds to the Strix's `127.0.0.1:8080` only, so open the SSH tunnel first: `ssh -fN strix-llm`
- Check it's ready: `curl http://127.0.0.1:8080/health` → `{"status":"ok"}` (a 503 means it's still loading)
- Override with env vars or flags: `LLM_URL` / `--llm-url` (include `/v1`), `LLM_MODEL` / `--model`, optional `LLM_API_KEY`
- Ollama also works: `LLM_URL=http://127.0.0.1:11434/v1 LLM_MODEL=<name>`

### For Cloud LLM (Alternative)

- Any OpenAI-compatible endpoint: set `LLM_URL`, `LLM_MODEL`, and `LLM_API_KEY`

## Usage

### Quick Test with Local Excerpt

```bash
# Test with a text excerpt
npx tsx scripts/ingest-textbook.ts --text scripts/test-excerpt.txt --dry-run

# Test with direct text
npx tsx scripts/ingest-textbook.ts \
  --excerpt "The work-energy theorem states..."
```

### Ingest a PDF Textbook

```bash
npx tsx scripts/ingest-textbook.ts \
  --pdf /path/to/textbook.pdf \
  --page 150 \
  --output-dir /tmp/ingestion-results
```

## Configuration

### LLM Parameters

The script uses the following default parameters (adjustable in the script):

- **Temperature**: 0.3 (lower = more consistent, higher = more creative)
- **Max output tokens**: 8192 (the context window is set on the server; llama-server on the Strix uses 256K)
- **Structured output**: `response_format: json_object`, so llama-server constrains output to valid JSON
- **Model**: `qwen3-coder-next`

### Output Directory

Default: `/tmp/opencode/ingestion-output`

## Entry Format

Generated entries follow the standard format, with a single role in the field's default framework (override with `--framework`):

```markdown
---
title: "Work–energy theorem"
slug: work-energy-theorem
field: classical-mechanics
summary: "The net work on a particle equals its change in kinetic energy."
roles:
  newtonian: { type: theorem, foundational: false, dependencies: [work, kinetic-energy, newtons-second-law] }
---

## Statement
The net work done on a particle equals its change in kinetic energy.

## Assumptions
- The particle has constant mass
- The frame of reference is inertial
- The speed is non-relativistic

## Derivation
Starting from Newton's second law...
```

## Validation

Generated entries are checked against:

1. **Schema validation** (Zod schema in `src/lib/entry-schema.ts`)
2. **Slug uniqueness** (global uniqueness across all fields)
3. **Dependency resolution** (all dependencies must exist)
4. **Section structure** (Statement, Assumptions, optional Derivation)
5. **Acyclic graph** (no circular dependencies)
6. **No orphans** (entries must connect to the graph)

## Quality Control

The pipeline includes several quality checks:

1. **LLM Prompt Engineering**: Clear instructions with examples
2. **Structured Output**: JSON format ensures parseability
3. **Temperature Control**: Low temperature for consistency
4. **Existing-entry catalogue**: the prompt lists every entry in `src/content/entries` (slug, type, title) and requires dependencies to use those slugs or slugs from the same batch
5. **Dependency resolution**: dependencies are mapped onto known slugs, also catching wrapper names (`definition-of-work` → `work`), titles and possessives. Unknown dependencies are dropped and reported, never written
6. **Duplicate detection**: results that match an existing entry are flagged and not written; merge them by hand
7. **Derivation rules**: theorems must have a derivation; definitions and axioms must not. Empty derivations are omitted, since `check-content` rejects empty sections
8. **Human Review**: All generated entries require manual review

## Next Steps

1. **PDF Text Extraction**: Implement robust PDF parsing
2. **Chunking Strategy**: Smart section/chunk detection
3. **Batch Processing**: Process multiple pages/chapters
4. **Quality Metrics**: Automated assessment of result quality
5. **Human-in-the-loop**: Interactive review interface

## Troubleshooting

### LLM Connection Issues

If the server isn't responding:

```bash
# Connection refused → the tunnel is down
ssh -fN strix-llm

# Is the server up and the model loaded? (503 = still loading)
curl http://127.0.0.1:8080/health
curl http://127.0.0.1:8080/v1/models

# Server logs / restart (on the Strix)
ssh strix journalctl --user -fu llama-server
```

### Parse Errors

If the LLM response isn't valid JSON:

1. Check the server honours `response_format: json_object` (llama-server does)
2. Look for the "hit max_tokens" warning: the output was truncated, so send a shorter excerpt
3. Simplify the prompt
4. Try a different model

### Low Quality Results

1. Increase prompt clarity
2. Use a more capable model (e.g. GPT-OSS 120B or Qwen3.5-35B-A3B on the Strix)
3. Add examples to the prompt
4. Reduce the amount of text per request

## Contributing

When improving the ingestion pipeline:

1. Test with diverse textbook excerpts
2. Document common failure modes
3. Improve error messages
4. Add quality metrics
