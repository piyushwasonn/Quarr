# One container runs the web app and the crawl worker together, sharing the
# screenshot volume. The Playwright image ships Chromium matching playwright-core.
FROM mcr.microsoft.com/playwright:v1.64.1-noble

WORKDIR /app
ENV NEXT_TELEMETRY_DISABLED=1

COPY package.json package-lock.json ./
RUN npm ci

COPY . .
RUN npx prisma generate && npm run build

ENV NODE_ENV=production
ENV STORAGE_DIR=/data/storage
EXPOSE 3000
CMD ["node", "scripts/run-all.mjs"]
