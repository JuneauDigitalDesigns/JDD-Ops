/**
 * lib/secrets.js — keep credentials out of anything onboard.js prints.
 *
 * ── Why this exists ─────────────────────────────────────────────────────────
 *
 * On 2026-11-02 a live `onboard.js` run printed two credentials to stdout:
 *
 *   - The GitHub token. `commitAndPush` built `https://<token>@github.com/…` and handed it to
 *     `run()`, which echoes every command it executes before running it.
 *   - The portal test password, printed in plain text by the test-login step.
 *
 * stdout is not a private channel here. The console narrates onboard.js's output into its UI,
 * operators paste run logs into issues and chats, and an agent reading a log to diagnose a run
 * reads whatever is in it. Both values ended up in an AI session transcript that way, and the
 * token had to be rotated.
 *
 * Redacting the echo alone would not have been enough. With the token inside the URL, git puts
 * that URL in its OWN output whenever a push fails — "fatal: unable to access 'https://ghp_…@…'"
 * — and that bypasses any redaction onboard.js applies to its own lines. So the token is kept out
 * of the URL and out of argv altogether, and the echo is redacted as well, as a second line.
 */

/**
 * Replace `user:pass@` / `token@` in any http(s) URL in `text` with `***@`.
 *
 * A guard on everything `run()` echoes, not the primary defence: the primary defence is never
 * putting a credential in a command line in the first place (see gitAuthEnv). This catches the
 * next one somebody adds.
 */
export function redactUrlCredentials(text) {
  return String(text ?? '').replace(/\b(https?:\/\/)[^\s/@]+@/gi, '$1***@');
}

/**
 * Environment that authenticates git to github.com WITHOUT the token appearing in a URL or argv.
 *
 * Uses git's `GIT_CONFIG_COUNT` / `GIT_CONFIG_KEY_n` / `GIT_CONFIG_VALUE_n` (git ≥ 2.31) to set
 * `http.https://github.com/.extraheader` for this one process. Scoped to github.com, so the
 * header is never sent to any other host. Appends to an existing `GIT_CONFIG_COUNT` rather than
 * overwriting it, which would silently discard whatever config the caller had already set.
 *
 * `GIT_TERMINAL_PROMPT=0`: if the token is wrong, fail at once instead of hanging a provisioning
 * run on a username prompt nobody can see.
 *
 * @param {string} token
 * @param {Record<string, string | undefined>} [baseEnv]
 * @returns {Record<string, string>}
 */
export function gitAuthEnv(token, baseEnv = process.env) {
  if (!token) throw new Error('gitAuthEnv: no GitHub token');
  const n = Number.parseInt(baseEnv.GIT_CONFIG_COUNT ?? '0', 10) || 0;
  const basic = Buffer.from(`x-access-token:${token}`).toString('base64');
  return {
    GIT_CONFIG_COUNT: String(n + 1),
    [`GIT_CONFIG_KEY_${n}`]: 'http.https://github.com/.extraheader',
    [`GIT_CONFIG_VALUE_${n}`]: `Authorization: Basic ${basic}`,
    GIT_TERMINAL_PROMPT: '0',
  };
}
