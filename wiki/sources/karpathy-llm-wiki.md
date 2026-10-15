---
title: "LLM Wiki: A Pattern for Building Personal Knowledge Bases Using LLMs"
type: source
created: 2026-10-15
updated: 2026-10-15
sources:
  - "[[raw/sources/karpathy-llm-wiki]]"
tags:
  - knowledge-base
  - llm-architecture
  - note-taking
---

# LLM Wiki: A Pattern for Building Personal Knowledge Bases Using LLMs

Summary: Andrej Karpathy outlines a methodology where an LLM agent incrementally builds and maintains a persistent, interlinked markdown wiki from raw source documents, contrasting this with ephemeral query-time RAG systems.

## Key Theses

- Traditional RAG rediscovers knowledge from scratch on every query without accumulating insight or synthesis across documents.
- An LLM Wiki sits between the user and raw sources as a compiled, compounding knowledge artifact.
- The human curates sources and directs queries; the LLM performs all summarization, cross-referencing, linking, and bookkeeping.
- The wiki is structured into three layers: immutable raw sources, the persistent wiki directory, and a schema document governing agent behavior.
- Core operations consist of ingest, query, and lint passes, supported by an index file and chronological log file.

## Structural Elements

- Raw Sources: Immutable input documents, clips, papers, or logs.
- The Wiki: Markdown files comprising entity pages, concept pages, source summaries, and comparative syntheses.
- The Schema: Configuration and prompt guidance instructing the LLM on conventions and workflows.
- Index and Log: `[[index]]` for topic routing and `[[log]]` for chronological history.

## Related Concepts and Entities

- Concepts: [[concepts/llm-wiki-pattern]], [[concepts/rag-vs-llm-wiki]], [[concepts/compounding-knowledge]]
- Entities: [[entities/andrej-karpathy]], [[entities/obsidian]], [[entities/vannevar-bush]]
