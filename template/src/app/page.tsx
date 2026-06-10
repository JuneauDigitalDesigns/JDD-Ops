import { CONTENT } from '@/data/site';
// @studio:imports
// @studio:metadata

// -----------------------------------------------------------------------------
// Home page - the composition surface.
//
// The body between @studio:body:start and @studio:body:end is the composition area.
// The studio export REPLACES this whole region with the selected catalog components,
// in the order chosen on the Finalize tab. The plain placeholders below are only here
// so the bare template builds and renders out of the box; they read straight from
// CONTENT and guard optional fields.
//
// Keep the `@studio:imports`, `@studio:metadata`, and `@studio:body:*` anchors intact —
// the studio export relies on them to wire components in automatically.
// -----------------------------------------------------------------------------

export default function HomePage() {
  return (
    <main className="font-sans text-ink">
      {/* @studio:body:start */}
      <header className="flex items-center justify-between border-b border-rule px-6 py-4">
        <span className="text-lg font-semibold">{CONTENT.brand.name}</span>
        <a href={CONTENT.brand.phoneHref} className="text-accent">{CONTENT.brand.phone}</a>
      </header>

      <section className="bg-bgSoft px-6 py-20 text-center">
        <h1 className="text-4xl">{CONTENT.brand.name}</h1>
        <p className="mx-auto mt-4 max-w-xl text-inkSoft">{CONTENT.brand.tagline}</p>
        <a
          href={CONTENT.brand.phoneHref}
          className="mt-8 inline-block rounded bg-accent px-6 py-3 text-bg"
        >
          Call {CONTENT.brand.phone}
        </a>
      </section>

      <section className="px-6 py-16">
        <h2 className="text-2xl">Services</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {CONTENT.services.items.map((s) => (
            <li key={s.n} className="rounded border border-rule p-5">
              <span className="text-sm text-accent">{s.n} - {s.tag}</span>
              <h3 className="mt-2 text-lg">{s.t}</h3>
              <p className="mt-1 text-inkSoft">{s.d}</p>
            </li>
          ))}
        </ul>
      </section>

      {CONTENT.testimonials && CONTENT.testimonials.items.length > 0 && (
        <section className="px-6 py-16">
          <h2 className="text-2xl">What clients say</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {CONTENT.testimonials.items.map((t, i) => (
              <li key={i} className="rounded border border-rule p-5">
                <p>&quot;{t.q}&quot;</p>
                <p className="mt-2 text-sm text-inkSoft">
                  {t.a}{t.r ? `, ${t.r}` : ''}{t.company ? ` - ${t.company}` : ''}
                </p>
              </li>
            ))}
          </ul>
        </section>
      )}

      <section className="bg-bgSoft px-6 py-16">
        <h2 className="text-2xl">FAQ</h2>
        <dl className="mt-6 space-y-4">
          {CONTENT.faq.items.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="text-inkSoft">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>

      <section className="bg-bgSoft px-6 py-16 text-center">
        <h2 className="text-2xl">Get in touch</h2>
        <p className="mt-2 text-inkSoft">{CONTENT.brand.address}</p>
        <p className="mt-1">
          <a href={`mailto:${CONTENT.brand.email}`} className="text-accent">{CONTENT.brand.email}</a>
        </p>
      </section>

      <footer className="border-t border-rule px-6 py-8 text-sm text-inkSoft">
        <p>
          &copy; {new Date().getFullYear()} {CONTENT.brand.long}
          {CONTENT.brand.license ? ` - License ${CONTENT.brand.license}` : ''}
        </p>
      </footer>
      {/* @studio:body:end */}
    </main>
  );
}
