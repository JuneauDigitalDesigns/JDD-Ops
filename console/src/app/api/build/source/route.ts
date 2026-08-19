import { NextResponse } from 'next/server';
import { readFile } from 'node:fs/promises';
import path from 'node:path';

// The allowlist of (category, name) pairs. Anything not in here is rejected, which is what
// prevents path traversal on the untrusted query params below.
//
// Imported from lib/export rather than redeclared: this file used to carry a byte-identical
// copy, and the two drifted. Two hand-maintained copies of the same security allowlist is
// exactly the shape of bug that goes unnoticed until it matters.
import { CATALOG as ALLOWED } from '@/lib/export';

export async function GET(req: Request) {
  const url = new URL(req.url);
  const category = url.searchParams.get('category');
  const name = url.searchParams.get('name');

  if (!category || !name) {
    return NextResponse.json({ error: 'Missing category or name.' }, { status: 400 });
  }
  const allowed = ALLOWED[category];
  if (!allowed || !allowed.includes(name)) {
    return NextResponse.json({ error: 'Unknown category or name.' }, { status: 400 });
  }

  const filePath = path.join(
    process.cwd(),
    'src',
    'components',
    'catalog',
    category,
    `${name}.tsx`,
  );

  try {
    const text = await readFile(filePath, 'utf8');
    return new NextResponse(text, {
      status: 200,
      headers: { 'content-type': 'text/plain; charset=utf-8' },
    });
  } catch {
    return NextResponse.json({ error: 'File not found.' }, { status: 404 });
  }
}
