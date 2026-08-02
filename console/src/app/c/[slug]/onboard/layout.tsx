// Onboard = the provisioning runbook for one client. The `.onboard-chrome` wrapper scopes
// this subtree's form-control styling (see globals.css) and mounts the dot field only here,
// so it never paints over the build canvas or the manage tables.
//
// The chrome is the light warm-cream palette from globals.css — there is no dark theme.
//
// The `.grain` overlay that used to sit after {children} is gone; it was print texture, and
// at z-60 it painted over the navbar and every modal. The dotfield stays — it reads as graph
// paper, which is structure rather than decoration.
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      {children}
    </div>
  );
}
