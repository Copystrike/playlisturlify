// src/lib/spotify.ts
import {
    SpotifyApi,
    AccessToken,
} from '@spotify/web-api-ts-sdk';

const SPOTIFY_ACCOUNTS_URL = 'https://accounts.spotify.com';
const SPOTIFY_API_URL = 'https://api.spotify.com/v1'; // For potential future direct API calls

/**
 * Generates the Spotify authorization URL.
 * This is used to redirect the user to Spotify for login.
 * @param clientId Your Spotify Client ID.
 * @param redirectUri Your configured Redirect URI.
 * @param scopes Desired Spotify scopes.
 * @returns The Spotify authorization URL.
 */
export function getAuthorizationUrl(
    clientId: string,
    redirectUri: string,
    scopes: string[]
): string {
    const params = new URLSearchParams({
        client_id: clientId,
        response_type: 'code',
        redirect_uri: redirectUri,
        scope: scopes.join(' '),
        show_dialog: 'true', // Optional: Force user to re-authorize
    });
    return `${SPOTIFY_ACCOUNTS_URL}/authorize?${params.toString()}`;
}

/**
 * Exchanges the authorization code for access and refresh tokens.
 * This is a direct fetch call as the Spotify SDK primarily focuses on client-side PKCE
 * or initializing with already-obtained tokens. Our server is the redirect URI target.
 * @param code The authorization code received from Spotify.
 * @param redirectUri Your configured Redirect URI.
 * @param clientId Your Spotify Client ID.
 * @param clientSecret Your Spotify Client Secret.
 * @returns An object containing access_token, refresh_token, expires_in, token_type, scope.
 * @throws An error if token exchange fails.
 */
export async function exchangeCodeForTokens(
    code: string,
    redirectUri: string,
    clientId: string,
    clientSecret: string
) {
    const params = new URLSearchParams({
        grant_type: 'authorization_code',
        code: code,
        redirect_uri: redirectUri,
    });

    const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        },
        body: params.toString(),
    });

    if (!response.ok) {
        const errorData: any = await response.json();
        console.error('Spotify token exchange error:', errorData);
        throw new Error(`Failed to exchange code for tokens: ${errorData.error_description || response.statusText}`);
    }

    return await response.json() as {
        access_token: string;
        token_type: string;
        expires_in: number;
        refresh_token?: string;
        scope: string;
    };
}

/**
 * Creates and returns an authenticated SpotifyApi SDK instance.
 * Note: The SDK itself handles auto-refresh internally if a refresh_token is provided.
 * We will manage D1 persistence of refreshed tokens via a separate check.
 * @param clientId Your Spotify Client ID.
 * @param tokenData An object containing access_token, refresh_token (optional), expires_in, token_type, scope.
 * @returns An initialized SpotifyApi instance.
 */
export function createSpotifySdk(clientId: string, tokenData: AccessToken): SpotifyApi {
    // SDK will handle auto-refresh internally if refresh_token is present in tokenData
    return SpotifyApi.withAccessToken(clientId, tokenData);
}

/**
 * Manually refreshes a Spotify access token and updates the D1 database.
 * @param refreshToken The user's Spotify refresh token.
 * @param clientId Your Spotify Client ID.
 * @param clientSecret Your Spotify Client Secret.
 * @param userId The Spotify user ID.
 * @param db The D1Database instance.
 * @returns The new AccessToken object, or null if refresh fails.
 */
export async function refreshAccessToken(
    refreshToken: string,
    clientId: string,
    clientSecret: string,
    userId: string,
    db: D1Database
): Promise<AccessToken | null> {
    const params = new URLSearchParams({
        grant_type: 'refresh_token',
        refresh_token: refreshToken,
    });

    const response = await fetch(`${SPOTIFY_ACCOUNTS_URL}/api/token`, {
        method: 'POST',
        headers: {
            'Content-Type': 'application/x-www-form-urlencoded',
            'Authorization': 'Basic ' + btoa(`${clientId}:${clientSecret}`),
        },
        body: params.toString(),
    });

    if (!response.ok) {
        const errorData: any = await response.json();
        console.error(`Spotify token refresh failed for user ${userId}:`, errorData);
        return null;
    }

    const newTokenData: AccessToken = await response.json();
    console.log(`Spotify access token refreshed for user: ${userId}. Updating D1.`);

    try {
        const newExpiresAt = Math.floor(Date.now() / 1000) + newTokenData.expires_in;

        // Update both access_token and expires_at, and potentially refresh_token if Spotify issues a new one
        await db.prepare(
            'UPDATE users SET access_token = ?, refresh_token = ?, expires_at = ? WHERE id = ?'
        ).bind(
            newTokenData.access_token,
            newTokenData.refresh_token || refreshToken, // Use new refresh_token if provided, else keep old
            newExpiresAt,
            userId
        ).run();
        console.log(`D1 updated with new access/refresh token for user: ${userId}`);
        return newTokenData;
    } catch (updateError) {
        console.error(`Failed to update D1 with refreshed token for user ${userId}:`, updateError);
        return null; // Still return token data even if DB update fails, to allow API call
    }
}

/**
 * Searches for a track on Spotify.
 * @param sdk The authenticated SpotifyApi SDK instance.
 * @param query The track name to search for.
 * @returns The first matching track object or null if not found.
 */
export async function searchTrack(sdk: SpotifyApi, query: string) {
    const searchResult = await sdk.search(query, ['track'], undefined, 1);
    if (searchResult.tracks && searchResult.tracks.items.length > 0) {
        return searchResult.tracks.items[0];
    }
    return null;
}

/**
 * Finds a user's playlist by name.
 */
export async function findUserPlaylist(sdk: SpotifyApi, playlistName: string) {
    let offset = 0;
    const limit = 50;

    while (true) {
        const playlistsResult = await sdk.currentUser.playlists.playlists(limit, offset);
        const playlist = playlistsResult.items.find(p => p.name.toLowerCase() === playlistName.toLowerCase());

        if (playlist) {
            return playlist;
        }

        if (!playlistsResult.next) {
            break;
        }
        offset += limit;
    }
    return null;
}

/**
 * Adds a track to a specific playlist.
 * @param sdk The authenticated SpotifyApi SDK instance.
 * @param playlistId The ID of the target playlist.
 * @param trackUri The URI of the track to add (e.g., 'spotify:track:...')
 * @returns The snapshot ID of the playlist after adding, or null on failure.
 */
export async function addTrackToPlaylist(sdk: SpotifyApi, playlistId: string, trackUri: string) {
    try {
        await sdk.playlists.addItemsToPlaylist(playlistId, [trackUri]);
        return true;
    } catch (error) {
        console.error(`Error adding track ${trackUri} to playlist ${playlistId}:`, error);
        throw error;
    }
}