# Pipoka Portfolio

An image portfolio built with Angular, a modular Express API, MySQL, Docker Compose, and Cloudflare Tunnel. Visitors browse responsive collection galleries, sort images, submit updateable one-to-five-star ratings, and leave moderated comments. One administrator manages portfolio content, copy, moderation, and the contact inbox.

## Prerequisites

- Docker Desktop with Docker Compose v2
- A Cloudflare account and a pre-created Cloudflare Tunnel only when exposing the site publicly

## Local setup

1. Copy the environment template:

   ```powershell
   Copy-Item .env.example .env
   ```

2. Replace every placeholder secret in `.env`, especially `MYSQL_PASSWORD`, `MYSQL_ROOT_PASSWORD`, `JWT_SECRET`, and `ADMIN_PASSWORD`. Keep `.env` private.

3. Build and start the local application:

   ```powershell
   docker compose up --build
   ```

4. Open `http://localhost:8080`. The API health endpoint is available at `http://localhost:8080/api/health`.

5. Stop the application with `docker compose down`. Persistent data remains in `database\data` and `api\uploads`.

If port 8080 is already occupied, set `FRONTEND_PORT` in `.env` to a free value, such as `18080`, then use that port in the browser.

## Cloudflare Tunnel

Create a remotely managed tunnel and route its public hostname to the `frontend` service using the Cloudflare dashboard. Place the tunnel token in `CLOUDFLARE_TUNNEL_TOKEN` in `.env`. The connector starts with the default stack:

```powershell
docker compose up --build
```

The tunnel container does not publish the API directly. Requests to `/api` are proxied by the frontend container, keeping the API inside the Compose network.

## Visitor guide

- Use **Work** to browse collections and select an image to view it larger.
- Choose **View collection** to open the published image grid. Sort images by newest or popularity, select an image for its details, rate it, or add/edit/delete your own comment.
- Choose **Dark room** or **Light room** in the header to change the display mode.
- Send project enquiries using the contact form. The administrator receives these in the dashboard.
- Image ratings and comments are designed for anonymous use. Comments are private until an administrator approves them; only approved comments are returned in public image views.

## Administrator guide

The API seeds the initial administrator on its first successful connection to MySQL using `ADMIN_EMAIL` and `ADMIN_PASSWORD` from `.env`. Open `/admin` on the portfolio site and sign in with those credentials.

- Sign in through the administrator interface with that email and password.
- Create, edit, reorder, and remove collections with a title, description, and publish state.
- Upload multiple images into a collection, preview them, remove unwanted images, and publish them when ready. Publishing an upload also makes its collection public and assigns its initial cover image.
- Approve or reject pending visitor comments.
- Read and manage contact submissions from the dashboard.
- Update the site title/subtitle and the archive, about, and contact-section copy without changing code.

## API architecture

The API uses a module-oriented Express layout:

```text
api/src/
  server.js
  app.js
  modules/
    auth/
    admin/
    public/
    database/
```

Each module separates `model.js`, `service.js`, `controller.js`, and `index.js`. `server.js` starts the service and `app.js` configures middleware, static uploads, and route registration.

## Development commands

Use these when running the applications outside Docker:

```powershell
cd api
npm run start:dev
```

```powershell
cd frontend
npm start
```

The database schema is initialized from `database\init\001-schema.sql` only when `database\data` is empty. To reset local persistent data, stop Compose, remove `database\data` and `api\uploads`, then start the application again.

## Upload test images

JPEG fixtures for verifying the administrator image-upload flow are available in `sample-images/`. Use them from **/admin** after creating or selecting a collection. Upload validation inspects file content rather than relying on browser-provided MIME types or file extensions, and automatically derives title/alt text from the filename if those optional fields are empty.


## TODO

Add watchtower to update cloudflare
