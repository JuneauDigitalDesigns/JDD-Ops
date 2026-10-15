// Finances wears the same `.onboard-chrome` surface (warm cream + dotfield) as /leads and the
// client index, so the money side of the business reads as part of the same application rather
// than a bolted-on tool. Scoping it here keeps the dot field off the manage tables and the
// build canvas.
export default function FinancesLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full overflow-y-auto">
      <div className="dotfield" aria-hidden />
      {children}
    </div>
  );
}
