FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat gcompat openssl
RUN npm install -g tsx turbo

FROM base AS builder
WORKDIR /app
COPY . .
RUN turbo prune 180-core-backend --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
COPY --from=builder /app/packages/db-180core/prisma ./packages/db-180core/prisma
RUN pnpm install --prefer-frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm --filter @workspace/db-180core generate
RUN pnpm --filter @workspace/db-180core build
RUN pnpm turbo run build --filter=180-core-backend...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /app .

WORKDIR /app/apps/180-core-backend

EXPOSE 4003
ENV PORT=4003

CMD ["tsx", "src/server.ts"]
