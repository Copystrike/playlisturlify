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
    const userId = getCookie(c, 'user_id'); // Get user ID from the 'user_id' cookie
    const { DB } = env(c);

    if (!userId) {
        // Not authenticated, redirect to login
        console.log('No user_id cookie, redirecting to login.');
        return c.redirect('/login');
    }

    // Fetch user from DB to ensure validity and get current data
    // Using .first<T>() to cast the result to our expected user type
    const user = await DB.prepare('SELECT * FROM users WHERE id = ?').bind(userId).first<{
        id: string;
        access_token: string;
        refresh_token: string;
        expires_at: number;
        api_key: string;
    }>();

    if (!user) {
        // User not found or invalid session, clear cookie and redirect to login
        console.warn(`User with ID ${userId} not found in DB, clearing cookie and redirecting to login.`);
        c.res.headers.append('Set-Cookie', 'user_id=; Path=/; Max-Age=0; HttpOnly; Secure; SameSite=Lax;'); // Clear the cookie
        return c.redirect('/login');
    }

    // Attach the current user object to the context for subsequent middleware/routes
    c.set('currentUser', user);
    await next();
});