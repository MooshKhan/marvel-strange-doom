# Marvel Character Explorer

A MERN learning project: browse 269 imported Marvel characters, search and filter by alignment, open character pages, and keep private notes in your account.

## Run locally

Use Node 24 (`nvm use`). Install dependencies with `npm ci --prefix server` and `npm ci --prefix client`. Copy `server/.env.example` to `server/.env` only if you do not already have an environment file. Set your Atlas URI and a randomly generated session secret. Never place these values in React code or Git.

Run `npm run dev --prefix server` in one terminal and `npm run dev --prefix client` in another. Open the URL printed by Vite. Keep both terminals running during local use.

## Check the app

`npm test` builds React, lints it, and runs isolated HTTP integration tests covering authentication, session rotation, CSRF protection, private-note ownership, validation, rate limits, and production routing. Tests use in-memory model doubles and do not touch Atlas. Production MongoDB connectivity must also be checked after deployment.

## Deploy on Render

1. Publish this repository to GitHub (a private repository works).
2. In Render, create a Blueprint from the repository. `render.yaml` selects the Free web service, builds React, and starts Express.
3. Supply `MONGODB_URI` privately in Render. The Blueprint generates `SESSION_SECRET`; never paste either secret into GitHub or chat.
4. Add the service's outbound IP ranges to the Atlas IP access list. Keep the database user's access restricted to `marvel_explorer`.
5. Wait for Live status. Check `/api/health`, browse a character, and create an account to test notes. Share the service's HTTPS URL with friends.

For a manually created Web Service: build command `npm run build`, start command `npm start`, health check `/api/health`, Node 24.21.0, environment `NODE_ENV=production`, `MONGODB_URI`, and a random `SESSION_SECRET` of at least 32 characters. The server listens on Render's `PORT` and serves the built frontend and API from the same origin.

Free Render services sleep when idle, so the first visit can take time to wake up. This app intentionally has no email or password-reset service yet; save your password. Authentication limits are held per server process, appropriate for this single-instance learning deployment, not a distributed production service.

## How the parts connect

1. **React** displays the gallery and forms. Page, search and alignment are stored in the URL so refresh and browser navigation work.
2. **Express running in Node** receives requests such as `GET /api/characters?search=hulk`. It validates inputs and asks MongoDB for matching records.
3. **Mongoose** defines Character, User and Note records. Each new note has both a character ID and an owner ID.
4. **MongoDB Atlas** stores characters, users, notes and expiring sessions. Character images load from the dataset's CDN, not from MongoDB.
5. **Accounts** hash passwords using scrypt. A protected cookie identifies a server-side session; requests that change data require a CSRF token. Note queries always include the signed-in user's ID. Account passwords are never returned to the frontend.
6. **Deployment** builds React into static files. One Express server serves those files and `/api` on the public HTTPS address. Your laptop can be off.

The original notes created before accounts are preserved in MongoDB without an owner and are excluded from all public/account responses. Once the project owner creates an account, they can deliberately migrate those old notes to that account; they are never automatically assigned to the first visitor.

## API

- `GET /api/health`
- `GET /api/characters?page=1&search=hulk&alignment=good`
- `GET /api/characters/:slug`
- `GET /api/auth/session` (user and CSRF token)
- `POST /api/auth/register`, `POST /api/auth/login`, `POST /api/auth/logout`
- `GET /api/characters/:slug/notes` (signed-in user's latest 50)
- `POST /api/characters/:slug/notes`
- `PATCH /api/characters/:slug/notes/:noteId`
- `DELETE /api/characters/:slug/notes/:noteId`

Writes require the session cookie and `X-CSRF-Token`. Notes accept 1–1000 trimmed characters. Usernames accept 3–30 letters, numbers or underscores; passwords accept 12–128 characters. Login is case-insensitive for usernames.

## Dataset

Imported from the [Akabab superhero dataset](https://github.com/akabab/superhero-api), version 0.3.0, filtered to Marvel Comics. This is an unofficial educational fan project, not affiliated with Marvel. Review the source's licensing and artwork rights before commercial use.
