FROM node:22-alpine AS base

WORKDIR /app

# Install build dependencies for native modules
RUN apk add --no-cache python3 make g++

# Install dependencies using npm (match local environment)
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install --include=optional

# Copy source
COPY src ./src
COPY characters ./characters

# Build
RUN npm run build

# Runtime image
FROM node:22-alpine

WORKDIR /app

# Install runtime dependencies for native modules
RUN apk add --no-cache libc6-compat

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/dist ./dist
COPY --from=base /app/characters ./characters

ENV NODE_ENV=production
ENV DIRECT_PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]


