#!/usr/bin/env node
/**
 * scripts/google-sign-in.js — the one-time Google sign-in for JDD's Search Console account (L11).
 *
 *   npm run google-sign-in        (from the ops root, signed in to the browser as the JDD Workspace account)
 *
 * The organization blocks service-account keys, so one JDD Workspace account verifies every client
 * site. This runs the OAuth loopback flow with PKCE on 127.0.0.1 only, asks for exactly the two
 * scopes lib/search-console.js uses, and saves the refresh token to a file OUTSIDE every repo
 * (default C:/Users/Xander/.jdd/google-search-console-token.json; it refuses a path inside a git
 * checkout). It prints neither the token nor the client secret. Re-run it only if Google revokes
 * the token; the agency's Vercel copy (nightly job) then needs the new one too.
 */
import dotenv from 'dotenv';
dotenv.config({ override: true });
import { readFileSync, writeFileSync, existsSync, mkdirSync } from 'node:fs';
import { dirname, resolve } from 'node:path';
import { createServer } from 'node:http';
import { randomBytes, createHash } from 'node:crypto';
import { spawn } from 'node:child_process';

import { GSC_SCOPES as SCOPES } from '../lib/search-console.js';

const argv = process.argv.slice(2);
const arg = (n) => { const i = argv.indexOf(`--${n}`); return i >= 0 ? argv[i + 1] : undefined; };
const env = process.env;
const envPath = '.env';

const clientFile = env.GOOGLE_OAUTH_CLIENT_FILE;
if (!clientFile) { console.error('GOOGLE_OAUTH_CLIENT_FILE is not set in that .env'); process.exit(2); }
const raw = JSON.parse(readFileSync(clientFile, 'utf8'));
const client = raw.installed;
if (!client) { console.error('that client file is not a Desktop app client (no "installed" block)'); process.exit(2); }

const out = resolve(arg('out') ?? env.GOOGLE_SEARCH_CONSOLE_TOKEN_FILE ?? 'C:/Users/Xander/.jdd/google-search-console-token.json');
// Refuse to write inside a git checkout: the token is a credential.
for (let d = dirname(out); ; d = dirname(d)) {
  if (existsSync(resolve(d, '.git'))) { console.error(`refusing: ${out} is inside a git checkout (${d})`); process.exit(2); }
  if (dirname(d) === d) break;
}

const verifier = randomBytes(48).toString('base64url');
const challenge = createHash('sha256').update(verifier).digest('base64url');
const state = randomBytes(16).toString('hex');

const server = createServer();
server.listen(0, '127.0.0.1', () => {
  const redirectUri = `http://127.0.0.1:${server.address().port}`;
  const url = `${client.auth_uri}?${new URLSearchParams({
    client_id: client.client_id, redirect_uri: redirectUri, response_type: 'code', scope: SCOPES.join(' '),
    access_type: 'offline', prompt: 'consent', state, code_challenge: challenge, code_challenge_method: 'S256',
  })}`;
  console.log('Opening Google sign-in in your browser. Sign in as the JDD Workspace account.');
  console.log(`If no browser opens, paste this into one:\n${url}\n`);
  spawn('rundll32', ['url.dll,FileProtocolHandler', url], { detached: true, stdio: 'ignore' }).unref();

  server.on('request', async (req, res) => {
    const q = new URL(req.url, redirectUri).searchParams;
    if (!q.has('code') && !q.has('error')) { res.writeHead(404).end(); return; }
    const done = (code, msg) => { res.writeHead(code, { 'content-type': 'text/plain' }).end(msg); server.close(); };
    if (q.get('state') !== state) { console.error('state mismatch; nothing saved'); done(400, 'State mismatch. Nothing was saved.'); process.exitCode = 1; return; }
    if (q.get('error')) { console.error(`Google returned: ${q.get('error')}; nothing saved`); done(400, 'Sign-in was not completed. Nothing was saved.'); process.exitCode = 1; return; }
    const r = await fetch(client.token_uri, { method: 'POST', headers: { 'content-type': 'application/x-www-form-urlencoded' },
      body: new URLSearchParams({ grant_type: 'authorization_code', code: q.get('code'), redirect_uri: redirectUri,
        client_id: client.client_id, client_secret: client.client_secret, code_verifier: verifier }) });
    const j = await r.json();
    if (!r.ok || !j.refresh_token) {
      console.error(`token exchange ${r.status}: ${j.error ?? 'no refresh token returned'}; nothing saved`);
      done(500, 'Sign-in failed. Nothing was saved.'); process.exitCode = 1; return;
    }
    const granted = (j.scope ?? '').split(' ');
    const missing = SCOPES.filter((s) => !granted.includes(s));
    mkdirSync(dirname(out), { recursive: true });
    writeFileSync(out, JSON.stringify({ refresh_token: j.refresh_token, scope: j.scope, client_id: client.client_id, obtained_at: new Date().toISOString() }, null, 2), { mode: 0o600 });
    console.log(`Saved the refresh token to ${out}`);
    if (missing.length) console.log(`WARNING: these scopes were not granted: ${missing.join(', ')}`);
    if (env.GOOGLE_SEARCH_CONSOLE_TOKEN_FILE !== out.replace(/\\/g, '/') && env.GOOGLE_SEARCH_CONSOLE_TOKEN_FILE !== out) {
      console.log(`Add this line to ${envPath}:\nGOOGLE_SEARCH_CONSOLE_TOKEN_FILE=${out.replace(/\\/g, '/')}`);
    }
    done(200, 'Signed in. You can close this tab.');
  });
});
