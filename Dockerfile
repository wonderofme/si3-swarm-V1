FROM node:22-slim AS base

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies using npm (match local environment)
COPY package.json package-lock.json* tsconfig.json ./
# Force reinstall to get correct platform-specific native modules
# Clean install to ensure overrides are applied
RUN rm -rf node_modules package-lock.json && npm install --include=optional

# Copy source
COPY src ./src
COPY characters ./characters

# Build
RUN npm run build

# Runtime image
FROM node:22-slim

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/dist ./dist
COPY --from=base /app/characters ./characters

ENV NODE_ENV=production
ENV DIRECT_PORT=3000
# Disable fastembed to avoid native module issues (use OpenAI embeddings instead)
ENV USE_OPENAI_EMBEDDING=true

EXPOSE 3000

CMD ["node", "dist/index.js"]


