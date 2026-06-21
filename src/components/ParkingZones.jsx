import { GeoJSON } from 'react-leaflet'
import { useEffect, useState } from 'react'
import { loadZones } from '../utils/zones'

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

export default function ParkingZones() {
  const [data, setData] = useState(null)

  // The .geojson is bundled as a static URL; fetched once (cached) and shared
  // with the tariff lookup. No external/RDW request at runtime.
  useEffect(() => {
    loadZones().then(setData)
  }, [])

  if (!data) return null
  return <GeoJSON data={data} style={style} onEachFeature={onEachFeature} />
}
