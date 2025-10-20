# ---------- Base Image ----------
FROM node:20-slim AS base

# ---------- Install Chromium dependencies ----------
RUN apt-get update && apt-get install -y --no-install-recommends \
  chromium \
  fonts-thai-tlwg \
  fonts-liberation \
  libasound2 \
  libatk-bridge2.0-0 \
  libatk1.0-0 \
  libcups2 \
  libdbus-1-3 \
  libdrm2 \
  libgbm1 \
  libglib2.0-0 \
  libnspr4 \
  libnss3 \
  libx11-xcb1 \
  libxcomposite1 \
  libxdamage1 \
  libxfixes3 \
  libxrandr2 \
  libxss1 \
  libxtst6 \
  libxshmfence1 \
  libu2f-udev \
  xdg-utils \
  wget \
  curl \
  ca-certificates \
  && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Puppeteer environment ----------
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true
ENV NODE_ENV=production

# ---------- Create app directory ----------
WORKDIR /usr/src/app

# ---------- Install dependencies ----------
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Copy source ----------
COPY . .

# ---------- Create non-root user ----------
RUN useradd -m nodeuser
USER nodeuser

# ---------- Expose port ----------
EXPOSE 4000

# ---------- Healthcheck ----------
HEALTHCHECK --interval=30s --timeout=5s --start-period=10s --retries=3 \
  CMD curl -f http://localhost:4000/status || exit 1

# ---------- Start command ----------
CMD ["node", "api/server.js"]
