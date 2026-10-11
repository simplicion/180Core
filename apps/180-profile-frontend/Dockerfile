FROM node:20-alpine AS base
ENV PNPM_HOME="/pnpm"
ENV PATH="$PNPM_HOME:$PATH"
RUN corepack enable
RUN apk add --no-cache libc6-compat

FROM base AS builder
WORKDIR /app
COPY . .
RUN npm install -g turbo
RUN turbo prune 180-profile-frontend --docker

FROM base AS installer
WORKDIR /app
COPY --from=builder /app/out/json/ .
RUN pnpm install --prefer-frozen-lockfile
COPY --from=builder /app/out/full/ .
RUN pnpm turbo run build --filter=180-profile-frontend...

FROM base AS runner
WORKDIR /app
ENV NODE_ENV=production
ENV PORT=3009

COPY --from=installer /app/apps/180-profile-frontend/public ./apps/180-profile-frontend/public
COPY --from=installer /app/apps/180-profile-frontend/.next/standalone ./
COPY --from=installer /app/apps/180-profile-frontend/.next/static ./apps/180-profile-frontend/.next/static

EXPOSE 3009
CMD ["node", "apps/180-profile-frontend/server.js"]
