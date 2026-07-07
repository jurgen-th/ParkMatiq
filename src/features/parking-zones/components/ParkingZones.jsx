import { GeoJSON, useMap, useMapEvents } from 'react-leaflet'
import { useEffect, useState, useCallback } from 'react'
import { loadZones, featureBBox } from '../../../utils/zones'

// Below this zoom the viewport spans too many zones to draw usefully, so we
// render nothing (the whole-country view would be thousands of polygons).
const MIN_ZOOM = 12

// Colour ramp by indicative hourly tariff (EUR/hour). Higher = warmer.
function colorFor(eur) {
  if (eur == null)  return '#9AA3B8' // unknown / no current daytime tariff
  if (eur <= 1)     return '#4ADE80' // cheap outer zones
  if (eur <= 2.5)   return '#FBBF24'
  if (eur <= 4)     return '#FB923C'
  return '#E5484D'                    // city-centre premium
}

function style(feature) {
  const c = colorFor(feature.properties.eurPerHour)
  return {
    color: c,
    weight: 2,
    fillColor: c,
    fillOpacity: 0.35,
    opacity: 0.95,
  }
}

function onEachFeature(feature, layer) {
  const { desc, eurPerHour } = feature.properties
  const price = eurPerHour
    ? `€${eurPerHour.toFixed(2).replace('.', ',')}/uur`
    : 'Geen dagtarief'
  layer.bindPopup(
    `<strong>${desc}</strong><br>${price}` +
    `<br><span style="color:#8B92A8;font-size:11px">Tarief indicatief · demo</span>`
  )
}

// Renders only the zones intersecting the current viewport, above a zoom
// threshold. With ~2.6k nationwide zones, drawing them all at once would choke
// Leaflet on a phone; a bbox filter keeps only the local handful on screen.
export default function ParkingZones() {
  const map = useMap()
  const [all, setAll] = useState(null)
  const [view, setView] = useState(null) // { fc, key }

  // Bundled static GeoJSON; fetched once (cached) and shared with the tariff
  // lookup. No external/RDW request at runtime.
  useEffect(() => { loadZones().then(setAll) }, [])

  const recompute = useCallback(() => {
    if (!all) return
    if (map.getZoom() < MIN_ZOOM) { setView(null); return }
    const b = map.getBounds().pad(0.25)
    const sw = b.getSouthWest(), ne = b.getNorthEast()
    const feats = all.features.filter(f => {
      const [minLon, minLat, maxLon, maxLat] = featureBBox(f)
      return !(maxLon < sw.lng || minLon > ne.lng || maxLat < sw.lat || minLat > ne.lat)
    })
    const c = map.getCenter()
    setView({
      fc: { type: 'FeatureCollection', features: feats },
      // react-leaflet's GeoJSON ignores data changes after mount, so re-key it
      // whenever the visible set moves to force a refresh.
      key: `${map.getZoom()}|${feats.length}|${c.lat.toFixed(3)},${c.lng.toFixed(3)}`,
    })
  }, [all, map])

  useEffect(() => { recompute() }, [recompute])
  // load/resize cover the first paint where the container sizes after mount.
  useMapEvents({ load: recompute, resize: recompute, moveend: recompute, zoomend: recompute })

  if (!view || !view.fc.features.length) return null
  return <GeoJSON key={view.key} data={view.fc} style={style} onEachFeature={onEachFeature} />
}
