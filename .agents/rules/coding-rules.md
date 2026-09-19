---
trigger: always_on
---

# Agent Directives & Coding Rules

## 1. Command Execution
- **Strictly DO NOT run `npm run build`** (or equivalent build scripts such as `vite build`, `yarn build`, `pnpm build`) in the terminal unless explicitly commanded by the user.
- Prefer dev server checks, linting, or targeted unit commands if verification is needed.

## 2. Code Comments
- **DO NOT write code comments** (single-line, multi-line, or JSDoc/docstrings) unless the user explicitly requests them.
- Write clear, self-explanatory, and readable code without explanatory commentary, inline notes, or TODO reminders.

## 3. Icons and Emojis
- **DO NOT add or inject emojis or unicode symbols** anywhere in the code, strings, logs, template literals, UI text, or component files.
- **DO NOT import or add icon sets, SVG mockups, or icon libraries** unless directly specified in the task prompt. Use plain text labels instead.