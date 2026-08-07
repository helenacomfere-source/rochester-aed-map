/*
 * stats.js — fills in the live numbers on the homepage from data/aeds.json.
 *
 * Nothing here is typed by hand, so the homepage can never drift out of sync
 * with the real data. Add an AED to the JSON file and the homepage updates on
 * the next refresh.
 *
 * Example records are excluded from every count. They are development
 * placeholders, and counting them would inflate the number with AEDs that do
 * not exist — the exact thing this project is trying not to do.
 */

// What OpenStreetMap held for the whole city before this project began.
// This is a fixed historical fact, not a live number, so it stays hard-coded.
const BASELINE_OSM_ROCHESTER = 1;

function pluralize(n, singular, plural) {
  return n === 1 ? singular : (plural || singular + 's');
}

function setText(id, text) {
  const el = document.getElementById(id);
  if (el) el.textContent = text;
}

function buildBreakdown(counts) {
  // Only mention categories that actually have something in them, so the line
  // stays short and never reads "0 verified · 0 reported".
  const parts = [];
  if (counts.fresh) parts.push(`${counts.fresh} verified in person`);
  if (counts.recheck) parts.push(`${counts.recheck} due for a recheck`);
  if (counts.reported) parts.push(`${counts.reported} community reported`);
  if (counts.unverified) parts.push(`${counts.unverified} awaiting a first check`);
  return parts.join(' · ');
}

async function fillStats() {
  let aeds;
  try {
    aeds = await loadAEDs();
  } catch (err) {
    // Leave whatever fallback text is in the HTML rather than showing a broken
    // dash where a number should be.
    return;
  }

  const real = aeds.filter((a) => a.status !== 'example');

  const counts = { fresh: 0, recheck: 0, reported: 0, unverified: 0 };
  real.forEach((aed) => {
    const key = trustLabel(aed).key;
    if (key === 'fresh') counts.fresh++;
    else if (key === 'aging' || key === 'stale') counts.recheck++;
    else if (key === 'reported') counts.reported++;
    else counts.unverified++;
  });

  const total = real.length;

  setText('stat-count', String(total));
  setText('stat-label', `${pluralize(total, 'AED')} on the map in the Rochester community`);

  const breakdown = buildBreakdown(counts);
  setText('stat-breakdown', breakdown);

  // The comparison is only worth drawing once we are actually ahead of it.
  const note = document.getElementById('stat-note');
  if (note) {
    if (total > BASELINE_OSM_ROCHESTER) {
      note.innerHTML =
        `Before this project, OpenStreetMap listed just ` +
        `<strong>${BASELINE_OSM_ROCHESTER}</strong> AED in all of Rochester, and 35 in all of Minnesota. ` +
        `<a href="about.html">Read why that matters.</a>`;
    } else {
      note.innerHTML =
        `OpenStreetMap lists <strong>${BASELINE_OSM_ROCHESTER}</strong> AED in all of Rochester, ` +
        `and 35 in all of Minnesota. The devices exist — they just aren't written down ` +
        `anywhere the public can reach. <a href="about.html">Read why that matters.</a>`;
    }
  }

  // Same rule as the map: placeholder data must announce itself.
  if (aeds.some((a) => a.status === 'example')) {
    const warn = document.getElementById('example-warning');
    if (warn) warn.hidden = false;
  }
}

document.addEventListener('DOMContentLoaded', fillStats);
