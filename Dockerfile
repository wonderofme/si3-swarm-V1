FROM node:22-slim AS base

WORKDIR /app

# Install build dependencies for native modules
RUN apt-get update && apt-get install -y \
    python3 \
    make \
    g++ \
    && rm -rf /var/lib/apt/lists/*

# Install dependencies using npm (match local environment)
COPY package.json package-lock.json tsconfig.json ./
# Use npm ci for reproducible builds (respects package-lock.json and overrides)
# Force clean install to ensure overrides are applied
# Remove any existing node_modules to ensure fresh install with overrides
RUN rm -rf node_modules .npm && npm ci --include=optional
# Verify overrides are applied and show actual zod version in use
RUN npm list zod zod-to-json-schema || true
RUN node -e "const zod = require('zod'); console.log('Zod version:', require('zod/package.json').version); console.log('Zod exports:', Object.keys(require('zod/package.json').exports || {}));" || true

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


