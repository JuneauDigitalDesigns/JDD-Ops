// The calendar wears the same `.onboard-chrome` surface (warm cream + dotfield) as the leads
// funnel and the client index, so sales, scheduling and delivery read as one application. Scoping
// it here keeps the dot field off the manage tables and the build canvas.
export default function CalendarLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="onboard-chrome h-full">
      <div className="dotfield" aria-hidden />
      {children}
    </div>
  );
}
