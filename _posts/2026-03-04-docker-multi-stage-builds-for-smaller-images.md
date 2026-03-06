---
title: "Docker Multi-Stage Builds for Smaller and Safer Images"
date: 2026-03-04 19:10:00 +0900
categories: [devops]
tags: [docker, containers, cicd, performance]
---
Large container images slow down CI/CD and increase security surface area.

## Why Multi-Stage Builds Help

With multi-stage builds, you compile in one stage and copy only runtime artifacts to the final image.

Benefits:

- Faster pull and deploy times
- Less attack surface
- Cleaner dependency boundaries

## Example (Node.js)

```dockerfile
# Build stage
FROM node:20-alpine AS build
WORKDIR /app
COPY package*.json ./
RUN npm ci
COPY . .
RUN npm run build

# Runtime stage
FROM nginx:alpine
COPY --from=build /app/dist /usr/share/nginx/html
EXPOSE 80
```

## Production Checklist

- Pin base image versions (avoid floating tags in production).
- Scan final image (`trivy`, `grype`, etc.).
- Keep runtime image free of package managers and compilers.

## Common Mistake

Copying the whole source tree into the runtime stage can accidentally include secrets, `.env`, or source maps. Use `.dockerignore` aggressively.
