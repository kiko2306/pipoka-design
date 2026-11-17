# Move pipoka-design.com from pi-srv-live-01 to home-srv-01

Status: DONE 2026-11-17. Cutover verified, Uptime Kuma monitors added (ids 9, 10), no restic by user decision, office stack archived to `/home/mat/removed-apps-backup-2026-11-17/` and deleted at once (user choice, no 7-day wait), memory updated.

## Starting facts (from memory notes, not checked live)

- Source: `pi-srv-live-01` (office, production), `/home/mat/www/pipoka-design`, repo `kiko2306/pipoka-design` (branch master, public), compose `compose.yaml`, 4 containers (frontend on 9001, db, api, cloudflared).
- State to carry: db bind data `database/data` (mysql-owned), `api/uploads` (root-owned), `.env` (holds `CLOUDFLARE_TUNNEL_TOKEN` and other secrets), `*.secret` files (gitignored).
- Cloudflare: zone `pipoka-design.com`, tunnel `pipoka-design` (85122a68), ingress `pipoka-design.com` -> `http://frontend:80`, proxied CNAME `www` + Single Redirect rule (www to apex, 301).
- Extras on the old server: CrowdSec Cloudflare bouncer Worker routes on this zone (2 routes), Uptime Kuma monitors, restic backup job to NAS.
- Target: `home-srv-01` (home and dev server). Last check from this machine: `tx-home-utils.local` did not resolve and `tx-home-utils.com` timed out on SSH.

## Decision needed before step 1

Home server is a dev machine. Moving a live public site there means home internet uptime, no office backup job, and no CrowdSec setup. Confirm the user wants production on home-srv-01 (or only a staging copy).

## Steps

1. Reach home-srv-01 over SSH and confirm it is healthy: disk space, Docker and compose versions match the office server, port 9001 free.
2. On the office server, record the exact image digests and container versions (`docker compose images`). Pin the same on the target.
3. Clone `kiko2306/pipoka-design` to `/home/mat/www/pipoka-design` on home-srv-01. Copy `.env` and `*.secret` over an encrypted channel (ssh pipe), never via chat or git.
4. Rehearse first: copy `database/data` and `api/uploads` (take a DB dump with `mysqldump` or a stopped-stack copy to keep ownership), start the stack on home-srv-01 with the cloudflared service disabled, test on the LAN IP and port 9001.
5. Cut over, accept about 1 to 5 minutes of downtime: on the office server `docker compose down`, take the final data copy, restore it on home-srv-01, `docker compose up -d` with cloudflared enabled. The same tunnel token works from any host, so no DNS or ingress change is needed. Stop the office connector first so only one runs.
6. Verify: `pipoka-design.com` returns 200, `www` returns 301 to the apex, login, uploads and DB reads work, 4 tunnel connections registered.
7. Move the extras: no home backup (decided 2026-11-17: git only, not restic); add the Uptime Kuma monitors, keep the CrowdSec bouncer routes (they are per zone, not per host).
8. Keep the office stack stopped, not deleted, for 7 days as rollback. Then archive it to `/home/mat/removed-apps-backup-<date>/` and delete.
9. Update memory (`ssh-hosts.md`, `office-server-history.md`, `home-srv-01-inventory.md`) and this plan.

## Rollback

Stop the stack on home-srv-01, start the office stack again (same tunnel token). Data written during the window on home-srv-01 must be copied back first.

## Open

- Confirm production on home-srv-01 (see above).
- Image build vs pull: check whether the compose file builds `api` and `frontend` locally.
