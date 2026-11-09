import { createHash } from 'node:crypto';

/**
 * Attaching a close call's recording: this machine → the private store, then the agency records it.
 *
 * The file can't go through the agency (a Vercel Function's request body stops at 4.5 MB). The
 * console runs locally, so it streams the file itself with a token the agency issues for one
 * pathname, and hashes the bytes as they pass. That hash is of what was actually sent to the
 * store, and nothing is held in memory however long the video is.
 *
 * The three outside calls are arguments so the sequence can be tested against the real hashing.
 */

export interface RecordingMeta {
  fileName: string;
  contentType: string;
  sizeBytes: number;
}

export interface RecordingDeps {
  begin: (meta: RecordingMeta) => Promise<{ status: number; body: Record<string, unknown> }>;
  store: (pathname: string, stream: ReadableStream<Uint8Array>, opts: { token: string; contentType: string }) => Promise<void>;
  complete: (input: RecordingMeta & { pathname: string; sha256: string }) => Promise<{ status: number; body: Record<string, unknown> }>;
}

/** Passes the stream through unchanged, counting and hashing what goes by. */
export function hashingStream(body: ReadableStream<Uint8Array>): {
  stream: ReadableStream<Uint8Array>;
  result: () => { sha256: string; bytes: number };
} {
  const hash = createHash('sha256');
  let bytes = 0;
  const stream = body.pipeThrough(
    new TransformStream<Uint8Array, Uint8Array>({
      transform(chunk, controller) {
        hash.update(chunk);
        bytes += chunk.byteLength;
        controller.enqueue(chunk);
      },
    }),
  );
  return { stream, result: () => ({ sha256: hash.digest('hex'), bytes }) };
}

/** Never throws: any failure comes back as a status and `{ error }`, with nothing recorded. */
export async function attachRecording(
  body: ReadableStream<Uint8Array>,
  meta: RecordingMeta,
  deps: RecordingDeps,
): Promise<{ status: number; body: Record<string, unknown> }> {
  const begun = await deps.begin(meta);
  if (begun.status >= 300) return begun;
  const { pathname, uploadToken } = begun.body as { pathname?: string; uploadToken?: string };
  if (!pathname || !uploadToken) return { status: 502, body: { error: 'The agency did not issue an upload.' } };

  const hashed = hashingStream(body);
  try {
    await deps.store(pathname, hashed.stream, { token: uploadToken, contentType: meta.contentType });
  } catch (err) {
    console.error('[recordingUpload] store failed', err);
    return { status: 502, body: { error: 'The upload to storage failed. Nothing was attached.' } };
  }

  const { sha256, bytes } = hashed.result();
  // A dropped connection can end the stream early without an error reaching this far.
  if (bytes !== meta.sizeBytes) {
    return { status: 400, body: { error: 'The upload was incomplete. Nothing was attached.' } };
  }
  return deps.complete({ ...meta, pathname, sha256 });
}
