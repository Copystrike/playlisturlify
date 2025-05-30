import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth';
import { getCookie, deleteCookie } from 'hono/cookie';
import { env } from 'hono/adapter';

import './../style.css';


const dashboard = new Hono();

dashboard.use(requireAuth);

dashboard.get('/', (c) => {
  const user = c.get('currentUser');
  const message = c.req.query('message');
  const error = c.req.query('error');

  return c.render(
    <div className="dashboard-container">
      <h1 className="dashboard-title">PlaylistUrlify Dashboard</h1>
      <p className="dashboard-welcome">Welcome, <strong>{user.id}</strong>!</p>

      {message && <p className="success">{message}</p>}
      {error && <p className="error">{error}</p>}

      <div className="api-key-container">
        <h2>Your API Key</h2>
        <p>
          <strong className="api-key breakable">{user.api_key}</strong>
        </p>
        <p className="api-key-note">Keep this key secure. Do not share it with anyone.</p>
        <form action="/api/generate" method="post" onsubmit="return confirm('Are you sure you want to regenerate your API key? Your old key will stop working immediately.');">
          <button type="submit" className="api-button">Regenerate API Key</button>
        </form>
      </div>

      <div className="ios-shortcut-container">
        <h2>IOS Shortcut</h2>
        <p>Use this shortcut to quickly add songs from your Shazam to your Spotify playlist using PlaylistUrlify:</p>
        <a
          href="https://www.icloud.com/shortcuts/5c4be0dca5894788b688c981eb8f39d6"
          target="_blank"
          rel="noopener noreferrer"
          className="api-button"
        >
          Get the Shortcut
        </a>
      </div>

      <div className="api-usage-container">
        <h2>Example API Usage</h2>
        <p>
          <strong>Recommended (Header Authentication):</strong>
          <br />
          Send a GET request to:
          <br />
          <code className="api-code breakable">
            {`${c.req.url.split('/dashboard')[0]}/add?query=SONG_QUERY&playlist=PLAYLIST_NAME`}
          </code>
          With an Authorization header:
          <br />
          <code className="api-code breakable">
            {`Authorization: Bearer ${user.api_key}`}
          </code>
        </p>
        <p>
          <strong>Alternative (Query Parameter Authentication):</strong>
          <br />
          <code className="api-code breakable">
            {`${c.req.url.split('/dashboard')[0]}/add?query=QUERY&playlist=PLAYLIST&token=${user.api_key}`}
          </code>
        </p>
      </div>

      <div className="api-actions-container">
        <h2>API Key Actions</h2>
        <form action="/api/delete" method="post" onsubmit="return confirm('WARNING: This will delete your account and all associated data. Your API key will stop working. Are you absolutely sure?');">
          <button type="submit" className="api-button" style={{ backgroundColor: '#DC3545' }}>Delete Account & API Key</button>
        </form>
        <form action="/dashboard/logout" method="post">
          <button type="submit" className="api-button" style={{ backgroundColor: '#6C757D' }}>Log Out</button>
        </form>
      </div>
    </div>
  );
});

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

  deleteCookie(c, '__session', { path: '/', httpOnly: true, secure: true, sameSite: 'Lax' });
  return c.redirect('/?message=You have been logged out.');
});

export default dashboard;