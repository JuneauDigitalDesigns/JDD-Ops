// The console listens on 127.0.0.1 only.
//
// It has no authentication and holds master credentials for every vendor, so "runs on this
// machine" is its whole security model. Until 2026-11-04 `npm run dev` and `npm start` ran
// `next dev -p 3040` / `next start -p 3040`, and Next binds every interface by default: anyone
// on the same network (a café, a client's office Wi-Fi) could reach it at <your-ip>:3040.
// src/middleware.ts refuses writes whose Host isn't loopback, but Host is a header the caller
// writes, so it stops DNS rebinding, not a LAN peer sending `Host: localhost`. And GET routes,
// `/api/manage/env/reveal` among them, aren't gated by it at all. Binding the socket to
// loopback is what actually keeps the network out.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';

const pkg = JSON.parse(readFileSync(new URL('../package.json', import.meta.url), 'utf8'));

for (const name of ['dev', 'start']) {
  test(`npm run ${name} binds 127.0.0.1 only`, () => {
    const script = pkg.scripts[name];
    assert.match(script, /(^|\s)(-H|--hostname)\s+127\.0\.0\.1(\s|$)/,
      `"${name}": "${script}" must pass -H 127.0.0.1, or Next listens on every interface`);
    assert.doesNotMatch(script, /0\.0\.0\.0|::(\s|$)/, `"${name}" must not bind all interfaces`);
  });
}
