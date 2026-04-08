# Researcher: Captain Segment Discovery Lab

## The Real Problem

Your team already segments captains on observable behavior — frequency (consistency), volume (performance), lifecycle stage (HH/PHH), time preference (TOD), day preference (DOW), distance. These are all **descriptive labels on the same underlying axis: "what does this captain do?"**

The segments you haven't found yet live on a different axis entirely: **"why does this captain do what they do?"** and **"how does this captain respond to change?"**

These are psychological and economic traits — invisible in static snapshots but visible in how behavior *changes* in response to stimuli. Two Daily-HP captains who look identical today will diverge tomorrow when you introduce a new incentive, or demand drops, or a competitor enters the market. The difference between them is the segment you haven't discovered yet.

**The goal of Researcher isn't to compute more KPIs. It's to build a system where your team reliably discovers behavioral patterns that no one anticipated.**

---

## Part 1: The Three Discovery Methods (Deep Dive)

### Method 1: Residual Analysis — "What Can't We Explain?"

#### The Idea

Every existing segment is a lens. Consistency tells you "this captain works daily." Performance tells you "they do 12 rides/day." But these lenses only explain *part* of behavior. The unexplained part — the residual — is where new segments hide.

If you build a model that predicts an outcome using all existing segments, the captains it gets *wrong* are the most interesting captains in your dataset. Something is driving their behavior that your current segments don't capture.

#### Concrete Implementation Against Your Data

**Step 1: Build the baseline model**

Data source: `metrics.captain_base_metrics_enriched` joined with `mne.ms_1842554619_2584218394` (for existing segments)

For each captain, compute a 28-day feature vector:
```
Features (from existing segments):
  - consistency_segment (daily/weekly/monthly/quarterly/rest)
  - performance_segment (UHP/HP/MP/LP/ZP)
  - tenure_days (from registration_date in captain_supply_journey_summary)
  - city
  - primary_service (max rides across taxi/c2c/delivery)
```

Pick a target outcome. The choice of target determines *what kind* of new segment you'll find:

| Target Outcome | What It Reveals | Data Source |
|---|---|---|
| `rides_next_14_days` | Hidden drivers of productivity | `count_captain_net_rides_taxi_all_day_city` summed over next 14 days |
| `churned_in_28_days` (binary: 0 net_days in next 28 days) | Hidden churn risk factors | `count_net_days_last_28_days` = 0 in next window |
| `incentive_response` (delta in rides during vs before incentive period) | Hidden incentive elasticity | Compare `count_captain_net_rides_*` during periods where `sum_captain_special_incentives_daily_city > 0` vs before |
| `earnings_efficiency` (`sum_captain_final_captain_earnings_daily_city / sum_captain_total_lh_daily_city`) | Hidden efficiency drivers | Direct from enriched table |

**Step 2: Train a simple model**

Use a gradient-boosted tree (XGBoost/LightGBM) — not because we care about prediction accuracy, but because it handles interactions well and feature importance is readable. The model only uses existing segment features.

```python
# Pseudocode
features = ['consistency_segment', 'performance_segment', 'tenure_bucket',
            'city', 'primary_service']
target = 'rides_next_14_days'  # or churn, or incentive_response

model = LightGBM(features, target)
model.fit(training_data)

# Compute residuals
predictions = model.predict(all_captains)
residuals = actual - predictions
```

**Step 3: Identify the high-residual captains**

Sort captains by absolute residual. The top 20% are the "mispredicted" group — captains whose behavior deviates most from what existing segments would predict.

Split them into two subgroups:
- **Positive residuals**: Captains who *outperform* their segment prediction (more rides, less churn, bigger incentive response than expected)
- **Negative residuals**: Captains who *underperform* their segment prediction

**Step 4: Profile the mispredicted captains**

Now compute a *rich* feature set for these captains — not just the 5 segment features, but everything available in Presto:

```
Expanded features (all from captain_base_metrics_enriched):
  # Time-of-day behavior
  - morning_share = online_morning_peak / online_all_day
  - evening_share = online_evening_peak / online_all_day
  - tod_concentration = max(morning%, evening%, afternoon%, night%)

  # Earnings structure
  - earnings_per_ride = final_captain_earnings / net_rides
  - earnings_per_login_hour = final_captain_earnings / total_lh
  - incentive_share = special_incentives / final_captain_earnings
  - gmv_per_ride = gmv / net_rides

  # Demand interaction
  - acceptance_rate = accepted_pings / gross_pings (from DAPR table)
  - idle_fraction = idle_lh / total_lh
  - pings_per_online_hour = gross_pings / total_lh

  # Service behavior
  - taxi_share = net_rides_taxi / total_net_rides
  - delivery_share = delivery_orders / total_net_rides
  - c2c_share = c2c_orders / total_net_rides

  # Behavioral stability (computed over 28-day window)
  - daily_rides_cv = std(daily_rides) / mean(daily_rides)
  - login_hour_cv = std(daily_login_hours) / mean(daily_login_hours)
  - earnings_cv = std(daily_earnings) / mean(daily_earnings)

  # Trajectory
  - rides_slope = linear_regression_slope(daily_rides, last_28_days)
  - earnings_slope = linear_regression_slope(daily_earnings, last_28_days)
  - login_hours_slope = linear_regression_slope(daily_lh, last_28_days)

  # Session behavior
  - avg_daily_login_hours = total_lh / active_days
  - active_days_ratio = active_days / 28

  # Cancellation/rejection patterns
  - reject_rate = riderrejected_pings / gross_pings (from captain_svo_daily_kpi)
  - busy_rate = riderbusy_pings / gross_pings
```

**Step 5: Find the discriminating features**

Compare the expanded feature distributions between:
- High positive residual captains vs the "well-predicted" middle group
- High negative residual captains vs the "well-predicted" middle group

Rank features by discriminative power (Kolmogorov-Smirnov statistic or mutual information). The top features are the candidate new segment axes.

**Step 6: The analyst interprets and names**

This is the human step. The system says: "Captains who churn unexpectedly (given their existing segments) have significantly higher `daily_rides_cv` (coefficient of variation) and declining `earnings_per_login_hour`." The analyst interprets: "These are captains whose daily rides are erratic and whose efficiency is declining — they're getting frustrated. Let's call them **Frustrated Inconsistents**."

#### What This Method Is Good At

- Automatically finds signals orthogonal to existing segments (by construction)
- Scales to any number of features without the analyst guessing which ones matter
- Different target outcomes yield different discoveries (churn targets find churn-related segments, earnings targets find efficiency-related segments)

#### Limitations

- Requires choosing a target outcome (the analyst still provides direction)
- Won't find segments unrelated to the chosen outcome
- Needs enough data to train a decent model (~10K+ captains)

---

### Method 2: Contrast Analysis — "These Look the Same, But Aren't"

#### The Idea

The human brain is extraordinarily good at causal reasoning when given the right comparison. Show an analyst two groups of captains that *should* behave the same (identical existing segments) but *don't* — and the analyst will start generating hypotheses immediately.

The system's job is to construct these comparisons and do the exhaustive feature search. The analyst's job is to interpret the results and form the narrative.

#### Concrete Implementation

**Step 1: Define the contrast**

The user specifies:
- A **base population** (e.g., "Daily-HP captains in Bangalore")
- A **splitting outcome** (e.g., "churned in the next 28 days" vs "did not churn")

Or the system auto-detects interesting contrasts: "Among Daily-HP captains in Bangalore, 12% churned in the last 28 days. This is anomalously high (z = 2.3 vs the historical baseline). Want to investigate?"

**Step 2: Build the two groups**

```sql
-- Group A: Daily-HP captains who churned (0 net_days in next 28-day window)
-- Group B: Daily-HP captains who did NOT churn

-- Both groups are identical on: consistency=daily, performance=HP, city=bangalore
-- They differ only on the outcome: churn vs survive
```

**Step 3: Exhaustive feature comparison**

For every available feature (the full expanded feature set from Method 1), compute:

```
For each feature F:
  1. Distribution of F in Group A (churned)
  2. Distribution of F in Group B (survived)
  3. Statistical test:
     - Continuous features: Mann-Whitney U test (non-parametric, handles skew)
     - Categorical features: Chi-square test
  4. Effect size: Cohen's d (or rank-biserial correlation for non-parametric)
  5. p-value with Bonferroni correction (since we're testing many features)
```

**Step 4: Rank and present**

Rank features by effect size (not just p-value — with enough captains, everything is "significant"). Present the top 10 most discriminating features as a side-by-side comparison:

```
Feature Comparison: Churned vs Survived Daily-HP Captains (Bangalore)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Feature                    Churned (n=340)   Survived (n=2,810)   Effect Size
─────────────────────────────────────────────────────────────────────────────
daily_rides_cv             0.72              0.41                 +0.68 ***
earnings_per_login_hour    ₹142              ₹198                 -0.55 ***
idle_fraction              0.38              0.22                 +0.51 ***
rides_slope (28d)          -1.2/week         +0.3/week            -0.49 ***
incentive_share            0.31              0.18                 +0.43 **
evening_share              0.52              0.35                 +0.38 **
reject_rate                0.18              0.09                 +0.35 **
login_hour_cv              0.65              0.44                 +0.31 **
acceptance_rate (DAPR)     0.61              0.74                 -0.29 *
morning_share              0.15              0.31                 -0.27 *
```

Reading this output: "Churned Daily-HP captains had much more erratic daily rides (CV 0.72 vs 0.41), earned less per login hour (₹142 vs ₹198), had more idle time (38% vs 22%), and were on a declining trajectory. They also worked disproportionately in evenings, rejected more pings, and were more dependent on incentives."

**Step 5: The analyst synthesizes**

The analyst looks at this and constructs a narrative: "These are captains who are working hard but inefficiently — high idle, declining earnings per hour, increasingly dependent on incentives to maintain income. They're probably in low-demand zones during evening hours. They're not quitting because they're lazy — they're quitting because the economics stopped working for them."

That narrative IS the new segment definition. Name it: **"Eroding Economics"** — captains where earnings-per-effort is declining despite consistent activity.

#### Contrast Types You Can Run

| Base Population | Splitting Outcome | What You'll Discover |
|---|---|---|
| Daily-HP captains | Churned vs Retained | Hidden churn drivers in your best captains |
| Monthly-LP captains | Ramped to Weekly+ vs Stayed Monthly | What makes someone "level up" |
| All captains during incentive period | Responded (rides ↑ >20%) vs Didn't respond | Incentive elasticity factors |
| Captains with same rides/day | High earnings vs Low earnings | Efficiency secrets |
| New captains (first 28 days) | Fast ramp (>10 rides/day by day 28) vs Slow ramp | Onboarding success factors |
| Captains in same city/service | High DAPR vs Low DAPR | What drives acceptance behavior |
| Weekly captains | Promoted to Daily vs Demoted to Monthly | What causes segment transitions |

#### What This Method Is Good At

- Extremely intuitive for analysts — the comparison format triggers natural causal reasoning
- Doesn't require ML — pure statistical comparison
- The analyst picks the question (which contrast matters), the system does the exhaustive work
- Outputs are immediately actionable narratives

#### Limitations

- Requires the analyst to have a good splitting outcome in mind
- Only finds segments relevant to the chosen contrast
- Can miss nonlinear interactions (feature A only matters when feature B is high)

---

### Method 3: Stimulus-Response Analysis — "Reveal Character Through Change"

#### The Idea

The most psychologically grounded method. A captain's "true type" is hidden during normal operations — everyone looks roughly the same. But when conditions change, different captains respond differently, and those differences reveal stable underlying traits.

This is exactly how personality psychology works: you don't know someone's stress response until they're stressed. You don't know their risk tolerance until they face risk.

#### Identifying Stimuli In Your Data

You don't need to run experiments to get stimuli. Natural variation provides them constantly:

**Stimulus Type 1: Demand Fluctuations**

```sql
-- Detect city-level demand shocks: days where gross_pings deviate >1.5σ from 14-day rolling mean
-- Data: metrics.captain_base_metrics_enriched (aggregated to city-day level)

WITH city_daily AS (
  SELECT geo_city, yyyymmdd,
    SUM(count_captain_gross_pings_taxi_all_day_city) as city_gross_pings
  FROM metrics.captain_base_metrics_enriched
  WHERE yyyymmdd BETWEEN '20260301' AND '20260331'
  GROUP BY geo_city, yyyymmdd
),
city_stats AS (
  SELECT geo_city, yyyymmdd, city_gross_pings,
    AVG(city_gross_pings) OVER (
      PARTITION BY geo_city ORDER BY yyyymmdd
      ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING
    ) as rolling_mean,
    STDDEV(city_gross_pings) OVER (
      PARTITION BY geo_city ORDER BY yyyymmdd
      ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING
    ) as rolling_std
  FROM city_daily
)
SELECT geo_city, yyyymmdd, city_gross_pings,
  (city_gross_pings - rolling_mean) / NULLIF(rolling_std, 0) as demand_z_score
FROM city_stats
WHERE ABS((city_gross_pings - rolling_mean) / NULLIF(rolling_std, 0)) > 1.5
```

This gives you "demand shock days" — days where pings were abnormally high or low. Each shock is a natural experiment.

**Stimulus Type 2: Incentive Periods**

```sql
-- Detect periods where a captain received incentives vs didn't
-- Data: metrics.captain_base_metrics_enriched

SELECT captain_id, yyyymmdd,
  CASE WHEN sum_captain_special_incentives_daily_city > 0
       THEN 'incentive_active'
       ELSE 'no_incentive' END as incentive_state,
  sum_captain_special_incentives_daily_city as incentive_amount,
  count_captain_net_rides_taxi_all_day_city as rides,
  sum_captain_total_lh_daily_city as login_hours,
  sum_captain_final_captain_earnings_daily_city as earnings
FROM metrics.captain_base_metrics_enriched
WHERE geo_city = 'bangalore'
  AND yyyymmdd BETWEEN '20260201' AND '20260331'
```

For each captain, compare behavior in incentive-active days vs non-incentive days. The *ratio* of change is the response.

**Stimulus Type 3: Idle Shocks (Supply-Demand Mismatch)**

```sql
-- Days where a captain's idle fraction was abnormally high
-- (they were online but getting no rides — marketplace failure for them personally)

SELECT captain_id, yyyymmdd,
  sum_captain_idle_lh_daily_city / NULLIF(sum_captain_total_lh_daily_city, 0) as idle_fraction,
  -- What did they do the NEXT day?
  LEAD(sum_captain_total_lh_daily_city) OVER (
    PARTITION BY captain_id ORDER BY yyyymmdd
  ) as next_day_login_hours,
  LEAD(count_captain_net_rides_taxi_all_day_city) OVER (
    PARTITION BY captain_id ORDER BY yyyymmdd
  ) as next_day_rides
FROM metrics.captain_base_metrics_enriched
WHERE geo_city = 'bangalore'
  AND sum_captain_total_lh_daily_city > 2  -- Only captains who actually worked that day
```

How a captain behaves the day after a frustrating high-idle day reveals their **resilience type**.

**Stimulus Type 4: Earnings Shocks**

```sql
-- Days where earnings-per-hour deviated significantly from captain's personal average

WITH captain_stats AS (
  SELECT captain_id, yyyymmdd,
    sum_captain_final_captain_earnings_daily_city /
      NULLIF(sum_captain_total_lh_daily_city, 0) as eph,
    AVG(sum_captain_final_captain_earnings_daily_city /
      NULLIF(sum_captain_total_lh_daily_city, 0)) OVER (
      PARTITION BY captain_id ORDER BY yyyymmdd
      ROWS BETWEEN 14 PRECEDING AND 1 PRECEDING
    ) as personal_avg_eph
  FROM metrics.captain_base_metrics_enriched
  WHERE geo_city = 'bangalore'
    AND sum_captain_total_lh_daily_city > 2
)
SELECT captain_id, yyyymmdd,
  eph, personal_avg_eph,
  (eph - personal_avg_eph) / NULLIF(personal_avg_eph, 0) as eph_deviation
FROM captain_stats
```

This detects "good days" (eph >> average) and "bad days" (eph << average). What the captain does the next day reveals **target-earning vs income-maximizing** behavior:
- After a good day: target earners reduce hours (already hit target). Income maximizers maintain/increase (keep going while it's good).
- After a bad day: target earners increase hours (need to make up). Income maximizers reduce hours (not worth it today).

#### Computing Response Profiles

For each stimulus type, compute a per-captain **response metric**:

```python
# Example: Incentive Response Profile

for each captain:
    # Days with incentives
    incentive_days = days where special_incentives > 0
    # Days without incentives (control period: 7 days before first incentive)
    baseline_days = 7 days preceding the incentive period

    # Response metrics
    rides_response = mean(rides on incentive_days) / mean(rides on baseline_days) - 1
    hours_response = mean(lh on incentive_days) / mean(lh on baseline_days) - 1

    # Post-incentive persistence (7 days after incentive ends)
    post_days = 7 days after last incentive day
    persistence = mean(rides on post_days) / mean(rides on baseline_days) - 1

    # Response classification
    if rides_response > 0.2 and persistence > 0.1:
        response_type = "clay"        # Permanently changed
    elif rides_response > 0.2 and persistence < 0.05:
        response_type = "rubber_band" # Snapped back
    elif rides_response < 0.05:
        response_type = "stone"       # No response
    elif rides_response < -0.1:
        response_type = "contrarian"  # Reduced activity?? Investigate
```

```python
# Example: Earnings Shock Response (Target Earner Detection)

for each captain with >= 14 active days:
    daily_data = [(eph, login_hours) for each active day]

    # Correlation between earnings-per-hour and login hours
    # Negative = target earner (earns well → logs off early)
    # Positive = income maximizer (earns well → stays longer)
    target_earning_score = pearson_correlation(eph, login_hours)

    # Also compute: after bad day (bottom quartile eph), does next-day hours go up or down?
    bad_days = days in bottom 25% of personal eph
    next_day_hours_after_bad = mean(login_hours on day after bad_day)
    normal_hours = mean(login_hours on all days)

    loss_response = next_day_hours_after_bad / normal_hours - 1
    # Positive = loss-averse (works harder after bad day)
    # Negative = discouraged (works less after bad day)
    # Near zero = independent (doesn't react)
```

```python
# Example: Idle Frustration Response (Resilience Typing)

for each captain with >= 14 active days:
    # Find days with high idle (>50% of login time idle)
    high_idle_days = days where idle_fraction > 0.5

    for each high_idle_day:
        next_day_lh = login_hours on next active day
        typical_lh = median login_hours (excluding high-idle context)

    # How does login time change after a frustrating day?
    resilience_score = mean(next_day_lh / typical_lh) for all high_idle_days

    # > 1.0 = Persistent (tries again, works even harder)
    # 0.8-1.0 = Resilient (small dip, bounces back)
    # 0.5-0.8 = Discouraged (significant pullback)
    # < 0.5 = Fragile (major withdrawal after frustration)
```

#### Clustering By Response (Not By Baseline)

The key insight: **don't cluster captains by how many rides they do. Cluster them by how they respond to the same stimulus.**

```python
# Build a response feature vector per captain
response_vector = [
    incentive_rides_response,      # How much rides change during incentive
    incentive_persistence,         # How much sticks after incentive ends
    target_earning_score,          # Correlation(eph, login_hours)
    loss_response,                 # Next-day hours after bad earnings day
    resilience_score,              # Next-day hours after high-idle day
    demand_surge_response,         # Rides change on high-demand days
    demand_drop_response,          # Rides change on low-demand days
]

# Now cluster on responses
# Use HDBSCAN (not K-means) — it finds natural clusters without requiring you to guess K
# And it labels noise points as "unclassified" instead of forcing them into clusters

from hdbscan import HDBSCAN
clusterer = HDBSCAN(min_cluster_size=50, min_samples=10)
labels = clusterer.fit_predict(response_vectors)
```

But clustering is just the starting point. The analyst then examines each cluster:
- What's the cluster's response "personality"?
- Does it have a narrative? Can you explain it in one sentence?
- Is it stable over time? (Recompute with different 28-day windows, check overlap)

#### Example Output: What This Might Find

```
Response Cluster Analysis: Bangalore Daily Captains (n=8,412)
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Cluster 1 — "The Professionals" (34%)
  Incentive response: +8% rides (modest)
  Persistence: +6% (behavior sticks)
  Target earning: +0.15 (weak income maximizer)
  Loss response: +0.02 (unaffected by bad days)
  Resilience: 0.95 (bounces back quickly)
  → Stable, self-regulated. Incentives help but they'd work anyway.

Cluster 2 — "The Incentive Dependent" (19%)
  Incentive response: +45% rides (huge)
  Persistence: -5% (snaps back completely)
  Target earning: -0.08 (mild target earner)
  Loss response: +0.15 (works harder after bad days)
  Resilience: 0.82 (moderate dip after frustration)
  → Rubber bands. Active mostly when incentives exist.
    High effort during campaigns, ghost otherwise.

Cluster 3 — "The Optimizers" (22%)
  Incentive response: +12% rides (moderate)
  Persistence: +3% (some sticks)
  Target earning: -0.35 (strong target earner!)
  Loss response: +0.20 (compensates after bad days)
  Resilience: 1.05 (works MORE after frustration)
  → Hit their daily target and stop. Work harder on bad days.
    Won't give you more supply on peak days no matter what.

Cluster 4 — "The Fragile" (14%)
  Incentive response: +5% (barely)
  Persistence: -12% (WORSE than before!)
  Target earning: -0.05 (neutral)
  Loss response: -0.18 (discouraged by bad days)
  Resilience: 0.62 (major withdrawal after frustration)
  → Easily discouraged. Bad experiences push them away.
    Need protection from frustration, not incentives.

Cluster 5 — "The Explorers" (11%)
  Incentive response: +25% (significant, but in NEW services/times)
  Persistence: +15% (behavior changes permanently)
  Target earning: +0.22 (income maximizer)
  Loss response: -0.05 (neutral)
  Resilience: 0.88 (moderate)
  Service entropy: HIGH (tries multiple services)
  → Adaptable, curious. Respond to incentives by trying new things,
    not just doing more of the same. Natural early adopters.

Unclassified (noise): 0%  ← (if this is high, clusters aren't clean)
```

#### Why This Is Truly Orthogonal

Consider: a captain in **Cluster 3 ("Optimizers")** could be Daily-HP or Weekly-MP. Their consistency/performance segment tells you nothing about their target-earning behavior. An HP-Daily Optimizer and an HP-Daily Professional look identical on your dashboards. But:
- The Optimizer will NOT give you more supply on Friday evening even if you offer a bonus — they've already hit their target.
- The Professional will respond to a bonus because they're income-maximizing.

This is the kind of insight that changes how you design incentive programs.

---

### Method 4: Combined Method — "The Full Investigation"

In practice, the three methods are complementary and often used together in a single investigation:

```
1. START with Contrast Analysis
   "Daily-HP captains who churned vs survived — what's different?"
   → Surfaces candidate features (e.g., idle_fraction, earnings_cv, rides_slope)

2. VALIDATE with Residual Analysis
   "Does this feature improve our ability to predict churn after controlling
   for existing segments?"
   → Confirms orthogonality (yes, idle_fraction + earnings_cv add information
   beyond consistency × performance)

3. DEEPEN with Stimulus-Response
   "Among the high-idle-fraction captains, how do they respond to demand drops?"
   → Reveals subtypes (some are Patient Waiters who'll persist, others are
   Fragile who'll churn — same idle fraction, different response)

4. NAME and VALIDATE
   "Fragile High-Idle" captains — size check, stability check, orthogonality
   check, predictive power check.
   → Publish to segment catalog if passes.
```

---

## Part 2: Response Dimensions — The Psychology Layer

These aren't segments themselves. They're **axes** — continuous dimensions that measure a captain's behavioral tendency. Segments emerge when you find natural clusters along one or more axes.

### Axis 1: Incentive Elasticity

**What it measures:** How much does behavior change when incentives are present?

**Computation:**
```
For each captain:
  incentive_days: days where special_incentives > 0
  baseline_days: 14-day window before first incentive day

  elasticity = (mean_rides_incentive - mean_rides_baseline) / mean_rides_baseline

  persistence = (mean_rides_7d_after_incentive - mean_rides_baseline) / mean_rides_baseline
```

**Data columns:** `sum_captain_special_incentives_daily_city`, `count_captain_net_rides_taxi_all_day_city`

**What clusters might emerge:**
- Stone (elasticity ~0): Behavior unchanged by incentives
- Rubber Band (high elasticity, zero persistence): Activates during incentive, reverts immediately
- Clay (high elasticity, high persistence): Incentive creates a lasting habit change
- Negative (negative elasticity): Reduces activity during incentives (?!) — worth investigating, could be captains who were already at capacity or who dislike the pressure

**Validation question:** Does incentive elasticity predict ROI of future incentive campaigns? If yes, you should be targeting incentives at Clay captains and not wasting money on Stone or Rubber Bands.

### Axis 2: Target Earning Score

**What it measures:** Does the captain have a daily income target, or do they maximize hours?

This is from the seminal Camerer, Babcock, Loewenstein & Thaler (1997) study of NYC taxi drivers. They found that many drivers have a mental "daily target" — they work until they hit it, then stop. This means they work LESS on high-earnings days and MORE on low-earnings days — exactly the opposite of what classical economics predicts, and exactly wrong for marketplace supply.

**Computation:**
```
For each captain with >=14 active days:
  daily_data = [(earnings_per_hour, login_hours) for each active day]

  target_earning_score = pearson_correlation(earnings_per_hour, login_hours)

  # Negative = target earner (good earning days → shorter hours)
  # Positive = income maximizer (good earning days → longer hours)
  # Near zero = independent (hours don't depend on earnings)
```

**Data columns:** `sum_captain_final_captain_earnings_daily_city`, `sum_captain_total_lh_daily_city`

**Why this matters enormously:** Target earners systematically reduce supply when the marketplace needs it most (high-demand = high earnings/hour = target earner stops early). An incentive designed to add supply during peak hours will fail on target earners — they'll just hit their target faster and leave earlier. You need a completely different intervention for them (e.g., shift their target upward, or use loss-framed incentives like "you'll lose your bonus if you log off before 9pm").

### Axis 3: Frustration Resilience

**What it measures:** How does the captain respond to a bad day (high idle, low rides)?

**Computation:**
```
For each captain:
  Find all "frustration events": days where idle_fraction > 0.5
  AND total_lh > 2 hours (they actually tried to work)

  For each frustration event:
    next_day_lh = login hours on next active day
    baseline_lh = median login hours on non-frustration days

  resilience = median(next_day_lh / baseline_lh) across all frustration events

  # > 1.0 = Anti-fragile (gets stronger after bad days)
  # 0.85-1.0 = Resilient (small dip, recovers)
  # 0.6-0.85 = Sensitive (noticeable pullback)
  # < 0.6 = Fragile (major withdrawal)
```

**Data columns:** `sum_captain_idle_lh_daily_city`, `sum_captain_total_lh_daily_city`

**Why this matters:** Fragile captains are your biggest hidden churn risk. They look fine on consistency/performance segments — until they have a few bad days in a row, and then they vanish. The intervention isn't "more incentives" — it's "fewer frustrating experiences" (better ping matching, demand-side management in their zones, proactive support after detected frustration events).

### Axis 4: Behavioral Inertia

**What it measures:** How much does the captain's daily pattern vary? (Completely separate from how MUCH they work.)

**Computation:**
```
For each captain with >=14 active days:
  # Autocorrelation of daily behavioral vector
  daily_vector = [login_start_time, total_lh, morning_share, evening_share,
                  service_mix, rides_count]

  # Simple proxy: coefficient of variation across multiple features
  inertia_score = mean([
    1 - cv(daily_rides),
    1 - cv(daily_login_hours),
    1 - cv(tod_distribution),
    1 - cv(service_distribution)
  ])

  # High inertia = same pattern every day (habitual)
  # Low inertia = different every day (adaptive/contextual)
```

**Data columns:** All daily metrics from `captain_base_metrics_enriched`

**Why this matters:**
- High-inertia captains: Respond poorly to nudges (they have a routine and stick to it). Best reached through long-term structural changes, not day-to-day interventions.
- Low-inertia captains: Respond well to nudges but are hard to predict. Good targets for real-time incentives ("switch to delivery for the next 2 hours — bonus active").

### Axis 5: Earnings Efficiency Trajectory

**What it measures:** Not absolute earnings, but the *trend* in how efficiently the captain converts login hours to earnings.

**Computation:**
```
For each captain:
  weekly_eph = [earnings_per_hour for week 1, week 2, week 3, week 4]

  efficiency_slope = linear_regression_slope(weekly_eph)

  # Positive = getting more efficient (learning, better zone selection, higher DAPR)
  # Zero = stable efficiency
  # Negative = eroding efficiency (worse zones, more idle, marketplace deteriorating)
```

**Data columns:** `sum_captain_final_captain_earnings_daily_city`, `sum_captain_total_lh_daily_city`

**Why this matters:** A captain with eroding efficiency is on a path to churn even if their consistency segment still says "Daily." The consistency segment is a lagging indicator. Efficiency slope is a leading indicator. A captain whose ₹/hour is declining 5% per week will churn in 4-6 weeks even if they're still showing up every day today.

### Axis 6: Demand-Supply Fit Score

**What it measures:** How well does the marketplace work for this specific captain? (Not about the captain's behavior — about the system's behavior toward them.)

**Computation:**
```
For each captain:
  # Pings-per-online-hour: how much demand reaches them
  demand_exposure = gross_pings / total_lh

  # Rides-per-ping: how well demand converts for them
  conversion = net_rides / gross_pings

  # Idle fraction: how much time is wasted
  waste = idle_lh / total_lh

  # Composite: how well the marketplace serves this captain
  fit_score = (demand_exposure × conversion) / (1 + waste)
```

**Data columns:** `count_captain_gross_pings_taxi_all_day_city`, `sum_captain_total_lh_daily_city`, `count_captain_net_rides_taxi_all_day_city`, `sum_captain_idle_lh_daily_city`

**Why this matters:** This flips the perspective — instead of "what type of captain is this?" it asks "how well is Rapido serving this captain?" Two captains with the same rides/day might have very different fit scores (one gets lots of pings and converts well; the other gets few pings and converts poorly but compensates by working longer hours). The low-fit captains are at systemic churn risk, and the fix is marketplace-level (rebalancing, better matching), not captain-level (incentives, nudges).

---

## Part 3: Validation Framework

### The 6-Gate Test

Every candidate segment must pass through these gates. The system computes them automatically when the analyst clicks "Validate."

| Gate | Test | Threshold | Data Required |
|---|---|---|---|
| **1. Size** | % of relevant population | >5% | Captain count in segment vs total |
| **2. Separation** | KPI differences vs complement | Cohen's d > 0.3 on ≥2 KPIs, p < 0.01 after Bonferroni | All KPIs from enriched table |
| **3. Stability** | Membership overlap across time windows | >60% Jaccard similarity between consecutive 28-day windows | Recompute segment on 2+ windows |
| **4. Orthogonality** | Information gain over existing segments | Mutual information > 0.05 | Cross-tab with consistency × performance |
| **5. Predictive Lift** | Does knowing this segment improve outcome prediction? | AUC improvement > 0.02 on at least one outcome (churn, earnings, incentive response) | Model comparison with/without segment feature |
| **6. Actionability** | Does this imply a different intervention? | Qualitative — analyst must write one sentence: "For this segment, we would do X differently" | Human judgment |

Gate 6 is the most important and the only one that requires human input. A segment can pass gates 1-5 and still be useless if there's no action to take. "Left-handed captains" might be statistically valid and orthogonal — but so what?

### Validation Output

```
Segment Validation: "Target Earners"
━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━━

Definition: captains with correlation(eph, login_hours) < -0.25

Gate 1 — Size:           ✅ PASS  (23% of Daily captains, n=1,932)
Gate 2 — Separation:     ✅ PASS
  • rides on Fridays: -15% vs complement (d=0.42, p<0.001)
  • rides on Tuesdays: +22% vs complement (d=0.38, p<0.001)
  • incentive_response: -30% vs complement (d=0.55, p<0.001)
  • weekly total rides: no difference (d=0.03, p=0.71) ← KEY: same total, different distribution
Gate 3 — Stability:      ✅ PASS  (72% Jaccard overlap across March → April windows)
Gate 4 — Orthogonality:  ✅ PASS  (MI=0.08 vs consistency×performance; found across UHP, HP, MP)
Gate 5 — Predictive Lift: ✅ PASS  (AUC for predicting Friday supply: +0.04 with target_earning feature)
Gate 6 — Actionability:  ⏳ PENDING (analyst input required)

Prompt: "What would you do differently for Target Earners?"
→ Analyst: "Stop offering them per-ride bonuses on peak days — they'll just hit target
   faster and log off. Instead, use time-locked bonuses ('stay online until 9pm')
   or loss-framed incentives ('bonus forfeited if you log off before X')."
→ ✅ PASS — actionable, specific, different from default intervention.

RESULT: 6/6 gates passed → Ready to publish
```

---

## Part 4: The System Design

### The Researcher Workflow

```
┌──────────────────────────────────────────────────────────────────┐
│                        RESEARCHER                                 │
│                                                                   │
│  ┌────────────┐    ┌────────────┐    ┌────────────┐              │
│  │   FRAME    │───→│  EXPLORE   │───→│  VALIDATE  │              │
│  │            │    │            │    │            │              │
│  │ • Residual │    │ • Feature  │    │ • 6-gate   │──────┐      │
│  │ • Contrast │    │   plots    │    │   test     │      │      │
│  │ • Stimulus │    │ • Scatter  │    │ • Auto     │      │      │
│  │ • Surprise │    │ • Lasso    │    │   computed │      │      │
│  │   me       │    │ • Compare  │    │            │      │      │
│  └────────────┘    └────────────┘    └────────────┘      │      │
│       ↑                                                   │      │
│       │              ┌────────────┐                       │      │
│       │              │  PUBLISH   │←──────────────────────┘      │
│       └──────────────│            │                               │
│        (new question │ • Name     │                               │
│         from finding)│ • Card     │                               │
│                      │ • Function │                               │
│                      │ • Catalog  │                               │
│                      └────────────┘                               │
└──────────────────────────────────────────────────────────────────┘
```

### Making It Fun (Briefly)

The deep methods above might look intimidating. The UX should hide the complexity:

1. **"Surprise Me"** — One click. System runs Method 1 (residual) with "churn" as target, finds the most mispredicted captains, profiles them, and presents: "We found 340 captains that should have been active but churned. Here's what they have in common." The analyst just reads and reacts.

2. **"Why Did These Captains Churn?"** — User uploads a list (or picks "churned last month"). System runs Method 2 (contrast) against retained captains. Presents ranked features. Analyst reads and names.

3. **"How Did Captains React to [Event]?"** — User picks a date range and says "demand dropped 20% this week in Bangalore." System runs Method 3 (stimulus-response). Presents response clusters. Analyst reads and names.

4. **Lab Notebook** — Every click, every chart, every observation is automatically logged. The analyst can add notes. Other team members can read the notebook later and continue the investigation.

5. **Segment Catalog** — Published segments get a card (like the validation output above). Browsable. Searchable. Each card has: name, definition, key stats, discoverer, method used, investigation notebook link.

---

## Open Questions

1. **Is `sum_captain_special_incentives_daily_city` reliably populated?** If yes, the incentive elasticity axis is immediately computable. If it's sparse or unreliable, we need another proxy for incentive periods.

2. **Do you have experiment assignment data in Presto?** (`iceberg_experiment_v6_root`) — if we can link captains to experiments, every past experiment becomes a natural stimulus for Method 3.

3. **How many active captains are in Bangalore (or your target city)?** The stimulus-response method needs ~5K+ captains with 14+ active days each to produce reliable clusters.

4. **What outcome does your team care most about predicting?** Churn? Incentive ROI? Peak-hour supply? This determines which residual analysis to run first.

5. **Do you want the computation to happen in Presto (SQL) or in Python (backend)?** Feature computation can be done either way, but response profiles (correlations, slopes) are easier in Python post-query.
