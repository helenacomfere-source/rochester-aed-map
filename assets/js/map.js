/*
 * map.js — the AED map, search, and results list.
 *
 * Leaflet + OpenStreetMap raster tiles. No API key, no build step, no billing.
 * Geocoding uses Nominatim, which is also keyless but rate limited to roughly
 * one request per second, so search is debounced behind an explicit button
 * press rather than firing as the user types.
 */

const ROCHESTER = [44.0121, -92.4802];
const DEFAULT_ZOOM = 13;

let map;
let markerLayer;
let allAEDs = [];
let originPoint = null; // where distances are measured from, once known

function initMap() {
  map = L.map('map').setView(ROCHESTER, DEFAULT_ZOOM);

  L.tileLayer('https://tile.openstreetmap.org/{z}/{x}/{y}.png', {
    maxZoom: 19,
    attribution: '&copy; <a href="https://www.openstreetmap.org/copyright">OpenStreetMap</a> contributors',
  }).addTo(map);

  markerLayer = L.layerGroup().addTo(map);
}

function pinIcon(trustKey) {
  return L.divIcon({
    className: '',
    html: `<div class="pin pin-${trustKey}"></div>`,
    iconSize: [22, 22],
    iconAnchor: [11, 22],
    popupAnchor: [0, -20],
  });
}

function popupHTML(aed) {
  const trust = trustLabel(aed);
  const dirs = `https://www.openstreetmap.org/directions?to=${aed.lat}%2C${aed.lon}`;

  return `
    <div class="popup">
      <span class="badge badge-${trust.key}">${trust.text}</span>
      <h3>${escapeHTML(aed.name)}</h3>
      ${aed.address ? `<p>${escapeHTML(aed.address)}</p>` : ''}
      ${aed.location_detail ? `<p class="detail">${escapeHTML(aed.location_detail)}</p>` : ''}
      ${aed.hours ? `<p class="detail">Hours: ${escapeHTML(aed.hours)}</p>` : ''}
      <p class="detail">${escapeHTML(trust.detail)}</p>
      <div class="popup-actions">
        <a href="${dirs}" target="_blank" rel="noopener">Directions</a>
        <a href="info.html">How to use an AED</a>
      </div>
    </div>`;
}

function escapeHTML(s) {
  return String(s ?? '').replace(/[&<>"']/g, (c) =>
    ({ '&': '&amp;', '<': '&lt;', '>': '&gt;', '"': '&quot;', "'": '&#39;' }[c])
  );
}

function render(aeds) {
  markerLayer.clearLayers();

  const sorted = [...aeds];
  if (originPoint) {
    sorted.forEach((a) => {
      a._dist = distanceMiles(originPoint[0], originPoint[1], a.lat, a.lon);
    });
    sorted.sort((a, b) => a._dist - b._dist);
  }

  sorted.forEach((aed) => {
    const trust = trustLabel(aed);
    L.marker([aed.lat, aed.lon], { icon: pinIcon(trust.key), title: aed.name })
      .bindPopup(popupHTML(aed))
      .addTo(markerLayer);
  });

  renderList(sorted);
}

function renderList(sorted) {
  const list = document.getElementById('results');
  const head = document.getElementById('results-head');
  head.textContent = `${sorted.length} AED${sorted.length === 1 ? '' : 's'}${originPoint ? ' — nearest first' : ''}`;

  list.innerHTML = '';
  sorted.forEach((aed) => {
    const trust = trustLabel(aed);
    const card = document.createElement('button');
    card.className = 'aed-card';
    card.innerHTML = `
      <span class="badge badge-${trust.key}">${trust.text}</span>
      <h3>${escapeHTML(aed.name)}</h3>
      ${aed.location_detail ? `<p>${escapeHTML(aed.location_detail)}</p>` : ''}
      ${aed._dist !== undefined ? `<p class="aed-dist">${aed._dist.toFixed(1)} mi away</p>` : ''}
    `;
    card.addEventListener('click', () => {
      map.setView([aed.lat, aed.lon], 17);
      // Reopening from the list should surface the same popup the pin shows.
      markerLayer.eachLayer((m) => {
        const ll = m.getLatLng();
        if (ll.lat === aed.lat && ll.lng === aed.lon) m.openPopup();
      });
    });
    list.appendChild(card);
  });
}

/* ---------- search ---------- */

async function geocode(query) {
  const url =
    'https://nominatim.openstreetmap.org/search?format=json&limit=1&countrycodes=us&q=' +
    encodeURIComponent(query);
  const res = await fetch(url, { headers: { Accept: 'application/json' } });
  if (!res.ok) throw new Error('Search service unavailable');
  const hits = await res.json();
  if (!hits.length) return null;
  return { lat: parseFloat(hits[0].lat), lon: parseFloat(hits[0].lon), label: hits[0].display_name };
}

function setStatus(msg) {
  document.getElementById('search-status').textContent = msg;
}

/* Shared by the search box here and by a ?q= handed over from the homepage. */
async function runSearch(query) {
  const q = (query || '').trim();
  if (!q) return;

  setStatus('Searching…');
  try {
    const hit = await geocode(q);
    if (!hit) {
      setStatus('No match found. Try a ZIP code or a full address.');
      return;
    }
    originPoint = [hit.lat, hit.lon];
    map.setView(originPoint, 14);
    setStatus(hit.label);
    render(allAEDs);
  } catch (err) {
    setStatus('Search failed. Check your connection and try again.');
  }
}

function handleSearch(e) {
  e.preventDefault();
  runSearch(document.getElementById('search-input').value);
}

function handleLocate() {
  if (!navigator.geolocation) {
    setStatus('Location is not available in this browser.');
    return;
  }
  setStatus('Finding your location…');
  navigator.geolocation.getCurrentPosition(
    (pos) => {
      originPoint = [pos.coords.latitude, pos.coords.longitude];
      map.setView(originPoint, 15);
      setStatus('Showing AEDs near you.');
      render(allAEDs);
    },
    () => setStatus('Could not get your location. Try searching instead.')
  );
}

/* ---------- boot ---------- */

async function start() {
  initMap();

  document.getElementById('search-form').addEventListener('submit', handleSearch);
  document.getElementById('locate-btn').addEventListener('click', handleLocate);

  try {
    allAEDs = await loadAEDs();
  } catch (err) {
    setStatus(err.message);
    return;
  }

  // Placeholder rows must never pass silently for real ones.
  if (allAEDs.some((a) => a.status === 'example')) {
    document.getElementById('example-warning').hidden = false;
  }

  render(allAEDs);

  // The homepage search box sends the visitor here as find.html?q=55901.
  // Show it in the box so it is clear what was searched, then run it.
  const handedOver = new URLSearchParams(window.location.search).get('q');
  if (handedOver) {
    document.getElementById('search-input').value = handedOver;
    runSearch(handedOver);
  }
}

document.addEventListener('DOMContentLoaded', start);
