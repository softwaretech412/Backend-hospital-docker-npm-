# SaludPlus API - Node.js 18
FROM node:18-alpine

WORKDIR /app

# Install dependencies first (better layer caching)
COPY package.json package-lock.json* ./
RUN npm ci --omit=dev

# Application and data (CSV for migration)
COPY src ./src
COPY scripts ./scripts
COPY data ./data

EXPOSE 3000

ENV NODE_ENV=production
CMD ["npm", "start"]
