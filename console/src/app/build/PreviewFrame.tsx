'use client';

// Studio-only (never exported to client repos). Renders preview content inside a real
// <iframe> so the component gets its OWN window — Tailwind breakpoints (lg: = 1024px) and
// viewport units (vw/vh) then resolve exactly like the shipped site instead of against the
// studio's browser window. Children are portaled into the iframe body, so they stay in the
// parent React tree (content/context still flow) while living in a separate document.
//
//  • mode="scaled"  → renders at a fixed virtual desktop width, then CSS-scales the whole
//                     iframe down to fit its container (truthful desktop preview in a card).
//  • mode="fluid"   → iframe fills its container 1:1 (full-screen / full-width preview).
import { useEffect, useRef, useState, type CSSProperties, type ReactNode } from 'react';
import { createPortal } from 'react-dom';
import type { Brand } from '@/data/site';
import { paletteVars, typographyVars } from '@/lib/palette';

type Mode = 'scaled' | 'fluid';

/** Copy the `--foo` custom properties from a CSSProperties bag onto a real DOM element. */
function applyVars(el: HTMLElement, vars: CSSProperties) {
  for (const [k, v] of Object.entries(vars)) {
    if (k.startsWith('--') && v != null) el.style.setProperty(k, String(v));
  }
}

export default function PreviewFrame({
  brand,
  mode,
  virtualWidth = 1280,
  className,
  rootClass,
  children,
}: {
  brand: Brand;
  mode: Mode;
  virtualWidth?: number;
  className?: string;
  /** Extra class added to the iframe's <html> (alongside studio-chrome) for scoped preview-only CSS. */
  rootClass?: string;
  children: ReactNode;
}) {
  const outerRef = useRef<HTMLDivElement>(null);
  const iframeRef = useRef<HTMLIFrameElement>(null);
  const moRef = useRef<MutationObserver | null>(null);

  const [visible, setVisible] = useState(mode === 'fluid'); // fluid mounts immediately
  const [mountEl, setMountEl] = useState<HTMLElement | null>(null);
  const [contentH, setContentH] = useState(0);
  const [containerW, setContainerW] = useState(0);

  // Lazy-mount cards when scrolled into view (don't build off-screen iframes).
  useEffect(() => {
    if (visible) return;
    const node = outerRef.current;
    if (!node) return;
    const io = new IntersectionObserver(
      (entries) => {
        if (entries.some((e) => e.isIntersecting)) {
          setVisible(true);
          io.disconnect();
        }
      },
      { rootMargin: '300px' },
    );
    io.observe(node);
    return () => io.disconnect();
  }, [visible]);

  // Track the container width so scaled mode knows how far to shrink the virtual desktop.
  useEffect(() => {
    const node = outerRef.current;
    if (!node) return;
    const ro = new ResizeObserver(() => setContainerW(node.clientWidth));
    ro.observe(node);
    setContainerW(node.clientWidth);
    return () => ro.disconnect();
  }, [visible]);

  // Prepare the iframe document: <base> for asset URLs, cloned head styles (Tailwind +
  // next/font), studio-chrome scope, then expose <body> as the portal mount node.
  useEffect(() => {
    if (!visible) return;
    const iframe = iframeRef.current;
    if (!iframe) return;
    let done = false;

    const trySetup = (): boolean => {
      if (done) return true;
      const doc = iframe.contentDocument;
      if (!doc || !doc.body) return false;
      done = true;

      // Resolve /_next/* font + asset URLs against our real origin (iframe is about:blank).
      let base = doc.head.querySelector('base');
      if (!base) {
        base = doc.createElement('base');
        doc.head.appendChild(base);
      }
      base.setAttribute('href', window.location.origin + '/');

      // Clone the parent's stylesheets in, and keep them synced through dev HMR.
      const cloneMap = new Map<Node, Node>();
      const syncNode = (n: Node) => {
        if (!(n instanceof HTMLElement) || cloneMap.has(n)) return;
        const tag = n.tagName.toLowerCase();
        const isStyle = tag === 'style' || (tag === 'link' && n.getAttribute('rel') === 'stylesheet');
        if (!isStyle) return;
        const clone = n.cloneNode(true);
        doc.head.appendChild(clone);
        cloneMap.set(n, clone);
      };
      Array.from(document.head.childNodes).forEach(syncNode);

      const mo = new MutationObserver((muts) => {
        for (const m of muts) {
          m.addedNodes.forEach(syncNode);
          m.removedNodes.forEach((n) => {
            const c = cloneMap.get(n);
            if (c && c.parentNode) c.parentNode.removeChild(c);
            cloneMap.delete(n);
          });
        }
      });
      mo.observe(document.head, { childList: true });
      moRef.current = mo;

      doc.documentElement.classList.add('studio-chrome');
      if (rootClass) doc.documentElement.classList.add(rootClass);
      doc.documentElement.style.margin = '0';
      doc.body.style.margin = '0';
      doc.body.className = 'bg-bg';
      setMountEl(doc.body);
      return true;
    };

    if (!trySetup()) iframe.addEventListener('load', trySetup);
    return () => {
      iframe.removeEventListener('load', trySetup);
      moRef.current?.disconnect();
      moRef.current = null;
      setMountEl(null);
    };
  }, [visible, rootClass]);

  // (Re)apply brand palette + typography whenever the brand changes (vertical switch, edits).
  useEffect(() => {
    if (!mountEl) return;
    const docEl = mountEl.ownerDocument.documentElement;
    applyVars(docEl, paletteVars(brand));
    applyVars(docEl, typographyVars(brand));
  }, [mountEl, brand]);

  // Measure rendered content height for scaled mode (re-run on resize + late image/font loads).
  useEffect(() => {
    if (mode !== 'scaled' || !mountEl) return;
    const measure = () => setContentH(mountEl.scrollHeight);
    const ro = new ResizeObserver(measure);
    ro.observe(mountEl);
    measure();
    const win = mountEl.ownerDocument.defaultView;
    win?.addEventListener('load', measure);
    return () => {
      ro.disconnect();
      win?.removeEventListener('load', measure);
    };
  }, [mode, mountEl]);

  const scale = mode === 'scaled' && containerW ? containerW / virtualWidth : 1;
  const h = contentH || 600;

  const iframeStyle: CSSProperties =
    mode === 'scaled'
      ? {
          width: virtualWidth,
          height: h,
          border: 0,
          display: 'block',
          transformOrigin: 'top left',
          transform: `scale(${scale})`,
        }
      : { width: '100%', height: '100%', border: 0, display: 'block' };

  const outerStyle: CSSProperties = {
    position: 'relative',
    overflow: 'hidden',
    width: '100%',
    ...(mode === 'scaled' ? { height: h * scale } : { height: '100%' }),
  };

  return (
    <div ref={outerRef} className={className} style={outerStyle}>
      {visible && <iframe ref={iframeRef} title="Component preview" style={iframeStyle} />}
      {mountEl && createPortal(children, mountEl)}
    </div>
  );
}
