// The leads screen wears the same `.onboard-chrome` surface (warm cream + dotfield) as the
// client index, so sales and delivery read as one application rather than two products.
// Scoping it here keeps the dot field off the manage tables and the build canvas.
export default function LeadsLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      {children}
    </div>
  );
}
