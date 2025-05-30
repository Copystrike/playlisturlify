# Spotify Add To Playlist Helper

## A Cloudflare Workers Application for Adding Songs to Spotify Playlists via URL

This project provides a serverless backend for easily adding songs to your Spotify playlists using custom API keys, designed to be integrated seamlessly with tools like iPhone Shortcuts. Built on Hono, Cloudflare Workers, and Cloudflare D1.

---

## Project Summary

| Area           | Stack                                                    |
| -------------- | -------------------------------------------------------- |
| Framework      | **Hono** (with JSX templating)                           |
| Hosting        | Cloudflare Workers                                       |
| DB             | Cloudflare D1 (SQLite)                                   |
| OAuth Provider | Spotify           d                                       |

---

## Functional Overview

This application aims to simplify adding music to Spotify playlists, especially from mobile devices without opening the Spotify app.

**Motivation:** Shazam (Apple) and other iOS actions or shortcuts do not directly provide a way to add shazamed or identified songs to Spotify playlists. This application acts as a bridge, allowing you to create an iOS shortcut that sends the song information to this web app, which then handles adding it to your specified Spotify playlist.

*   **Spotify Authentication:** Users can securely authenticate with their Spotify account using the Authorization Code Flow.
*   **Personal API Token:** Upon first login, each user is issued a unique, secure API token. This token acts as a lightweight, per-user authentication mechanism for the `/add` endpoint.
*   **API Token Management:** Users can view their API token on a dashboard, regenerate it (invalidating the old one), or delete their entire account and token.
*   **iPhone Shortcut Integration:** The core functionality enables a simple HTTP GET request from an iPhone Shortcut (or similar automation tool) to add a song to a specified playlist:
    ```
    https://yourapp.com/add?song=SONG_NAME&playlist=PLAYLIST_NAME&token=YOUR_API_KEY
    ```
*   **Automatic Token Refresh:** The application automatically handles the refreshing of Spotify access tokens in the background, ensuring long-lived API key validity.

---

## Usage with iOS Shortcuts

This project is specifically designed to work with Apple's iOS Shortcuts. You can use the provided template to quickly set up a shortcut that adds a song to your Spotify playlist.

### Shortcut Template

[Download the "Add to Spotify Playlist" Shortcut Template](https://www.icloud.com/shortcuts/8da23ef90de341e9819a3de14db9563c)

### How to Use the Shortcut

1.  **Download the Shortcut:** Tap the link above on your iOS device to add the shortcut to your Shortcuts app.
2.  **Edit the Shortcut:**
    *   Open the Shortcuts app and find the "Add to Spotify Playlist" shortcut.
    *   Edit the "URL" action:
        *   Replace `yourapp.com` with the actual domain of your deployed Cloudflare Worker (e.g., `your-worker-name.workers.dev` or your custom domain).
        *   Replace `YOUR_API_KEY` with the API key generated from your dashboard (`/dashboard`) after logging into the web application.
    *   Edit the "Text" action for `Playlist Name`:
        *   Enter the exact name of the Spotify playlist you want to add songs to.
3.  **Run the Shortcut:**
    *   You can run this shortcut manually from the Shortcuts app, or by integrating it with other actions (e.g., after Shazaming a song, share it to this shortcut).
    *   When prompted, enter the song name.

The shortcut will then call your deployed Worker, which will search for the song on Spotify and add it to your specified playlist.

---

## Cloudflare D1 Schema

The application uses a single `users` table to store Spotify user authentication details and their associated API key.

```sql
CREATE TABLE users (
  id TEXT PRIMARY KEY,           -- Spotify user ID
  access_token TEXT NOT NULL,
  refresh_token TEXT NOT NULL,
  expires_at INTEGER NOT NULL,   -- UNIX timestamp (when access_token expires)
  api_key TEXT NOT NULL          -- Secure token used in /add endpoint
);
```

---

## Routes and Their Purpose

| Route           | Method | Description                                                |
| --------------- | ------ | ---------------------------------------------------------- |
| `/`             | GET    | Landing page with "Log in with Spotify" button.            |
| `/login`        | GET    | Initiates the Spotify OAuth Authorization Code Flow.       |
| `/callback`     | GET    | Handles the redirect from Spotify after user authorization, exchanges code for tokens, saves/updates user data in D1, and redirects to dashboard. |
| `/dashboard`    | GET    | User's dashboard to view their API key, regenerate it, or delete their account. Requires authentication. |
| `/dashboard/logout`| POST   | Clears the session cookie to log the user out.            |
| `/api/generate` | POST   | Regenerates the API key for the current authenticated user. Requires authentication. |
| `/api/delete`   | POST   | Deletes the current user's account and all associated data from D1. Requires authentication. |
| `/add`          | GET    | The primary endpoint for adding songs. Accepts `song`, `playlist` (query parameters), and `token` (API key) for authentication. |

---

## Local Development Setup

To get the project running on your local machine:

### 1. Prerequisites

*   Node.js (v18.0.0 or higher recommended)
*   npm (or yarn/pnpm)
*   A Spotify Developer Account: [https://developer.spotify.com/dashboard/](https://developer.spotify.com/dashboard/)
*   A Cloudflare account (for D1 database, though local D1 emulator works without one)

### 2. Clone the Repository

```bash
git clone https://github.com/your-username/spotify-shortcut-helper.git
cd spotify-shortcut-helper
```

### 3. Install Dependencies

```bash
npm install
```

### 4. Spotify App Configuration

1.  Go to your [Spotify Developer Dashboard](https://developer.spotify.com/dashboard/).
2.  Create a new application.
3.  In your app's settings, add the following to **Redirect URIs**:
    *   `http://localhost:8787/callback`
    *   (Optional, for future deployment) `https://your-app-domain.com/callback` (replace with your actual domain)
4.  Note down your **Client ID** and **Client Secret**.

### 5. Cloudflare D1 Setup (Local)

1.  **Create a D1 Database:** This needs to be done once to get a `database_id`.
    ```bash
    wrangler d1 create spotify-adder-db
    ```
    *   Note the `database_id` from the output (e.g., `fc67ed8f-f638-438b-995b-cd343fe2b37b`).

2.  **Configure `wrangler.jsonc`:**
    Open `wrangler.jsonc` and update the `d1_databases` section with your `database_id`:
    ```jsonc
    {
      "$schema": "node_modules/wrangler/config-schema.json",
      "name": "spotify-adder",
      "compatibility_date": "2024-04-01",
      "main": "./src/index.tsx",
      "d1_databases": [
        {
          "binding": "DB",
          "database_name": "spotify-adder-db",
          "database_id": "YOUR_D1_DATABASE_ID_HERE", # <--- REPLACE THIS
          "migrations_dir": "migrations"
        }
      ]
    }
    ```

3.  **Create D1 Migrations Directory:**
    ```bash
    mkdir -p migrations
    ```

4.  **Create `schema.sql`:**
    Create a file named `schema.sql` in the project root (`spotify-adder/schema.sql`) with the D1 schema:
    ```sql
    -- schema.sql
    CREATE TABLE IF NOT EXISTS users (
      id TEXT PRIMARY KEY,
      access_token TEXT NOT NULL,
      refresh_token TEXT NOT NULL,
      expires_at INTEGER NOT NULL,
      api_key TEXT NOT NULL
    );
    ```

5.  **Generate Initial Migration File:**
    ```bash
    wrangler d1 migrations create spotify-adder-db init_schema
    ```
    This will create a file like `migrations/<timestamp>_init_schema.sql`.

6.  **Populate Migration File:**
    **Manually copy the entire content of `schema.sql` into the newly created `migrations/<timestamp>_init_schema.sql` file.**
    (Do not leave the migration file empty).

7.  **Apply Migrations to Local D1 Emulator:**
    ```bash
    wrangler d1 migrations apply spotify-adder-db --local
    ```
    Confirm you want to apply the migration. You should see "status: OK" or similar success message.

8.  **Verify Table Creation (Optional but recommended):**
    ```bash
    wrangler d1 execute spotify-adder-db --local --command "SELECT name FROM sqlite_master WHERE type='table' AND name='users';"
    ```
    Expected output: `[ { "name": "users" } ]`

### 6. Environment Variables

Create a `.dev.vars` file in your project root (`spotify-adder/.dev.vars`) and fill it with your Spotify app credentials:

```
# .dev.vars
SPOTIFY_CLIENT_ID="YOUR_SPOTIFY_CLIENT_ID"
SPOTIFY_CLIENT_SECRET="YOUR_SPOTIFY_CLIENT_SECRET"
SPOTIFY_REDIRECT_URI="http://localhost:8787/callback"
```

### 7. Generate Cloudflare Bindings Types

Run this command to update your TypeScript types based on your `wrangler.jsonc` and `.dev.vars`:

```bash
npm run cf-typegen
```

### 8. Run the Development Server

```bash
npm run dev
```
The application will be accessible at `http://localhost:8787` (or similar port).

---

## Deployment to Cloudflare Workers

1.  **Set Production Secrets:**
    For production, environment variables are stored as secrets in your Cloudflare Worker. These should match your production `SPOTIFY_REDIRECT_URI`.

    ```bash
    wrangler secret put SPOTIFY_CLIENT_ID
    wrangler secret put SPOTIFY_CLIENT_SECRET
    wrangler secret put SPOTIFY_REDIRECT_URI
    ```
    (Enter your respective values when prompted. The `SPOTIFY_REDIRECT_URI` for production must match the one configured in your Spotify Developer Dashboard for your live domain.)

2.  **Apply Migrations to Remote D1:**
    If you haven't already, apply your database schema to your live Cloudflare D1 instance.

    ```bash
    wrangler d1 migrations apply spotify-adder-db --remote
    ```

3.  **Deploy the Worker:**
    ```bash
    npm run deploy
    ```
    Wrangler will build your project using Vite and deploy it to your Cloudflare account. Your app will be accessible at the Worker's URL (e.g., `your-app-name.your-worker-subdomain.workers.dev`). You can then configure a custom domain via Cloudflare DNS settings if desired.

---

## Contributing

(Optional: Add sections for how others can contribute, e.g., bug reports, feature requests, pull requests.)