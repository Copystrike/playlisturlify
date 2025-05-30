// src/middleware/auth.ts
import { createMiddleware } from 'hono/factory';
import { getCookie } from 'hono/cookie'; // Import getCookie
import { env } from 'hono/adapter'; // Import env helper

// Define a type for the user data we'll attach to the context
declare module 'hono' {
    interface ContextRenderer {
        // You might also need this if your renderer is used for conditional rendering based on user
        // e.g., if you want to pass `user` to your JSX layout
    }
    interface ContextVariableMap {
        currentUser: {
            id: string;
            access_token: string;
            refresh_token: string;
            expires_at: number;
            api_key: string;
        };
    }
}

export const requireAuth = createMiddleware<{ Bindings: CloudflareBindings; }>(async (c, next) => {
    const sessionId = getCookie(c, '__session'); // Get session ID from the '__session' cookie

    // Ensure `env(c)` extracts the environment bindings correctly
    const { DB } = env(c); // Correctly destructure DB from env(c)

    if (!sessionId) {
        // Not authenticated, redirect to login
        console.log('No __session cookie, redirecting to login.');
        return c.redirect('/login');
    }

    // Fetch session and user from DB to ensure validity
    const session = await DB.prepare('SELECT user_id FROM sessions WHERE id = ?').bind(sessionId).first<{ user_id: string }>();

    if (!session) {
        // Session not found or invalid, clear cookie and redirect to login
        console.warn(`Session with ID ${sessionId} not found in DB, clearing cookie and redirecting to login.`);
        c.res.headers.append('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax;'); // Clear the cookie
        return c.redirect('/login');
    }

    const user = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(session.user_id).first<{
        id: string;
        access_token: string;
        refresh_token: string;
        expires_at: number;
        api_key: string;
    }>();

    if (!user) {
        // User not found, clear session and redirect to login
        console.warn(`User with ID ${session.user_id} not found in DB, clearing session and redirecting to login.`);
        await DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
        c.res.headers.append('Set-Cookie', '__session=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax;'); // Clear the cookie
        return c.redirect('/login');
    }

    // Attach the current user object to the context for subsequent middleware/routes
    c.set('currentUser', user);
    await next();
});