FROM node:20-alpine

WORKDIR /app

# Install deps
COPY package.json package-lock.json* ./
RUN npm ci || npm install

# Copy sources
COPY tsconfig.json ./
COPY src ./src

# Build
RUN npm run build

ENV NODE_ENV=production

CMD ["node", "dist/standalone.js"]
