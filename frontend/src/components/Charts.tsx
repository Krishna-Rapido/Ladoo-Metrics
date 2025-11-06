import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';
import { useState, useRef } from 'react';
import { motion } from 'framer-motion';
import { useReport } from '../contexts/ReportContext';
import { toPng } from 'html-to-image';

export type SeriesPoint = { date: string; cohort: string; value: number; series_value?: string | null };

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
    const [hiddenLines, setHiddenLines] = useState<Set<string>>(new Set());

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
    // Toggle line visibility
    const toggleLineVisibility = (lineKey: string) => {
        setHiddenLines(prev => {
            const next = new Set(prev);
            if (next.has(lineKey)) {
                next.delete(lineKey);
            } else {
                next.add(lineKey);
            }
            return next;
        });
    };

    // Check if series breakout is used
    const hasSeriesBreakout = preData.some(d => d.series_value != null && d.series_value !== '') ||
        postData.some(d => d.series_value != null && d.series_value !== '');
    const seriesValues = hasSeriesBreakout
        ? Array.from(new Set([...preData, ...postData]
            .map(d => d.series_value)
            .filter(v => v != null && v !== '')))
            .sort()
        : [];

    // Merge dates and align values per series
    const allDates = Array.from(new Set([...preData, ...postData].map(d => d.date))).sort();

    const series = allDates.map(date => {
        const point: any = { date };

        if (hasSeriesBreakout && seriesValues.length > 0) {
            // For each series value, create separate data points
            for (const seriesVal of seriesValues) {
                const seriesValStr = String(seriesVal);
                const preTest = preData.find(d =>
                    d.date === date &&
                    d.cohort === testCohort &&
                    String(d.series_value || '') === seriesValStr
                )?.value ?? null;
                const postTest = postData.find(d =>
                    d.date === date &&
                    d.cohort === testCohort &&
                    String(d.series_value || '') === seriesValStr
                )?.value ?? null;
                const preCtrl = preData.find(d =>
                    d.date === date &&
                    d.cohort === controlCohort &&
                    String(d.series_value || '') === seriesValStr
                )?.value ?? null;
                const postCtrl = postData.find(d =>
                    d.date === date &&
                    d.cohort === controlCohort &&
                    String(d.series_value || '') === seriesValStr
                )?.value ?? null;

                // Use a safe key for the series (replace special characters)
                const seriesKey = seriesValStr.replace(/[^a-zA-Z0-9]/g, '_');
                point[`preTest_${seriesKey}`] = preTest;
                point[`postTest_${seriesKey}`] = postTest;
                point[`preCtrl_${seriesKey}`] = preCtrl;
                point[`postCtrl_${seriesKey}`] = postCtrl;
            }
        } else {
            // Original behavior without series breakout
            point.preTest = preData.find(d => d.date === date && d.cohort === testCohort)?.value ?? null;
            point.postTest = postData.find(d => d.date === date && d.cohort === testCohort)?.value ?? null;
            point.preCtrl = preData.find(d => d.date === date && d.cohort === controlCohort)?.value ?? null;
            point.postCtrl = postData.find(d => d.date === date && d.cohort === controlCohort)?.value ?? null;
        }

        return point;
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
                            onClick={(e: any) => {
                                if (e && e.dataKey) {
                                    toggleLineVisibility(e.dataKey);
                                }
                            }}
                            content={({ payload }: any) => {
                                if (!payload) return null;
                                return (
                                    <ul style={{ listStyle: 'none', padding: 0, margin: 0, display: 'flex', flexWrap: 'wrap', gap: '16px', justifyContent: 'center' }}>
                                        {payload.map((entry: any, index: number) => {
                                            const isHidden = hiddenLines.has(entry.dataKey);
                                            return (
                                                <li
                                                    key={`item-${index}`}
                                                    onClick={() => toggleLineVisibility(entry.dataKey)}
                                                    style={{
                                                        cursor: 'pointer',
                                                        opacity: isHidden ? 0.4 : 1,
                                                        textDecoration: isHidden ? 'line-through' : 'none',
                                                        userSelect: 'none',
                                                        display: 'inline-flex',
                                                        alignItems: 'center',
                                                        gap: '8px',
                                                        padding: '4px 8px',
                                                        borderRadius: '4px',
                                                        transition: 'background-color 0.2s',
                                                    }}
                                                    onMouseEnter={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'rgba(0, 0, 0, 0.05)';
                                                    }}
                                                    onMouseLeave={(e) => {
                                                        e.currentTarget.style.backgroundColor = 'transparent';
                                                    }}
                                                >
                                                    <span
                                                        style={{
                                                            display: 'inline-block',
                                                            width: '16px',
                                                            height: '2px',
                                                            backgroundColor: isHidden ? '#999' : entry.color,
                                                        }}
                                                    />
                                                    <span style={{ fontSize: '12px', color: '#374151' }}>
                                                        {entry.value}
                                                    </span>
                                                </li>
                                            );
                                        })}
                                    </ul>
                                );
                            }}
                        />
                        {hasSeriesBreakout && seriesValues.length > 0 ? (
                            // Render lines for each series value
                            seriesValues.flatMap(seriesVal => {
                                const seriesValStr = String(seriesVal);
                                const seriesKey = seriesValStr.replace(/[^a-zA-Z0-9]/g, '_');
                                const seriesLabel = ` (${seriesValStr})`;

                                // Generate distinct colors for each series
                                const hue = (seriesValues.indexOf(seriesVal) * 137.508) % 360; // Golden angle for color distribution
                                const testColors = {
                                    pre: `hsl(${hue}, 70%, 50%)`,
                                    post: `hsl(${hue}, 70%, 40%)`
                                };
                                const ctrlColors = {
                                    pre: `hsl(${(hue + 180) % 360}, 70%, 50%)`,
                                    post: `hsl(${(hue + 180) % 360}, 70%, 40%)`
                                };

                                const preTestKey = `preTest_${seriesKey}`;
                                const postTestKey = `postTest_${seriesKey}`;
                                const preCtrlKey = `preCtrl_${seriesKey}`;
                                const postCtrlKey = `postCtrl_${seriesKey}`;

                                return [
                                    <Line
                                        key={preTestKey}
                                        type="monotone"
                                        dataKey={preTestKey}
                                        name={`Pre Test${seriesLabel} ${legendSuffix ?? ''}`.trim()}
                                        stroke={testColors.pre}
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: testColors.pre, strokeWidth: 0 }}
                                        activeDot={{ r: 4, fill: testColors.pre }}
                                        hide={hiddenLines.has(preTestKey)}
                                    />,
                                    <Line
                                        key={postTestKey}
                                        type="monotone"
                                        dataKey={postTestKey}
                                        name={`Post Test${seriesLabel} ${legendSuffix ?? ''}`.trim()}
                                        stroke={testColors.post}
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: testColors.post, strokeWidth: 0 }}
                                        activeDot={{ r: 4, fill: testColors.post }}
                                        hide={hiddenLines.has(postTestKey)}
                                    />,
                                    <Line
                                        key={preCtrlKey}
                                        type="monotone"
                                        dataKey={preCtrlKey}
                                        name={`Pre Control${seriesLabel} ${legendSuffix ?? ''}`.trim()}
                                        stroke={ctrlColors.pre}
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: ctrlColors.pre, strokeWidth: 0 }}
                                        activeDot={{ r: 4, fill: ctrlColors.pre }}
                                        hide={hiddenLines.has(preCtrlKey)}
                                    />,
                                    <Line
                                        key={postCtrlKey}
                                        type="monotone"
                                        dataKey={postCtrlKey}
                                        name={`Post Control${seriesLabel} ${legendSuffix ?? ''}`.trim()}
                                        stroke={ctrlColors.post}
                                        strokeWidth={2}
                                        dot={{ r: 2, fill: ctrlColors.post, strokeWidth: 0 }}
                                        activeDot={{ r: 4, fill: ctrlColors.post }}
                                        hide={hiddenLines.has(postCtrlKey)}
                                    />,
                                ];
                            })
                        ) : (
                            // Original behavior without series breakout
                            <>
                                <Line
                                    type="monotone"
                                    dataKey="preTest"
                                    name={`Pre Test ${legendSuffix ?? ''}`.trim()}
                                    stroke="#667eea"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: "#667eea", strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: "#667eea" }}
                                    hide={hiddenLines.has('preTest')}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="postTest"
                                    name={`Post Test ${legendSuffix ?? ''}`.trim()}
                                    stroke="#22c55e"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: "#22c55e", strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: "#22c55e" }}
                                    hide={hiddenLines.has('postTest')}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="preCtrl"
                                    name={`Pre Control ${legendSuffix ?? ''}`.trim()}
                                    stroke="#f59e0b"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: "#f59e0b", strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: "#f59e0b" }}
                                    hide={hiddenLines.has('preCtrl')}
                                />
                                <Line
                                    type="monotone"
                                    dataKey="postCtrl"
                                    name={`Post Control ${legendSuffix ?? ''}`.trim()}
                                    stroke="#f97316"
                                    strokeWidth={3}
                                    dot={{ r: 3, fill: "#f97316", strokeWidth: 0 }}
                                    activeDot={{ r: 5, fill: "#f97316" }}
                                    hide={hiddenLines.has('postCtrl')}
                                />
                            </>
                        )}
                    </LineChart>
                </ResponsiveContainer>
            </div>
        </div>
    );
}
