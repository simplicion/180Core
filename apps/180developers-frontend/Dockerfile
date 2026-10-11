FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm install -g turbo
RUN turbo prune 180developers-frontend --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN pnpm install --prefer-frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=180developers-frontend...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3008

COPY --from=installer /app/apps/180developers-frontend/public ./apps/180developers-frontend/public
COPY --from=installer /app/apps/180developers-frontend/.next/standalone ./
COPY --from=installer /app/apps/180developers-frontend/.next/static ./apps/180developers-frontend/.next/static

EXPOSE 3008
CMD ["node", "apps/180developers-frontend/server.js"]
