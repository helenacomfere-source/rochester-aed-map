/*
 * submit.js — the "add an AED" form.
 *
 * There is still no backend of our own, so submissions are emailed instead of
 * being written to a database. FormSubmit (formsubmit.co) takes the POST and
 * forwards it to the team inbox — no account, no server, no API key.
 *
 * IMPORTANT, ONE TIME ONLY: the very first submission triggers a confirmation
 * email to the team inbox with an activation link. Nothing is delivered until that
 * link is clicked. Send one test submission and confirm it before launch.
 *
 * Submissions are always status 'reported', never 'verified'. Only an admin who
 * has physically confirmed the AED may promote a record to verified — that rule
 * is the whole trust model, so the form has no way to bypass it.
 */

const ROCHESTER = [44.0121, -92.4802];

// FormSubmit's stand-in code for our address. Using this instead of the raw
// email keeps our address out of the page source, where spam crawlers
// harvest anything shaped like an address. Submissions arrive exactly the same.
const FORM_TOKEN = 'cadcfa452e63b1e3636e383934523c12';
const FORM_ENDPOINT = 'https://formsubmit.co/ajax/' + FORM_TOKEN;

let pickMap;
let pickMarker;
let picked = null;

function initPickMap() {
  pickMap = L.map('pick-map').setView(ROCHESTER, 13);
  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(pickMap);

  pickMap.on('click', (e) => {
    picked = [e.latlng.lat, e.latlng.lng];
    if (pickMarker) {
      pickMarker.setLatLng(e.latlng);
    } else {
      pickMarker = L.marker(e.latlng).addTo(pickMap);
    }
    document.getElementById('coords').textContent =
      `Selected: ${picked[0].toFixed(5)}, ${picked[1].toFixed(5)}`;
  });
}

function slugId(name) {
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, '-').replace(/^-|-$/g, '').slice(0, 40);
  return `sub-${slug || 'aed'}-${Date.now().toString(36)}`;
}

function buildRecord() {
  const name = document.getElementById('f-name').value.trim();
  return {
    id: slugId(name),
    name,
    lat: Number(picked[0].toFixed(6)),
    lon: Number(picked[1].toFixed(6)),
    address: document.getElementById('f-address').value.trim(),
    location_detail: document.getElementById('f-detail').value.trim(),
    access: document.getElementById('f-access').value,
    indoor: document.getElementById('f-indoor').value === 'yes',
    hours: document.getElementById('f-hours').value.trim(),
    // Never 'verified' from a public form — an admin must confirm in person.
    status: 'reported',
    last_verified: null,
    verified_by: null,
    source: 'community',
    osm_id: null,
    notes: document.getElementById('f-notes').value.trim(),
    submitter_contact: document.getElementById('f-contact').value.trim(),
  };
}

function showResult(html, isError) {
  const out = document.getElementById('form-result');
  out.className = 'form-result' + (isError ? ' form-result-error' : ' form-result-ok');
  out.style.display = 'block';
  out.innerHTML = html;
  out.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

async function handleSubmit(e) {
  e.preventDefault();

  const name = document.getElementById('f-name').value.trim();
  const detail = document.getElementById('f-detail').value.trim();

  if (!picked) {
    alert('Please click the map to mark where the AED is.');
    return;
  }
  if (!name || !detail) {
    alert('Please fill in the required fields.');
    return;
  }

  const record = buildRecord();
  const button = document.querySelector('#submit-form button[type="submit"]');
  button.disabled = true;
  button.textContent = 'Sending…';

  // Readable fields for the email body, plus the exact JSON to paste into
  // data/aeds.json once the AED has been verified in person.
  const payload = {
    _subject: `New AED submitted: ${record.name}`,
    _template: 'table',
    _captcha: 'false',
    'Place name': record.name,
    'Where in the building': record.location_detail,
    'Address': record.address || '(not given)',
    'Coordinates': `${record.lat}, ${record.lon}`,
    'Map link': `https://www.openstreetmap.org/?mlat=${record.lat}&mlon=${record.lon}#map=19/${record.lat}/${record.lon}`,
    'Access': record.access,
    'Indoors': record.indoor ? 'yes' : 'no',
    'Open hours': record.hours || '(not given)',
    'Notes': record.notes || '(none)',
    'Submitter email': record.submitter_contact || '(not given)',
    'JSON for aeds.json': JSON.stringify(record, null, 2),
  };

  try {
    const res = await fetch(FORM_ENDPOINT, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json', Accept: 'application/json' },
      body: JSON.stringify(payload),
    });
    if (!res.ok) throw new Error('HTTP ' + res.status);

    showResult(
      `<h3>Thank you — we got it</h3>
       <p>Your submission for <strong>${escapeHTML(record.name)}</strong> has been sent
       to AEDs for Athletes.</p>
       <p>It is recorded as <strong>community reported</strong>. A volunteer will visit
       to confirm the AED is present and accessible before it appears on the map as
       verified.</p>
       <p><a href="find.html">Back to the map</a> &middot;
          <a href="submit.html">Add another AED</a></p>`,
      false
    );
    document.getElementById('submit-form').reset();
    if (pickMarker) { pickMap.removeLayer(pickMarker); pickMarker = null; }
    picked = null;
    document.getElementById('coords').textContent = 'No location selected yet.';
  } catch (err) {
    // Never lose what someone took the trouble to write down. If sending fails,
    // show it so it can be copied and emailed by hand.
    showResult(
      `<h3>That didn't send</h3>
       <p>Something went wrong reaching our submission service. Please copy the details
       below and send them via our <a href="contact.html">contact page</a> so nothing
       is lost.</p>
       <pre>${escapeHTML(JSON.stringify(record, null, 2))}</pre>`,
      true
    );
  } finally {
    button.disabled = false;
    button.textContent = 'Submit for review';
  }
}

document.addEventListener('DOMContentLoaded', () => {
  initPickMap();
  document.getElementById('submit-form').addEventListener('submit', handleSubmit);
});
