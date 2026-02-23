export type ReportPDFData = {
  reportName: string
  period: string
  teamRevenue: number
  teamGoal: number
  goalPercent: number
  reps: Array<{
    name: string
    role: string | null
    revenue: number
    quota: number
    quotaPercent: number
    dealsClosed: number
    avgDaysToClose: number
    calls: number
    emails: number
    demos: number
  }>
}

export async function exportReportPDF(data: ReportPDFData): Promise<void> {
  // Dynamic import to prevent SSR crash — this is REQUIRED
  const { default: jsPDF } = await import("jspdf")

  const doc = new jsPDF({ orientation: "portrait", unit: "mm", format: "a4" })
  const pageWidth = doc.internal.pageSize.getWidth()
  const margin = 20

  // Header bar
  doc.setFillColor(15, 15, 15)
  doc.rect(0, 0, pageWidth, 28, "F")
  doc.setTextColor(247, 245, 240)
  doc.setFontSize(16)
  doc.text("PipelineIQ", margin, 12)
  doc.setFontSize(10)
  doc.setTextColor(136, 136, 136)
  doc.text(data.reportName, margin, 20)
  doc.text(data.period, pageWidth - margin, 20, { align: "right" })

  // Team goal section
  doc.setTextColor(15, 15, 15)
  doc.setFontSize(11)
  doc.setFont("helvetica", "bold")
  doc.text("TEAM PERFORMANCE", margin, 40)
  doc.setFont("helvetica", "normal")
  doc.setFontSize(28)
  doc.text(`$${data.teamRevenue.toLocaleString()}`, margin, 54)
  doc.setFontSize(11)
  doc.setTextColor(136, 136, 136)
  doc.text(`of $${data.teamGoal.toLocaleString()} goal · ${data.goalPercent}%`, margin, 62)

  // Progress bar
  doc.setFillColor(224, 221, 214)
  doc.roundedRect(margin, 67, pageWidth - margin * 2, 3, 1.5, 1.5, "F")
  doc.setFillColor(200, 73, 26)
  const barWidth = Math.min(
    (pageWidth - margin * 2) * (data.goalPercent / 100),
    pageWidth - margin * 2
  )
  doc.roundedRect(margin, 67, barWidth, 3, 1.5, 1.5, "F")

  // Rep table header
  let y = 82
  doc.setFillColor(15, 15, 15)
  doc.rect(margin, y, pageWidth - margin * 2, 8, "F")
  doc.setTextColor(136, 136, 136)
  doc.setFontSize(8)
  const cols = { name: margin + 2, revenue: 95, quota: 120, deals: 140, days: 158, activity: 175 }
  doc.text("REP", cols.name, y + 5.5)
  doc.text("REVENUE", cols.revenue, y + 5.5)
  doc.text("QUOTA %", cols.quota, y + 5.5)
  doc.text("DEALS", cols.deals, y + 5.5)
  doc.text("AVG DAYS", cols.days, y + 5.5)
  doc.text("ACTIVITY", cols.activity, y + 5.5)
  y += 8

  data.reps.forEach((rep, i) => {
    if (y > 260) {
      doc.addPage()
      y = 20
    }

    // Alternating row background
    if (i % 2 === 0) {
      doc.setFillColor(247, 245, 240)
      doc.rect(margin, y, pageWidth - margin * 2, 10, "F")
    }

    doc.setTextColor(15, 15, 15)
    doc.setFontSize(9)
    doc.setFont("helvetica", "bold")
    doc.text(rep.name, cols.name, y + 6.5)
    doc.setFont("helvetica", "normal")
    doc.setTextColor(58, 58, 58)
    if (rep.role) doc.text(rep.role, cols.name, y + 10.5)

    doc.setTextColor(15, 15, 15)
    doc.text(`$${rep.revenue.toLocaleString()}`, cols.revenue, y + 6.5)

    // Color-coded quota
    if (rep.quotaPercent >= 100) doc.setTextColor(26, 110, 60)
    else if (rep.quotaPercent >= 75) doc.setTextColor(176, 125, 0)
    else doc.setTextColor(200, 73, 26)
    doc.text(`${rep.quotaPercent}%`, cols.quota, y + 6.5)

    doc.setTextColor(58, 58, 58)
    doc.text(String(rep.dealsClosed), cols.deals, y + 6.5)
    doc.text(`${rep.avgDaysToClose}d`, cols.days, y + 6.5)
    doc.text(String(rep.calls + rep.emails + rep.demos), cols.activity, y + 6.5)

    y += 12
  })

  // Footer
  const pageHeight = doc.internal.pageSize.getHeight()
  doc.setFillColor(236, 234, 228)
  doc.rect(0, pageHeight - 12, pageWidth, 12, "F")
  doc.setTextColor(136, 136, 136)
  doc.setFontSize(8)
  doc.text("PipelineIQ · Sales Intelligence", margin, pageHeight - 4)
  doc.text(`Generated ${new Date().toLocaleDateString()}`, pageWidth - margin, pageHeight - 4, {
    align: "right",
  })

  doc.save(`${data.reportName.replace(/\s+/g, "-").toLowerCase()}.pdf`)
}
