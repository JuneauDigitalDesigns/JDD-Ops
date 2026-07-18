// /onboard = the Onboarding Runbook. Uses the global Aurora-Glass dark chrome (navy body
// from globals.css). The `.onboard-chrome` wrapper scopes the dark form-control styling to
// this subtree, and mounts the decorative dot field + grain only here (so they never paint
// over the light /build canvas or the home page).
export default function OnboardLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      {children}
      <div className="grain" aria-hidden />
    </div>
  );
}
