import zonesUrl from '../data/nl-parking-zones.geojson?url'

// Single cached fetch of the bundled GeoJSON, shared by the map layer and the
// tariff lookup so the file is only requested once.
//
// Resolves to `null` when the file could not be loaded (offline first run, a
// failed deploy). That is deliberately distinct from an empty zone list: missing
// data must read as "tarief onbekend", never as "gratis parkeren". A failure
// also clears the cache so the next caller retries.
let cache = null

export function loadZones() {
  if (!cache) {
    cache = fetch(zonesUrl)
      .then(r => {
        if (!r.ok) throw new Error(`zones ${r.status}`)
        return r.json()
      })
      .catch(() => { cache = null; return null })
  }
  return cache
}

// Cached bounding box [minLon, minLat, maxLon, maxLat] for a feature. With ~3k
// nationwide zones, a cheap box test lets both the tariff lookup and the map
// layer skip zones nowhere near the point/viewport instead of scanning polygons.
export function featureBBox(f) {
  if (f.__bbox) return f.__bbox
  let minLon = Infinity, minLat = Infinity, maxLon = -Infinity, maxLat = -Infinity
  const scan = ring => {
    for (const [lon, lat] of ring) {
      if (lon < minLon) minLon = lon
      if (lon > maxLon) maxLon = lon
      if (lat < minLat) minLat = lat
      if (lat > maxLat) maxLat = lat
    }
  }
  const g = f.geometry
  if (g?.type === 'Polygon') g.coordinates.forEach(scan)
  else if (g?.type === 'MultiPolygon') g.coordinates.forEach(p => p.forEach(scan))
  f.__bbox = [minLon, minLat, maxLon, maxLat]
  return f.__bbox
}
