import { useState } from 'react';
import { runStatisticalTest } from '../lib/api';
import type { StatTestRequest, StatTestResult } from '../lib/api';
import type { SeriesPoint } from './Charts';

// Use types from api.ts instead of duplicating

interface StatisticalTestsProps {
    preData: SeriesPoint[];
    postData: SeriesPoint[];
    testCohort?: string;
    controlCohort?: string;
    metric: string;
}

// Statistical test configurations based on test.json
const TEST_CATEGORIES = {
    paired_tests: {
        name: "Paired Tests",
        icon: "🔄",
        tests: [
            {
                name: "Paired t-test",
                goal: "Compare two related samples (pre vs post) when differences are approximately normal",
                parameters: [],
                description: "Tests if the mean difference between paired observations is significantly different from zero"
            },
            {
                name: "Wilcoxon signed-rank test",
                goal: "Compare two related samples (pre vs post) when differences are not normal or ordinal",
                parameters: [],
                description: "Non-parametric test for paired data when normality assumptions are violated"
            },
            {
                name: "Sign test",
                goal: "Test if paired differences are symmetrically distributed around zero",
                parameters: [],
                description: "Simple non-parametric test counting positive vs negative differences"
            }
        ]
    },
    group_comparisons: {
        name: "Group Comparisons",
        icon: "👥",
        tests: [
            {
                name: "Two-way ANOVA (time × group)",
                goal: "Compare test vs control across time (pre vs post) using two-way ANOVA",
                parameters: [],
                description: "Analyzes effects of time, group, and their interaction"
            },
            {
                name: "Difference-in-Differences",
                goal: "Difference-in-Differences for test vs control",
                parameters: [],
                description: "Causal inference method comparing changes over time between treatment and control groups"
            },
            {
                name: "Linear Mixed-Effects Model",
                goal: "Account for repeated measures and individual heterogeneity",
                parameters: [
                    { name: "subject_id", label: "Subject ID Column", type: "text", default: "subject", description: "Column name for subject identifiers" }
                ],
                description: "Handles correlation within subjects and unbalanced data"
            }
        ]
    },
    effect_size: {
        name: "Effect Size",
        icon: "📏",
        tests: [
            {
                name: "Cohen's d",
                goal: "Compute Cohen's d for paired samples",
                parameters: [],
                description: "Standardized effect size measure (small: 0.2, medium: 0.5, large: 0.8)"
            },
            {
                name: "Hedges' g",
                goal: "Compute Hedges' g (small sample correction)",
                parameters: [],
                description: "Bias-corrected version of Cohen's d for small samples"
            },
            {
                name: "Cliff's delta",
                goal: "Compute Cliff's delta (non-parametric effect size)",
                parameters: [],
                description: "Non-parametric effect size based on probability of superiority"
            }
        ]
    },
    variance_distribution_tests: {
        name: "Variance & Distribution",
        icon: "📊",
        tests: [
            {
                name: "Homoscedasticity test",
                goal: "Test for changes in variance of paired differences",
                parameters: [],
                description: "Tests if variance is constant across groups/time"
            },
            {
                name: "Kolmogorov-Smirnov test",
                goal: "Compare pre vs post distributional shape (non-parametric)",
                parameters: [],
                description: "Tests if two samples come from the same distribution"
            }
        ]
    },
    power_and_sample_size: {
        name: "Power Analysis",
        icon: "⚡",
        tests: [
            {
                name: "Paired t-test power",
                goal: "Compute sample size for desired power in paired t-test",
                parameters: [
                    { name: "effect_size", label: "Expected Effect Size", type: "number", default: 0.5, description: "Cohen's d" },
                    { name: "alpha", label: "Significance Level", type: "number", default: 0.05, description: "Type I error rate" },
                    { name: "power", label: "Desired Power", type: "number", default: 0.8, description: "1 - Type II error rate" }
                ],
                description: "Determines required sample size for detecting specified effect"
            },
            {
                name: "Independent t-test power",
                goal: "Compute power for two-sample comparisons (e.g., DiD)",
                parameters: [
                    { name: "effect_size", label: "Expected Effect Size", type: "number", default: 0.5, description: "Cohen's d" },
                    { name: "alpha", label: "Significance Level", type: "number", default: 0.05, description: "Type I error rate" },
                    { name: "nobs1", label: "Sample Size Group 1", type: "number", default: 50, description: "Number of observations" }
                ],
                description: "Calculates statistical power for independent group comparisons"
            }
        ]
    },
    confidence_intervals: {
        name: "Confidence Intervals",
        icon: "📈",
        tests: [
            {
                name: "Paired mean difference CI",
                goal: "Get 95% CI for paired mean difference",
                parameters: [
                    { name: "confidence", label: "Confidence Level", type: "number", default: 0.95, description: "Confidence level (0-1)" }
                ],
                description: "Confidence interval for the mean difference between paired samples"
            },
            {
                name: "Bootstrap CI",
                goal: "Bootstrap CI for effect or mean difference",
                parameters: [
                    { name: "confidence", label: "Confidence Level", type: "number", default: 0.95, description: "Confidence level (0-1)" },
                    { name: "n_bootstrap", label: "Bootstrap Samples", type: "number", default: 1000, description: "Number of bootstrap iterations" }
                ],
                description: "Non-parametric confidence interval using bootstrap resampling"
            }
        ]
    }
};

export function StatisticalTests({ preData, postData, testCohort, controlCohort, metric }: StatisticalTestsProps) {
    const [selectedCategory, setSelectedCategory] = useState<string>('');
    const [selectedTest, setSelectedTest] = useState<string>('');
    const [parameters, setParameters] = useState<Record<string, any>>({});
    const [results, setResults] = useState<StatTestResult[]>([]);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    // Helper function to safely format numbers
    const safeToFixed = (value: number | null | undefined, decimals: number = 4): string => {
        if (value === null || value === undefined || isNaN(value)) {
            return 'N/A';
        }
        return value.toFixed(decimals);
    };

    // Extract data for statistical tests
    const extractData = () => {
        const preTest = preData.filter(d => d.cohort === testCohort).map(d => d.value);
        const postTest = postData.filter(d => d.cohort === testCohort).map(d => d.value);
        const preControl = preData.filter(d => d.cohort === controlCohort).map(d => d.value);
        const postControl = postData.filter(d => d.cohort === controlCohort).map(d => d.value);

        return { preTest, postTest, preControl, postControl };
    };

    const runTest = async () => {
        if (!selectedCategory || !selectedTest) return;

        setLoading(true);
        setError(null);

        try {
            const data = extractData();

            // Validate data
            if (data.preTest.length === 0 && data.postTest.length === 0) {
                throw new Error('No valid data found for the test cohort');
            }

            const request: StatTestRequest = {
                test_category: selectedCategory,
                test_name: selectedTest,
                parameters,
                data: {
                    pre_test: data.preTest,
                    post_test: data.postTest,
                    pre_control: data.preControl,
                    post_control: data.postControl
                }
            };

            const result = await runStatisticalTest(request);

            // Validate result before adding to state
            if (!result || typeof result !== 'object') {
                throw new Error('Invalid response from statistical test');
            }

            setResults(prev => [...prev, result]);

        } catch (err: any) {
            console.error('Statistical test error:', err);
            setError(err.message || 'Statistical test failed');
        } finally {
            setLoading(false);
        }
    };

    const clearResults = () => {
        setResults([]);
        setError(null);
    };

    const selectedCategoryConfig = selectedCategory ? TEST_CATEGORIES[selectedCategory as keyof typeof TEST_CATEGORIES] : null;
    const selectedTestConfig = selectedCategoryConfig?.tests.find(t => t.name === selectedTest);

    return (
        <div className="space-y-6">
            <div className="card-header">
                <span className="card-icon">🧮</span>
                <div>
                    <h3 className="card-title">Statistical Analysis</h3>
                    <p className="card-subtitle">Run statistical tests on {metric.replace(/_/g, ' ')} data</p>
                </div>
            </div>

            {/* Test Category Selection */}
            <div className="input-group">
                <label className="input-label">Test Category</label>
                <select
                    className="glass-select"
                    value={selectedCategory}
                    onChange={(e) => {
                        setSelectedCategory(e.target.value);
                        setSelectedTest('');
                        setParameters({});
                    }}
                >
                    <option value="">Select test category...</option>
                    {Object.entries(TEST_CATEGORIES).map(([key, category]) => (
                        <option key={key} value={key}>
                            {category.icon} {category.name}
                        </option>
                    ))}
                </select>
            </div>

            {/* Test Selection */}
            {selectedCategoryConfig && (
                <div className="input-group">
                    <label className="input-label">Statistical Test</label>
                    <select
                        className="glass-select"
                        value={selectedTest}
                        onChange={(e) => {
                            setSelectedTest(e.target.value);
                            const testConfig = selectedCategoryConfig.tests.find(t => t.name === e.target.value);
                            // Initialize parameters with defaults
                            const defaultParams: Record<string, any> = {};
                            testConfig?.parameters.forEach(param => {
                                defaultParams[param.name] = param.default;
                            });
                            setParameters(defaultParams);
                        }}
                    >
                        <option value="">Select test...</option>
                        {selectedCategoryConfig.tests.map((test) => (
                            <option key={test.name} value={test.name}>
                                {test.name}
                            </option>
                        ))}
                    </select>

                    {selectedTestConfig && (
                        <div className="mt-2 p-3 rounded-lg bg-blue-50 border border-blue-200">
                            <p className="text-sm text-blue-800 font-medium">{selectedTestConfig.goal}</p>
                            <p className="text-xs text-blue-600 mt-1">{selectedTestConfig.description}</p>
                        </div>
                    )}
                </div>
            )}

            {/* Parameter Inputs */}
            {selectedTestConfig && selectedTestConfig.parameters.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-700">Test Parameters</h4>
                    {selectedTestConfig.parameters.map((param) => (
                        <div key={param.name} className="input-group">
                            <label className="input-label">{param.label}</label>
                            <input
                                type={param.type}
                                className="glass-input"
                                value={parameters[param.name] || param.default || ''}
                                onChange={(e) => setParameters(prev => ({
                                    ...prev,
                                    [param.name]: param.type === 'number' ? parseFloat(e.target.value) : e.target.value
                                }))}
                                placeholder={param.default?.toString()}
                            />
                            <p className="text-xs text-gray-500 mt-1">{param.description}</p>
                        </div>
                    ))}
                </div>
            )}

            {/* Action Buttons */}
            <div className="action-bar">
                {results.length > 0 && (
                    <button className="btn btn-secondary" onClick={clearResults}>
                        Clear Results
                    </button>
                )}
                <button
                    className="btn btn-primary"
                    onClick={runTest}
                    disabled={!selectedTest || loading}
                >
                    {loading ? (
                        <>
                            <div className="loading-spinner"></div>
                            Running Test...
                        </>
                    ) : (
                        'Run Statistical Test'
                    )}
                </button>
            </div>

            {/* Error Display */}
            {error && (
                <div className="p-4 rounded-lg bg-red-50 border border-red-200">
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">⚠️</span>
                        <span className="text-red-700 font-medium">Error</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
            )}

            {/* Results Display */}
            {results.length > 0 && (
                <div className="space-y-4">
                    <h4 className="font-medium text-gray-700">Test Results</h4>
                    {results.map((result, index) => (
                        <div key={index} className="glass-card">
                            <div className="flex items-start justify-between mb-4">
                                <div>
                                    <h5 className="font-semibold text-gray-800">{result.test_name}</h5>
                                    <p className="text-sm text-gray-600">{result.category}</p>
                                </div>
                                <span className="text-xs bg-gray-100 px-2 py-1 rounded">
                                    Test #{index + 1}
                                </span>
                            </div>

                            {/* Key Results Table */}
                            <div className="overflow-x-auto">
                                <table className="w-full text-sm">
                                    <thead>
                                        <tr className="border-b border-gray-200">
                                            <th className="text-left py-2 font-medium text-gray-700">Metric</th>
                                            <th className="text-left py-2 font-medium text-gray-700">Value</th>
                                        </tr>
                                    </thead>
                                    <tbody className="divide-y divide-gray-100">
                                        {result.statistic !== undefined && result.statistic !== null && (
                                            <tr>
                                                <td className="py-2 text-gray-600">Test Statistic</td>
                                                <td className="py-2 font-mono">{safeToFixed(result.statistic)}</td>
                                            </tr>
                                        )}
                                        {result.p_value !== undefined && result.p_value !== null && (
                                            <tr>
                                                <td className="py-2 text-gray-600">P-value</td>
                                                <td className="py-2 font-mono">
                                                    <span className={result.p_value !== null && result.p_value < 0.05 ? 'text-red-600 font-semibold' : ''}>
                                                        {result.p_value !== null && result.p_value < 0.001 ? '< 0.001' : safeToFixed(result.p_value)}
                                                    </span>
                                                </td>
                                            </tr>
                                        )}
                                        {result.effect_size !== undefined && result.effect_size !== null && (
                                            <tr>
                                                <td className="py-2 text-gray-600">Effect Size</td>
                                                <td className="py-2 font-mono">{safeToFixed(result.effect_size)}</td>
                                            </tr>
                                        )}
                                        {result.confidence_interval && result.confidence_interval.length === 2 && (
                                            <tr>
                                                <td className="py-2 text-gray-600">95% CI</td>
                                                <td className="py-2 font-mono">
                                                    [{safeToFixed(result.confidence_interval[0])}, {safeToFixed(result.confidence_interval[1])}]
                                                </td>
                                            </tr>
                                        )}
                                        {result.sample_size !== undefined && result.sample_size !== null && (
                                            <tr>
                                                <td className="py-2 text-gray-600">Required Sample Size</td>
                                                <td className="py-2 font-mono">{result.sample_size}</td>
                                            </tr>
                                        )}
                                        {result.power !== undefined && result.power !== null && (
                                            <tr>
                                                <td className="py-2 text-gray-600">Statistical Power</td>
                                                <td className="py-2 font-mono">{safeToFixed(result.power * 100, 1)}%</td>
                                            </tr>
                                        )}
                                    </tbody>
                                </table>
                            </div>

                            {/* Summary */}
                            <div className="mt-4 p-3 bg-gray-50 rounded-lg">
                                <p className="text-sm text-gray-700">
                                    <strong>Interpretation:</strong> {result.summary}
                                </p>
                            </div>

                            {/* Parameters Used */}
                            {Object.keys(result.parameters_used).length > 0 && (
                                <details className="mt-3">
                                    <summary className="text-sm text-gray-600 cursor-pointer">Parameters Used</summary>
                                    <div className="mt-2 text-xs text-gray-500 font-mono bg-gray-50 p-2 rounded">
                                        {JSON.stringify(result.parameters_used, null, 2)}
                                    </div>
                                </details>
                            )}
                        </div>
                    ))}
                </div>
            )}
        </div>
    );
}
