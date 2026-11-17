#!/usr/bin/env bash
# Copy the home-server data (MySQL + api/uploads) into the LOCAL docker stack for testing.
# Overwrites the local database and api/uploads. Never touches the home server's data.
# Usage: bash backup-from-home.sh   (local stack must be running: docker compose up -d)
set -euo pipefail
cd "$(dirname "$0")"
. ./publish.env
umask 077

echo "Database: dump on $HOME_SSH_HOST, restore into local db"
# Root password is read inside each container's own env: it never leaves the containers.
ssh -o BatchMode=yes "$HOME_SSH_HOST" "cd '$HOME_PATH' && docker compose exec -T db sh -c 'mysqldump -uroot -p\"\$MYSQL_ROOT_PASSWORD\" --single-transaction --routines --databases \"\$MYSQL_DATABASE\" 2>/dev/null'" \
  | docker compose exec -T db sh -c 'mysql -uroot -p"$MYSQL_ROOT_PASSWORD" 2>/dev/null'

echo "Uploads: copy api/uploads"
mkdir -p api/uploads && find api/uploads -mindepth 1 -delete   # keep the folder itself: it is a docker bind mount
ssh -o BatchMode=yes "$HOME_SSH_HOST" "tar -C '$HOME_PATH/api/uploads' -cf - ." | tar -C api/uploads -xf -
docker compose up -d --force-recreate api >/dev/null
echo "Done. Log in locally with the HOME server's admin password (the restored DB holds its admin user)."
