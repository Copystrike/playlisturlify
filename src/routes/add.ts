// src/routes/add.ts
import { Context, Hono } from 'hono';
import { env } from 'hono/adapter';
import { createSpotifySdk, searchTrack, findUserPlaylist, addTrackToPlaylist, refreshAccessToken } from '../lib/spotify';
import type { SpotifyApi } from '@spotify/web-api-ts-sdk';

// Define the context type for Hono
type CustomContext = {
    Bindings: CloudflareBindings;
    Variables: {
        currentUser: {
            id: string;
            access_token: string;
            refresh_token: string;
            expires_at: number;
            api_key: string;
        };
        spotifySdk: SpotifyApi;
    };
};

const add = new Hono<CustomContext>();

// Middleware to validate API key and setup Spotify SDK
export const validateApiToken = async (c: any, next: any) => {
    let apiToken = c.req.query('token');
    const authHeader = c.req.header('Authorization');
    const { DB, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = env(c);

    if (!apiToken && authHeader) {
        const parts = authHeader.split(' ');
        if (parts.length === 2 && parts[0].toLowerCase() === 'bearer') {
            apiToken = parts[1];
        }
    }

    if (!apiToken) {
        return c.text('Error: API key (token) is missing in query parameter or Authorization header.', 401);
    }

    const user = await DB.prepare('SELECT * FROM users WHERE api_key = ?').bind(apiToken).first();

    if (!user) {
        return c.text('Error: Invalid API key (token).', 403);
    }

    // Use 'currentUser' as the context key to match the declared type
    c.set('currentUser', user);

    let currentAccessToken = user.access_token;
    let currentRefreshToken = user.refresh_token;
    let currentExpiresAt = user.expires_at;

    const now = Math.floor(Date.now() / 1000);
    const FIVE_MINUTES_IN_SECONDS = 5 * 60;

    if (currentExpiresAt <= now + FIVE_MINUTES_IN_SECONDS) {
        console.log(`Access token for user ${user.id} is expired or nearing expiry. Attempting to refresh.`);
        if (currentRefreshToken) {
            const newTokens = await refreshAccessToken(
                currentRefreshToken,
                SPOTIFY_CLIENT_ID as string,
                SPOTIFY_CLIENT_SECRET as string,
                user.id,
                DB
            );

            if (newTokens) {
                currentAccessToken = newTokens.access_token;
                currentRefreshToken = newTokens.refresh_token || currentRefreshToken;
                currentExpiresAt = now + newTokens.expires_in;
                console.log(`Access token refreshed successfully for user ${user.id}.`);
            } else {
                console.error(`Failed to refresh token for user ${user.id}. User may need to re-authenticate.`);
                return c.text('Error: Your Spotify session has expired. Please log in again via the dashboard.', 401);
            }
        } else {
            console.warn(`User ${user.id} has no refresh token available for automated refresh.`);
            return c.text('Error: Your Spotify session needs re-authentication. Please log in again via the dashboard.', 401);
        }
    } else {
        console.log(`Access token for user ${user.id} is still valid.`);
    }

    const spotifySdk = createSpotifySdk(
        SPOTIFY_CLIENT_ID as string,
        {
            access_token: currentAccessToken,
            refresh_token: currentRefreshToken,
            expires_in: Math.max(0, currentExpiresAt - now),
            token_type: 'Bearer'
            // removed 'scope'
        }
    );
    c.set('spotifySdk', spotifySdk);

    await next();
};

add.on(['GET', 'POST'], '/', validateApiToken, async (c) => {
    let songQuery: string | undefined;
    let playlistName: string | undefined;

    if (c.req.method === 'GET') {
        songQuery = c.req.query('query');
        playlistName = c.req.query('playlist');
    } else if (c.req.method === 'POST') {
        try {
            const body = await c.req.parseBody(); // Handles form-data and URL-encoded
            if (typeof body === 'object' && body !== null) {
                songQuery = body.query as string | undefined;
                playlistName = body.playlist as string | undefined;
            }
        } catch (e) {
            console.error('Error parsing POST body:', e);
            return c.text('Error: Could not parse request body.', 400);
        }
    }

    // Use the correct context key and type assertion
    const authenticatedUser = c.get('currentUser') as CustomContext['Variables']['currentUser'];
    const spotifySdk = c.get('spotifySdk') as SpotifyApi;

    if (!songQuery) { // Changed from songName to songQuery
        return c.text('Error: Song query (query) is missing.', 400); // Updated message
    }
    if (!playlistName) {
        return c.text('Error: Playlist name (playlist) is missing.', 400);
    }

    try {
        const track = await searchTrack(spotifySdk, songQuery); // Changed from songName to songQuery
        if (!track) {
            return c.text(`Error: Song for query "${songQuery}" not found on Spotify.`, 404); // Updated message
        }
        console.log(`Found song: ${track.name} by ${track.artists.map(a => a.name).join(', ')}`);

        const playlist = await findUserPlaylist(spotifySdk, playlistName);
        if (!playlist) {
            return c.text(`Error: Playlist "${playlistName}" not found or not owned by you.`, 404);
        }
        console.log(`Found playlist: ${playlist.name} (ID: ${playlist.id})`);

        const snapshotId = await addTrackToPlaylist(spotifySdk, playlist.id, track.uri);

        if (snapshotId) {
            console.log(`Successfully added "${track.name}" to "${playlist.name}" for user ${authenticatedUser.id}.`);
            return c.text(`Successfully added "${track.name}" to "${playlist.name}".`);
        } else {
            return c.text('Error: Failed to add song to playlist.', 500);
        }

    } catch (error) {
        console.error('Error in /add endpoint:', error);
        return c.text(`Internal server error: ${error instanceof Error ? error.message : String(error)}`, 500);
    }
});

export default add;