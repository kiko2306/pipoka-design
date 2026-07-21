# Portfolio Website Implementation Plan

## Problem and proposed approach

Build a Dockerized portfolio platform from the supplied concept. The public Angular application will present image collections, individual image details, ratings, approved visitor comments, an about section, a contact form, and light/dark themes. A Node.js API backed by MySQL will provide public content, moderation, administrative management, image upload support, and a Cloudflare Tunnel will expose the public site.

## Requirements

- Administrators create image collections with title, description, cover thumbnail, and images.
- Visitors view public collections and image details, submit comments, and rate images one to five stars.
- The home page presents collection thumbnails, a concise about section, and a contact form.
- An administrative area manages portfolio content, uploads, comment approval, contact messages, about text, and highly rated images.
- The public site supports visitor-selectable light and dark modes.
- Docker Compose runs the frontend, API, MySQL, persistent image storage, and Cloudflare Tunnel.
- Docker builds must be reproducible with the repository Dockerfiles and documented host prerequisites.

## Confirmed product decisions

- Visitors submit ratings and comments without accounts; comments are moderated before publication.
- Contact submissions are stored in the administrative dashboard only.
- One seeded administrator signs in with email and password.
- Administrators do not configure public visual branding; visitors select light or dark mode.
- A `cloudflared` service receives an existing Cloudflare Tunnel token from an uncommitted environment variable and routes the public hostname to the frontend container.

## Architecture

- **Frontend:** Angular SPA with responsive public, authentication, and protected admin routes.
- **API:** Node.js with a modular Express/CommonJS structure, with validated REST endpoints and administrator authorization.
- **Database:** MySQL schema and migrations for users, collections, images, ratings, comments, contact submissions, and site settings.
- **Images:** Uploaded files stored in the local `api/uploads` bind mount; metadata stored in MySQL.
- **Runtime:** Docker Compose services for frontend, API, MySQL, and `cloudflared`; health checks, environment configuration, and local bind mounts for persistent data.
- **Deployment:** The production project directory is `/home/ubuntu/www/pipoka-design` on the configured Ubuntu server.

## Implementation steps

1. Create the Dockerized workspace and Cloudflare Tunnel configuration.
2. Define the MySQL schema and seed the initial administrator and sample portfolio content.
3. Implement the Node.js API for public content, anonymous engagement, uploads, contact inbox, and administration.
4. Implement the Angular public portfolio experience with light/dark mode.
5. Implement the protected Angular administration experience.
6. Add focused tests and operational documentation, including setup and visitor/administrator usage instructions in `README.md`.

## Current implementation status

- The public portfolio and `/admin` administrator workspace are implemented.
- The administrator workspace supports creating, editing, removing, and reordering collections; draft image uploads; public-about text editing; comment moderation; and the contact inbox.
- The administrator workspace is localized in Portuguese.
- The public collection archive loads published collections from the API.
- Administrators can preview the images belonging to each collection directly in the Portuguese workspace.
- Administrator action feedback is displayed as Portuguese toasts that dismiss after five seconds.
- Administrators can upload multiple images to a collection, and published collection images are viewable from the public archive.
- Administrators can personalize the public site title and subtitle.
- Publishing an uploaded image automatically publishes its collection and assigns an initial cover image, ensuring it is immediately visible on the public archive.
- The site is responsive across mobile and desktop layouts, including accessible mobile navigation, touch-sized controls, scalable/lazy-loaded images, and responsive grids.
- Visitors can sort collection images by newest or popularity, submit/update ratings, and create, edit, or delete their own moderated comments.
- Administrators can delete collection images and edit all public archive, about, and contact copy.

## Recently completed fixes

- The Cloudflare Tunnel connector uses the current pinned `cloudflared` release, `2026.7.2`.
- The Cloudflare Tunnel connector starts automatically with the default `docker compose up -d` command.
- MySQL readiness requires TCP port `3306`, preventing the API from starting against MySQL's temporary initialization server.
- Persistent uploads and MySQL data use local repository bind mounts at `api/uploads` and `database/data`.
- Docker startup troubleshooting repaired stale MySQL volume credentials without deleting data and moved the local frontend binding to port `8083` because ports `8080` and `8081` are already occupied on the host.
- Image uploads validate actual file content, accept the sample JPEG fixtures reliably, and clean rejected files.
- Delete actions use accessible themed confirmation dialogs instead of browser-native prompts.
- Dark mode uses darker surfaces and lighter text for stronger contrast.
- File-picker controls inherit the active visual theme.
- Upload metadata falls back to a normalized filename when no title or alt text is supplied.
- Public collection thumbnails are reduced by 30% on desktop, and selected collection galleries open in a dedicated dialog.
- Desktop collection thumbnails use 90% of the available browser height.
- Pending comments are excluded from every public image response and become visible only after administrator approval.

## Notes

- Do not commit the Cloudflare Tunnel token, administrator password, or any other secret.
- Keep the API private to the Docker network unless it is explicitly needed externally.
- All future plan changes must update this file.
