FROM node:22-alpine AS base

WORKDIR /app

# Install dependencies using npm
COPY package.json package-lock.json* tsconfig.json ./
RUN npm install
# Force install the Alpine/musl binary for tokenizers
RUN npm install @anush008/tokenizers-linux-x64-musl --no-save

# Copy source
COPY src ./src
COPY characters ./characters

# Build
RUN npm run build

# Runtime image
FROM node:22-alpine

WORKDIR /app

COPY --from=base /app/node_modules ./node_modules
COPY --from=base /app/package.json ./package.json
COPY --from=base /app/dist ./dist
COPY --from=base /app/characters ./characters

ENV NODE_ENV=production
ENV DIRECT_PORT=3000

EXPOSE 3000

CMD ["node", "dist/index.js"]


