// Every visible Search Console string, as Xander approved it word for word (2026-11-13, "I approve",
// W1–W59 in https://claude.ai/artifact/AGN6puPcUeehTdkQiLNBtP). A change here is a wording change
// and needs his sign-off first; the screens read these constants and nothing else.
import { test } from 'node:test';
import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import { SC, departureNote, departureNoteHosts } from '../src/lib/searchConsoleCopy.ts';

test('the approved strings, word for word', () => {
  assert.equal(SC.section, 'Search'); // W1
  assert.equal(SC.title, 'Google Search Console'); // W2
  assert.deepEqual(SC.pill, { setUp: 'SET UP', notSetUp: 'NOT SET UP', newAddress: 'NEW ADDRESS', stopped: 'STOPPED' }); // W3
  assert.equal(SC.setUpFor('https://www.acmeair.com/', new Date('2026-11-13T15:00:00Z')), 'Set up for https://www.acmeair.com/ on 13 Nov 2026.'); // W4
  assert.equal(SC.notSetUp, 'JDD verifies this site itself. The client does nothing.'); // W5
  assert.equal(SC.newAddress('https://www.acmeair.com/', 'https://acmeair.vercel.app/'),
    'https://www.acmeair.com/ is a new address for this site and needs its own setup. The old one, https://acmeair.vercel.app/, stays until teardown.'); // W6
  assert.deepEqual(SC.steps, {
    token: 'Google token', file: 'Token file on the site', verify: 'Verified as JDD',
    list: 'Added to Search Console', sitemap: 'Sitemap submitted', owner: 'Client added as owner',
  }); // W7
  assert.equal(SC.ownerLabel, 'Client’s Google account'); // W8
  assert.equal(SC.ownerHelp, 'Added as an owner, so the data is theirs too. Leave it empty to add it later.'); // W9
  assert.equal(SC.ownerPlaceholder, 'name@gmail.com'); // mockup, approved with it
  assert.deepEqual([SC.setUpButton, SC.rerunButton], ['Set up Search Console', 'Run setup again']); // W10
  assert.equal(SC.rerunHint, 'Safe to repeat. Each step that is already done is left as it is.'); // W11
  assert.equal(SC.proposalsTitle, 'Proposed pages'); // W21
  assert.equal(SC.proposalsHint, 'From Search Console data. Nothing here publishes a page.'); // W22
  assert.equal(SC.proposalsEmpty, 'No proposals yet. They come from Search Console data, usually 3 to 6 months after launch.'); // W23
  assert.equal(SC.spokeHeading('AC Repair', 'Minneola'), 'AC Repair in Minneola'); // W24
  assert.equal(SC.townHeading('Groveland'), 'A town page for Groveland'); // W25
  assert.equal(SC.foldHeading('Duct Cleaning', 'Minneola'), 'Merge Duct Cleaning in Minneola back'); // W26
  assert.deepEqual(SC.kind, {
    spoke: 'READY TO APPROVE', 'ask-client': 'NEEDS FACTS FROM THE CLIENT', 'town-facts': 'NEEDS TOWN FACTS', fold: 'LOW TRAFFIC',
  }); // W27
  assert.equal(SC.approvedPill, 'APPROVED'); // W27
  assert.equal(SC.evidence(32, 1), '32 impressions, 1 click in the last 90 days.'); // W28 (singular as in the mockup)
  assert.equal(SC.evidence(41, 0), '41 impressions, 0 clicks in the last 90 days.'); // W28
  assert.equal(SC.evidenceTown(58, 'Groveland'), '58 impressions on searches naming Groveland in the last 90 days.'); // W29
  assert.equal(SC.evidenceFold(12), '12 impressions in the 180 days since it went live.'); // W30
  assert.equal(SC.signal('Minneola', 4, 2), 'Calls naming Minneola: 4. Web leads: 2.'); // W31
  assert.deepEqual(SC.table, ['Search', 'Impressions', 'Clicks', 'Position']); // W32
  assert.equal(SC.missingFacts('Winter Garden', 'AC Repair', 1), 'Needs 2 job photos or reviews tagged to both Winter Garden and AC Repair. It has 1.'); // W33
  assert.equal(SC.missingPage('AC Repair'), 'The AC Repair page isn’t built yet, so this can’t be either.'); // W34
  assert.equal(SC.townFacts('Groveland'), 'People search for Groveland, but it has too few facts for a page of its own. It needs 3 facts of 2 kinds: job photos, reviews or sourced notes.'); // W35
  assert.equal(SC.foldBody('Minneola'), 'Merging folds it into the Minneola page, with a permanent redirect.'); // W36
  assert.deepEqual([SC.approve, SC.notNow, SC.ask], ['Approve', 'Not now', 'Ask the client for facts']); // W37
  assert.equal(SC.approved('AC Repair', 'Minneola'), 'Approved. AC Repair in Minneola is a draft in the Studio. It needs its facts, copy and review before it can be exported.'); // W38
  assert.equal(SC.approvedFold('Duct Cleaning', 'Minneola'), 'Approved. Duct Cleaning in Minneola will merge into the Minneola page at the next export.'); // W39
  assert.equal(SC.asked, 'Marked as asked. It won’t be proposed again for 90 days.'); // W40
  assert.equal(SC.setAside, 'Set aside. It won’t be proposed again for 90 days.'); // W41
  assert.equal(SC.teardownLeaves('https://www.acmeair.com/'), 'Google Search Console: JDD leaves https://www.acmeair.com/'); // W42
  assert.equal(SC.teardownLeftBehind('https://www.acmeair.com/'),
    'The client stays an owner of https://www.acmeair.com/ for a while, until they verify it with their own Google account. Send them the note below.'); // W43
  assert.equal(SC.noteTitle, 'Your Google Search Console data'); // W50
  assert.equal(SC.copyNote, 'Copy note'); // W52
});

test('the departure note (W50–W51), and only custom domains JDD actually left get one', () => {
  const note = departureNote('www.acmeair.com');
  assert.deepEqual(note.paragraphs, [
    'We’ve removed Juneau Digital Designs from Google Search Console for www.acmeair.com. Your Google account is still an owner, but only for a limited time.',
    'To keep your search data, verify the site with your own Google account once it’s live at its new home. Open search.google.com/search-console, pick www.acmeair.com, and go to Settings, then Ownership verification. Your search history stays with it, because the address hasn’t changed.',
  ]);
  assert.equal(note.text, `Your Google Search Console data\n\n${note.paragraphs.join('\n\n')}`);
  const steps = [
    { resource: 'gsc.property', target: 'https://www.acmeair.com/', outcome: 'deleted' },
    { resource: 'gsc.property', target: 'https://acmeair.vercel.app/', outcome: 'deleted' },
    { resource: 'gsc.property', target: 'https://other.example.com/', outcome: 'failed' },
    { resource: 'vercel.project', target: 'acmeair', outcome: 'deleted' },
  ];
  assert.deepEqual(departureNoteHosts(steps), ['www.acmeair.com']);
});

test('the screens use the copy module, not literals of their own', () => {
  const read = (p) => readFileSync(new URL(p, import.meta.url), 'utf8');
  const screen = read('../src/components/manage/SearchSection.tsx');
  assert.match(screen, /from '@\/lib\/searchConsoleCopy'/);
  for (const literal of ['Proposed pages', 'Run setup again', 'Ask the client for facts', 'Not now']) {
    assert.ok(!screen.includes(`'${literal}'`) && !screen.includes(`>${literal}<`), `${literal} must come from SC`);
  }
  assert.match(read('../src/components/manage/DangerSection.tsx'), /SC\.teardownLeaves\(/);
  assert.match(read('../src/components/manage/DangerSection.tsx'), /SC\.teardownLeftBehind\(/);
  assert.match(read('../src/app/archive/[id]/page.tsx'), /<DepartureNotes /);
});
