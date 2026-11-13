'use client';

import { SC, departureNote, departureNoteHosts } from '@/lib/searchConsoleCopy';

/**
 * L11 teardown: the note the operator sends a departing client for each custom domain JDD left in
 * Google Search Console (W50–W52). The console sends nothing itself. The client stays a delegated
 * owner only for Google's grace period, so this tells them to verify with their own account.
 */
export default function DepartureNotes({ steps }: { steps: Array<{ resource: string; target: string; outcome: string }> }) {
  const hosts = departureNoteHosts(steps);
  if (hosts.length === 0) return null;
  return (
    <>
      {hosts.map((host) => {
        const note = departureNote(host);
        return (
          <section key={host} className="panel mb-4 flex flex-col gap-3 p-5">
            <div className="flex max-w-[62ch] flex-col gap-2.5 text-sm text-fg">
              <p className="m-0 font-semibold">{note.title}</p>
              {note.paragraphs.map((p) => (
                <p key={p} className="m-0">
                  {p}
                </p>
              ))}
            </div>
            <div>
              <button
                type="button"
                className="btn btn-sm"
                onClick={() => {
                  void navigator.clipboard?.writeText(note.text).catch(() => {
                    /* clipboard blocked: the text is on screen to select */
                  });
                }}
              >
                {SC.copyNote}
              </button>
            </div>
          </section>
        );
      })}
    </>
  );
}
