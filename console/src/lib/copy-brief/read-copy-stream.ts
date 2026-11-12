/**
 * Read a /api/build/generate-copy response to its end: the applied `generated` overlay, or the
 * run's own error message. For the Review step's part regeneration, which needs the result and
 * not the per-section progress the Prompt step's menu shows. The messages are the ones the Prompt
 * step already uses for the same failures.
 */
const IDLE_TIMEOUT_MS = 90_000;

export async function readCopyStream(res: Response): Promise<{ generated?: Record<string, unknown>; error?: string }> {
  if (!res.body) return { error: 'No response stream from the copy service.' };
  const reader = res.body.getReader();
  const decoder = new TextDecoder();
  let buf = '';
  let generated: Record<string, unknown> | undefined;
  let error: string | undefined;
  let timedOut = false;
  let idle: ReturnType<typeof setTimeout> | undefined;
  const arm = () => {
    clearTimeout(idle);
    idle = setTimeout(() => { timedOut = true; reader.cancel().catch(() => {}); }, IDLE_TIMEOUT_MS);
  };
  arm();
  try {
    while (true) {
      const { done, value } = await reader.read();
      if (done) break;
      arm();
      buf += decoder.decode(value, { stream: true });
      let nl: number;
      while ((nl = buf.indexOf('\n')) >= 0) {
        const line = buf.slice(0, nl).trim();
        buf = buf.slice(nl + 1);
        if (!line) continue;
        let msg: { type?: string; generated?: unknown; message?: unknown };
        try { msg = JSON.parse(line); } catch { continue; }
        if (msg.type === 'done') generated = msg.generated as Record<string, unknown>;
        else if (msg.type === 'error') error = String(msg.message);
      }
    }
  } catch {
    /* cancelled by the watchdog, or the connection dropped */
  } finally {
    clearTimeout(idle);
  }
  if (timedOut) return { error: 'The copy service stopped responding.' };
  if (generated) return { generated };
  return { error: error ?? 'The connection ended before generation finished.' };
}
