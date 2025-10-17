# ---------- Base Image ----------
FROM node:20-slim

# ---------- Install Chromium dependencies ----------
RUN apt-get update && apt-get install -y \
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
  ca-certificates \
  --no-install-recommends && apt-get clean && rm -rf /var/lib/apt/lists/*

# ---------- Puppeteer environment ----------
ENV PUPPETEER_EXECUTABLE_PATH=/usr/bin/chromium
ENV PUPPETEER_SKIP_DOWNLOAD=true

# ---------- Working directory ----------
WORKDIR /usr/src/app

# ---------- Copy & Install ----------
COPY package*.json ./
RUN npm ci --omit=dev

# ---------- Copy Source ----------
COPY . .

# ---------- Expose & Start ----------
EXPOSE 4000
CMD ["node", "api/server.js"]
