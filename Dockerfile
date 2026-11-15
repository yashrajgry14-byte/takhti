# Takhti on Google Cloud Run: the app and its Gemini endpoints in one service
# (cloud/server.mjs). No build step — the app is plain files.
FROM node:22-slim
WORKDIR /app
ENV NODE_ENV=production
COPY package.json package-lock.json ./
# @netlify/blobs is the only runtime dependency, and Cloud Run doesn't use it;
# installed anyway so api/class-sync.mjs imports cleanly
RUN npm ci --omit=dev --no-audit --no-fund
COPY index.html sw.js manifest.webmanifest ./
COPY src ./src
COPY icons ./icons
COPY audio ./audio
COPY api ./api
COPY cloud ./cloud
# the files server.mjs serves are a whitelist (index.html, sw.js, the manifest,
# src/, icons/, audio/) — api/ and cloud/ are code it runs, never served
USER node
CMD ["node", "cloud/server.mjs"]
