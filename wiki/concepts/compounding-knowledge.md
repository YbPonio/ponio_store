---
title: Compounding Knowledge
type: concept
created: 2026-10-15
updated: 2026-10-15
sources:
  - "[[sources/karpathy-llm-wiki]]"
tags:
  - knowledge-base
  - synthesis
  - compounding
---

# Compounding Knowledge

Summary: The property of an information system where every newly ingested piece of data updates, enriches, and challenges prior notes, producing an asset whose value grows non-linearly over time.

## Mechanics of Compounding

- Single Source Ingestion: Ingesting one new document updates the source summary, refreshes 5 to 15 related entity and concept files, and flags contradictions against older claims.
- Bidirectional Connections: Concepts link back to sources and forward to related entities, forming an associative web.
- Filing Exploration Results: In-depth answers generated during query workflows can be filed back into the wiki as syntheses (`wiki/syntheses/`), permanently retaining research outcomes.
- Maintenance Automation: Humans traditionally abandon wikis due to bookkeeping friction. Delegating continuous linking and filing to LLMs keeps the graph intact without human fatigue.

## Related Pages

- Source Notes: [[sources/karpathy-llm-wiki]]
- Related Concepts: [[concepts/llm-wiki-pattern]], [[concepts/rag-vs-llm-wiki]]
- Linked Entities: [[entities/andrej-karpathy]], [[entities/vannevar-bush]]
