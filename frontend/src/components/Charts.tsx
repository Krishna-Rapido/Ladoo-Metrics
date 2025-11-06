import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReport } from '../contexts/ReportContext';
import { toPng } from 'html-to-image';

export type SeriesPoint = { date: string; cohort: string; value: number };

export function Charts({ preData, postData, testCohort, controlCohort, legendSuffix, title }: {
    preData: SeriesPoint[];
    postData: SeriesPoint[];
    testCohort?: string;
    controlCohort?: string;
    legendSuffix?: string;
    title?: string;
}) {
    const { addItem } = useReport();
    const [showSuccess, setShowSuccess] = useState(false);
    const chartRef = useRef<HTMLDivElement>(null);

    const handleAddToReport = async () => {
        if (!chartRef.current) return;

        try {
            // Capture the chart as an image
            const dataUrl = await toPng(chartRef.current, {
                backgroundColor: '#ffffff',
                quality: 1.0,
                pixelRatio: 2,
            });

            await addItem({
                type: 'chart',
                title: title || `${legendSuffix || 'Cohort'} Analysis Chart`,
                content: {
                    chartType: 'line',
                    imageDataUrl: dataUrl,
                    preData,
                    postData,
                    testCohort,
                    controlCohort,
                },
                comment: '',
            });

            setShowSuccess(true);
            setTimeout(() => setShowSuccess(false), 2000);
        } catch (error) {
            console.error('Failed to add chart to report:', error);
            alert('Failed to capture chart image. Please try again.');
        }
    };
    // Merge dates and align values per series
    const allDates = Array.from(new Set([...preData, ...postData].map(d => d.date))).sort();
    const series = allDates.map(date => {
        const preTest = preData.find(d => d.date === date && d.cohort === testCohort)?.value ?? null;
        const postTest = postData.find(d => d.date === date && d.cohort === testCohort)?.value ?? null;
        const preCtrl = preData.find(d => d.date === date && d.cohort === controlCohort)?.value ?? null;
        const postCtrl = postData.find(d => d.date === date && d.cohort === controlCohort)?.value ?? null;
        return { date, preTest, postTest, preCtrl, postCtrl } as any;
    });

    return (
        <div className="space-y-3">
            <div className="flex justify-end">
                {showSuccess && (
                    <motion.div
                        initial={{ scale: 0 }}
                        animate={{ scale: 1 }}
                        className="px-3 py-1.5 bg-green-100 text-green-700 rounded-lg font-medium text-xs flex items-center gap-1 mr-2"
                    >
                        <span>✓</span>
                        <span>Added!</span>
                    </motion.div>
                )}
                <button
                    onClick={handleAddToReport}
                    className="px-4 py-2 bg-gradient-to-r from-purple-600 to-blue-600 text-white rounded-lg text-sm font-semibold hover:shadow-lg transition-all"
                >
                    <span className="mr-1">📝</span>
                    Add to Report
                </button>
            </div>
            <div ref={chartRef} className="h-96 w-full" style={{ height: 400 }}>
                <ResponsiveContainer width="100%" height="100%">
                    <LineChart
                        data={series}
                        margin={{ top: 20, right: 30, bottom: 20, left: 20 }}
                    >
                        <CartesianGrid
                            strokeDasharray="3 3"
                            stroke="rgba(0, 0, 0, 0.1)"
                            strokeOpacity={0.5}
                        />
                        <XAxis
                            dataKey="date"
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            stroke="#d1d5db"
                            tickLine={{ stroke: '#d1d5db' }}
                        />
                        <YAxis
                            tick={{ fontSize: 12, fill: '#6b7280' }}
                            stroke="#d1d5db"
                            tickLine={{ stroke: '#d1d5db' }}
                        />
                        <Tooltip
                            contentStyle={{
                                backgroundColor: 'rgba(255, 255, 255, 0.95)',
                                backdropFilter: 'blur(8px)',
                                border: '1px solid rgba(0, 0, 0, 0.1)',
                                borderRadius: '12px',
                                boxShadow: '0 8px 32px rgba(0, 0, 0, 0.12)',
                                fontSize: '14px'
                            }}
                            labelStyle={{ color: '#374151', fontWeight: 600 }}
                        />
                        <Legend
                            wrapperStyle={{ paddingTop: '20px' }}
                            iconType="line"
                        />
                        <Line
                            type="monotone"
                            dataKey="preTest"
                            name={`Pre Test ${legendSuffix ?? ''}`.trim()}
                            stroke="#667eea"
                            strokeWidth={3}
                            dot={{ r: 3, fill: "#667eea", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#667eea" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="postTest"
                            name={`Post Test ${legendSuffix ?? ''}`.trim()}
                            stroke="#22c55e"
                            strokeWidth={3}
                            dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#22c55e" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="preCtrl"
                            name={`Pre Control ${legendSuffix ?? ''}`.trim()}
                            stroke="#f59e0b"
                            strokeWidth={3}
                            dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#f59e0b" }}
                        />
                        <Line
                            type="monotone"
                            dataKey="postCtrl"
                            name={`Post Control ${legendSuffix ?? ''}`.trim()}
                            stroke="#f97316"
                            strokeWidth={3}
                            dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                            activeDot={{ r: 5, fill: "#f97316" }}
                        />
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
