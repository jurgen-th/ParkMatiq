#!/usr/bin/env python3
"""
One-time build script: download all Dutch paid-parking zones from the free,
unmetered RDW Open Data portal and bundle them as a static GeoJSON.

Source: opendata.rdw.nl (Socrata) — open-licensed, no API key, no per-request charge.
Run manually to refresh the snapshot:  python scripts/build-zones.py

The app never calls RDW at runtime; it only reads the generated .geojson file,
so the PWA makes zero external requests and cannot incur any cost.

Tariff model (SPDP):
  GEOMETRIE GEBIED (polygon)  --areaid-->  GEBIED REGELING (areaid -> regulationid)
  --regulationid-->  TIJDVAK (day/time window -> farecalculationcode)
  --farecalculationcode-->  TARIEFDEEL (amount per duration step => EUR/hour)

NB every id in these datasets (areaid, regulationid, farecalculationcode) is only
unique *within* an areamanagerid -- ids like "11" or "0" are reused by dozens of
municipalities. Every join below is therefore keyed on (areamanagerid, id);
joining on the bare id silently mixes another municipality's name and tariff
into a zone.
"""
import json, urllib.request, urllib.parse, datetime, os

BASE = "https://opendata.rdw.nl/resource/"
DATASETS = {
    "geometry":   "nsk3-v9n7",
    "regulation": "qtex-qwd8",
    "timeframe":  "ixf8-gtwq",
    "fare":       "534e-5vdg",
    "area":       "adw6-9hsg",
    "manager":    "2uc2-nnv3",
}
PAGE = 50000                 # Socrata max rows per request; larger sets are paged.
TODAY = datetime.date.today().strftime("%Y%m%d")
# Representative slot: a normal weekday afternoon (covers typical daytime tariff).
WEEKDAYS = ["WOENSDAG", "DINSDAG", "DONDERDAG", "MAANDAG", "VRIJDAG"]
SAMPLE_MINUTE = 1300         # 13:00, expressed in RDW's HHMM-as-int form
SAMPLE_MINUTES = 60          # stay length the indicative EUR/hour is derived from
# No Dutch street tariff comes near this. Anything above it is a day-ticket or
# progressive scheme encoded as if it were an hourly rate; charging it would be
# far worse than leaving the zone out.
MAX_PLAUSIBLE_RATE = 15.0


def fetch(dataset, **params):
    """Page through a dataset (nationwide — no areamanagerid filter)."""
    rows, offset = [], 0
    while True:
        params["$limit"], params["$offset"] = PAGE, offset
        url = BASE + DATASETS[dataset] + ".json?" + urllib.parse.urlencode(params)
        with urllib.request.urlopen(url) as r:
            batch = json.load(r)
        rows.extend(batch)
        if len(batch) < PAGE:
            return rows
        offset += PAGE


def _nest(s, i=0):
    """Parse a parenthesised WKT body into nested lists; leaves are coordinate strings."""
    items = []
    while i < len(s):
        c = s[i]
        if c == "(":
            child, i = _nest(s, i + 1)
            items.append(child)
        elif c == ")":
            return items, i + 1
        elif c == ",":
            i += 1
        else:
            j = i
            while j < len(s) and s[j] not in "()":
                j += 1
            text = s[i:j].strip().rstrip(",").strip()
            if text:
                items.append(text)
            i = j
    return items, i


def _ring(node):
    text = node[0] if isinstance(node, list) else node
    return [[float(x) for x in pt.split()] for pt in text.split(",") if pt.strip()]


def parse_wkt(wkt):
    """Parse WKT POLYGON / MULTIPOLYGON into GeoJSON geometry (lon lat order)."""
    wkt = (wkt or "").strip()
    if "(" not in wkt:
        return None
    start = wkt.index("(")
    tree, _ = _nest(wkt, start + 1)
    if wkt.startswith("MULTIPOLYGON"):
        return {"type": "MultiPolygon",
                "coordinates": [[_ring(r) for r in poly] for poly in tree]}
    if wkt.startswith("POLYGON"):
        return {"type": "Polygon", "coordinates": [_ring(r) for r in tree]}
    return None


def active(rows, end_field, key_fields, start_field):
    """Keep rows whose end date is in the future; if duplicates per key, keep latest start."""
    best = {}
    for r in rows:
        if r.get(end_field, "0")[:8] <= TODAY:
            continue
        k = tuple(r.get(f) for f in key_fields)
        if k not in best or r.get(start_field, "0") > best[k].get(start_field, "0"):
            best[k] = r
    return best


def eur_per_hour(parts):
    """Cost of a representative one-hour stay, in EUR.

    RDW splits a tariff into duration bands, each charging `amountfarepart` per
    `stepsizefarepart` minutes. Reading the first band as the hourly rate is
    wrong wherever a municipality encodes a start fee in a 0-1 minute band
    (EUR 0.30 for the first minute then read as EUR 18/hour); walking the bands
    across a full hour handles start fees and progressive scales alike.
    """
    bands = []
    for p in parts:
        try:
            start, end = int(p["startdurationfarepart"]), int(p["enddurationfarepart"])
            amt, step = float(p["amountfarepart"]), float(p["stepsizefarepart"])
        except (KeyError, ValueError):
            continue
        if step > 0 and end > start:
            bands.append((start, end, amt, step))
    bands.sort()

    total, covered = 0.0, 0
    for start, end, amt, step in bands:
        lo, hi = max(start, covered), min(end, SAMPLE_MINUTES)
        if hi <= lo:
            continue           # band already covered by an overlapping row
        total += (hi - lo) / step * amt
        covered = hi
        if covered >= SAMPLE_MINUTES:
            break
    return round(total, 2)


def main():
    print("Fetching all-NL parking data from RDW open data (one-time, paged)...")
    geometry   = fetch("geometry")
    regulation = fetch("regulation")
    timeframe  = fetch("timeframe")
    fare       = fetch("fare")
    areas      = fetch("area")
    managers   = fetch("manager")

    # (manager, areaid) -> active paid-parking regulationid
    reg = active([r for r in regulation if r.get("usageid") == "BETAALDP"],
                 "enddatearearegulation", ("areamanagerid", "areaid"),
                 "startdatearearegulation")
    area_to_reg = {k: v["regulationid"] for k, v in reg.items()}

    # (manager, regulationid) -> representative weekday-afternoon farecalculationcode
    reg_to_fare = {}
    for r in timeframe:
        if r.get("enddatetimeframe", "0")[:8] <= TODAY:
            continue
        if r.get("daytimeframe") not in WEEKDAYS:
            continue
        try:
            start, end = int(r["starttimetimeframe"]), int(r["endtimetimeframe"])
        except (KeyError, ValueError):
            continue
        if not (start <= SAMPLE_MINUTE <= end):
            continue
        code = r.get("farecalculationcode")
        if not code:
            continue
        key = (r.get("areamanagerid"), r["regulationid"])
        # prefer the earlier weekday in our priority list
        prio = WEEKDAYS.index(r["daytimeframe"])
        if key not in reg_to_fare or prio < reg_to_fare[key][1]:
            reg_to_fare[key] = (code, prio)

    # (manager, farecalculationcode) -> EUR/hour
    fare_parts = {}
    for r in fare:
        if r.get("enddatefarepart", "0")[:8] <= TODAY:
            continue
        fare_parts.setdefault((r.get("areamanagerid"), r["farecalculationcode"]), []).append(r)
    fare_rate = {c: eur_per_hour(p) for c, p in fare_parts.items()}

    # (manager, areaid) -> zone name, preferring a currently active area row.
    area_desc = {}
    for r in areas:
        key = (r.get("areamanagerid"), r.get("areaid"))
        live = r.get("enddatearea", "0")[:8] > TODAY
        if key not in area_desc or (live and not area_desc[key][1]):
            area_desc[key] = (r.get("areadesc", ""), live)
    area_desc = {k: v[0] for k, v in area_desc.items()}

    # areamanagerid -> municipality name. Managers are versioned; an id can carry
    # an expired row (merged municipalities), so prefer a currently active one.
    mgr_name = {}
    for r in managers:
        mid, name = r.get("areamanagerid"), r.get("areamanagerdesc", "")
        if not mid or not name:
            continue
        live = r.get("enddateareamanagerid", "0")[:8] > TODAY
        if mid not in mgr_name or (live and not mgr_name[mid][1]):
            mgr_name[mid] = (name, live)
    mgr_name = {k: v[0] for k, v in mgr_name.items()}

    features, priced, implausible = [], 0, []
    for g in geometry:
        aid, mid = g["areaid"], g.get("areamanagerid")
        geom = parse_wkt(g.get("areageometryastext", ""))
        if not geom:
            continue
        rid = area_to_reg.get((mid, aid))
        code = reg_to_fare.get((mid, rid), (None, None))[0] if rid else None
        rate = fare_rate.get((mid, code))
        # Keep only zones that resolve to a real weekday-daytime tariff. This
        # drops the administrative "umbrella" areas (Sector NN, ZE Zone, ...)
        # that carry no tariff and would grey out / intercept clicks on the real
        # zones underneath -- works nationwide, unlike a numeric-id heuristic.
        if not rate:
            continue
        if rate > MAX_PLAUSIBLE_RATE:
            implausible.append((mgr_name.get(mid, mid), area_desc.get((mid, aid), aid), rate))
            continue
        priced += 1
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "areaid": aid,
                "areamanagerid": g.get("areamanagerid"),
                "municipality": mgr_name.get(mid, ""),
                "desc": area_desc.get((mid, aid)) or f"Zone {aid}",
                "eurPerHour": rate,
                "fareCode": code,
            },
        })

    fc = {
        "type": "FeatureCollection",
        "metadata": {
            "source": "RDW Open Data Parkeren (opendata.rdw.nl), all Dutch municipalities",
            "license": "open data, free to use",
            "generated": TODAY,
            "note": "Tarieven indicatief / demo - representative weekday daytime rate",
        },
        "features": features,
    }

    out = os.path.join(os.path.dirname(__file__), "..", "src", "data",
                       "nl-parking-zones.geojson")
    os.makedirs(os.path.dirname(out), exist_ok=True)
    with open(out, "w", encoding="utf-8") as f:
        json.dump(fc, f, ensure_ascii=False)
    managers = {f["properties"]["areamanagerid"] for f in features}
    kept_digit = sum(1 for g in geometry if g["areaid"].isdigit())
    total_geo = len(geometry)
    print(f"Geometry rows: {total_geo}; numeric-id kept: {kept_digit}")
    print(f"Wrote {len(features)} zones ({priced} priced) across {len(managers)} "
          f"municipalities -> {os.path.normpath(out)}")
    for mun, desc, rate in implausible:
        print(f"  skipped implausible rate EUR {rate}/h: {mun} - {desc}")


if __name__ == "__main__":
    main()
