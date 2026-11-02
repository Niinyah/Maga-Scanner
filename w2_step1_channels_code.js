// W2 step 1 – Recfluence channels: parse, filter, clean, batch
// Mode: Run Once for All Items. Input: one item with the .jsonl file as binary property "data".

const MIN_SUBS = 100000;
const BATCH_SIZE = 200;

// Channels from the Lewis network, always imported even below the filter
const LEWIS_IDS = new Set([
  'UC-yewGHQbNFpDrGM0diZOLA','UC0aVoboXBUx2-tVIWHc3W2Q','UC0rZoXAD5lxgBHMsjrGwWWQ','UC2h3yPmh9TfQv2z3aTDTHHA',
  'UC554eY5jNUfDq3yDOJYirOQ','UC5tEELgWBfKbA9fVPRzBzPQ','UC6cMYsKMx6XicFcFm7mTsmA','UC6wdP5hTf_phre6Q3kFiV2g',
  'UC87YBeLMwXhgaw5tcCxsXgQ','UCAgBUlIpzlJaE0693J3s97w','UCAldq8BAAGdsX9UyK_09-ZA','UCC3L8QaxqEGUiBC252GHy3w',
  'UCDVb4m_5QHhZElT47E1oODg','UCDmCBKaKOtOrEqgsL4-3C8Q','UCEE8w-v6Gg4j3ze3oX-urEw','UCFpvg5yg5fMda91yiI1owSQ',
  'UCG749Dj4V2fKa143f8sE60Q','UCHlZ46QmqDdXFMbsaF8evIg','UCIveFvW-ARp_B_RckhweNJw','UCJdKr0Bgd_5saZYqLCa9mng',
  'UCKEt1xKVBLuL175dkk8rqLg','UCL0u5uz7KZ9q-pe-VC8TY-w','UCL9PlYkRD3Q-RZca6CCnPKw','UCLJkNhB1Eg_mXx0quUju0Og',
  'UCL_f53ZEJxp8TtlOkHwMV9Q','UCLfhh63n0fWn0gXXKQ5NWvw','UCMLbmp5tcLxzahMLTmeM4lg','UCN0-RRaxMgh86eOwndAklxw',
  'UCNAxrHudMfdzNi6NxruKPLw','UCOtFVJUoek4TKZAaeQVhiLA','UCPGxwlhPEJE89bT4gB6rzhg','UCSTy-H5lSiCcozas32sfJlQ',
  'UCT9D87j5W7PtE7NHOR5DUOQ','UCZWlSUNDvCCS1hBiXV0zKcA','UCZeP6H2mELnRI9imY5Iga0g','UCaeO5vkdj5xOQHp4UmIN6dw',
  'UCctjGdm2NlMNzIlxz02IsXA','UCdf14z6V0MWNeVcbAz0r8wQ','UCe02lGcO-ahAURWuxAJnjdA','UCesrUK_dMDBZAf7cnjQPdgQ',
  'UCfYbb7nga6-icsFWWgS-kWw','UCittVh8imKanO_5KohzDbpg','UCka_dz0F1gYuvN8LTefNcJQ','UCl3RCEtooHD5bhPCHJw3btA',
  'UClMWnUHbxJKJLUgloN1mPUA','UCla6APLHX6W3FeNLc8PYuvg','UCmrLCXSDScliR7q8AxxjvXg','UCnQC_G5Xsjhp9fEJKuIcrSw',
  'UCowcNKm1w2GGw5U_XQeduhg','UCpbyOgUSjTSPpvVUAT2OyHw','UCpiCH7qvGVlzMOqy3dncA5Q','UCr4kgAUTFkGIwlWSodg43QA',
  'UCr_Q-bPpcw5fJ-Oow1BW1NQ','UCyhEZKz-LOwgktptEOh6_Iw','UCzQUP1qoWDoEbmsQxvdjxgQ',
]);

// Repair text that was UTF-8 but got decoded as Windows-1252 ("GariÃ©py" -> "Gariépy")
const CP1252 = {0x20AC:0x80,0x201A:0x82,0x0192:0x83,0x201E:0x84,0x2026:0x85,0x2020:0x86,0x2021:0x87,0x02C6:0x88,
  0x2030:0x89,0x0160:0x8A,0x2039:0x8B,0x0152:0x8C,0x017D:0x8E,0x2018:0x91,0x2019:0x92,0x201C:0x93,0x201D:0x94,
  0x2022:0x95,0x2013:0x96,0x2014:0x97,0x02DC:0x98,0x2122:0x99,0x0161:0x9A,0x203A:0x9B,0x0153:0x9C,0x017E:0x9E,0x0178:0x9F};
function decodeRun(run) {
  const bytes = [];
  for (const ch of run) {
    const c = ch.codePointAt(0);
    bytes.push(c < 0x100 ? c : CP1252[c]);
  }
  const out = Buffer.from(bytes).toString('utf8');
  return out.includes('\uFFFD') ? run : out;   // only accept a clean repair
}
function fixText(s) {
  if (!s || !/[ÃÂâ]/.test(s)) return s;
  s = s.replace(/Â(?=\s)/g, '');        // "Â " is a mangled non-breaking space
  // repair each run of suspicious characters separately, so one bad spot can't block the rest
  const cp = Object.keys(CP1252).map(k => String.fromCodePoint(+k)).join('');
  return s.replace(new RegExp(`[\u0080-\u00FF${cp}]+`, 'gu'), decodeRun);
}

const LEAN = { L: 'left', C: 'centre', R: 'right' };

const buf = await this.helpers.getBinaryDataBuffer(0, 'data');
const lines = buf.toString('utf8').split('\n').filter(l => l.trim());

const rows = [];
for (const line of lines) {
  const r = JSON.parse(line);
  const keep = (r.reviewsHuman >= 1 && r.subs >= MIN_SUBS) || LEWIS_IDS.has(r.channelId);
  if (!keep) continue;
  rows.push({
    channelId: r.channelId,
    title: fixText(r.channelTitle),
    subs: r.subs,
    views: r.channelViews,
    lean: LEAN[r.lr] ?? null,
    humanReviews: r.reviewsHuman,
    labelSource: r.reviewsHuman >= 1 ? 'human' : 'auto',
    tags: r.tags ?? [],
    description: fixText(r.description) || null,
    reviewerNote: r.publicReviewerNotes,
    creatorNote: r.publicCreatorNotes,
    inLewis: LEWIS_IDS.has(r.channelId),
  });
}

const CYPHER = `
UNWIND $rows AS r
MERGE (c:Channel {channelId: r.channelId})
SET c.title = r.title, c.subs = r.subs, c.views = r.views,
    c.lean = r.lean, c.humanReviews = r.humanReviews,
    c.labelSource = r.labelSource, c.description = r.description,
    c.reviewerNote = r.reviewerNote, c.creatorNote = r.creatorNote,
    c.inLewis = r.inLewis, c.source = 'Recfluence'
WITH c, r
UNWIND r.tags AS t
MERGE (tag:Tag {name: t})
MERGE (c)-[:TAGGED_AS {source: 'Recfluence'}]->(tag)`;

// One output item per batch; the HTTP Request node runs once per item and sends $json.body
const out = [];
for (let i = 0; i < rows.length; i += BATCH_SIZE) {
  const batch = rows.slice(i, i + BATCH_SIZE);
  out.push({ json: {
    batch: out.length + 1,
    count: batch.length,
    body: { statements: [{ statement: CYPHER, parameters: { rows: batch } }] },
  } });
}
return out;
