// Re-export shim. The implementation lives in @jdd/ui so the console, the template and
// every exported client repo share one copy. Kept at this path so catalog components can go
// on importing '@/lib/…' unchanged — and so verifyCatalogImports still finds it.
export * from '@jdd/ui/img';
