# AEDs for Athletes — Community AED Map

A map of verified AED locations for the Rochester, MN community.

## Why this exists

When this project started (July 2026), OpenStreetMap listed **1 AED in the entire
city of Rochester**, 35 in all of Minnesota, and 2,830 in the entire United States.
The US has an estimated 2–4 million AEDs, so roughly 0.1% of them are on any public
map. The devices exist — they are just not written down anywhere the public can reach.

There is no dataset to import. Building the dataset *is* the project.

## Running it

No build step and no dependencies. Serve the folder over HTTP:

```bash
python3 -m http.server 8000
```

Then open <http://localhost:8000>.

Opening `index.html` directly as a `file://` URL will not work — the browser blocks
`fetch()` of the local JSON.

## Layout

```
index.html          map, search, results list
info.html           what to do in a cardiac emergency
submit.html         community submission form
about.html          mission and data provenance
assets/js/data.js   loading + the trust/freshness model
assets/js/map.js    map, search, rendering
assets/js/submit.js submission form
data/aeds.json      the AED records
tools/import_osm.py pulls AEDs from OpenStreetMap into the right shape
```

## The trust model

This is the part that matters, and it is why verification is in V1 rather than V2.
Anyone can put dots on a map. The hard problem — and the one that makes this useful
in an actual emergency — is knowing whether a dot is still true.

Every record carries a `status`:

| status | meaning |
|---|---|
| `verified` | An AEDs for Athletes volunteer confirmed it in person |
| `reported` | A community member submitted it; nobody has confirmed it |
| `unverified` | Imported from an outside source (e.g. OSM); not confirmed |
| `example` | Development placeholder — never real, warns in the UI |

Verified records also decay. `last_verified` drives a freshness tier:

- **fresh** — under 180 days
- **aging** — 180 to 365 days, recheck due
- **stale** — over 365 days, shown as out of date

A verified AED nobody has looked at in two years is not really verified, so
freshness is tracked separately from status rather than folded into it. All of
this lives in `trustLabel()` in `assets/js/data.js`, so the map pins, the results
list, and the popups can never disagree about how an AED is described.

**The submission form can never create a `verified` record.** Public submissions
are always `reported`. Only an admin who has physically confirmed the AED may
promote one. That rule is enforced in `submit.js` and should stay enforced
server-side when a backend exists.

## Seed data

`data/aeds.json` contains one real record (the single Rochester AED in OSM) and two
records marked `status: "example"`. The examples are development placeholders so the
map renders during development.

**Delete every `example` record before launch.** The app shows a warning banner while
any are present. A plausible-looking wrong pin is worse than an empty map — it sends
someone running toward a defibrillator that is not there.

## Importing from OpenStreetMap

```bash
python3 tools/import_osm.py                      # Rochester, MN
python3 tools/import_osm.py 43.8 -92.7 44.2 -92.2  # custom bbox: S W N E
```

Prints records to stdout for review before merging. Imports are always
`unverified`.

## Licensing

Base map tiles and OSM-imported records come from OpenStreetMap under the
**Open Database License (ODbL)**, which requires attribution and has share-alike
provisions for derived databases.

Keep OSM-sourced records tagged `source: "osm"` and AEDs for Athletes field data
tagged `source: "community"`. Keeping them separable from day one is far easier than
untangling a merged database later — worth getting advice on before publishing bulk
data.

## Roadmap

**V1 (this scaffold)** — map, search by ZIP/address/geolocation, AED info page,
about page, submission form, trust and freshness model.

**V2** — a real backend so submissions persist, an admin review queue to promote
`reported` to `verified`, and a stats page (AEDs mapped, schools covered,
verification rate).

Concrete next steps:

1. Delete the example records and add real verified AEDs from field visits.
2. Ask Rochester Fire / Olmsted County whether they are a PulsePoint agency. If so,
   partnering may beat building independently — PulsePoint's NEAR Registry API is
   partner-gated and not open to public signup.
3. Encourage dual submission to the [Minnesota AED Registry](https://minnesota.nationalaedregistry.com/),
   which MN law requires of public-access AED owners within 30 days.
4. Run a mapping session at RPS schools and sports complexes. 35 AEDs statewide means
   the first 100 verified Rochester records would make this the best source in the region.

## Disclaimer

Community awareness tool. Not a substitute for calling 911, for AED registration
required under Minnesota law, or for CPR/AED training.
