import type { SummaryStats } from '../lib/api';

export function Table({ summaries }: { summaries: SummaryStats[] }) {
    return (
        <div className="overflow-x-auto">
            <table className="min-w-full border">
                <thead>
                    <tr className="bg-slate-50">
                        <th className="px-3 py-2 text-left border">Aggregation</th>
                        <th className="px-3 py-2 text-right border">Test</th>
                        <th className="px-3 py-2 text-right border">Control</th>
                        <th className="px-3 py-2 text-right border">Mean diff</th>
                        <th className="px-3 py-2 text-right border">% change</th>
                    </tr>
                </thead>
                <tbody>
                    {summaries.map((s, i) => (
                        <tr key={i} className="odd:bg-white even:bg-slate-50">
                            <td className="px-3 py-2 border">{s.aggregation}</td>
                            <td className="px-3 py-2 text-right border">{s.test_value.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right border">{s.control_value.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right border">{s.mean_difference.toFixed(2)}</td>
                            <td className="px-3 py-2 text-right border">{s.pct_change == null ? '—' : s.pct_change.toFixed(2)}</td>
                        </tr>
                    ))}
                </tbody>
            </table>
        </div>
    );
}
