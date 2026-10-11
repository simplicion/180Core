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
# Copy prisma schemas to ensure postinstall (prisma generate) succeeds
COPY --from=builder /app/packages/db/prisma ./packages/db/prisma
COPY --from=builder /app/packages/db-180core/prisma ./packages/db-180core/prisma
RUN pnpm install --prefer-frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm --filter @workspace/db build || (cd packages/db && npx esbuild src/index.ts --platform=node --target=node18 --outfile=dist/index.js)
RUN pnpm --filter @workspace/db-180core build || (cd packages/db-180core && npx esbuild src/index.ts --platform=node --target=node18 --outfile=dist/index.js)
RUN pnpm turbo run build --filter=180-core-backend...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production

COPY --from=installer /app .

WORKDIR /app/apps/180-core-backend

EXPOSE 4003
ENV PORT=4003

CMD ["tsx", "src/server.ts"]
