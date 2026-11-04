#!/bin/sh
set -e
# Hosts mount persistent volumes owned by root. Hand the data folder to the
# unprivileged "node" user, then run the service as that user.
DATA_DIR="${SERVICE_DATA_DIR:-/app/data}"
mkdir -p "$DATA_DIR"
if [ "$(id -u)" = "0" ]; then
  chown -R node:node "$DATA_DIR" 2>/dev/null || true
  exec su-exec node "$@"
fi
exec "$@"
