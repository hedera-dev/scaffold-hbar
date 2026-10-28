# Self-hosted x402 Hedera facilitator
FROM node:22.23.4-alpine

WORKDIR /app

# Install runtime dependencies first for better layer caching (includes tsx).
# Uses the committed lockfile for reproducible builds.
COPY package.json package-lock.json ./
RUN npm ci --omit=dev --no-audit --no-fund

COPY tsconfig.json ./
COPY src ./src

ENV PORT=4020
EXPOSE 4020

# Drop root privileges.
USER node

CMD ["npx", "tsx", "src/server.ts"]
