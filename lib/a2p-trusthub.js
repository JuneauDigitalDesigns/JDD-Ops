// @ts-check
/**
 * A2P 10DLC — the vendor transport: one authenticated Twilio request, with every failure path
 * scrubbed before anything can print it.
 *
 * Moved from the agency repo (`app/lib/a2p-trusthub.mjs`). `A2pVendorError`, the scrubbing
 * `postForm` and `deleteEndUsers` are carried over unchanged in behaviour. What did not move is
 * `createIdentityObjects`, which created all four identity objects in one request because the
 * client's wizard submit was the only moment the data existed. In the console each object is
 * its own click-gated step (`lib/a2p-register.js`), so the one-request bundling has no reason
 * left to exist — and a click-per-object is what lets the operator see each SID land.
 *
 * `fetchImpl` is injectable everywhere so the suite drives the real code with a spy.
 */

import { scrubVendorMessage } from "./a2p-identity.js";

export const TRUSTHUB = "https://trusthub.twilio.com/v1";
export const MESSAGING = "https://messaging.twilio.com/v1";
export const TWILIO_API = "https://api.twilio.com/2010-04-01";

/**
 * @typedef {object} A2pTwilioAuth
 * @property {string} accountSid
 * @property {string} authToken
 */

/**
 * An error carrying a status and an already-scrubbed message.
 *
 * It is scrubbed at construction, not at the log site, because the only reliable way to keep
 * a payload out of a log is for no object in flight to be holding one by the time anything
 * can print it. An unhandled throw in a Next route writes `error.message` to stderr.
 */
export class A2pVendorError extends Error {
  /**
   * @param {string} message Already scrubbed.
   * @param {number} status
   * @param {number | null} [code] Twilio's numeric error code, when it sent one.
   */
  constructor(message, status, code = null) {
    super(message);
    this.name = "A2pVendorError";
    this.status = status;
    this.code = code;
  }
}

/** @param {A2pTwilioAuth} auth */
function basicAuth(auth) {
  return `Basic ${Buffer.from(`${auth.accountSid}:${auth.authToken}`).toString("base64")}`;
}

/** @param {string} text */
function twilioCode(text) {
  try {
    const code = JSON.parse(text)?.code;
    return typeof code === "number" ? code : null;
  } catch {
    return null;
  }
}

/**
 * One Twilio request. Form-encoded body when `params` is given.
 *
 * `params` values may be arrays — Twilio takes repeated keys for list parameters
 * (`MessageSamples`), which `URLSearchParams` produces from repeated `append`s.
 *
 * Every failure path goes through `scrubVendorMessage` with the submitted values, so a vendor
 * 400 that quotes the offending field value back at us cannot reach a log line or a response.
 *
 * @param {object} args
 * @param {"GET" | "POST" | "DELETE"} args.method
 * @param {string} args.url
 * @param {Record<string, string | string[]>} [args.params]
 * @param {A2pTwilioAuth} args.auth
 * @param {typeof fetch} args.fetchImpl
 * @param {string[]} [args.submitted] Values submitted this request, for scrubbing only.
 * @returns {Promise<Record<string, any>>} `{}` for a 204.
 */
export async function twilioRequest({ method, url, params, auth, fetchImpl, submitted = [] }) {
  /** @type {Record<string, string>} */
  const headers = { Authorization: basicAuth(auth) };
  /** @type {string | undefined} */
  let body;
  if (params) {
    const form = new URLSearchParams();
    for (const [key, value] of Object.entries(params)) {
      for (const v of Array.isArray(value) ? value : [value]) form.append(key, v);
    }
    body = form.toString();
    headers["Content-Type"] = "application/x-www-form-urlencoded";
  }

  /** @type {Response} */
  let response;
  try {
    response = await fetchImpl(url, { method, headers, body });
  } catch (error) {
    // A transport error message can quote the URL, never the body — but scrub regardless.
    const message = error instanceof Error ? error.message : "request failed";
    throw new A2pVendorError(`Could not reach Twilio on ${new URL(url).pathname}: ${scrubVendorMessage(message, submitted)}`, 0);
  }

  const text = await response.text();
  if (!response.ok) {
    throw new A2pVendorError(
      `Twilio ${response.status} on ${method} ${new URL(url).pathname}: ${scrubVendorMessage(text, submitted)}`,
      response.status,
      twilioCode(text),
    );
  }
  if (response.status === 204 || !text) return {};
  try {
    return /** @type {Record<string, any>} */ (JSON.parse(text));
  } catch {
    // Not scrubbed-and-included: an unparseable body is not a field-level reason, and
    // including it would reintroduce the leak for no diagnostic gain.
    throw new A2pVendorError(`Twilio returned a non-JSON body on ${new URL(url).pathname}`, 502);
  }
}

/**
 * Best-effort deletion of EndUsers, for cleanup paths that run while a failure is already
 * being reported. `DELETE /v1/EndUsers/{Sid}` is supported: verified live 2026-11-02 (204,
 * then 404 on re-read). Swallows its own errors so a cleanup error never replaces the real one.
 *
 * @param {object} args
 * @param {string[]} args.endUserSids
 * @param {A2pTwilioAuth} args.auth
 * @param {typeof fetch} args.fetchImpl
 */
export async function deleteEndUsers({ endUserSids, auth, fetchImpl }) {
  await Promise.all(
    endUserSids.filter(Boolean).map(async (sid) => {
      try {
        await fetchImpl(`${TRUSTHUB}/EndUsers/${encodeURIComponent(sid)}`, {
          method: "DELETE",
          headers: { Authorization: basicAuth(auth) },
        });
      } catch {
        /* nothing to do and nothing to log: the caller is already failing */
      }
    }),
  );
}
