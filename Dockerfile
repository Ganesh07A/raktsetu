# Multi-stage Dockerfile for RaktSetu API (Bun + Hono)
FROM oven/bun:1.4-alpine AS builder

WORKDIR /app

# Copy monorepo configuration & package files
COPY package.json bun.lock turbo.json ./
COPY apps/api/package.json ./apps/api/
COPY packages/db/package.json ./packages/db/
COPY packages/shared/package.json ./packages/shared/
COPY packages/ui/package.json ./packages/ui/
COPY packages/typescript-config/package.json ./packages/typescript-config/
COPY packages/eslint-config/package.json ./packages/eslint-config/

# Install all workspace dependencies
RUN bun install --frozen-lockfile || bun install

# Copy source code
COPY apps/api ./apps/api
COPY packages ./packages

# Build the standalone self-contained API bundle
RUN bun build apps/api/src/index.ts --outdir apps/api/dist --target bun

# Production runner image
FROM oven/bun:1.4-alpine AS runner

WORKDIR /app

COPY --from=builder /app/apps/api/dist/index.js ./index.js

ENV NODE_ENV=production
ENV PORT=3002

EXPOSE 3002

CMD ["bun", "run", "index.js"]
