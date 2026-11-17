#!/usr/bin/env bash
# Publish to a server: pull the pushed branch and rebuild the changed services.
# Usage: bash publish.sh <home|office|ptisp>   (commit and push first; .env and *.secret stay on the server)
# Targets and their data live in publish.env as <TARGET>_SSH_HOST, <TARGET>_PATH, <TARGET>_BRANCH, <TARGET>_PUBLIC_URL.
set -euo pipefail
cd "$(dirname "$0")"
. ./publish.env

target="${1:-}"
case "$target" in home|office|ptisp) ;; *) echo "Usage: bash publish.sh <home|office|ptisp>" >&2; exit 2 ;; esac
[ "$target" != ptisp ] || { echo "ptisp (FTP) is not set up for this project." >&2; exit 2; }

T="$(echo "$target" | tr a-z A-Z)"
get() { local k="${T}_$1"; [ -n "${!k:-}" ] || { echo "Missing $k in publish.env." >&2; exit 2; }; echo "${!k}"; }
host=$(get SSH_HOST); path=$(get PATH); branch=$(get BRANCH); url=$(get PUBLIC_URL)

[ -z "$(git status --porcelain --untracked-files=no)" ] || { echo "Uncommitted changes. Commit and push first." >&2; exit 1; }
[ "$(git rev-parse HEAD)" = "$(git rev-parse "origin/$branch" 2>/dev/null)" ] || { echo "HEAD is not pushed to origin/$branch." >&2; exit 1; }

if [ "$target" = office ]; then
  read -r -p "Target is OFFICE (production). Type yes to publish: " answer
  [ "$answer" = yes ] || { echo "Cancelled."; exit 1; }
fi

ssh -o BatchMode=yes "$host" "set -e; cd '$path'; git pull --ff-only origin '$branch'; docker compose up -d --build; docker compose ps"
curl -fsS -o /dev/null -w "$target: $url http %{http_code}\n" "$url/" || { echo "$target: health check failed for $url" >&2; exit 1; }
