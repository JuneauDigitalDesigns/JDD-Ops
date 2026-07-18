// /manage = ops management tools (portal-link repair, and more later). Reuses the same
// `.onboard-chrome` dark scope as /onboard so form controls + panels theme correctly and
// the decorative dot field + grain paint only within this subtree.
export default function ManageLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      {children}
      <div className="grain" aria-hidden />
    </div>
  );
}
