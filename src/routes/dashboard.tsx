// src/routes/dashboard.ts
import { Hono } from 'hono';
import { requireAuth } from '../middleware/auth'; // Import the auth middleware
import { deleteCookie } from 'hono/cookie'; // Import deleteCookie

// No explicit CloudflareBindings import needed if middleware handles it
const dashboard = new Hono();

dashboard.use(requireAuth); // Apply authentication middleware to all dashboard routes

dashboard.get('/', (c) => {
  // Get the currentUser from the context, set by requireAuth middleware
  const user = c.get('currentUser');
  const message = c.req.query('message');
  const error = c.req.query('error');

  return c.render(
    <div>
      <h1>Your Spotify Helper Dashboard</h1>
      <p>Welcome, {user.id}!</p>

      {message && <p style={{ color: 'green', fontWeight: 'bold' }}>{message}</p>}
      {error && <p style={{ color: 'red', fontWeight: 'bold' }}>{error}</p>}

      <h2>Your API Key:</h2>
      <p>
        <strong>`{user.api_key}`</strong>
      </p>

      {/* Example API usage */}
      <h3>Example API Usage:</h3>
      <p>
        <code>
          {`${c.req.url.split('/dashboard')[0]}/add?song=QUERY&playlist=PLAYLIST&token=${user.api_key}`}
        </code>
      </p>

      <h4>Example Ideas:</h4>
      <ul>
        <li>
          <code>
            {`${c.req.url.split('/dashboard')[0]}/add?song=artist%3A%22anfa%20rose%22%20track%3A%22baby%22&playlist=My%20Shazam%20Tracks&token=${user.api_key}`}
          </code>
        </li>
        <li>
          <code>
            {`${c.req.url.split('/dashboard')[0]}/add?song=anfa rose track:"baby"&playlist=My Shazam Tracks&token=${user.api_key}`}
          </code>
        </li>
        {/* Add more ideas here if desired */}
      </ul>

      <h3>API Key Actions:</h3>
      <form action="/api/generate" method="post" onsubmit="return confirm('Are you sure you want to regenerate your API key? Your old key will stop working immediately.');">
        <button type="submit">Regenerate API Key</button>
      </form>
      <br />
      <form action="/api/delete" method="post" onsubmit="return confirm('WARNING: This will delete your account and all associated data. Your API key will stop working. Are you absolutely sure?');">
        <button type="submit">Delete Account & API Key</button>
      </form>
      <br />
      {/* New Logout Form */}
      <form action="/logout" method="post">
        <button type="submit">Log Out</button>
      </form>

      <p><a href="/">Back to Home</a></p>
    </div>
  );
});

// Add a new route for logout
dashboard.post('/logout', (c) => {
  deleteCookie(c, 'user_id', { path: '/' }); // Clear the session cookie
  console.log('User logged out by clearing cookie.');
  return c.redirect('/?message=You have been logged out.'); // Redirect to home page with a message
});

export default dashboard;