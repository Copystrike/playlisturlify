// src/routes/api.ts
import { Hono } from 'hono';
import { env } from 'hono/adapter';
import { requireAuth } from '../middleware/auth'; // Import the auth middleware
import { generateApiKey } from '../lib/utils'; // Import the API key generator
import { deleteCookie } from 'hono/cookie'; // For clearing cookie on delete

const api = new Hono<{ Bindings: CloudflareBindings; }>();

api.use(requireAuth); // Apply authentication middleware to all API routes

// Regenerate API key
api.post('/generate', async (c) => {
    const user = c.get('currentUser'); // Get the current user from context
    const { DB } = env(c);

    try {
        const newApiKey = generateApiKey();

        await DB.prepare('UPDATE users SET api_key = ? WHERE id = ?')
            .bind(newApiKey, user.id)
            .run();

        console.log(`API key regenerated for user: ${user.id}`);
        return c.redirect('/dashboard?message=API key regenerated successfully!');
    } catch (error) {
        console.error('Error regenerating API key:', error);
        return c.redirect('/dashboard?error=Failed to regenerate API key.');
    }
});

// Delete user account and API key
api.post('/delete', async (c) => {
    const user = c.get('currentUser'); // Get the current user from context
    const { DB } = env(c);

    try {
        await DB.prepare('DELETE FROM users WHERE id = ?')
            .bind(user.id)
            .run();

        console.log(`User account deleted: ${user.id}`);

        // Clear the user_id cookie upon account deletion
        deleteCookie(c, 'user_id', { path: '/' });

        return c.redirect('/?message=Your account has been successfully deleted.'); // Redirect to home
    } catch (error) {
        console.error('Error deleting user account:', error);
        return c.redirect('/dashboard?error=Failed to delete account.');
    }
});

export default api;