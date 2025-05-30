// src/routes/auth.ts
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { getAuthorizationUrl, exchangeCodeForTokens, createSpotifySdk } from '../lib/spotify';
import { generateApiKey } from '../lib/utils'; // Make sure this is imported

const auth = new Hono<{ Bindings: CloudflareBindings; }>();

const SPOTIFY_SCOPES = [
    'user-read-private',
    'playlist-read-private',
    'playlist-modify-public',
    'playlist-modify-private'
];

auth.get('/login', (c) => {
    const { SPOTIFY_CLIENT_ID } = env(c);
    const requestUrl = new URL(c.req.url);
    // Construct the redirect_uri based on the current request's host and protocol.
    // The path /auth/callback corresponds to the callback handler in this auth router.
    const redirectUri = `${requestUrl.protocol}//${requestUrl.host}/callback`;

    const authUrl = getAuthorizationUrl(
        SPOTIFY_CLIENT_ID as string,
        redirectUri,
        SPOTIFY_SCOPES
    );
    return c.redirect(authUrl);
});

auth.get('/callback', async (c) => {
    const { code, error } = c.req.query();
    // Remove SPOTIFY_REDIRECT_URI from env destructuring
    const { DB, SPOTIFY_CLIENT_ID, SPOTIFY_CLIENT_SECRET } = env(c);
    const requestUrl = new URL(c.req.url);
    // Construct the redirect_uri based on the current request's host and protocol.
    // This must match the redirect_uri used in the /login route and registered with Spotify.
    const redirectUri = `${requestUrl.protocol}//${requestUrl.host}/callback`;

    if (error) {
        console.error('Spotify OAuth error:', error);
        return c.text(`Spotify authentication failed: ${error}`, 400);
    }

    if (!code) {
        return c.text('No authorization code received from Spotify.', 400);
    }

    try {
        const tokenData = await exchangeCodeForTokens(
            code,
            redirectUri,
            SPOTIFY_CLIENT_ID as string,
            SPOTIFY_CLIENT_SECRET as string
        );

        const spotifySdk = createSpotifySdk(
            SPOTIFY_CLIENT_ID as string,
            { ...tokenData, refresh_token: tokenData.refresh_token ?? '' }
        );
        const userProfile = await spotifySdk.currentUser.profile();
        const spotifyUserId = userProfile.id;
        const expiresAt = Math.floor(Date.now() / 1000) + tokenData.expires_in;

        // Fetch the existing user, including their current API key
        const existingUser = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(spotifyUserId).first<{
            id: string;
            access_token: string;
            refresh_token: string;
            expires_at: number;
            api_key: string;
        }>(); // Cast to the full user type to access api_key

        let apiKeyToSave: string; // This variable will hold the API key we want to store/preserve

        if (existingUser) {
            // User exists, use their existing API key.
            // Only update tokens and expiry, preserving the original API key.
            apiKeyToSave = existingUser.api_key;
            await DB.prepare(
                'UPDATE users SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?'
            ).bind(
                tokenData.access_token,
                tokenData.refresh_token,
                expiresAt,
                spotifyUserId
            ).run();
            console.log(`Updated tokens for existing user ${spotifyUserId} in D1. API key preserved.`);
        } else {
            // New user, generate a NEW API key for them and insert the full record.
            apiKeyToSave = generateApiKey(); // Generate API key ONLY for new users
            await DB.prepare(
                'INSERT INTO users (id, access_token, refresh_token, expires_at, api_key) VALUES (?, ?, ?, ?, ?)'
            ).bind(
                spotifyUserId,
                tokenData.access_token,
                tokenData.refresh_token,
                expiresAt,
                apiKeyToSave // Use the newly generated key for the new user
            ).run();
            console.log(`Inserted new user ${spotifyUserId} into D1 with a new API key.`);
        }

        const sessionId = crypto.randomUUID(); // Generate a random session ID
        await DB.prepare('INSERT INTO sessions (id, user_id) VALUES (?, ?)')
            .bind(sessionId, spotifyUserId)
            .run();

        c.res.headers.append('Set-Cookie', `__session=${sessionId}; Path=/; Max-Age=${60 * 60 * 24 * 30}; HttpOnly; Secure; SameSite=Lax`);

        return c.redirect('/dashboard');

    } catch (err) {
        console.error('Error during Spotify OAuth callback:', err);
        return c.text(`Authentication failed: ${err instanceof Error ? err.message : String(err)}`, 500);
    }
});

export default auth;