/*
 * data.js — loading AED records and deciding how much to trust them.
 *
 * The trust model is the point of this project, so it lives in one place:
 *
 *   status      what we claim about the record
 *     verified    someone from AEDs for Athletes physically confirmed it
 *     reported    a community member submitted it, nobody has confirmed yet
 *     unverified  imported from an outside source (e.g. OSM), not confirmed
 *     example     development placeholder, never shown as real
 *
 *   freshness   how much a *verified* claim has decayed since last check
 *     fresh    < 180 days
 *     aging    180-365 days
 *     stale    > 365 days
 *
 * A verified AED that nobody has looked at in two years is not really
 * verified, so freshness is tracked separately from status rather than
 * folded into it.
 */

const FRESH_DAYS = 180;
const AGING_DAYS = 365;

const DATA_URL = 'data/aeds.json';

/** Days between an ISO date string and today. Null if no date. */
function daysSince(isoDate) {
  if (!isoDate) return null;
  const then = new Date(isoDate + 'T00:00:00');
  if (Number.isNaN(then.getTime())) return null;
  return Math.floor((Date.now() - then.getTime()) / 86400000);
}

/** 'fresh' | 'aging' | 'stale' | null (null when the record was never verified) */
function freshness(aed) {
  const age = daysSince(aed.last_verified);
  if (age === null) return null;
  if (age < FRESH_DAYS) return 'fresh';
  if (age < AGING_DAYS) return 'aging';
  return 'stale';
}

/*
 * One combined label for the UI, so the map, list and detail panel can never
 * disagree about how an AED is described.
 */
function trustLabel(aed) {
  if (aed.status === 'example') {
    return { key: 'example', text: 'Example data', detail: 'Development placeholder — not a real AED.' };
  }
  if (aed.status === 'reported') {
    return { key: 'reported', text: 'Community reported', detail: 'Submitted by a community member. Not yet confirmed by AEDs for Athletes.' };
  }
  if (aed.status === 'unverified') {
    return { key: 'unverified', text: 'Unconfirmed', detail: 'Imported from an outside source. Not yet confirmed in person.' };
  }

  // status === 'verified' — qualify it by how long ago that was.
  const f = freshness(aed);
  const age = daysSince(aed.last_verified);
  if (f === 'fresh') {
    return { key: 'fresh', text: 'Verified', detail: `Confirmed in person ${age} days ago.` };
  }
  if (f === 'aging') {
    return { key: 'aging', text: 'Verified — recheck due', detail: `Last confirmed ${age} days ago. Due for a recheck.` };
  }
  return { key: 'stale', text: 'Verified — out of date', detail: `Last confirmed ${age} days ago. Treat as unconfirmed until rechecked.` };
}

/** Great-circle distance in miles, for "nearest AED" sorting. */
function distanceMiles(lat1, lon1, lat2, lon2) {
  const R = 3958.8;
  const toRad = (d) => (d * Math.PI) / 180;
  const dLat = toRad(lat2 - lat1);
  const dLon = toRad(lon2 - lon1);
  const a =
    Math.sin(dLat / 2) ** 2 +
    Math.cos(toRad(lat1)) * Math.cos(toRad(lat2)) * Math.sin(dLon / 2) ** 2;
  return R * 2 * Math.asin(Math.sqrt(a));
}

async function loadAEDs() {
  const res = await fetch(DATA_URL);
  if (!res.ok) throw new Error(`Could not load AED data (HTTP ${res.status})`);
  const json = await res.json();
  return json.aeds || [];
}
