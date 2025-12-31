FROM node:20-bookworm-slim

# Install RAW deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    dcraw imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy backend package files first (better caching)
COPY server/package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the backend code
COPY server/. .

ENV NODE_ENV=production
ENV PORT=5051

EXPOSE 5051
CMD ["node", "index.js"]
