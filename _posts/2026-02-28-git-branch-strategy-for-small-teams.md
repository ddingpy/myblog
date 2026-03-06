---
title: "Git Branch Strategy for Small Teams"
date: 2026-02-28 09:20:00 +0900
categories: [development, collaboration]
tags: [git, workflow, team]
---
A lightweight branching strategy helps small teams move fast without losing code quality.

## Recommended Flow

- `main`: always deployable
- short-lived feature branches: `feat/*`
- pull request required before merge

## Practical Rules

- Keep branch lifetime under 2 days.
- Rebase or merge `main` daily to reduce conflicts.
- Prefer small PRs with one clear intent.

## Why It Works

Smaller diffs are easier to review, test, and roll back.
