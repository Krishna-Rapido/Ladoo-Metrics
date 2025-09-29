import { Line, LineChart, CartesianGrid, XAxis, YAxis, Tooltip, Legend, ResponsiveContainer } from 'recharts';

export type SeriesPoint = { date: string; cohort: string; value: number };

export function Charts({ preData, postData, testCohort, controlCohort, title, legendSuffix }: {
    preData: SeriesPoint[];
    postData: SeriesPoint[];
    testCohort?: string;
    controlCohort?: string;
    title?: string;
    legendSuffix?: string;
}) {
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
        <div className="h-96 w-full" style={{ height: 400 }}>
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
    );
}
