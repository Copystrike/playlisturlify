/// <reference types="../worker-configuration" />

import { Hono } from 'hono';
import { renderer } from './renderer';
import authRoutes from './routes/auth';
import dashboardRoutes from './routes/dashboard';
import apiRoutes from './routes/api';
import addRoutes from './routes/add';
import { env } from 'hono/adapter';
import { csrf } from 'hono/csrf';
import { getCookie } from 'hono/cookie';

const app = new Hono<{ Bindings: CloudflareBindings; }>();

app.use(renderer);

// Apply CSRF middleware globally
app.use(csrf());

app.get('/', async (c) => {
  const sessionCookie = getCookie(c, '__session');
  if (sessionCookie) {
    return c.redirect('/dashboard');
  }
  const { DB } = env(c);
  try {
    await DB.prepare('SELECT 1').run();
    console.log('D1 connection successful at root route load!');
  } catch (error) {
    console.error('D1 connection failed at root route load:', error);
  }

  return c.render(
    <main class="card">
      <h1>Spotify Shortcut Helper</h1>
      <p>Log in with Spotify to manage your API key and easily add songs to your playlists via iPhone Shortcuts.</p>
      <a href="/login" class="button-link">Log in with Spotify</a>
    </main>
  );
});

// Mount the authentication routes
app.route('/', authRoutes);

// Mount the dashboard routes
app.route('/dashboard', dashboardRoutes);

// Mount the API routes (generate/delete key)
app.route('/api', apiRoutes);

// Mount the /add route
app.route('/add', addRoutes); // Mount the new /add route

export default app;