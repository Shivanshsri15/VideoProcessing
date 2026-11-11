# Node/npm pinned to match .nvmrc + package.json packageManager (avoids lockfile drift).
FROM node:24.22-bookworm-slim AS deps
WORKDIR /app
RUN corepack enable && corepack prepare npm@11.19.1 --activate
COPY package.json package-lock.json ./
RUN npm ci

FROM node:24.22-bookworm-slim AS build
WORKDIR /app
RUN corepack enable && corepack prepare npm@11.19.1 --activate
COPY --from=deps /app/node_modules ./node_modules
COPY . .
RUN npm run build && npm prune --omit=dev

FROM node:24.22-bookworm-slim AS runner
WORKDIR /app
ENV NODE_ENV=production
COPY --from=build /app/package.json ./
COPY --from=build /app/node_modules ./node_modules
COPY --from=build /app/dist ./dist
EXPOSE 3000
CMD ["node", "dist/main.js"]
