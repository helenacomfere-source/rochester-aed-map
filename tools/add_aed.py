#!/usr/bin/env python3
"""
Add or verify AED records in data/aeds.json without hand-editing it.

Hand-editing JSON is where this project is most likely to break: one missing
comma and the whole map goes blank. This validates first, writes a backup, and
never leaves a broken file behind.

USAGE

  Add a submission (paste the JSON block from the email, then Ctrl-D):
      python3 tools/add_aed.py add

  Add straight from a file:
      python3 tools/add_aed.py add submission.json

  Mark a record verified after visiting it in person:
      python3 tools/add_aed.py verify ets-performance-broadway

  See what needs attention:
      python3 tools/add_aed.py list

Nothing here can mark a record verified except the `verify` command, which is
the same rule the website enforces: only a real visit makes a pin green.
"""

import datetime
import json
import math
import os
import shutil
import sys

ROOT = os.path.dirname(os.path.dirname(os.path.abspath(__file__)))
DATA = os.path.join(ROOT, "data", "aeds.json")

REQUIRED = ["id", "name", "lat", "lon", "location_detail"]
VALID_STATUS = {"verified", "reported", "unverified"}

# Rough box around Olmsted County. A pin outside this is almost certainly a
# typo or a coordinate entered backwards.
LAT_RANGE = (43.6, 44.4)
LON_RANGE = (-93.0, -92.0)

FRESH_DAYS = 180
AGING_DAYS = 365


def load():
    with open(DATA) as f:
        return json.load(f)


def save(doc):
    # Keep one rollback copy. Cheap insurance against a bad paste.
    if os.path.exists(DATA):
        shutil.copy2(DATA, DATA + ".bak")
    doc["updated"] = datetime.date.today().isoformat()
    tmp = DATA + ".tmp"
    with open(tmp, "w") as f:
        json.dump(doc, f, indent=2, ensure_ascii=False)
        f.write("\n")
    os.replace(tmp, DATA)  # atomic: never a half-written file


def distance_m(a_lat, a_lon, b_lat, b_lon):
    dy = (b_lat - a_lat) * 111320
    dx = (b_lon - a_lon) * 111320 * math.cos(math.radians(a_lat))
    return math.hypot(dx, dy)


def validate(rec, existing):
    """Return a list of problems. Empty list means it's safe to add."""
    problems = []

    for field in REQUIRED:
        if not rec.get(field) and rec.get(field) != 0:
            problems.append(f"missing required field: {field}")

    try:
        lat, lon = float(rec["lat"]), float(rec["lon"])
    except (KeyError, TypeError, ValueError):
        problems.append("lat/lon are not numbers")
        return problems

    if not (LAT_RANGE[0] <= lat <= LAT_RANGE[1]):
        problems.append(f"latitude {lat} is outside the Rochester area")
    if not (LON_RANGE[0] <= lon <= LON_RANGE[1]):
        problems.append(f"longitude {lon} is outside the Rochester area — "
                        "check it isn't swapped with the latitude")

    status = rec.get("status", "reported")
    if status not in VALID_STATUS:
        problems.append(f"status '{status}' is not one of {sorted(VALID_STATUS)}")
    if status == "verified" and not rec.get("last_verified"):
        problems.append("status is 'verified' but last_verified is empty")

    if any(e["id"] == rec.get("id") for e in existing):
        problems.append(f"id '{rec.get('id')}' is already in the file")

    return problems


def warn_duplicates(rec, existing):
    """Non-blocking: flag anything suspiciously close by."""
    near = []
    for e in existing:
        d = distance_m(rec["lat"], rec["lon"], e["lat"], e["lon"])
        if d < 100:
            near.append((d, e))
    if near:
        print("\n  Heads up — there are already AEDs near this spot:")
        for d, e in sorted(near):
            print(f"    {d:5.0f} m  {e['name']}  ({e['id']})")
        print("  A building can have several AEDs, so this may be fine.")
    return bool(near)


def ask(prompt, default="n"):
    ans = input(f"{prompt} [{'Y/n' if default == 'y' else 'y/N'}] ").strip().lower()
    if not ans:
        ans = default
    return ans.startswith("y")


def cmd_add(args):
    if args:
        with open(args[0]) as f:
            raw = f.read()
    else:
        print("Paste the JSON block from the submission email.")
        print("When you're done, press Ctrl-D (Ctrl-Z then Enter on Windows).\n")
        raw = sys.stdin.read()

    try:
        rec = json.loads(raw)
    except json.JSONDecodeError as err:
        raise SystemExit(f"\nThat isn't valid JSON: {err}\n"
                         "Copy the whole block including the outer { and }.")

    doc = load()
    existing = doc["aeds"]

    # A submission is a report until someone stands in front of it.
    rec.setdefault("status", "reported")
    rec.setdefault("source", "community")
    for field in ("address", "hours", "notes"):
        rec.setdefault(field, "")
    for field in ("last_verified", "verified_by", "osm_id"):
        rec.setdefault(field, None)

    # The submitter's email is for follow-up, not for publishing on a public map.
    contact = rec.pop("submitter_contact", None)

    problems = validate(rec, existing)
    if problems:
        print("\nCan't add this record:")
        for p in problems:
            print(f"  - {p}")
        raise SystemExit(1)

    print(f"\n  {rec['name']}")
    print(f"  {rec['location_detail']}")
    print(f"  {rec['lat']}, {rec['lon']}")
    if contact:
        print(f"  submitter: {contact}  (not saved to the map)")
    warn_duplicates(rec, existing)

    if ask("\nHave you personally confirmed this AED is there, right now?"):
        rec["status"] = "verified"
        rec["last_verified"] = datetime.date.today().isoformat()
        rec["verified_by"] = "AEDs for Athletes"
        print("  -> saved as VERIFIED (green pin)")
    else:
        rec["status"] = "reported"
        print("  -> saved as COMMUNITY REPORTED (blue pin)")
        print("     Run the verify command after visiting it.")

    existing.append(rec)
    save(doc)
    print(f"\nAdded. {len(existing)} records now. Refresh the site to see it.")


def cmd_verify(args):
    if not args:
        raise SystemExit("Which record? Try: python3 tools/add_aed.py list")

    doc = load()
    match = next((a for a in doc["aeds"] if a["id"] == args[0]), None)
    if not match:
        raise SystemExit(f"No record with id '{args[0]}'. Try the list command.")

    print(f"\n  {match['name']}")
    print(f"  {match['location_detail']}")
    print(f"  current status: {match['status']}, last verified: {match['last_verified']}")

    if not ask("\nConfirmed present and accessible today?"):
        raise SystemExit("Left unchanged.")

    match["status"] = "verified"
    match["last_verified"] = datetime.date.today().isoformat()
    match["verified_by"] = "AEDs for Athletes"
    save(doc)
    print(f"\nVerified as of {match['last_verified']}. The pin is now green.")


def cmd_list(args):
    doc = load()
    today = datetime.date.today()
    rows = []
    for a in doc["aeds"]:
        status, lv = a["status"], a.get("last_verified")
        if status == "verified" and lv:
            age = (today - datetime.date.fromisoformat(lv)).days
            if age < FRESH_DAYS:
                state, note = "verified", f"{age}d ago"
            elif age < AGING_DAYS:
                state, note = "RECHECK DUE", f"{age}d ago"
            else:
                state, note = "OUT OF DATE", f"{age}d ago"
        elif status == "reported":
            state, note = "needs visit", "community reported"
        else:
            state, note = "needs visit", "imported, unconfirmed"
        rows.append((state, note, a["name"], a["id"]))

    order = {"OUT OF DATE": 0, "RECHECK DUE": 1, "needs visit": 2, "verified": 3}
    rows.sort(key=lambda r: order.get(r[0], 9))

    print(f"\n{len(rows)} record(s) in {os.path.relpath(DATA, ROOT)}:\n")
    print(f"  {'state':<13}{'when':<22}{'name':<34}id")
    for state, note, name, rid in rows:
        print(f"  {state:<13}{note:<22}{name[:33]:<34}{rid}")

    todo = sum(1 for r in rows if r[0] != "verified")
    print(f"\n  {todo} need attention." if todo else "\n  All records are freshly verified.")


COMMANDS = {"add": cmd_add, "verify": cmd_verify, "list": cmd_list}

if __name__ == "__main__":
    if len(sys.argv) < 2 or sys.argv[1] not in COMMANDS:
        raise SystemExit(__doc__)
    COMMANDS[sys.argv[1]](sys.argv[2:])
