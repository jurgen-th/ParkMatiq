// Hand a destination off to the navigation app the user already has installed.
//
// Both are https "universal links", not custom schemes: on a phone the OS opens
// the installed Google Maps / Waze app, and on desktop (or without the app) the
// same URL works in the browser. A custom scheme like waze:// would dead-end
// when the app isn't installed.

export function googleMapsUrl(lat, lon) {
  return `https://www.google.com/maps/dir/?api=1&destination=${lat},${lon}&travelmode=driving`
}

export function wazeUrl(lat, lon) {
  return `https://waze.com/ul?ll=${lat},${lon}&navigate=yes`
}

export function openNavigation(app, lat, lon) {
  const url = app === 'waze' ? wazeUrl(lat, lon) : googleMapsUrl(lat, lon)
  window.open(url, '_blank', 'noopener')
}
