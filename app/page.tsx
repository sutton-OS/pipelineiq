import { ReportUploader } from "@/components/ReportUploader";

const previewRows = [
  {
    rep: "Alex Rivera",
    revenue: "$62,100",
    quota: "104%",
    status: "On Track",
    statusClass: "bg-[#e2f0e8] text-[#1a6e3c]",
  },
  {
    rep: "Jordan Kim",
    revenue: "$55,900",
    quota: "97%",
    status: "On Track",
    statusClass: "bg-[#e2f0e8] text-[#1a6e3c]",
  },
  {
    rep: "Sam Patel",
    revenue: "$48,300",
    quota: "88%",
    status: "At Risk",
    statusClass: "bg-[#fdf4d8] text-[#b07d00]",
  },
  {
    rep: "Taylor Brooks",
    revenue: "$42,500",
    quota: "79%",
    status: "Behind",
    statusClass: "bg-[#fce8e6] text-[#c5221f]",
  },
];

export default function HomePage() {
  return (
    <main className="min-h-screen bg-[#f9f5eb] px-5 pb-16 pt-12 text-[#1a1a1a] sm:px-8">
      <div className="mx-auto w-full max-w-6xl space-y-12">
        <section>
          <p className="text-xs uppercase tracking-[0.12em] text-[#5f5f5f]">
            PipelineIQ Core
          </p>
          <h1 className="mt-3 max-w-4xl font-serif text-5xl leading-[0.95] sm:text-6xl">
            CSV in, beautiful sales report out.
          </h1>
          <p className="mt-5 max-w-3xl text-lg leading-relaxed text-[#393939]">
            Upload your raw rep performance data and instantly generate a
            polished PDF designed in our paper-and-ink dashboard aesthetic.
          </p>
        </section>

        <section className="overflow-hidden rounded-3xl border border-[#d8d5ce] bg-white shadow-[0_22px_50px_rgba(26,26,26,0.12)]">
          <div className="border-b border-[#2d2d2d] bg-[#1a1a1a] px-6 py-7 text-white md:px-8">
            <p className="text-xs uppercase tracking-[0.12em] text-white/65">
              Dashboard Preview
            </p>
            <div className="mt-4 grid gap-6 lg:grid-cols-[1.2fr_1fr] lg:items-end">
              <div>
                <p className="font-serif text-5xl leading-none">$214,800</p>
                <p className="mt-2 text-sm text-white/70">
                  Team revenue this month • 92% to target
                </p>
              </div>
              <div className="space-y-3">
                <div className="h-2 rounded-full bg-white/20">
                  <div className="h-2 w-[92%] rounded-full bg-[#1a6e3c]" />
                </div>
                <div className="grid grid-cols-3 gap-3 text-xs">
                  <div>
                    <p className="text-white/55">Avg Deal</p>
                    <p className="mt-1 font-mono text-sm text-white">$14,200</p>
                  </div>
                  <div>
                    <p className="text-white/55">Win Rate</p>
                    <p className="mt-1 font-mono text-sm text-white">38%</p>
                  </div>
                  <div>
                    <p className="text-white/55">Avg Close</p>
                    <p className="mt-1 font-mono text-sm text-white">31d</p>
                  </div>
                </div>
              </div>
            </div>
          </div>

          <div className="bg-[#f9f5eb] p-4 md:p-6">
            <div className="overflow-hidden rounded-2xl border border-[#d8d5ce] bg-white">
              <table className="w-full min-w-[620px] text-sm">
                <thead>
                  <tr className="border-b border-[#d8d5ce] bg-[#f3eee3] text-left text-xs uppercase tracking-[0.08em] text-[#666]">
                    <th className="px-4 py-3">Rep</th>
                    <th className="px-4 py-3">Revenue</th>
                    <th className="px-4 py-3">Quota</th>
                    <th className="px-4 py-3">Status</th>
                  </tr>
                </thead>
                <tbody>
                  {previewRows.map((row) => (
                    <tr key={row.rep} className="border-b border-[#ece8dc] last:border-b-0">
                      <td className="px-4 py-3 font-medium">{row.rep}</td>
                      <td className="px-4 py-3 font-mono">{row.revenue}</td>
                      <td className="px-4 py-3 font-mono">{row.quota}</td>
                      <td className="px-4 py-3">
                        <span className={`inline-flex rounded-full px-2.5 py-1 text-xs font-semibold ${row.statusClass}`}>
                          {row.status}
                        </span>
                      </td>
                    </tr>
                  ))}
                </tbody>
              </table>
            </div>
          </div>
        </section>

        <ReportUploader />
      </div>
    </main>
  );
}
