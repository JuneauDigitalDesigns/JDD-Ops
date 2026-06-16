import { useEffect, useState } from 'react';

/**
 * True once the page has scrolled past `threshold` px. Uses an IntersectionObserver
 * sentinel (a 1px element pinned to the top of the document) instead of a scroll
 * listener, so there is no per-frame work on the main thread.
 */
export function useScrolled(threshold = 12): boolean {
  const [scrolled, setScrolled] = useState(false);

  useEffect(() => {
    const sentinel = document.createElement('div');
    sentinel.setAttribute('aria-hidden', 'true');
    sentinel.style.cssText = `position:absolute;top:0;left:0;width:1px;height:${threshold}px;pointer-events:none;opacity:0;`;
    document.body.appendChild(sentinel);

    const io = new IntersectionObserver(
      ([entry]) => setScrolled(!entry.isIntersecting),
      { threshold: 0 },
    );
    io.observe(sentinel);

    return () => {
      io.disconnect();
      sentinel.remove();
    };
  }, [threshold]);

  return scrolled;
}
