/**
 * lib/make-editor-fields.js — the field list Make's editor shows for the Airtable module.
 *
 * A blueprint holds a module's mappings in `mapper.record` (what RUNS) and, separately, a saved
 * copy of the form in `metadata` (what the EDITOR draws). It is saved twice over:
 *
 *   metadata.expect[name=record].spec                 the record collection's fields
 *   metadata.restore.expect.table.nested[record].spec the same, with each select's options
 *
 * The editor draws that saved list and does not re-read Airtable when the module opens. So a
 * column added to `mapper.record` by API runs fine and is invisible: on 2026-11-09 Xander opened the
 * master and could not see `SMS consent` or `Callback number`, both of which had been writing
 * real rows. The form can only submit the fields it drew, so clicking OK there is unsafe.
 *
 * A select holding a mapped expression also needs `mode: "edit"`, in the spec and in
 * `metadata.restore.expect.record.nested`, or the editor draws a dropdown instead of the formula.
 *
 * Pure. `checkEditorShowsMappings` reads this; `withEditorFields` is the repair.
 */

export function savedFieldLists(mod) {
  const expect = (mod?.metadata?.expect ?? []).find((e) => e?.name === 'record')?.spec ?? null;
  const nested = mod?.metadata?.restore?.expect?.table?.nested;
  const restore = (Array.isArray(nested) ? nested : []).find((e) => e?.name === 'record')?.spec ?? null;
  return { expect, restore };
}

/**
 * The module with every mapped column present in both saved lists. Adds only: no existing entry,
 * mapping or filter changes, and an already-listed column is left exactly as it is.
 *
 * @param mod         the Airtable module, from a blueprint read WITH metadata
 * @param fieldMap    this base's `{ byId }`, the base the module's record keys belong to
 * @param fields      the column specs, `CALL_LOG_FIELDS`
 */
export function withEditorFields(mod, { fieldMap, fields }) {
  const next = structuredClone(mod);
  const { expect, restore } = savedFieldLists(next);
  if (!expect || !restore) throw new Error('module has no saved field list to extend');
  const byName = new Map(fields.map((f) => [f.name, f]));

  for (const id of Object.keys(next.mapper?.record ?? {})) {
    const label = fieldMap.byId?.[id];
    const field = byName.get(label);
    if (!field) continue; // Site, or a column this repo doesn't define: not ours to describe
    const select = field.type === 'singleSelect';
    const base = select ? { mode: 'edit', name: id, type: 'select', label } : { name: id, type: 'text', label };
    if (!expect.some((s) => s.name === id)) expect.push({ ...base });
    if (!restore.some((s) => s.name === id)) {
      restore.push(
        select
          ? { ...base, dynamic: true, options: field.options.choices.map(({ name }) => ({ label: name, value: name })), validate: false }
          : { ...base },
      );
    }
    if (select) {
      const rec = (next.metadata.restore.expect.record ??= {});
      (rec.nested ??= {})[id] ??= { mode: 'edit' };
    }
  }
  return next;
}
