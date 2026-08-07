#!/usr/bin/env python3
"""
Pull AEDs from OpenStreetMap for a bounding box and print them in the shape
data/aeds.json expects.

OSM records are imported as 'unverified', never 'verified' — being in OSM tells
us someone once saw an AED there, not that it is still there today.

Usage:
    python3 tools/import_osm.py                 # Rochester, MN
    python3 tools/import_osm.py 43.8 -92.7 44.2 -92.2

Note on licensing: OSM data is ODbL. If you redistribute it you must attribute
OpenStreetMap, and share-alike terms can apply to a derived database. Keeping
OSM-sourced records tagged with source='osm' is what makes it possible to keep
them separable from AEDs for Athletes' own field-verified data later.
"""

import json
import sys
import time
import urllib.error
import urllib.parse
import urllib.request

# The public Overpass instances are free and heavily used, so 429/504 responses
# are routine rather than exceptional. Try each mirror in turn before giving up.
MIRRORS = [
    "https://overpass-api.de/api/interpreter",
    "https://overpass.kumi.systems/api/interpreter",
    "https://overpass.osm.jp/api/interpreter",
]

# south, west, north, east — Rochester, MN by default
DEFAULT_BBOX = (43.85, -92.65, 44.15, -92.30)


def fetch(bbox):
    query = f"""[out:json][timeout:90];
(
  node["emergency"="defibrillator"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
  way["emergency"="defibrillator"]({bbox[0]},{bbox[1]},{bbox[2]},{bbox[3]});
);
out center;"""
    data = urllib.parse.urlencode({"data": query}).encode()

    last_error = None
    for mirror in MIRRORS:
        req = urllib.request.Request(
            mirror, data=data, headers={"User-Agent": "aed-for-athletes/1.0 (community AED map)"}
        )
        try:
            with urllib.request.urlopen(req, timeout=120) as resp:
                return json.load(resp)["elements"]
        except (urllib.error.HTTPError, urllib.error.URLError, TimeoutError) as err:
            last_error = err
            print(f"  {mirror} failed ({err}), trying next mirror…", file=sys.stderr)
            time.sleep(2)

    raise SystemExit(
        f"All Overpass mirrors failed. Last error: {last_error}\n"
        "This is usually temporary — wait a few minutes and try again."
    )


def to_record(el):
    tags = el.get("tags", {})
    lat = el.get("lat") or el.get("center", {}).get("lat")
    lon = el.get("lon") or el.get("center", {}).get("lon")
    if lat is None or lon is None:
        return None

    name = tags.get("name") or tags.get("operator") or "Unnamed AED (imported from OpenStreetMap)"

    # OSM spreads "where is it exactly" across a few different tags.
    detail = tags.get("defibrillator:location") or tags.get("description") or ""
    if not detail and tags.get("indoor") == "yes":
        level = tags.get("level")
        detail = f"Indoors{', level ' + level if level else ''}. No further detail recorded."

    return {
        "id": f"osm-{el['id']}",
        "name": name,
        "lat": round(lat, 7),
        "lon": round(lon, 7),
        "address": " ".join(
            filter(None, [tags.get("addr:housenumber"), tags.get("addr:street"), tags.get("addr:city")])
        ),
        "location_detail": detail,
        "access": tags.get("access", "unknown"),
        "indoor": tags.get("indoor") == "yes",
        "hours": tags.get("opening_hours", ""),
        # Imported, not confirmed. Only a volunteer visit can change this.
        "status": "unverified",
        "last_verified": None,
        "verified_by": None,
        "source": "osm",
        "osm_id": el["id"],
        "notes": "Imported from OpenStreetMap. Needs field verification.",
    }


def main():
    bbox = DEFAULT_BBOX
    if len(sys.argv) == 5:
        bbox = tuple(float(a) for a in sys.argv[1:5])

    elements = fetch(bbox)
    records = [r for r in (to_record(e) for e in elements) if r]

    print(json.dumps(records, indent=2))
    print(f"\n{len(records)} AED(s) found in bbox {bbox}", file=sys.stderr)


if __name__ == "__main__":
    main()
