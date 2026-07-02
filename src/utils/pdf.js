import { jsPDF } from 'jspdf'

export function formatDuration(totalSeconds) {
  const h = Math.floor(totalSeconds / 3600)
  const m = Math.floor((totalSeconds % 3600) / 60)
  const s = totalSeconds % 60
  if (h > 0) return `${h}u ${m}m ${s}s`
  return `${m}m ${s}s`
}

export function generateReceipt(session) {
  const doc = new jsPDF({ unit: 'mm', format: 'a4' })

  const startDate = new Date(session.startTime)
  const endDate = new Date(session.endTime)

  const dateStr = startDate.toLocaleDateString('nl-NL', {
    weekday: 'long', day: 'numeric', month: 'long', year: 'numeric',
  })
  const startStr = startDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const endStr = endDate.toLocaleTimeString('nl-NL', { hour: '2-digit', minute: '2-digit', second: '2-digit' })
  const durationStr = formatDuration(session.duration)
  const refNum = `PW-${session.id}`

  // Header bar
  doc.setFillColor(27, 69, 200)
  doc.rect(0, 0, 210, 42, 'F')

  doc.setTextColor(255, 255, 255)
  doc.setFont('helvetica', 'bold')
  doc.setFontSize(26)
  doc.text('ParkMatiq', 105, 17, { align: 'center' })

  doc.setFont('helvetica', 'normal')
  doc.setFontSize(11)
  doc.text('Parkeer Bewijs', 105, 30, { align: 'center' })

  // Divider
  doc.setDrawColor(200, 210, 240)
  doc.setLineWidth(0.4)

  // Body rows
  doc.setTextColor(30, 30, 30)
  const rows = [
    ['Datum',      dateStr],
    ['Start',      startStr],
    ['Einde',      endStr],
    ['Duur',       durationStr],
    ['Kenteken',   session.plate],
    ['Referentie', refNum],
  ]

  const startY = 62
  const lineH = 13

  doc.line(20, startY - 6, 190, startY - 6)

  rows.forEach(([label, value], i) => {
    const y = startY + i * lineH
    doc.setFont('helvetica', 'bold')
    doc.setFontSize(11)
    doc.text(label, 22, y)
    doc.setFont('helvetica', 'normal')
    doc.text(String(value), 75, y)
    doc.setDrawColor(230, 235, 250)
    doc.line(20, y + 4, 190, y + 4)
  })

  // Footer
  doc.setFontSize(9)
  doc.setTextColor(160, 160, 160)
  doc.text('Bedankt voor het gebruik van ParkMatiq', 105, 278, { align: 'center' })
  doc.text('parkmatiq.app', 105, 284, { align: 'center' })

  const fileName = `ParkMatiq_${session.plate}_${startDate.toISOString().slice(0, 10)}.pdf`
  doc.save(fileName)
}
