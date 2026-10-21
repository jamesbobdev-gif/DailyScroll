FROM node:22-alpine
WORKDIR /app
RUN npm install --omit=dev --no-audit --no-fund qrcode@1.5.4
COPY server.mjs content.mjs oauth.mjs token-vault.mjs connected-feeds.mjs public-youtube.mjs public-previews.mjs youtube-feed.mjs ./
COPY web ./web
RUN mkdir data && chown -R node:node /app
USER node
ENV PORT=8787
EXPOSE 8787
VOLUME ["/app/data"]
CMD ["node", "server.mjs"]
