---
title: RAG vs LLM Wiki
type: concept
created: 2026-10-15
updated: 2026-10-15
sources:
  - "[[sources/karpathy-llm-wiki]]"
tags:
  - retrieval
  - comparison
  - token-efficiency
---

# RAG vs LLM Wiki

Summary: A comparative analysis contrasting dynamic query-time fragment retrieval (RAG) with persistent, compiled knowledge maintenance (LLM Wiki).

## Comparison Matrix

| Dimension | Standard RAG | LLM Wiki Pattern |
| --- | --- | --- |
| Knowledge State | Fragmented, re-retrieved per query | Persistent, interlinked markdown pages |
| Processing Time | Heavy re-computation at query time | One-time compilation during ingestion |
| Synthesis Quality | Limited to retrieved chunks | Compounded across all ingested sources |
| Contradiction Handling | Often produces conflicting answers | Explicitly resolved or flagged in pages |
| Token Consumption | High on repeat queries across sources | Low; queries read concise wiki notes |
| Tool Dependencies | Vector databases, embeddings, chunkers | Plain markdown files, git, text editor |

## Efficiency and Cost Benefits

- Eliminates redundant reading of lengthy source documents on recurring queries.
- Pre-compiled cross-references enable the agent to navigate directly to relevant entities and concepts.
- Solves synthesis across disparate documents by reconciling them during ingestion rather than during ad-hoc prompt execution.

## Related Pages

- Source Notes: [[sources/karpathy-llm-wiki]]
- Related Concepts: [[concepts/llm-wiki-pattern]], [[concepts/compounding-knowledge]]
- Linked Entities: [[entities/andrej-karpathy]]
