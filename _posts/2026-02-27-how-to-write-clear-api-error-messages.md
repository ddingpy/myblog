---
title: "How to Write Clear API Error Messages"
date: 2026-02-27 18:10:00 +0900
categories: [development, backend]
tags: [api, ux, backend]
---
Good error messages reduce support requests and speed up integration.

## Error Response Shape

Use a consistent structure:

```json
{
  "code": "VALIDATION_ERROR",
  "message": "email is invalid",
  "request_id": "req_123"
}
```

## Guidelines

- Keep `code` machine-friendly and stable.
- Keep `message` human-readable and actionable.
- Include `request_id` for log correlation.

## Avoid

- Generic responses like "Something went wrong".
- Leaking stack traces or sensitive internal data.
