FROM node:20-bullseye

# Install RAW tools
RUN apt-get update && apt-get install -y --no-install-recommends \
  dcraw imagemagick \
  && rm -rf /var/lib/apt/lists/*

WORKDIR /app

# Copy server files (adjust if your structure differs)
COPY package*.json ./
RUN npm ci

COPY . .

ENV NODE_ENV=production
ENV PORT=5051

EXPOSE 5051

# your backend entry
CMD ["node", "server/index.js"]
