# My Note (Jekyll + GitHub Pages)

A GitHub Pages-compatible Jekyll blog for technical articles, tutorials, and practical life tips.

## Tech Stack

- Jekyll (GitHub Pages compatible via `github-pages` gem)
- Docker + Docker Compose for local development
- Lunr.js for client-side full-text search over markdown posts

## Project Structure

- `_config.yml`: production Jekyll configuration (GitHub Pages)
- `_config.dev.yml`: local development overrides (`url`/`baseurl`)
- `_posts/`: blog posts organized by category directories (`_posts/<category>/YYYY-MM-DD-title.md`)
- `_layouts/`: site and post layouts
- `assets/css/mynote.css`: site styles
- `assets/js/search.js`: Lunr search logic
- `search.json`: generated post index for search
- `search.md`: search page UI
- `categories.md`: topic/category landing page
- `journal.md`: dedicated landing page for your journal entries
- `Dockerfile`: local Jekyll image
- `docker-compose.yaml`: local run command and ports
- `scripts/dev-server.sh`: starts Jekyll watch build + static server using `_config.yml,_config.dev.yml`
- `scripts/static-server.js`: serves generated `_site` without WEBrick
- `.github/workflows/pages.yml`: GitHub Pages deployment workflow

Post URL structure:

- Posts are generated with a simple path: `/posts/<title>/` (no year/month/day hierarchy).

## Local Development

Prerequisites:

- Docker Desktop (or Docker Engine + Compose plugin)

Run the site:

```bash
docker compose up --build
```

Then open:

- http://localhost:4000

Stop:

```bash
docker compose down
```

Why this works:

- The Docker image `jekyll/jekyll:pages` already contains GitHub Pages-compatible Jekyll dependencies.
- This project intentionally avoids `bundle install` during Docker build, so startup does not depend on direct access to `index.rubygems.org`.
- Local serving does not use `jekyll serve`/WEBrick; it uses `jekyll build --watch` plus a small Node static server.

## Writing Content

Create a post in a category directory under `_posts/`:

```text
_posts/<category>/YYYY-MM-DD-your-title.md
```

Post front matter example:

```yaml
---
title: "My New Tutorial"
date: 2026-03-06 10:00:00 +0900
tags: [jekyll, tutorial]
---
```

Category/topic behavior:

- Categories are shown on each post and on the home list.
- Topic landing page is available at `/categories/`, and each category has its own subpage at `/categories/<category>/`.
- Use one category per post by placing the file in one folder under `_posts/<category>/`.
- The category is inferred from the directory path (you do not need a `categories:` field in front matter).
- Journal entries belong in `_posts/journal/` and are grouped at `/journal/`.

Navigation behavior:

- Every page shows a breadcrumb trail at the top (parent to current page).
- Post pages include `Previous`/`Next` links only for posts sharing the same category, plus a shortcut to that category's article list.

## Search (Lunr.js)

- `search.json` is generated at build time from markdown posts in `_posts/`.
- `search.md` loads `search.json` and builds an in-browser Lunr index.
- Search fields: title, tags, categories, content.

## GitHub Pages Hosting

1. Push this repository to GitHub.
2. In GitHub repository settings, open **Pages**.
3. Set **Source** to **GitHub Actions**.
4. Ensure default branch is `main`; pushing to `main` triggers deployment.

## Required Configuration Update

Before production deploy, update `_config.yml`:

- `url`: set to your GitHub Pages domain (for example `https://username.github.io`)
- `baseurl`:
  - Use `""` for user/organization site repositories (`username.github.io`)
  - Use `"/repository-name"` for project sites

## Maintenance Tips

- Rebuild image when Dockerfile changes:

```bash
docker compose up --build
```

- Validate generated site locally before pushing.

## Troubleshooting

- If you are on Apple Silicon and see platform warnings, `docker-compose.yaml` already pins `linux/amd64` for compatibility with `jekyll/jekyll:pages`.
- If container starts but site is not immediately ready, wait a few seconds for the first Jekyll build to generate `_site`.
