FROM node:22-slim

WORKDIR /app

COPY package.json package-lock.json ./
RUN npm ci --omit=dev

COPY src ./src

# useMultiFileAuthState("auth") resolves relative to the CWD (/app) — the
# Fly volume is mounted at /app/auth so the WhatsApp session (and its QR
# pairing) survives restarts/redeploys instead of asking to re-link every time.
VOLUME /app/auth

CMD ["node", "src/index.js"]
