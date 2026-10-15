---
title: LLM Wiki Pattern
type: concept
created: 2026-10-15
updated: 2026-10-15
sources:
  - "[[sources/karpathy-llm-wiki]]"
tags:
  - knowledge-base
  - architecture
  - workflow
---

# LLM Wiki Pattern

Summary: An architectural design pattern where an autonomous LLM incrementally compiles, updates, and cross-references a persistent markdown wiki from immutable raw sources, decoupling knowledge synthesis from query time.

## Architectural Layers

1. Raw Sources: Read-only inputs (articles, papers, notes, data). Serves as ground truth.
2. The Wiki: Persistent markdown files (sources, entities, concepts, syntheses) linked together via wikilinks.
3. The Schema: Operating guidelines (`AGENTS.md`) directing agent behavior during ingestion, queries, and audits.

## Operational Cycles

- Ingestion: Reads raw text once, summarizes takeaways, establishes cross-references, updates `[[index]]`, and records operations in `[[log]]`.
- Query: Queries consult `[[index]]` and compiled wiki pages directly without parsing raw sources, saving tokens and response latency.
- Lint: Validates link targets, discovers orphan notes, detects conflicting statements across pages, and highlights knowledge gaps.

## Related Pages

- Source Notes: [[sources/karpathy-llm-wiki]]
- Related Concepts: [[concepts/rag-vs-llm-wiki]], [[concepts/compounding-knowledge]]
- Linked Entities: [[entities/andrej-karpathy]], [[entities/obsidian]], [[entities/vannevar-bush]]
