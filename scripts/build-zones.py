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
"""
import json, urllib.request, urllib.parse, datetime, os

BASE = "https://opendata.rdw.nl/resource/"
DATASETS = {
    "geometry":   "nsk3-v9n7",
    "regulation": "qtex-qwd8",
    "timeframe":  "ixf8-gtwq",
    "fare":       "534e-5vdg",
    "area":       "adw6-9hsg",
}
PAGE = 50000                 # Socrata max rows per request; larger sets are paged.
TODAY = datetime.date.today().strftime("%Y%m%d")
# Representative slot: a normal weekday afternoon (covers typical daytime tariff).
WEEKDAYS = ["WOENSDAG", "DINSDAG", "DONDERDAG", "MAANDAG", "VRIJDAG"]
SAMPLE_MINUTE = 1300         # 13:00, expressed in RDW's HHMM-as-int form


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
    """First fare part with a positive amount, normalised to EUR/hour."""
    parts = sorted(parts, key=lambda r: int(r["startdurationfarepart"]))
    for p in parts:
        amt, step = float(p["amountfarepart"]), float(p["stepsizefarepart"])
        if amt > 0 and step > 0:
            return round(amt / step * 60, 2)
    return 0.0


def main():
    print("Fetching all-NL parking data from RDW open data (one-time, paged)...")
    geometry   = fetch("geometry")
    regulation = fetch("regulation")
    timeframe  = fetch("timeframe")
    fare       = fetch("fare")
    areas      = fetch("area")

    # areaid -> active paid-parking regulationid
    reg = active([r for r in regulation if r.get("usageid") == "BETAALDP"],
                 "enddatearearegulation", ("areaid",), "startdatearearegulation")
    area_to_reg = {k[0]: v["regulationid"] for k, v in reg.items()}

    # regulationid -> representative weekday-afternoon farecalculationcode
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
        rid = r["regulationid"]
        # prefer the earlier weekday in our priority list
        prio = WEEKDAYS.index(r["daytimeframe"])
        if rid not in reg_to_fare or prio < reg_to_fare[rid][1]:
            reg_to_fare[rid] = (code, prio)

    # farecalculationcode -> EUR/hour
    fare_parts = {}
    for r in fare:
        if r.get("enddatefarepart", "0")[:8] <= TODAY:
            continue
        fare_parts.setdefault(r["farecalculationcode"], []).append(r)
    fare_rate = {c: eur_per_hour(p) for c, p in fare_parts.items()}

    area_desc = {r["areaid"]: r.get("areadesc", "") for r in areas}

    features, priced = [], 0
    for g in geometry:
        aid = g["areaid"]
        geom = parse_wkt(g.get("areageometryastext", ""))
        if not geom:
            continue
        rid = area_to_reg.get(aid)
        code = reg_to_fare.get(rid, (None, None))[0] if rid else None
        rate = fare_rate.get(code)
        # Keep only zones that resolve to a real weekday-daytime tariff. This
        # drops the administrative "umbrella" areas (Sector NN, ZE Zone, ...)
        # that carry no tariff and would grey out / intercept clicks on the real
        # zones underneath -- works nationwide, unlike a numeric-id heuristic.
        if not rate:
            continue
        priced += 1
        features.append({
            "type": "Feature",
            "geometry": geom,
            "properties": {
                "areaid": aid,
                "areamanagerid": g.get("areamanagerid"),
                "desc": area_desc.get(aid, f"Zone {aid}"),
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


if __name__ == "__main__":
    main()
