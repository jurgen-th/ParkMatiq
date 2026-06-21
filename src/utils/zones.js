import zonesUrl from '../data/rotterdam-parking-zones.geojson?url'

// Single cached fetch of the bundled GeoJSON, shared by the map layer and the
// tariff lookup so the file is only requested once.
let cache = null

export function loadZones() {
  if (!cache) {
    cache = fetch(zonesUrl)
      .then(r => r.json())
      .catch(() => ({ type: 'FeatureCollection', features: [] }))
  }
  return cache
}
