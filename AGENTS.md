# LLM Wiki Schema & Operational Directives

This document specifies the architecture, file conventions, and operational workflows for maintaining the LLM Wiki in this workspace, following Andrej Karpathy's persistent knowledge base pattern.

---

## 1. Core Principles

- The wiki sits between the human and raw sources as an accumulated, interlinked knowledge layer.
- Raw documents are read once during ingestion; subsequent queries read from compiled wiki pages.
- Knowledge compounds: cross-references are maintained, contradictions are highlighted, and syntheses evolve continuously.
- The human directs sourcing and queries; the agent performs all summarization, cross-referencing, linking, and bookkeeping.
- Formatting must remain strictly plain text. Do not add or inject emojis or unicode symbols anywhere.

---

## 2. Three-Layer Architecture

1. Raw Sources (`raw/`):
   - `raw/sources/`: Raw markdown, text files, articles, transcripts, papers, clips. Immutable source of truth.
   - `raw/assets/`: Locally downloaded image attachments or media referenced by raw sources.
   - The agent reads from this directory during ingest, but never alters or deletes raw files.

2. The Wiki (`wiki/`):
   - `wiki/index.md`: Master catalog listing all wiki pages with one-line summaries and links, organized by category.
   - `wiki/log.md`: Chronological, append-only ledger tracking all wiki operations (ingest, query, lint).
   - `wiki/sources/`: Distilled summaries, core claims, and takeaways of ingested raw documents.
   - `wiki/entities/`: Pages for specific people, organizations, repositories, software, tools, APIs, and components.
   - `wiki/concepts/`: Pages for abstract ideas, architectures, workflows, design patterns, and domain models.
   - `wiki/syntheses/`: Cross-cutting comparative analyses, thematic syntheses, and filed query answers.

3. The Schema (`AGENTS.md` and `.agents/skills/llm-wiki/SKILL.md`):
   - Governs file structures, naming conventions, linking rules, and operational execution.

---

## 3. File Formats and Conventions

### File Naming
- Use lowercase alphanumeric characters and hyphens: `<slug>.md`.
- Example: `wiki/concepts/compounding-knowledge.md`, `wiki/entities/andrej-karpathy.md`.

### Frontmatter Standard
Every page in `wiki/` must begin with YAML frontmatter:

```markdown
---
title: Page Title
type: source | entity | concept | synthesis
created: YYYY-MM-DD
updated: YYYY-MM-DD
sources:
  - "[[sources/source-slug]]"
tags:
  - tag-one
  - tag-two
---
```

### Linking Standard
- Use Obsidian-compatible wikilinks: `[[slug]]` or `[[category/slug|Display Title]]`.
- Every page should link back to its related sources, entities, concepts, and parent index.
- Never leave dead links.

### Content Structure
- Header 1 (`# Title`): Matches page title.
- Summary section: 2 to 3 sentences summarizing the page.
- Core Body: Detailed structured sections, bullet lists, or tables.
- Related Pages: Cross-references to other wiki pages.
- Source References: Links to underlying sources.

---

## 4. Operational Workflows

### Ingestion Workflow (`ingest`)
Triggered when a new document is added to `raw/sources/`:
1. Read the target document in `raw/sources/`.
2. Inspect `wiki/index.md` to identify existing entities and concepts.
3. Extract core theses, key claims, mentioned entities, concepts, and relationships.
4. Create the source distillation page in `wiki/sources/<slug>.md`.
5. Update or create relevant entity pages in `wiki/entities/`:
   - If an entity exists, integrate new findings, update the `updated` date, and link the source.
   - If an entity is new and significant, create `wiki/entities/<slug>.md`.
6. Update or create relevant concept pages in `wiki/concepts/`:
   - Check if new claims contradict or reinforce existing concept definitions. Note disagreements explicitly.
7. Update `wiki/index.md`:
   - Insert links and one-line summaries in the appropriate categories.
8. Append an entry to `wiki/log.md`:
   - Format:
     ```markdown
     ## [YYYY-MM-DD] ingest | Title of Source
     - Source: [[sources/source-slug]]
     - Created: [[entities/entity-slug]], [[concepts/concept-slug]]
     - Updated: [[concepts/other-slug]]
     - Notes: One sentence summary of changes.
     ```

### Query Workflow (`query`)
Triggered when the user asks a domain or knowledge question:
1. Read `wiki/index.md` first to locate candidate pages.
2. Read the specific pages from `wiki/entities/`, `wiki/concepts/`, `wiki/syntheses/`, or `wiki/sources/`.
3. Do not re-read raw sources unless wiki pages lack necessary fine details.
4. Synthesize the answer clearly, including wikilinks to relevant wiki pages.
5. If the query produces a substantial comparison, analysis, or novel insight, offer to file it into `wiki/syntheses/<slug>.md`, link it in `wiki/index.md`, and record the query in `wiki/log.md`.

### Linting Workflow (`lint`)
Triggered periodically or on demand:
1. Scan all markdown files in `wiki/`.
2. Check for broken links (wikilinks pointing to non-existent files).
3. Identify orphan pages (pages not referenced anywhere and missing from `wiki/index.md`).
4. Find prominent terms mentioned across multiple pages that lack dedicated entity or concept pages.
5. Flag contradictions or stale information.
6. Record the audit in `wiki/log.md`:
   ```markdown
   ## [YYYY-MM-DD] lint | Routine Health Check
   - Broken links: count
   - Orphans: count
   - Recommendations: suggested additions or investigations
   ```

---

## 5. Tooling

Use the project wiki CLI script:
- `node scripts/wiki.mjs stats`: Display current counts for pages, links, and log entries.
- `node scripts/wiki.mjs lint`: Check link integrity, missing index entries, and orphans.
- `node scripts/wiki.mjs search <term>`: Search across wiki pages.
- `node scripts/wiki.mjs list`: List all pages categorized by directory.
