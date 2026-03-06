---
title: "How I Use AI to Write Better Technical Documentation"
date: 2026-03-02 22:00:00 +0900
categories: [productivity, writing]
tags: [ai, documentation, workflow, engineering]
---
AI tools are great documentation assistants when you give them strict structure.

## My Workflow

1. Draft raw notes from implementation.
2. Ask AI to turn notes into sections: context, setup, steps, troubleshooting.
3. Manually verify every command and config key.
4. Add a "known limitations" section.

## Prompt Template

```text
Convert these notes into a concise engineering guide.
Constraints:
- include prerequisites
- include exact commands
- include failure cases and fixes
- avoid marketing language
```

## Quality Gate Before Publish

- A new team member can follow it in one pass.
- Commands are copy-paste safe.
- Version numbers are explicit.
- Ambiguous words like "soon" or "latest" are replaced with concrete values.

## Important Reminder

AI improves drafting speed, not factual trust. Final ownership of correctness is always yours.
