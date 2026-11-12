/**
 * OAuth2 helper for theclosetstory.in@gmail.com.
 * Run `node auth-tcs.js` once to get a token-tcs.json saved locally.
 * When the browser opens, sign in as theclosetstory.in@gmail.com.
 */
import { google } from 'googleapis';
import fs from 'fs';
import { createServer } from 'http';
import { URL } from 'url';
import open from 'open';

const CREDENTIALS_PATH = './credentials.json';
const TOKEN_PATH = './token-tcs.json';
const SCOPES = [
  'https://www.googleapis.com/auth/gmail.modify',
  'https://www.googleapis.com/auth/gmail.settings.basic',
  'https://www.googleapis.com/auth/gmail.settings.sharing',
];

function getFreePort() {
  return new Promise((resolve, reject) => {
    const srv = createServer();
    srv.listen(0, () => {
      const port = srv.address().port;
      srv.close(() => resolve(port));
    });
    srv.on('error', reject);
  });
}

export async function getAuthTCS() {
  if (!fs.existsSync(CREDENTIALS_PATH)) {
    throw new Error('credentials.json not found.');
  }
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const auth = new google.auth.OAuth2(client_id, client_secret, 'urn:ietf:wg:oauth:2.0:oob');

  if (fs.existsSync(TOKEN_PATH)) {
    auth.setCredentials(JSON.parse(fs.readFileSync(TOKEN_PATH)));
    return auth;
  }
  throw new Error('No token-tcs.json found. Run: node auth-tcs.js');
}

// --- Run directly to do the OAuth dance ---
if (process.argv[1].endsWith('auth-tcs.js')) {
  const creds = JSON.parse(fs.readFileSync(CREDENTIALS_PATH));
  const { client_id, client_secret } = creds.installed || creds.web;
  const port = await getFreePort();
  const redirectUri = `http://localhost:${port}/oauth2callback`;
  const auth = new google.auth.OAuth2(client_id, client_secret, redirectUri);

  const url = auth.generateAuthUrl({ access_type: 'offline', scope: SCOPES, prompt: 'consent' });
  console.log('\nOpening browser for Google auth...');
  console.log('*** IMPORTANT: Sign in as theclosetstory.in@gmail.com ***');
  console.log('If browser does not open, visit:\n', url, '\n');

  await open(url);

  await new Promise((resolve, reject) => {
    const server = createServer(async (req, res) => {
      const parsed = new URL(req.url, `http://localhost:${port}`);
      const code = parsed.searchParams.get('code');
      if (!code) { res.end('No code.'); return; }
      try {
        const { tokens } = await auth.getToken(code);
        auth.setCredentials(tokens);
        fs.writeFileSync(TOKEN_PATH, JSON.stringify(tokens, null, 2));
        res.end('<h2>Auth complete for theclosetstory.in@gmail.com! You can close this tab.</h2>');
        console.log('token-tcs.json saved.');
        server.close();
        resolve();
      } catch (e) {
        res.end('Error: ' + e.message);
        reject(e);
      }
    });
    server.listen(port, () => console.log(`Waiting for OAuth callback on http://localhost:${port} ...`));
    server.on('error', reject);
  });
}
