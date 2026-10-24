# Daily Scroll service image. Runs the Node service in limited (production) mode:
# time limits enforced, no --testing flag. Data persists in /app/data, which
# hosts should mount as a volume.
FROM node:22-alpine
WORKDIR /app
RUN apk add --no-cache su-exec \
 && npm install --omit=dev --no-audit --no-fund qrcode@1.5.4
# Everything server.mjs imports, directly or indirectly, plus the folders it reads at runtime.
COPY server.mjs content.mjs oauth.mjs token-vault.mjs connected-feeds.mjs public-youtube.mjs public-previews.mjs youtube-feed.mjs companion-zip.mjs ./
COPY web ./web
COPY chrome-companion ./chrome-companion
COPY docker-entrypoint.sh /usr/local/bin/docker-entrypoint.sh
RUN mkdir -p data && chown -R node:node /app && chmod +x /usr/local/bin/docker-entrypoint.sh
ENV PORT=8787 \
    SERVICE_DATA_DIR=/app/data
EXPOSE 8787
VOLUME ["/app/data"]
# The entrypoint starts as root only to make the mounted volume writable by the
# "node" user, then drops privileges before starting the service.
ENTRYPOINT ["docker-entrypoint.sh"]
CMD ["node", "server.mjs"]
