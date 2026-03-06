---
title: "Building a REST API with FastAPI in 30 Minutes"
date: 2026-03-05 08:30:00 +0900
categories: [development, backend]
tags: [python, fastapi, api, tutorial]
---
FastAPI is a great choice when you want to ship a backend quickly without giving up type safety and clear docs.

## What You Will Build

In this tutorial, you will create a small task API with:

- `GET /tasks`
- `POST /tasks`
- `GET /tasks/{id}`

## Project Setup

Install dependencies:

```bash
pip install fastapi uvicorn
```

Create `main.py`:

```python
from fastapi import FastAPI, HTTPException
from pydantic import BaseModel

app = FastAPI()

class Task(BaseModel):
    title: str
    done: bool = False

DB = []

@app.get("/tasks")
def list_tasks():
    return DB

@app.post("/tasks")
def create_task(task: Task):
    DB.append(task.model_dump())
    return {"id": len(DB) - 1, **task.model_dump()}

@app.get("/tasks/{task_id}")
def get_task(task_id: int):
    if task_id < 0 or task_id >= len(DB):
        raise HTTPException(status_code=404, detail="Task not found")
    return {"id": task_id, **DB[task_id]}
```

Run the app:

```bash
uvicorn main:app --reload
```

Open `http://127.0.0.1:8000/docs` for auto-generated API docs.

## Practical Tip

Keep your first API thin and boring. Add auth, DB, caching, and messaging only after your endpoints and payloads are stable.

## Next Improvement Ideas

- Replace in-memory list with PostgreSQL.
- Add request validation for title length.
- Add API tests with `pytest` and `httpx`.
