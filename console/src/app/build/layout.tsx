// /build = the Studio site builder. Re-establishes the light "working canvas" + studio
// chrome and opens the `.studio-chrome` scope, which (via globals.css) re-asserts the
// client-preview palette + typography and neutralizes the dark global chrome inside this
// subtree. The live per-vertical preview palette is applied by StudioApp on its <main>.
export default function BuildLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="studio-chrome h-full bg-uiCanvas font-chrome text-uiInk antialiased">
      {children}
    </div>
  );
}
