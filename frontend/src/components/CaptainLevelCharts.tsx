import { useState } from 'react';
import { BarChart, Bar, XAxis, YAxis, CartesianGrid, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import type { CaptainLevelResponse } from '../lib/api';

const COLORS = {
    preTest: '#3b82f6',
    postTest: '#60a5fa',
    preControl: '#10b981',
    postControl: '#34d399'
};

type CaptainLevelChartsProps = {
    data: CaptainLevelResponse;
};

export function CaptainLevelCharts({ data }: CaptainLevelChartsProps) {
    const [selectedMetric, setSelectedMetric] = useState<string>(data.metrics[0] || '');

    if (!data || !data.data || data.data.length === 0) {
        return (
            <div className="card">
                <p className="text-gray-500">No data available for visualization</p>
            </div>
        );
    }

    // Helper to aggregate data by group_value for a specific period/cohort/metric
    const aggregateByGroupValue = (period: string, cohortType: string) => {
        const filtered = data.data.filter(
            row => row.period === period && row.cohort_type === cohortType
        );

        const grouped = new Map<string, number>();
        filtered.forEach(row => {
            const value = row.aggregations[selectedMetric] || 0;
            grouped.set(row.group_value, value);
        });

        const chartData = Array.from(grouped.entries()).map(([name, value]) => ({
            name,
            value
        }));

        return chartData;
    };

    // Get data for each combination
    const preTestData = aggregateByGroupValue('pre', 'test');
    const postTestData = aggregateByGroupValue('post', 'test');
    const preControlData = aggregateByGroupValue('pre', 'control');
    const postControlData = aggregateByGroupValue('post', 'control');

    // Combine data for bar chart comparison
    const prepareBarChartData = () => {
        const allGroupValues = new Set<string>();
        [...preTestData, ...postTestData, ...preControlData, ...postControlData].forEach(d => {
            allGroupValues.add(d.name);
        });

        return Array.from(allGroupValues).map(groupValue => {
            const preTest = preTestData.find(d => d.name === groupValue)?.value || 0;
            const postTest = postTestData.find(d => d.name === groupValue)?.value || 0;
            const preControl = preControlData.find(d => d.name === groupValue)?.value || 0;
            const postControl = postControlData.find(d => d.name === groupValue)?.value || 0;

            return {
                name: groupValue,
                'Pre Test': preTest,
                'Post Test': postTest,
                'Pre Control': preControl,
                'Post Control': postControl
            };
        });
    };

    const barChartData = prepareBarChartData();

    // Calculate summary statistics
    const calculateSummary = () => {
        const preTestTotal = preTestData.reduce((sum, item) => sum + item.value, 0);
        const postTestTotal = postTestData.reduce((sum, item) => sum + item.value, 0);
        const preControlTotal = preControlData.reduce((sum, item) => sum + item.value, 0);
        const postControlTotal = postControlData.reduce((sum, item) => sum + item.value, 0);

        const testChange = postTestTotal - preTestTotal;
        const controlChange = postControlTotal - preControlTotal;
        const testChangePercent = preTestTotal > 0 ? ((testChange / preTestTotal) * 100).toFixed(2) : 'N/A';
        const controlChangePercent = preControlTotal > 0 ? ((controlChange / preControlTotal) * 100).toFixed(2) : 'N/A';

        return {
            preTestTotal,
            postTestTotal,
            preControlTotal,
            postControlTotal,
            testChange,
            controlChange,
            testChangePercent,
            controlChangePercent
        };
    };

    const summary = calculateSummary();

    return (
        <div className="space-y-8">
            {/* Header and Metric Selection */}
            <div className="card-header">
                <span className="card-icon">📊</span>
                <div>
                    <h2 className="card-title">Captain-Level Analysis by {data.group_by_column}</h2>
                    <p className="card-subtitle">Visualize aggregated metrics across different segments</p>
                </div>
            </div>

            <div className="input-group">
                <label className="input-label">Select Metric</label>
                <select
                    className="glass-select"
                    value={selectedMetric}
                    onChange={(e) => setSelectedMetric(e.target.value)}
                >
                    {data.metrics.map(metric => (
                        <option key={metric} value={metric}>
                            {metric.replace(/_/g, ' ')}
                        </option>
                    ))}
                </select>
            </div>

            {/* Summary Cards */}
            <div className="overflow-x-auto">
                <table className="min-w-full table-auto bg-white border border-gray-200 rounded-lg">
                    <thead>
                        <tr className="bg-gray-100">
                            <th className="border border-gray-300 px-6 py-3 text-left"></th>
                            <th className="border border-gray-300 px-6 py-3 text-center text-blue-900">Test Cohort</th>
                            <th className="border border-gray-300 px-6 py-3 text-center text-green-900">Control Cohort</th>
                        </tr>
                    </thead>
                    <tbody>
                        <tr className="hover:bg-blue-50 cursor-pointer" title="Total in test cohort, pre period">
                            <td className="border border-gray-300 px-6 py-3 text-gray-700 font-medium">Pre Period Total</td>
                            <td className="border border-gray-300 px-6 py-3 font-semibold text-center text-blue-900">
                                <span
                                    tabIndex={0}
                                    title="Total value for test cohort during pre period"
                                    className="focus:outline-blue-300"
                                >
                                    {summary.preTestTotal.toLocaleString()}
                                </span>
                            </td>
                            <td className="border border-gray-300 px-6 py-3 font-semibold text-center text-green-900">
                                <span
                                    tabIndex={0}
                                    title="Total value for control cohort during pre period"
                                    className="focus:outline-green-300"
                                >
                                    {summary.preControlTotal.toLocaleString()}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-blue-50 cursor-pointer" title="Total in test cohort, post period">
                            <td className="border border-gray-300 px-6 py-3 text-gray-700 font-medium">Post Period Total</td>
                            <td className="border border-gray-300 px-6 py-3 font-semibold text-center text-blue-900">
                                <span
                                    tabIndex={0}
                                    title="Total value for test cohort during post period"
                                    className="focus:outline-blue-300"
                                >
                                    {summary.postTestTotal.toLocaleString()}
                                </span>
                            </td>
                            <td className="border border-gray-300 px-6 py-3 font-semibold text-center text-green-900">
                                <span
                                    tabIndex={0}
                                    title="Total value for control cohort during post period"
                                    className="focus:outline-green-300"
                                >
                                    {summary.postControlTotal.toLocaleString()}
                                </span>
                            </td>
                        </tr>
                        <tr className="hover:bg-blue-50 cursor-pointer" title="Change from pre to post in each cohort">
                            <td className="border border-gray-300 px-6 py-3 text-gray-700 font-medium">Change</td>
                            <td className={`border border-gray-300 px-6 py-3 font-semibold text-center ${summary.testChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span
                                    tabIndex={0}
                                    title={`Change in total for test cohort: ${summary.testChange >= 0 ? '+' : ''}${summary.testChange.toLocaleString()} (${summary.testChangePercent}%)`}
                                    className="focus:outline-blue-300"
                                >
                                    {summary.testChange >= 0 ? '+' : ''}{summary.testChange.toLocaleString()} ({summary.testChangePercent}%)
                                </span>
                            </td>
                            <td className={`border border-gray-300 px-6 py-3 font-semibold text-center ${summary.controlChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                <span
                                    tabIndex={0}
                                    title={`Change in total for control cohort: ${summary.controlChange >= 0 ? '+' : ''}${summary.controlChange.toLocaleString()} (${summary.controlChangePercent}%)`}
                                    className="focus:outline-green-300"
                                >
                                    {summary.controlChange >= 0 ? '+' : ''}{summary.controlChange.toLocaleString()} ({summary.controlChangePercent}%)
                                </span>
                            </td>
                        </tr>
                    </tbody>
                </table>
            </div>

            {/* Bar Chart - Comparison Across All Combinations */}
            <div className="card">
                <h3 className="text-xl font-semibold mb-4">
                    {selectedMetric.replace(/_/g, ' ')} by {data.group_by_column}
                </h3>
                <ResponsiveContainer width="100%" height={500}>
                    <BarChart data={barChartData} margin={{ top: 20, right: 30, left: 20, bottom: 60 }}>
                        <CartesianGrid strokeDasharray="3 3" />
                        <XAxis
                            dataKey="name"
                            angle={-45}
                            textAnchor="end"
                            height={100}
                        />
                        <YAxis />
                        <Tooltip
                            formatter={(value: number) => value.toLocaleString()}
                            contentStyle={{ backgroundColor: 'white', border: '1px solid #ccc' }}
                        />
                        <Legend />
                        <Bar dataKey="Pre Test" fill={COLORS.preTest} />
                        <Bar dataKey="Post Test" fill={COLORS.postTest} />
                        <Bar dataKey="Pre Control" fill={COLORS.preControl} />
                        <Bar dataKey="Post Control" fill={COLORS.postControl} />
                    </BarChart>
                </ResponsiveContainer>
            </div>

            {/* Data Table */}
            <div className="card">
                <h3 className="text-xl font-semibold mb-4">Detailed Breakdown</h3>
                <div className="overflow-x-auto">
                    <table className="w-full border border-gray-400 table-fixed">
                        <thead>
                            <tr className="bg-gray-100">
                                <th className="border border-gray-400 px-4 py-2 text-left">{data.group_by_column}</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Pre Test</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Post Test</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Test Change</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Pre Control</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Post Control</th>
                                <th className="border border-gray-400 px-4 py-2 text-right">Control Change</th>
                            </tr>
                        </thead>
                        <tbody>
                            {barChartData.map((row, idx) => {
                                const testChange = row['Post Test'] - row['Pre Test'];
                                const controlChange = row['Post Control'] - row['Pre Control'];
                                const testChangePct = row['Pre Test'] > 0 ? ((testChange / row['Pre Test']) * 100).toFixed(1) : 'N/A';
                                const controlChangePct = row['Pre Control'] > 0 ? ((controlChange / row['Pre Control']) * 100).toFixed(1) : 'N/A';

                                return (
                                    <tr key={idx} className={idx % 2 === 0 ? 'bg-white' : 'bg-gray-50'}>
                                        <td className="border border-gray-400 px-4 py-2 font-medium">{row.name}</td>
                                        <td className="border border-gray-400 px-4 py-2 text-right">{row['Pre Test'].toLocaleString()}</td>
                                        <td className="border border-gray-400 px-4 py-2 text-right">{row['Post Test'].toLocaleString()}</td>
                                        <td className={`border border-gray-400 px-4 py-2 text-right ${testChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {testChange >= 0 ? '+' : ''}{testChange.toLocaleString()} ({testChangePct}%)
                                        </td>
                                        <td className="border border-gray-400 px-4 py-2 text-right">{row['Pre Control'].toLocaleString()}</td>
                                        <td className="border border-gray-400 px-4 py-2 text-right">{row['Post Control'].toLocaleString()}</td>
                                        <td className={`border border-gray-400 px-4 py-2 text-right ${controlChange >= 0 ? 'text-green-600' : 'text-red-600'}`}>
                                            {controlChange >= 0 ? '+' : ''}{controlChange.toLocaleString()} ({controlChangePct}%)
                                        </td>
                                    </tr>
                                );
                            })}
                        </tbody>
                    </table>
                </div>
            </div>
        </div>
    );
}

