FROM node:20-bookworm-slim

# Install RAW deps
RUN apt-get update && apt-get install -y --no-install-recommends \
    dcraw imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy root package files (Monorepo structure)
COPY package*.json ./
RUN npm ci --omit=dev || npm install --omit=dev

# Copy the backend code
COPY server/. ./server/
COPY .env ./server/ 

# Adjust CMD to point to the file in server/
CMD ["node", "server/index.cjs"]
