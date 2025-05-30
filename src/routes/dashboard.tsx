// src/routes/dashboard.ts
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth'; // Import the auth middleware
import { getCookie, deleteCookie } from 'hono/cookie'; // Ensure deleteCookie is imported
import { env } from 'hono/adapter'; // Import env helper



// No explicit CloudflareBindings import needed if middleware handles it
const dashboard = new Hono();

dashboard.use(requireAuth); // Apply authentication middleware to all dashboard routes

dashboard.get('/', (c) => {
  const user = c.get('currentUser');
  const message = c.req.query('message');
  const error = c.req.query('error');

  return c.render(
    <div style={{ fontFamily: 'Arial, sans-serif', maxWidth: '800px', margin: '0 auto', padding: '20px' }}>
      <h1 style={{ textAlign: 'center', color: '#333' }}>PlaylistUrlify Dashboard</h1>
      <p style={{ textAlign: 'center', fontSize: '1.2em' }}>Welcome, <strong>{user.id}</strong>!</p>

      {message && <p style={{ color: 'green', fontWeight: 'bold', textAlign: 'center' }}>{message}</p>}
      {error && <p style={{ color: 'red', fontWeight: 'bold', textAlign: 'center' }}>{error}</p>}

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2>Your API Key</h2>
        <p>
          <strong style={{ fontSize: '1.1em', color: '#555' }}>{user.api_key}</strong>
        </p>
        <p style={{ fontSize: '0.9em', color: '#777' }}>Keep this key secure. Do not share it with anyone.</p>
        <form action="/api/generate" method="post" onsubmit="return confirm('Are you sure you want to regenerate your API key? Your old key will stop working immediately.');" style={{ marginTop: '15px' }}>
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#007BFF', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Regenerate API Key
          </button>
        </form>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2>IOS Shortcut</h2>
        <p>
          Use this shortcut to quickly add songs from your Shazam to your Spotify playlist using PlaylistUrlify:
        </p>
        <a
          href="https://www.icloud.com/shortcuts/5c4be0dca5894788b688c981eb8f39d6"
          target="_blank"
          rel="noopener noreferrer"
          style={{
            display: 'inline-block',
            padding: '10px 20px',
            backgroundColor: '#007BFF',
            color: '#fff',
            textDecoration: 'none',
            borderRadius: '4px',
            fontSize: '1em',
            textAlign: 'center',
          }}
        >
          Get the Shortcut
        </a>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2>Example API Usage</h2>
        <p>
          <strong>Recommended (Header Authentication):</strong>
          <br />
          Send a GET request to:
          <br />
          <code style={{ display: 'block', backgroundColor: '#eee', padding: '10px', borderRadius: '4px' }}>
            {`${c.req.url.split('/dashboard')[0]}/add?query=SONG_QUERY&playlist=PLAYLIST_NAME`}
          </code>
          With an Authorization header:
          <br />
          <code style={{ display: 'block', backgroundColor: '#eee', padding: '10px', borderRadius: '4px' }}>
            {`Authorization: Bearer ${user.api_key}`}
          </code>
        </p>
        <p>
          <strong>Alternative (Query Parameter Authentication):</strong>
          <br />
          <code style={{ display: 'block', backgroundColor: '#eee', padding: '10px', borderRadius: '4px' }}>
            {`${c.req.url.split('/dashboard')[0]}/add?query=QUERY&playlist=PLAYLIST&token=${user.api_key}`}
          </code>
        </p>
      </div>

      <div style={{ marginTop: '30px', padding: '20px', border: '1px solid #ccc', borderRadius: '8px', backgroundColor: '#f9f9f9' }}>
        <h2>API Key Actions</h2>
        <form action="/api/delete" method="post" onsubmit="return confirm('WARNING: This will delete your account and all associated data. Your API key will stop working. Are you absolutely sure?');" style={{ marginBottom: '15px' }}>
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#DC3545', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Delete Account & API Key
          </button>
        </form>
        <form action="/dashboard/logout" method="post">
          <button type="submit" style={{ padding: '10px 20px', backgroundColor: '#6C757D', color: '#fff', border: 'none', borderRadius: '4px', cursor: 'pointer' }}>
            Log Out
          </button>
        </form>
      </div>

      <p style={{ textAlign: 'center', marginTop: '30px' }}>
        <a href="/" style={{ color: '#007BFF', textDecoration: 'none' }}>Back to PlaylistUrlify Home</a>
      </p>
    </div>
  );
});

// Add a new route for logout
dashboard.post('/logout', async (c) => {
  const sessionId = getCookie(c, '__session');
  const { DB } = env(c) as unknown as Cloudflare.Env;

  if (sessionId) {
    const session = await DB.prepare('SELECT user_id FROM sessions WHERE id = ?').bind(sessionId).first<{ user_id: string; }>();

    if (session) {
      await DB.prepare('DELETE FROM sessions WHERE id = ?').bind(sessionId).run();
      console.log(`User ${session.user_id} logged out`);
    }
  }

  // Use deleteCookie to clear the session cookie
  deleteCookie(c, '__session', { path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  return c.redirect('/?message=You have been logged out.');
});

export default dashboard;