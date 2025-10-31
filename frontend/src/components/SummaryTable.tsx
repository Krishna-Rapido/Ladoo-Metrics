type GroupStats = {
    label: string;
    count: number;
    mean: number;
    median: number;
    p25: number;
    p75: number;
    std: number;
    nunique: number;
};

function computeStats(values: number[]): Omit<GroupStats, 'label'> {
    const clean = values.filter(v => Number.isFinite(v));
    const count = clean.length;
    if (count === 0) {
        return { count: 0, mean: 0, median: 0, p25: 0, p75: 0, std: 0, nunique: 0 };
    }
    const sorted = [...clean].sort((a, b) => a - b);
    const mean = sorted.reduce((a, b) => a + b, 0) / count;
    const mid = Math.floor(count / 2);
    const median = count % 2 === 0 ? (sorted[mid - 1] + sorted[mid]) / 2 : sorted[mid];
    // nearest-rank method for quantiles
    const p25Idx = Math.ceil(0.25 * count) - 1;
    const p75Idx = Math.ceil(0.75 * count) - 1;
    const p25 = sorted[Math.max(0, Math.min(sorted.length - 1, p25Idx))];
    const p75 = sorted[Math.max(0, Math.min(sorted.length - 1, p75Idx))];
    // sample standard deviation (ddof=1) when count>1 else 0
    const variance = count > 1
        ? sorted.reduce((acc, x) => acc + Math.pow(x - mean, 2), 0) / (count - 1)
        : 0;
    const std = Math.sqrt(variance);
    const unique = new Set(sorted.map(v => Number.isFinite(v) ? v : NaN)).size;
    const nunique = Number.isNaN(unique) ? 0 : unique; // guard though Set.size won't be NaN
    return { count, mean, median, p25, p75, std, nunique };
}

function fmt(x: number, digits = 2): string {
    return Number.isFinite(x)
        ? x.toLocaleString(undefined, {
            maximumFractionDigits: digits,
            minimumFractionDigits: digits,
        })
        : '—';
}

export function SummaryTable({
    preSeries,
    postSeries,
    testCohort,
    controlCohort,
}: {
    preSeries: Array<{ date: string; cohort: string; value: number }>;
    postSeries: Array<{ date: string; cohort: string; value: number }>;
    testCohort?: string;
    controlCohort?: string;
}) {
    const preTestVals = preSeries.filter(p => p.cohort === testCohort).map(p => p.value);
    const postTestVals = postSeries.filter(p => p.cohort === testCohort).map(p => p.value);
    const preCtrlVals = preSeries.filter(p => p.cohort === controlCohort).map(p => p.value);
    const postCtrlVals = postSeries.filter(p => p.cohort === controlCohort).map(p => p.value);

    const preTest = computeStats(preTestVals);
    const postTest = computeStats(postTestVals);
    const preCtrl = computeStats(preCtrlVals);
    const postCtrl = computeStats(postCtrlVals);

    return (
        <div className="overflow-x-auto py-6 flex justify-center">
            <table className="min-w-[600px] text-sm border-separate border-spacing-0 shadow-lg rounded-xl bg-white">
                <thead>
                    <tr>
                        <th
                            className="px-6 py-4 text-left align-middle border-b-2 border-r-2 border-gray-300 bg-gradient-to-r from-slate-100 to-slate-200 font-semibold text-lg rounded-tl-xl"
                            rowSpan={2}
                        >
                            Statistic
                        </th>
                        <th
                            className="px-6 py-4 text-center align-middle border-b-2 border-r-2 border-gray-300 bg-gradient-to-r from-blue-50 to-blue-100 font-semibold text-lg"
                            colSpan={2}
                        >
                            Test
                        </th>
                        <th
                            className="px-6 py-4 text-center align-middle border-b-2 border-gray-300 bg-gradient-to-r from-pink-50 to-pink-100 font-semibold text-lg rounded-tr-xl"
                            colSpan={2}
                        >
                            Control
                        </th>
                    </tr>
                    <tr>
                        <th className="px-4 py-2 text-center border-b-2 border-r-2 border-gray-200 bg-slate-50 font-medium">Pre</th>
                        <th className="px-4 py-2 text-center border-b-2 border-r-2 border-gray-200 bg-slate-50 font-medium">Post</th>
                        <th className="px-4 py-2 text-center border-b-2 border-r-2 border-gray-200 bg-slate-50 font-medium">Pre</th>
                        <th className="px-4 py-2 text-center border-b-2 border-gray-200 bg-slate-50 font-medium">Post</th>
                    </tr>
                </thead>
                <tbody>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">Count</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{preTest.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{postTest.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{preCtrl.count.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{postCtrl.count.toLocaleString()}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">Std Dev</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preTest.std)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(postTest.std)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preCtrl.std)}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{fmt(postCtrl.std)}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">Mean</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preTest.mean)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(postTest.mean)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preCtrl.mean)}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{fmt(postCtrl.mean)}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">Median</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preTest.median)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(postTest.median)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preCtrl.median)}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{fmt(postCtrl.median)}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">P25</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preTest.p25)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(postTest.p25)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preCtrl.p25)}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{fmt(postCtrl.p25)}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50">P75</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preTest.p75)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(postTest.p75)}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{fmt(preCtrl.p75)}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100">{fmt(postCtrl.p75)}</td>
                    </tr>
                    <tr className="hover:bg-blue-50 transition">
                        <td className="px-4 py-3 font-semibold text-gray-800 border-b border-r-2 border-gray-200 bg-slate-50 rounded-bl-xl">Nunique</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{preTest.nunique.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{postTest.nunique.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-r-2 border-gray-100">{preCtrl.nunique.toLocaleString()}</td>
                        <td className="px-4 py-3 text-right border-b border-gray-100 rounded-br-xl">{postCtrl.nunique.toLocaleString()}</td>
                    </tr>
                </tbody>
            </table>
        </div>
    );
}


