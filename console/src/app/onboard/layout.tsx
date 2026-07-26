// /onboard = the Onboarding Runbook. The `.onboard-chrome` wrapper scopes this subtree's
// form-control styling (see globals.css) and mounts the decorative dot field + grain only
// here, so they never paint over the /build canvas or the home page.
//
// The chrome is the light warm-cream palette from globals.css — there is no dark theme.
// (This comment used to describe an "Aurora-Glass dark navy" chrome that no longer exists.)
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      {children}
      <div className="grain" aria-hidden />
    </div>
  );
}
