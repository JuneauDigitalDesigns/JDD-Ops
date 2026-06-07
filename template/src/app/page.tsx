import { CONTENT } from '@/data/site';
// @studio:imports
// @studio:metadata

// -----------------------------------------------------------------------------
// Home page - the composition surface.
//
// Each SLOT below is where you drop a catalog component. To use one:
//   1. Paste its file into src/components/catalog/<category>/.
//   2. Import it here and replace the placeholder block inside the matching SLOT.
//
// The placeholders below are intentionally plain so the template builds and renders
// out of the box. They read straight from CONTENT and guard optional fields.
//
// The `@studio:*` comment anchors and `@studio:slot:<cat>:start/end` markers let the
// studio export wire components in automatically — keep them intact.
// -----------------------------------------------------------------------------

export default function HomePage() {
  const { brand, services, faq, testimonials } = CONTENT;

  return (
    <main className="font-sans text-ink">
      {/* SLOT: nav -- replace with a Nav* component */}
      {/* @studio:slot:nav:start */}
      <header className="flex items-center justify-between border-b border-rule px-6 py-4">
        <span className="text-lg font-semibold">{brand.name}</span>
        <a href={brand.phoneHref} className="text-accent">{brand.phone}</a>
      </header>
      {/* @studio:slot:nav:end */}

      {/* SLOT: hero -- replace with a Hero* component */}
      {/* @studio:slot:hero:start */}
      <section className="bg-bgSoft px-6 py-20 text-center">
        <h1 className="text-4xl">{brand.name}</h1>
        <p className="mx-auto mt-4 max-w-xl text-inkSoft">{brand.tagline}</p>
        <a
          href={brand.phoneHref}
          className="mt-8 inline-block rounded bg-accent px-6 py-3 text-bg"
        >
          Call {brand.phone}
        </a>
      </section>
      {/* @studio:slot:hero:end */}

      {/* SLOT: trust -- replace with a Trust* component */}
      {/* @studio:slot:trust:start */}
      {/* @studio:slot:trust:end */}

      {/* SLOT: about -- replace with an About* component */}
      {/* @studio:slot:about:start */}
      {/* @studio:slot:about:end */}

      {/* SLOT: services -- replace with a Services* component */}
      {/* @studio:slot:services:start */}
      <section className="px-6 py-16">
        <h2 className="text-2xl">Services</h2>
        <ul className="mt-6 grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
          {services.items.map((s) => (
            <li key={s.n} className="rounded border border-rule p-5">
              <span className="text-sm text-accent">{s.n} - {s.tag}</span>
              <h3 className="mt-2 text-lg">{s.t}</h3>
              <p className="mt-1 text-inkSoft">{s.d}</p>
            </li>
          ))}
        </ul>
      </section>
      {/* @studio:slot:services:end */}

      {/* SLOT: work -- replace with a Work* component */}
      {/* @studio:slot:work:start */}
      {/* @studio:slot:work:end */}

      {/* SLOT: testimonials -- replace with a Testimonials* component.
          Optional in the schema - guard before rendering. */}
      {/* @studio:slot:testimonials:start */}
      {testimonials && testimonials.items.length > 0 && (
        <section className="px-6 py-16">
          <h2 className="text-2xl">What clients say</h2>
          <ul className="mt-6 grid gap-6 sm:grid-cols-2">
            {testimonials.items.map((t, i) => (
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
      {/* @studio:slot:testimonials:end */}

      {/* SLOT: faq -- replace with a Faq* component */}
      {/* @studio:slot:faq:start */}
      <section className="bg-bgSoft px-6 py-16">
        <h2 className="text-2xl">FAQ</h2>
        <dl className="mt-6 space-y-4">
          {faq.items.map((f) => (
            <div key={f.q}>
              <dt className="font-medium">{f.q}</dt>
              <dd className="text-inkSoft">{f.a}</dd>
            </div>
          ))}
        </dl>
      </section>
      {/* @studio:slot:faq:end */}

      {/* SLOT: finalCta -- replace with a FinalCta* component */}
      {/* @studio:slot:finalCta:start */}
      {/* @studio:slot:finalCta:end */}

      {/* SLOT: contact -- replace with a Contact or Cta component.
          A catalog Contact component POSTs to /api/contact. */}
      {/* @studio:slot:contact:start */}
      <section className="bg-bgSoft px-6 py-16 text-center">
        <h2 className="text-2xl">Get in touch</h2>
        <p className="mt-2 text-inkSoft">{brand.address}</p>
        <p className="mt-1">
          <a href={`mailto:${brand.email}`} className="text-accent">{brand.email}</a>
        </p>
      </section>
      {/* @studio:slot:contact:end */}

      {/* SLOT: footer -- replace with a Footer* component */}
      {/* @studio:slot:footer:start */}
      <footer className="border-t border-rule px-6 py-8 text-sm text-inkSoft">
        <p>
          &copy; {new Date().getFullYear()} {brand.long}
          {brand.license ? ` - License ${brand.license}` : ''}
        </p>
      </footer>
      {/* @studio:slot:footer:end */}
    </main>
  );
}
