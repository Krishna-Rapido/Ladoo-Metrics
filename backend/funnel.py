import pandas as pd
# import fastparquet
import numpy as np
import matplotlib.pyplot as plt
import seaborn as sns
from datetime import datetime
import os
import re
import logging

logger = logging.getLogger(__name__)

pd.set_option('display.max_columns', None)
from pyhive import presto

# --- Input validation helpers ---

# Allowlists for user-supplied identifiers used in SQL queries
ALLOWED_CITIES = {
    'delhi', 'bangalore', 'mumbai', 'hyderabad', 'chennai', 'kolkata',
    'pune', 'ahmedabad', 'jaipur', 'lucknow', 'chandigarh', 'kochi',
    'coimbatore', 'indore', 'nagpur', 'bhopal', 'visakhapatnam',
    'patna', 'vadodara', 'guwahati', 'surat', 'noida', 'gurgaon',
    'thiruvananthapuram', 'mysore', 'mangalore', 'bhubaneswar',
    'ranchi', 'dehradun', 'agra', 'varanasi', 'amritsar', 'ludhiana',
    'kanpur', 'nashik', 'rajkot', 'madurai', 'aurangabad', 'jodhpur',
    'raipur', 'gwalior', 'vijayawada', 'meerut', 'faridabad',
    'navi mumbai', 'thane', 'pimpri-chinchwad', 'kalyan-dombivali',
    'vasai-virar', 'salem', 'warangal', 'guntur', 'bhiwandi',
}

ALLOWED_SERVICE_CATEGORIES = {
    'bike_taxi', 'auto', 'cab', 'link', 'c2c', 'delivery', 'auto_c2c',
}

ALLOWED_SERVICE_VALUES = {
    'two_wheeler', 'three_wheeler', 'four_wheeler',
}

ALLOWED_TIME_LEVELS = {'daily', 'weekly', 'monthly'}
ALLOWED_TOD_LEVELS = {'daily', 'afternoon', 'evening', 'morning', 'night', 'all'}

# Regex for YYYYMMDD date format
_DATE_RE = re.compile(r'^\d{8}$')

# Regex for UUID (experiment_id)
_UUID_RE = re.compile(r'^[0-9a-fA-F]{8}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{4}-[0-9a-fA-F]{12}$')

# Regex for safe identifiers (alphanumeric + underscores + hyphens + spaces, lowercase)
_SAFE_IDENT_RE = re.compile(r'^[a-z0-9_\- ]+$')


def _validate_date(value: str, label: str = "date") -> str:
    """Validate and return a YYYYMMDD date string."""
    if not _DATE_RE.match(value):
        raise ValueError(f"Invalid {label} format: expected YYYYMMDD, got '{value}'")
    # Also verify it's a real date
    datetime.strptime(value, '%Y%m%d')
    return value


def _validate_city(value: str) -> str:
    """Validate city against allowlist (case-insensitive) and return lowercase."""
    normalized = value.strip().lower()
    if normalized not in ALLOWED_CITIES:
        # Fallback: allow if it matches a safe identifier pattern (new cities may be added)
        if not _SAFE_IDENT_RE.match(normalized):
            raise ValueError(f"Invalid city: '{value}'. Must be alphanumeric.")
        logger.warning("City '%s' not in allowlist but passes safe-identifier check.", normalized)
    return normalized


def _validate_service_category(value: str) -> str:
    """Validate service_category against allowlist."""
    normalized = value.strip().lower()
    if normalized not in ALLOWED_SERVICE_CATEGORIES:
        if not _SAFE_IDENT_RE.match(normalized):
            raise ValueError(f"Invalid service_category: '{value}'.")
        logger.warning("service_category '%s' not in allowlist but passes safe-identifier check.", normalized)
    return normalized


def _validate_service_value(value: str) -> str:
    """Validate service_value against allowlist."""
    normalized = value.strip().lower()
    if normalized not in ALLOWED_SERVICE_VALUES:
        if not _SAFE_IDENT_RE.match(normalized):
            raise ValueError(f"Invalid service_value: '{value}'.")
        logger.warning("service_value '%s' not in allowlist but passes safe-identifier check.", normalized)
    return normalized


def _validate_experiment_id(value: str) -> str:
    """Validate experiment_id as UUID or safe alphanumeric string."""
    stripped = value.strip()
    if _UUID_RE.match(stripped):
        return stripped
    # Allow alphanumeric with hyphens/underscores
    if re.match(r'^[a-zA-Z0-9_-]+$', stripped):
        return stripped
    raise ValueError(f"Invalid experiment_id: '{value}'. Must be a UUID or alphanumeric.")


def _escape_sql_string(value: str) -> str:
    """Escape single quotes in a string for safe SQL interpolation."""
    return value.replace("'", "''")


def get_presto_connection(username: str):
    """Create a Presto connection with the given username"""
    # Read Presto host from environment variable, fallback to default
    presto_host = os.environ.get('PRESTO_HOST', 'bi-trino-4.serving.data.production.internal')
    presto_port = int(os.environ.get('PRESTO_PORT', '80'))
    presto_connection = presto.connect(presto_host, presto_port, username=username)
    return presto_connection



def get_captain_id(mobile_number_df: pd.DataFrame, username: str):
    """
    Fetch captain_id for given mobile numbers from Presto
    
    Args:
        mobile_number_df: DataFrame with 'mobile_number' column
        username: Presto username for connection
    
    Returns:
        DataFrame with mobile_number and captain_id columns
    """
    presto_connection = get_presto_connection(username)
    
    query = f"""
    select captain_id, mobile_number from 
    datasets.captain_supply_journey_summary
    where date_format(date_parse(registration_date, '%Y-%m-%d'), '%Y%m%d') > '20200101'
    and mobile_number in {tuple(list(map(str, (mobile_number_df.mobile_number.unique()))))}
    
    """
    df = pd.read_sql(query, presto_connection)
    # Ensure the 'mobile_number' column is of the same dtype before merging
    mobile_number_df['mobile_number'] = mobile_number_df['mobile_number'].astype(str)
    df['mobile_number'] = df['mobile_number'].astype(str)
    return mobile_number_df.merge(df, on='mobile_number', how='left')



def get_ao_funnel(captain_id_df: pd.DataFrame, username: str, start_date: str = '20250801', 
                  end_date: str = '20251031', time_level: str = 'daily', tod_level: str = 'daily'):
    """
    Fetch AO funnel metrics for given captain IDs from Presto
    
    Args:
        captain_id_df: DataFrame with 'captain_id' column
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format (default: '20250801')
        end_date: End date in YYYYMMDD format (default: '20251031')
        time_level: Time aggregation level - 'daily', 'weekly', or 'monthly' (default: 'daily')
        tod_level: Time of day level - 'daily', 'afternoon', 'evening', 'morning', 'night', or 'all' (default: 'daily')
    
    Returns:
        DataFrame with funnel metrics
    """
    presto_connection = get_presto_connection(username)
    
    query = f"""


    with service_mapping as (
                    select captain_id,  geo_city geo_city, substr(replace(time_value,'-',''),1,8) as run_date,
                        case 
                            when count_net_days_last_28_days >= 15 then 'daily'
                            when count_net_days_last_28_days<= 14 and count_net_days_last_28_days >= 1 and count_net_weeks_last_28_days>=3 then 'weekly'
                            when count_net_days_last_28_days<= 14 and count_net_days_last_28_days >= 1 and count_net_weeks_last_28_days<3 then 'monthly'
                            when count_net_days_last_28_days =0 and captain_net_days_last_83_days > 0 then 'quarterly'
                        else 'rest' end as consistency_segment, 
                        case 
                            when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 15 then 'UHP'
                            when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 10 then 'HP'
                            when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 5 then 'MP'
                            when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 0 then 'LP'
                        else 'ZP' end as performance_segment
                    from mne.ms_1842554619_2584218394
                    where time_level = 'daily'
                    and replace(substr(time_value,1,10),'-','') between '{start_date}'  and '{end_date}'
                    and lower(geo_city) in ('hyderabad','bangalore','delhi','ahmedabad','chennai','jaipur','lucknow','mumbai','kolkata','pune')
    ),
    base as (
        
        select lower(a.city) as city,
        a.captain_id,
        b.consistency_segment,
        b.performance_segment,
        case 
            when lower('{time_level}')='weekly' then concat(cast(year(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar),'_',cast(week(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar))
            when lower('{time_level}')='monthly' then concat(cast(year(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar),'_',cast(month(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar))
            when lower('{time_level}')='daily' then yyyymmdd
        end as time,
        sum(
        case
            when lower('{tod_level}') = 'daily' then coalesce(count_captain_num_online_daily_city, 0)
            when lower('{tod_level}') = 'afternoon' then coalesce(count_num_online_afternoon_daily_city, 0)
            when lower('{tod_level}') = 'evening' then coalesce(count_num_online_evening_peak_daily_city, 0)
            when lower('{tod_level}') = 'morning' then coalesce(count_num_online_morning_peak_daily_city, 0)
            when lower('{tod_level}') = 'night' then coalesce(count_num_online_rest_midnight_daily_city, 0)
            when lower('{tod_level}') = 'all' then coalesce(count_captain_num_online_daily_city, 0)
        end
    ) as online_events,
    count(distinct case when coalesce(count_captain_num_online_daily_city, 0) > 0 then yyyymmdd end) as online_days,
    count(distinct case when (coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) > 0 then yyyymmdd end) as net_days,
    sum(
        case
            when lower('{tod_level}') = 'daily' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
            when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_delivery_afternoon_city, 0)
            when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_taxi_evening_peak_city, 0)
            when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_taxi_morning_peak_city, 0)
            when lower('{tod_level}') = 'night' then coalesce(count_captain_net_rides_taxi_rest_midnight_city, 0)
            when lower('{tod_level}') = 'all' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
        end
    ) as net_rides_taxi,
    sum(
        case
            when lower('{tod_level}') = 'daily' then coalesce(count_captain_c2c_orders_all_day_city, 0)
            when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_c2c_afternoon_city, 0)
            when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_c2c_evening_peak_city, 0)
            when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_c2c_morning_peak_city, 0)
            when lower('{tod_level}') = 'night' then coalesce(count_captain_c2c_orders_all_day_city, 0)
            when lower('{tod_level}') = 'all' then coalesce(count_captain_c2c_orders_all_day_city, 0)
        end
    ) as net_rides_c2c,
    sum(
        case
            when lower('{tod_level}') = 'daily' then coalesce(count_captain_delivery_orders_all_day_city, 0)
            when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_delivery_afternoon_city, 0)
            when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_delivery_evening_peak_city, 0)
            when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_delivery_morning_peak_city, 0)
            when lower('{tod_level}') = 'night' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
            when lower('{tod_level}') = 'all' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
        end
    ) as net_rides_delivery,
    count(distinct case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then yyyymmdd end) as accepted_days,
    avg(
        case
            when lower('{tod_level}') = 'daily' then (coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))
            when lower('{tod_level}') = 'afternoon' then (coalesce(count_captain_accepted_orders_afternoon_taxi, 0))
            when lower('{tod_level}') = 'evening' then (coalesce(count_captain_accepted_orders_evening_peak_c2c, 0) + coalesce(count_captain_accepted_orders_evening_peak_delivery, 0) + coalesce(count_captain_accepted_orders_evening_peak_taxi, 0))
            when lower('{tod_level}') = 'morning' then (coalesce(count_captain_accepted_pings_morning_peak_delivery, 0) + coalesce(count_captain_accepted_pings_morning_peak_c2c, 0) + coalesce(count_captain_accepted_orders_morning_peak_taxi, 0))
            when lower('{tod_level}') = 'night' then coalesce(count_num_online_rest_midnight_daily_city, 0)
            when lower('{tod_level}') = 'all' then (coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))
        end
    ) as accepted_orders,
    sum(coalesce(count_captain_accepted_orders_all_day_taxi, 0)) as accepted_orders_sum, -- Renamed to avoid duplicate alias
    count(distinct case when (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) > 0 then yyyymmdd end) as gross_days,
    count(distinct case when coalesce(count_captain_number_app_open_captains_daily_all_day_city, 0) > 0 then yyyymmdd end) as ao_days,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 and (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) = 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh_nonO2a,
    sum(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) else 0 end) as total_lh_sum,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh,
    max(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as max_lh_per_day,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_morning_peak_daily_city, 0) end) as total_lh_morning_peak,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_afternoon_daily_city, 0) end) as total_lh_afternoon,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_evening_peak_daily_city, 0) end) as total_lh_evening_peak,
    avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_idle_lh_daily_city, 0) end) as idle_lh,
    sum(coalesce(count_captain_gross_pings_link_all_day_city, 0)) as total_pings_link,
    avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) end) as gross_pings,
    avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) end) as accepted_pings,
    sum(coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) / nullif(cast(sum(coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) as double), 0) as dapr
    from metrics.captain_base_metrics_enriched a
    left join service_mapping b on a.captain_id = b.captain_id and a.yyyymmdd = b.run_date
    where 
    yyyymmdd >= '{start_date}'
    and yyyymmdd <= '{end_date}'
    and a.captain_id in {tuple(list(captain_id_df.captain_id.dropna().unique()))}
    
    group by 1,2,3,4,5
    )

    select * from base


    """.format(tod_level=tod_level, time_level=time_level, start_date=start_date, end_date=end_date)
    df = pd.read_sql_query(query, presto_connection)
    captain_id_df['captain_id'] = captain_id_df['captain_id'].astype(str)
    df['captain_id'] = df['captain_id'].astype(str)
    return captain_id_df.merge(df, on='captain_id', how='inner')


def dapr_bucket(username: str, start_date: str, end_date: str, city: str, service_category: str, low_dapr: float, high_dapr: float):
    """
    Fetch DAPR bucket distribution data from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'delhi', 'bangalore')
        service_category: Service category
        low_dapr: Low DAPR threshold
        high_dapr: High DAPR threshold
    
    Returns:
        DataFrame with DAPR bucket distribution
    """
    presto_connection = get_presto_connection(username)
    query = f"""
    with mapping as (SELECT 
       service_category,
       service_level
FROM datasets.service_level_mapping_qc   
where service_category = '{service_category}'
group by 1,2) , 

city as (SELECT 
       city_display_name  
FROM datasets.service_level_mapping_qc   
where lower(city_display_name) = lower('{city}')
group by 1) , 


dapr as ( 
SELECT 
    yyyymmdd, 
    captain_id, 
    city_name, 
    CASE 
        WHEN accepted_pings < 20 THEN 'less_than_20_pings'
        WHEN dapr <= {low_dapr} AND accepted_pings >= 20 THEN 'BAD'
        WHEN dapr >= {high_dapr} AND accepted_pings >= 20 THEN 'GOOD' 
        WHEN dapr > {low_dapr} AND dapr < {high_dapr} AND accepted_pings >= 20 THEN 'AVG' 
    END AS Dapr_bucket
FROM reports_internal.marketplace_dapr_twenty_pings_combined_v7_v8
WHERE yyyymmdd >= '{start_date}'
and yyyymmdd <= '{end_date}'
AND service_category IN (SELECT service_category FROM mapping)
AND city_name IN (SELECT city_display_name FROM city)),
    

    
active as (select *
from
(select captainid ,a.yyyymmdd , Dapr_bucket ,
sum(net_orders) as dropped_rides_day, sum(accepted_pings) as accp_pings_day,
sum(accepted_pings + riderrejected_pings + riderbusy_pings) as pings_rec_day,
sum(accepted_pings)-sum(net_orders) as cancelled_day
from datasets.captain_svo_daily_kpi a
left join dapr b on a.captainid=b.captain_id and a.city=b.city_name and a.yyyymmdd=b.yyyymmdd

where a.yyyymmdd >= '{start_date}'
and a.yyyymmdd <= '{end_date}'

    and service_name in (select  service_level from mapping )
    and city in (select city_display_name  from city )
    and Dapr_bucket is not null
group by 1,2,3
having  sum(accepted_pings + riderrejected_pings + riderbusy_pings)>0))

select yyyymmdd  ,Dapr_bucket , active_caps , dropped , total_pings ,  cancelled , 
active_caps/cast(active_caps_total as real ) as per_caps ,
total_pings/cast(pings_total as real ) as per_total_pings ,
accepted/cast(accepted_total as real ) as per_accp ,
dropped/cast(dropped_total as real ) as per_dropped ,
cancelled/cast(cancelled_total as real ) as per_cancel,
100*dropped/cast(accepted as real ) as avg_dapr
from
(select a.yyyymmdd  ,case when Dapr_bucket is null then 'less_than_20_pings' else Dapr_bucket end as Dapr_bucket, 
active_caps_total,dropped_total , accepted_total , pings_total , cancelled_total , 
count(captainid) as active_caps , 
sum(dropped_rides_day) as dropped,
sum(accp_pings_day) as accepted,
sum(pings_rec_day) as total_pings , 
sum(cancelled_day) as cancelled
from active a
inner join (select yyyymmdd , 
count(captainid) active_caps_total, 
sum(dropped_rides_day) as dropped_total,
sum(accp_pings_day) as accepted_total,
sum(pings_rec_day) as pings_total , 
sum(cancelled_day) as cancelled_total
from active
where Dapr_bucket is not null
group by 1
) b on a.yyyymmdd = b.yyyymmdd
group by 1,2,3,4,5,6,7
)
order by  yyyymmdd , Dapr_bucket

    """
    df = pd.read_sql_query(query, presto_connection)
    return df


def fe2net(username: str, start_date: str, end_date: str, city: str, service_category: str, geo_level: str, time_level: str):
    """
    Fetch FE2Net funnel data from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'delhi', 'bangalore')
        service_category: Service category
        geo_level: Geographic level (e.g., 'city', 'zone')
        time_level: Time aggregation level (e.g., 'daily', 'weekly')
    
    Returns:
        DataFrame with FE2Net funnel metrics
    """
    presto_connection = get_presto_connection(username)
    
    query = f"""
    select
    city as "City", 
    time_level as "Time Level", 
    time_value as "Time Value",
    geo_level as "Geo Level",
    geo_value as "Geo Value",
    service as Service,
    login_hours,
    fe_sessions,
    gross_session,
    fe2rr,
    fe2net,
    gsr2net,
    gross_orders,
    mapped_orders,
    net_orders,
    g2n_req_percent,
    g2n_mapped_percent,
    stress_gsr_login_hours,
    accepted_orders_out_of_mapped as AOR,
    accepted_orders_out_of_gross_percent,
    total_pings,
    net_order_per_login_hour,
    unmapped_orders_percent,
    stockout_percent,
    cobrm_percent,
    expiry_mapped_percent,
    cobra_percent,
    ocara_percent,
    avg_mr as avg_mapped_riders_count,
    median_mr as median_mapped_riders_count,
    online_captains,
    gross_captains,
    net_captains,
    idle_hours,
    time_spent_earning_percent,
    login_hours_per_online_captain,
    rph,
    rides_per_net_rider,
    apr,
    rider_busy_percent,
    rider_reject_percent,
    dpr,
    dapr,
    matching_efficiency_pings_per_net_order,
    avg_fm_accepted_orders_kms,
    median_fm_accepted_orders_kms,
    avg_fm_dropped_orders_kms,
    median_fm_dropped_orders_kms,
    avg_fm_ocara_orders_kms,
    median_fm_ocara_orders_kms,
    avg_shown_eta,
    avg_actual_eta,
    avg_tta_secs
from experiments.fe2net_dashboard_lite
where
 substr(replace(time_value,'-',''),1,10) >= '{start_date}' 
and substr(replace(time_value,'-',''),1,10) <= '{end_date}'
    and service = '{service_category}'
    and geo_level = '{geo_level}'
    and lower(city) = lower('{city}')
    and time_level = '{time_level}'
    -- [[and {{geo_value}}]]
    and geo_value != ''
order by 3 asc
    """
    df = pd.read_sql_query(query, presto_connection)
    return df

def performance_metrics(username: str, start_date: str, end_date: str, city: str, perf_cut: int, consistency_cut: int, time_level: str, tod_level: str, service_category: str):
    """
    Fetch RTU performance metrics from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'delhi', 'hyderabad')
        perf_cut: Performance cut threshold
        consistency_cut: Consistency cut threshold
        time_level: Time aggregation level ('daily', 'weekly', 'monthly')
        tod_level: Time of day level ('daily', 'afternoon', 'evening', 'morning', 'night', 'all')
        service_category: Service category (e.g., 'auto', 'bike')
    
    Returns:
        DataFrame with RTU performance metrics
    """
    presto_connection = get_presto_connection(username)
    query = f"""
    with 
service_mapping as (
                 
                 select captain_id,  geo_city city, date_format(date_parse(substr(replace(time_value,'-',''),1,8), '%Y%m%d') + interval '1' day,'%Y%m%d') as run_date,
                    row_number() over(partition by captain_id order by time_value asc) as rank,
                    case 
                        -- when count_net_days_last_28_days >= 21 then 'dailydaily'
                        when count_net_days_last_28_days >= 15 then 'daily'
                        when count_net_days_last_28_days<= 14 and count_net_days_last_28_days >= 1 and count_net_weeks_last_28_days>=3 then 'weekly'
                        when count_net_days_last_28_days<= 14 and count_net_days_last_28_days >= 1 and count_net_weeks_last_28_days<3 then 'monthly'
                        when count_net_days_last_28_days =0 and captain_net_days_last_83_days > 0 then 'quarterly'
                    else 'rest' end as consistency_segment, 
                    case 
                        when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 15 then 'UHP'
                        when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 10 then 'HP'
                        when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 5 then 'MP'
                        when count_net_days_last_28_days>0 and count_total_rides_last_28_days/cast(count_net_days_last_28_days as double) > 0 then 'LP'
                    else 'ZP' end as performance_segment
                from mne.ms_1842554619_2584218394
                where lower(service_category) like lower(concat('%','{service_category}','%'))
                and time_level = 'daily'
                and cast(date_format(date_parse(substr(replace(time_value,'-',''),1,8), '%Y%m%d') + interval '1' day,'%Y%m%d') as varchar) >= '{start_date}' 
                and cast(date_format(date_parse(substr(replace(time_value,'-',''),1,8), '%Y%m%d') + interval '1' day,'%Y%m%d') as varchar) <= '{end_date}'
                and lower(geo_city) in (select lower(city_display_name) from datasets.service_level_mapping_qc where lower(city_display_name) = '{city}')
                and lower(service_category) like concat('%', lower('{service_category}'), '%')
),
 base as (
    select lower(a.city) as city,
    b.consistency_segment,
    b.performance_segment,
    
    a.captain_id,
    case 
        when lower('{time_level}')='weekly' then concat(cast(year(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar),'_',cast(week(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar))
        when lower('{time_level}')='monthly' then concat(cast(year(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar),'_',cast(month(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar))
        when lower('{time_level}')='daily' then yyyymmdd
    end as time,
    sum(
    case
        when lower('{tod_level}') = 'daily' then coalesce(count_captain_num_online_daily_city, 0)
        when lower('{tod_level}') = 'afternoon' then coalesce(count_num_online_afternoon_daily_city, 0)
        when lower('{tod_level}') = 'evening' then coalesce(count_num_online_evening_peak_daily_city, 0)
        when lower('{tod_level}') = 'morning' then coalesce(count_num_online_morning_peak_daily_city, 0)
        when lower('{tod_level}') = 'night' then coalesce(count_num_online_rest_midnight_daily_city, 0)
        when lower('{tod_level}') = 'all' then coalesce(count_captain_num_online_daily_city, 0)
    end
   ) as online_events,
   count(distinct case when coalesce(count_captain_num_online_daily_city, 0) > 0 then yyyymmdd end) as online_days,
   count(distinct case when (coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) > 0 then yyyymmdd end) as net_days,
   sum(
    case
        when lower('{tod_level}') = 'daily' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
        when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_delivery_afternoon_city, 0)
        when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_taxi_evening_peak_city, 0)
        when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_taxi_morning_peak_city, 0)
        when lower('{tod_level}') = 'night' then coalesce(count_captain_net_rides_taxi_rest_midnight_city, 0)
        when lower('{tod_level}') = 'all' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
    end
   ) as net_rides_taxi,
   sum(
    case
        when lower('{tod_level}') = 'daily' then coalesce(count_captain_c2c_orders_all_day_city, 0)
        when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_c2c_afternoon_city, 0)
        when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_c2c_evening_peak_city, 0)
        when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_c2c_morning_peak_city, 0)
        when lower('{tod_level}') = 'night' then coalesce(count_captain_c2c_orders_all_day_city, 0)
        when lower('{tod_level}') = 'all' then coalesce(count_captain_c2c_orders_all_day_city, 0)
    end
   ) as net_rides_c2c,
   sum(
    case
        when lower('{tod_level}') = 'daily' then coalesce(count_captain_delivery_orders_all_day_city, 0)
        when lower('{tod_level}') = 'afternoon' then coalesce(count_captain_net_rides_delivery_afternoon_city, 0)
        when lower('{tod_level}') = 'evening' then coalesce(count_captain_net_rides_delivery_evening_peak_city, 0)
        when lower('{tod_level}') = 'morning' then coalesce(count_captain_net_rides_delivery_morning_peak_city, 0)
        when lower('{tod_level}') = 'night' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
        when lower('{tod_level}') = 'all' then coalesce(count_captain_net_rides_taxi_all_day_city, 0)
    end
   ) as net_rides_delivery,
   count(distinct case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then yyyymmdd end) as accepted_days,
   avg(
    case
        when lower('{tod_level}') = 'daily' then (coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))
        when lower('{tod_level}') = 'afternoon' then (coalesce(count_captain_accepted_orders_afternoon_taxi, 0))
        when lower('{tod_level}') = 'evening' then (coalesce(count_captain_accepted_orders_evening_peak_c2c, 0) + coalesce(count_captain_accepted_orders_evening_peak_delivery, 0) + coalesce(count_captain_accepted_orders_evening_peak_taxi, 0))
        when lower('{tod_level}') = 'morning' then (coalesce(count_captain_accepted_pings_morning_peak_delivery, 0) + coalesce(count_captain_accepted_pings_morning_peak_c2c, 0) + coalesce(count_captain_accepted_orders_morning_peak_taxi, 0))
        when lower('{tod_level}') = 'night' then coalesce(count_num_online_rest_midnight_daily_city, 0)
        when lower('{tod_level}') = 'all' then (coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))
    end
   ) as accepted_orders,
   sum(coalesce(count_captain_accepted_orders_all_day_taxi, 0)) as accepted_orders_sum, -- Renamed to avoid duplicate alias
   count(distinct case when (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) > 0 then yyyymmdd end) as gross_days,
   count(distinct case when coalesce(count_captain_number_app_open_captains_daily_all_day_city, 0) > 0 then yyyymmdd end) as ao_days,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 and (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) = 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh_nonO2a,
   sum(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) else 0 end) as total_lh_sum,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh,
   max(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as max_lh_per_day,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_morning_peak_daily_city, 0) end) as total_lh_morning_peak,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_afternoon_daily_city, 0) end) as total_lh_afternoon,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_evening_peak_daily_city, 0) end) as total_lh_evening_peak,
   avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_idle_lh_daily_city, 0) end) as idle_lh,
   sum(coalesce(count_captain_gross_pings_link_all_day_city, 0)) as total_pings_link,
   avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) end) as gross_pings,
   avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) end) as accepted_pings,
   sum(coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) / nullif(cast(sum(coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) as double), 0) as dapr,
   sum(coalesce(sum_captain_take_daily_city,0)) as take_amount,
   sum(coalesce(sum_captain_cm_daily_city,0)) as cm_amount,
   sum(coalesce(sum_captain_order_earnings_daily_city,0)) as order_earnings_amount,
   sum(coalesce(sum_captain_subs_orders_daily_city,0)) as subs_orders,
   sum(coalesce(sum_captain_final_captain_earnings_daily_city,0)) as final_earnings_amount,
   sum(coalesce(sum_captain_gmv_daily_city,0)) as gmv_amount,
   sum(coalesce(sum_captain_special_incentives_daily_city, 0)) incentive_amount
    from metrics.captain_base_metrics_enriched a
    left join service_mapping b
        on a.captain_id=b.captain_id
        and yyyymmdd=run_date
    where substr(replace(yyyymmdd, '-', ''), 1,8) >= '{start_date}' 
        and substr(replace(yyyymmdd, '-', ''), 1,8) <= '{end_date}'
        and lower(a.city) in (select lower(city_display_name) from datasets.service_level_mapping_qc where lower(city_display_name) = '{city}')
        and lower(service_category) like concat('%','{service_category}', '%')
    group by 1,2,3,4,5
),
finalTbl as (select 
     
    case 
       when {perf_cut}=1 and {consistency_cut}=1 then concat(coalesce(city,'NA'),'_pef_',coalesce(performance_segment,'NA'),'_cons_',coalesce(consistency_segment,'NA'))
       when {perf_cut}=0 and {consistency_cut}=1 then concat(coalesce(city,'NA'),'_cons_',coalesce(consistency_segment,'NA')) 
       when {perf_cut}=1 and {consistency_cut}=0 then concat(coalesce(city,'NA'),'_pef_',coalesce(performance_segment,'NA'))
       when {perf_cut}=0 and {consistency_cut}=0 then coalesce(city,'NA') 
       end as groupedValue,
    time,
    -- approx_percentile(base.gross_days, 0.1) gross_days_10,
    -- approx_percentile(base.gross_days, 0.25) gross_days_25,
    -- approx_percentile(base.gross_days, 0.5) gross_days_50,
    -- approx_percentile(base.gross_days, 0.75) gross_days_75,
    -- approx_percentile(base.gross_days, 0.9) gross_days_90,
    -- approx_percentile(base.accepted_days, 0.1) accepted_days_10,
    -- approx_percentile(base.accepted_days, 0.25) accepted_days_25,
    -- approx_percentile(base.accepted_days, 0.5) accepted_days_50,
    -- approx_percentile(base.accepted_days, 0.75) accepted_days_75,
    -- approx_percentile(base.accepted_days, 0.9) accepted_days_90,
    
    -- approx_percentile(case when online_events>0 then coalesce(base.total_lh/cast(online_events as double),0)*60 end, 0.1) lh_session_10,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_lh/cast(online_events as double),0)*60 end, 0.25) lh_session_25,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_lh/cast(online_events as double),0)*60 end, 0.5) lh_session_50,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_lh/cast(online_events as double),0)*60 end, 0.75) lh_session_75,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_lh/cast(online_events as double),0)*60 end, 0.9) lh_session_90,
    
    -- approx_percentile(case when online_events>0 then coalesce(base.total_pings_link/cast(online_events as double),0) end, 0.1) pings_per_session_10,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_pings_link/cast(online_events as double),0) end, 0.25) pings_per_session_25,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_pings_link/cast(online_events as double),0) end, 0.5) pings_per_session_50,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_pings_link/cast(online_events as double),0) end, 0.75) pings_per_session_75,
    -- approx_percentile(case when online_events>0 then coalesce(base.total_pings_link/cast(online_events as double),0) end, 0.9) pings_per_session_90,
    
    -- approx_percentile(case when total_lh>0 then coalesce(base.total_pings_link/cast(total_lh as double),0) end, 0.1) pings_per_hour_10,
    -- approx_percentile(case when total_lh>0 then coalesce(base.total_pings_link/cast(total_lh as double),0) end, 0.25) pings_per_hour_25,
    -- approx_percentile(case when total_lh>0 then coalesce(base.total_pings_link/cast(total_lh as double),0) end, 0.5) pings_per_hour_50,
    -- approx_percentile(case when total_lh>0 then coalesce(base.total_pings_link/cast(total_lh as double),0) end, 0.75) pings_per_hour_75,
    -- approx_percentile(case when total_lh>0 then coalesce(base.total_pings_link/cast(total_lh as double),0) end, 0.9) pings_per_hour_90,
    -- count(distinct case when non_gig_segment_nonO2a_daily =1 then captain_id end) as non_gig_segment_nonO2a_daily,
    -- count(distinct case when rha_segment_nonO2a_daily =1 then captain_id end) as rha_segment_nonO2a_daily,
    -- count(distinct case when non_gig_segment_O2a_daily =1 then captain_id end) as non_gig_segment_O2a_daily,
    -- count(distinct case when rha_gig_segment_O2a_daily =1 then captain_id end) as rha_segment_O2a_daily,
    count(distinct case when base.ao_days>0 then captain_id end) as ao_captains,
    count(distinct case when base.online_days>0 then captain_id end) as online_captains,
    count(distinct case when base.gross_days>0 then captain_id end) as gross_captains,
    count(distinct case when base.accepted_days>0 then captain_id end) as acc_captains,
    count(distinct case when base.net_days>0 then captain_id end) as net_captains,
    (
        count(distinct case when base.online_days>0 and base.ao_days>0 then captain_id end)/
        cast(count(distinct case when base.ao_days>0 then captain_id end) as double)
    ) ao2o,
    (
        count(distinct case when base.net_days>0 and base.accepted_days>0  and  base.online_days>0 then captain_id end)/
          cast(count(distinct case when base.online_days>0 then captain_id end) as double)
    ) o2n,
    (
        count(distinct case when base.gross_days>0 and base.online_days>0  then captain_id end)/
        cast(count(distinct case when base.online_days>0 then captain_id end) as double)
    ) o2g,
    (
        count(distinct case when base.accepted_days>0 and base.gross_days>0 then captain_id end)/
        cast(count(distinct case when base.gross_days>0 then captain_id end) as double)
    ) g2a,
    (
        count(distinct case when base.net_days>0 and base.accepted_days>0 then captain_id end)/
        cast(count(distinct case when base.accepted_days>0 then captain_id end) as double)
    ) a2n,
    
    (
        count(distinct case when base.gross_days>0 and base.ao_days>0  then captain_id end)/
        cast(count(distinct case when base.ao_days>0 then captain_id end) as double)
    ) gross_per_ao,
    (
        count(distinct case when base.accepted_days>0 and base.ao_days>0 then captain_id end)/
        cast(count(distinct case when base.ao_days>0 then captain_id end) as double)
    ) acc_per_ao,
    (
        count(distinct case when base.net_days>0 and base.ao_days>0 then captain_id end)/
        cast(count(distinct case when base.ao_days>0 then captain_id end) as double)
    ) net_per_ao,
    avg(case when base.gross_pings>0 then base.gross_pings end) as avg_gross_pings_when_gross,
    -- avg(case when base.gross_pings>0 and base.accepted_pings=0 then base.gross_pings end) as avg_gross_pings_when_non_acc,
    -- avg(case when base.gross_pings>0 and base.accepted_pings>0 then base.gross_pings end) as avg_gross_pings_when_acc,
    avg(case when base.accepted_pings>0 then base.accepted_pings end) as avg_accepted_pings_when_acc,
    avg(case when base.accepted_pings>0 then base.dapr end) as avg_dapr_weekly,
    avg(case when base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c>0 then base.net_rides_taxi end) as avg_RPR_daily,
    avg(case when base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c>0 then base.net_rides_delivery end) as avg_RPR_delivery_daily,
    avg(case when base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c>0 then base.net_rides_c2c end) as avg_RPR_c2c_daily,
    avg(case when base.ao_days>0 then base.ao_days end) as ao_days,
    avg(case when base.online_days>0 then base.online_days end) as online_days,
    avg(case when base.gross_days>0 then base.gross_days end) as gross_days,
    avg(case when base.accepted_days>0 then base.accepted_days end) as acc_days,
    avg(case when base.net_days>0 then base.net_days end) as net_days,
    avg(case when base.online_days>0 then base.total_lh end) as total_lh,
    -- avg(case when base.online_days>0 and base.gross_pings>0 and base.accepted_pings=0 then base.total_lh end) as avg_lh_when_non_acc,
    -- avg(case when base.online_days>0 and base.gross_pings>0 and base.accepted_pings>0 then base.total_lh end) as avg_lh_when_acc,
    avg(case when base.max_lh_per_day>0 then max_lh_per_day end ) max_lh_per_day,
    -- avg(case when base.net_days>0 then base.total_lh_nonO2a end) as total_lh_nonO2a,
    avg(case when base.net_days>0 then base.total_lh_morning_peak end) as total_lh_morning_peak,
    avg(case when base.net_days>0 then base.total_lh_afternoon end) as total_lh_afternoon,
    avg(case when base.net_days>0 then base.total_lh_evening_peak end) as total_lh_evening_peak,
    avg(case when base.online_days>0 then base.idle_lh end) as idle_lh,
    avg(case when base.total_lh>0 then 1-base.idle_lh/cast(base.total_lh as double) end) as avg_util,
    --avg(gmv_amount/cast(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c as double)) as gmv_per_ride ,
    --avg(take_amount /cast(gmv_amount as double)) as take_per ,
    --avg(cm_amount /cast(gmv_amount as double)) as cm_per ,
    --avg(final_earnings_amount /cast(gmv_amount as double)) as final_earnings_per ,
    --avg(incentive_amount/cast(gmv_amount as double)) as incentives_per ,
    --avg(order_earnings_amount / cast(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c as double)) as order_earnings_per_ride ,
    --avg(final_earnings_amount / cast(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c as double)) as final_earnings_per_ride ,
    --avg(gmv_amount/cast(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c as double)) as gmv_per_ride ,
     
    sum(gmv_amount) / cast(sum(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c) as double) as gmv_per_ride ,
    sum(take_amount) / cast(sum(gmv_amount) as double) as take_per ,
    sum(cm_amount) / cast(sum(gmv_amount) as double) as cm_per ,
    sum(final_earnings_amount) / cast(sum(gmv_amount) as double) as final_earnings_per ,
    sum(incentive_amount) / cast(sum(gmv_amount) as double) as incentives_per ,
    sum(order_earnings_amount) / cast(sum(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c) as double) as order_earnings_per_ride ,
    sum(final_earnings_amount) / cast(sum(base.net_rides_delivery+base.net_rides_taxi+base.net_rides_c2c) as double) as final_earnings_per_ride ,
    
    
    avg(subs_orders) as avg_subs_orders,
    count(distinct case when incentive_amount>0 then base.captain_id end) as incentives_ach_caps ,
    avg(case when incentive_amount>0 then base.incentive_amount end) as avg_incentives_per_ach_cap ,
    count(distinct case when base.subs_orders>0 then base.captain_id end) as subs_net_captains
    -- avg(case when base.online_days>0 and base.gross_pings>0 and base.accepted_pings=0 then 1-base.idle_lh/cast(base.total_lh as double) end) as avg_util_when_non_acc,
    -- avg(case when base.online_days>0 and base.gross_pings>0 and base.accepted_pings>0 then 1-base.idle_lh/cast(base.total_lh as double) end) as avg_util_when_acc
from   base
group by 1,2
)
select '{time_level}' as time_level,'{tod_level}' as tod_level,*
from finalTbl 
order by time, groupedValue
    """
    df = pd.read_sql(query, presto_connection)
    return df


def r2a_registration_by_activation(username: str, start_date: str, end_date: str, city: str, service: str, time_level: str):
    """
    Fetch R2A% (Registration to Activation) metrics from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'hyderabad', 'bangalore')
        service: Service type (e.g., 'auto', 'bike')
        time_level: Time aggregation level ('day', 'week', 'month')
    
    Returns:
        DataFrame with R2A metrics
    """
    presto_connection = get_presto_connection(username)
    query = f"""
    with base_reg as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(registration_date as date)
    ) as time_level, 
    count(distinct captain_id) as registrations 
  from 
    (
      select 
        captain_id, 
        registration_date, 
        mobile_number, 
        activation_date, 
        first_ridedate, 
        source, 
        registration_city, 
        case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
        case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
        case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
        case when pancard_uploaded is not null 
        or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
       CASE
            WHEN mode_id = '642ae204b4b6b8ec5665ce87' THEN 'cab'
            WHEN mode_id = '5fbe8a8a9788ac0008c4eb98' THEN 'auto'
            WHEN mode_id = '5fbe8a6fb1c45500077393da' THEN 'link' end as final_service 
      from 
        datasets.captain_supply_journey_summary 
      where 
         substr(replace(registration_date, '-', ''),1,10) >= '{start_date}'
        and substr(replace(registration_date, '-', ''),1,10) <= '{end_date}'
        and lower(registration_city) = lower('{city}')
    )
  where 1=1
    --final_service != 'cab' 
    and lower(final_service) = lower('{service}')
  group by 
    1
), 
base_act as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(activation_date as date)
    ) as time_level, 
    count( distinct captain_id) as overall_activations, 
    count(
     distinct case when date_trunc(
        '{time_level}', 
        cast(registration_date as date)
      ) = date_trunc(
        '{time_level}', 
        cast(activation_date as date)
      ) then captain_id end
    ) as M0Activations, 
    count(
    distinct  case when date_trunc(
        '{time_level}', 
        cast(registration_date as date)
      ) != date_trunc(
        '{time_level}', 
        cast(activation_date as date)
      ) then captain_id end
    ) as MrestActivations
from 
  (
    select 
      captain_id, 
      registration_date, 
      mobile_number, 
      activation_date, 
      first_ridedate, 
      source, 
      registration_city, 
      case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
      case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
      case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
      case when pancard_uploaded is not null 
      or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
      coalesce(case 
      when lower(servicename) like '%auto%' then 'auto'
        when lower(servicename) like '%rick%' then 'auto'
        when lower(servicename) like '%cab%' then 'cab'
        when lower(servicename) like '%link%' then 'link' end,
         case 
        when lower(services_interested) like '%auto%' then 'auto'
        when lower(services_interested) like '%cab%' then 'cab'
        else 'link' end) as final_service 
    from 
      datasets.captain_supply_journey_summary
    where 
      substr(replace(activation_date, '-', ''),1,10) >= '{start_date}'
      and substr(replace(activation_date, '-', ''),1,10) <= '{end_date}'
      and lower(registration_city) = lower('{city}')
  ) 
where 1=1
  --final_service != 'cab'
  and lower(final_service) = lower('{service}')  
group by 
  1
), 
base_fr as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(first_ridedate as date)
    ) as time_level, 
    count(distinct captain_id) as overall_fr 
  from 
    (
      select 
        captain_id, 
        registration_date, 
        mobile_number, 
        activation_date, 
        first_ridedate, 
        source, 
        registration_city, 
        case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
        case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
        case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
        case when pancard_uploaded is not null 
        or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
       coalesce(case 
        when lower(servicename) like '%auto%' then 'auto'
        when lower(servicename) like '%rick%' then 'auto'
        when lower(servicename) like '%cab%' then 'cab'
        when lower(servicename) like '%link%' then 'link' end,
         case 
        when lower(services_interested) like '%auto%' then 'auto'
        when lower(services_interested) like '%cab%' then 'cab'
        else 'link' end) as final_service
      from 
        datasets.captain_supply_journey_summary ing 
      where 
        cast(first_ridedate as varchar) >= '{start_date}' 
        and cast(first_ridedate as varchar) <= '{end_date}' 
        and lower(registration_city) = lower('{city}')
    ) 
  where 1=1
    --final_service != 'cab' 
    and lower(final_service) = lower('{service}')   
  group by 
    1
), 
calls as (
  select 
    date_trunc(
      lower('{time_level}'), 
      date_parse(yyyymmdd, '%Y%m%d')
    ) as time_level, 
    count(dialed_number) as sk_calls 
  FROM 
    canonical.galaxy_supply_cdr_immutable 
  where 
    yyyymmdd >= '{start_date}'
    and yyyymmdd <= '{end_date}'
    and campaign in (
      'SKILLOUTBOUND', 'SKILLCALLBACK', 
      'AUTO', 'AUTOCALLBACK'
    ) 
    and dialer_disposition = 'Answered By Agent' 
  group by 
    1
) 
select 
  base_reg.time_level, 
  registrations, 
  M0Activations, 
  MrestActivations, 
  overall_activations, 
  M0Activations * 100.00 / registrations as R2A_M0, 
  MrestActivations * 100.00 / registrations R2A_Mrest, 
  overall_activations * 100.00 / registrations as overall_R2A, 
  sk_calls * 1.00 / overall_activations as calls_per_act, 
  overall_fr as overall_net_caps, 
  overall_fr * 100.00 / M0Activations as "net_caps/M0Activations" 
from 
  base_reg 
  left join base_act on base_reg.time_level = base_act.time_level 
  left join base_fr on base_reg.time_level = base_fr.time_level 
  left join calls on base_reg.time_level = calls.time_level 
order by 
    1"""
    df = pd.read_sql(query, presto_connection)
    return df



def r2a_pecentage(username: str, start_date: str, end_date: str, city: str, service: str, time_level: str):
    """
    Fetch R2A% metrics from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'hyderabad', 'bangalore')
        service: Service type (e.g., 'auto', 'bike')
        time_level: Time aggregation level ('day', 'week', 'month')
    
    Returns:
        DataFrame with R2A% metrics
    """
    presto_connection = get_presto_connection(username)
    query = f"""
    with base_reg as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(registration_date as date)
    ) as time_level, 
    count(distinct captain_id) as registrations 
  from 
    (
      select 
        captain_id, 
        registration_date, 
        mobile_number, 
        activation_date, 
        first_ridedate, 
        source, 
        registration_city, 
        case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
        case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
        case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
        case when pancard_uploaded is not null 
        or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
    CASE
            WHEN mode_id = '642ae204b4b6b8ec5665ce87' THEN 'cab'
            WHEN mode_id = '5fbe8a8a9788ac0008c4eb98' THEN 'auto'
            WHEN mode_id = '5fbe8a6fb1c45500077393da' THEN 'link' end as final_service 
      from 
        datasets.captain_supply_journey_summary 
      where 
        substr(replace(registration_date,'-',''),1,10) >= '{start_date}'
        and registration_date <= '{end_date}'
        and servicename<>'E rickshaw'
        and lower(registration_city) = lower('{city}')
    )
  where 1=1
    --final_service != 'cab' 
    and lower(final_service) = lower('{service}')  
  group by 
    1
), 
base_act as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(activation_date as date)
    ) as time_level, 
    count(distinct captain_id) as overall_activations, 
    count(
    distinct  case when date_trunc(
        lower('{time_level}'), 
        cast(registration_date as date)
      ) = date_trunc(
        lower('{time_level}'), 
        cast(activation_date as date)
      ) then captain_id end
    ) as M0Activations, 
    count(
    distinct  case when date_trunc(
        lower('{time_level}'), 
        cast(registration_date as date)
      ) != date_trunc(
        lower('{time_level}'), 
        cast(activation_date as date)
      ) then captain_id end
    ) as MrestActivations
from 
  (
    select 
      captain_id, 
      registration_date, 
      mobile_number, 
      activation_date, 
      first_ridedate, 
      source, 
      registration_city, 
      case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
      case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
      case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
      case when pancard_uploaded is not null 
      or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
      coalesce(case 
        when lower(servicename) like '%auto%' then 'auto'
        when lower(servicename) like '%rick%' then 'auto'
        when lower(servicename) like '%cab%' then 'cab'
        when lower(servicename) like '%link%' then 'link' end,
         case 
        when lower(services_interested) like '%auto%' then 'auto'
        when lower(services_interested) like '%cab%' then 'cab'
        else 'link' end) as final_service 
    from 
      datasets.captain_supply_journey_summary
    where 
      substr(replace(activation_date,'-',''),1,10) >= '{start_date}'
      and substr(replace(activation_date,'-',''),1,10) <= '{end_date}'
      and lower(registration_city) = lower('{city}')
  ) 
where 1=1
  --final_service != 'cab'
  and lower(final_service) = lower('{service}')
group by 
  1
), 
base_fr as (
  select 
    date_trunc(
      lower('{time_level}'), 
      cast(first_ridedate as date)
    ) as time_level, 
    count(distinct captain_id) as overall_fr 
  from 
    (
      select 
        captain_id, 
        registration_date, 
        mobile_number, 
        activation_date, 
        first_ridedate, 
        source, 
        registration_city, 
        case when profile_picture_uploaded is not null then 1 else 0 end as profile_picture_uploaded, 
        case when license_uploaded is not null then 1 else 0 end as license_uploaded, 
        case when rc_uploaded is not null then 1 else 0 end as rc_uploaded, 
        case when pancard_uploaded is not null 
        or aadhar_uploaded is not null then 1 else 0 end as "Pan | Aadhar Uplpoaded", 
        coalesce(case 
        when lower(servicename) like '%auto%' then 'auto'
        when lower(servicename) like '%rick%' then 'auto'
        when lower(servicename) like '%cab%' then 'cab'
        when lower(servicename) like '%link%' then 'link' end,
         case 
        when lower(services_interested) like '%auto%' then 'auto'
        when lower(services_interested) like '%cab%' then 'cab'
        else 'link' end) as final_service
      from 
        datasets.captain_supply_journey_summary ing 
      where 
        cast(first_ridedate as varchar) >= '{start_date}' 
        and cast(first_ridedate as varchar) <= '{end_date}' 
        and lower(registration_city) = lower('{city}')
    ) 
  where 1=1
    --final_service != 'cab' 
    and lower(final_service) = lower('{service}')
  group by 
    1
), 
calls as (
  select 
    date_trunc(
      lower('{time_level}'), 
      date_parse(yyyymmdd, '%Y%m%d')
    ) as time_level, 
    count(dialed_number) as sk_calls 
  FROM 
    canonical.galaxy_supply_cdr_immutable 
  where 
    yyyymmdd >= '{start_date}'
    and yyyymmdd <= '{end_date}'
    and campaign in (
      'SKILLOUTBOUND', 'SKILLCALLBACK', 
      'AUTO', 'AUTOCALLBACK'
    ) 
    and dialer_disposition = 'Answered By Agent' 
  group by 
    1
) 
    
select  base_reg.time_level,registrations,M0Activations,MrestActivations,overall_activations,
M0Activations*100.00/registrations as R2A_M0,
MrestActivations*100.00/registrations R2A_Mrest,
overall_activations*100.00/registrations as overall_R2A,
sk_calls*1.00/overall_activations as calls_per_act,
overall_fr as overall_net_caps,
overall_fr*100.00/M0Activations as "net_caps/M0Activations"

from base_reg
left join base_act on base_reg.time_level = base_act.time_level
 left join base_fr on base_reg.time_level = base_fr.time_level
left join calls on base_reg.time_level = calls.time_level
order by 1


    """
    df = pd.read_sql(query, presto_connection)
    return df


def get_experiment_performance(
    username: str,
    experiment_id: str,
    start_date: str,
    end_date: str,
    time_level: str = 'daily',
    tod_level: str = 'daily',
    city: str = 'delhi',
    service_value: str = 'two_wheeler',
):
    """
    Query experiment data and AO funnel metrics in a single query.
    
    This function combines get_experiment_data and get_ao_funnel by:
    1. Extracting captain_ids (split_key_values) from the experiment table
    2. Joining directly with captain metrics tables without passing captain_ids as strings
    
    Parameters:
        username: Presto username for connection
        experiment_id: UUID of the experiment (e.g., 'edc35f8a-ed7a-4557-9a3e-14edc61e6d58')
        start_date: Start date (YYYYMMDD format, e.g., '20251221')
        end_date: End date (YYYYMMDD format, e.g., '20251221')
        time_level: Time aggregation level - 'daily', 'weekly', or 'monthly' (default: 'daily')
        tod_level: Time of day level - 'daily', 'afternoon', 'evening', 'morning', 'night', or 'all' (default: 'daily')
        city: City name (e.g., 'delhi', 'bangalore', 'mumbai') (default: 'delhi')
        service_value: Service type - 'two_wheeler', 'three_wheeler', or 'four_wheeler' (default: 'two_wheeler')

    Returns:
        {"csv": <csv_string>, "row_count": <int>, "columns": [...], "experiment_id": ..., "cohort_breakdown": [...]}
    """
    import io
    from datetime import timedelta

    # --- Validate & sanitize all user-supplied inputs ---
    try:
        start_date = _validate_date(start_date, "start_date")
        end_date = _validate_date(end_date, "end_date")
        experiment_id = _validate_experiment_id(experiment_id)
        city = _validate_city(city)
        service_value = _validate_service_value(service_value)
    except ValueError as ve:
        return {
            "csv": "",
            "row_count": 0,
            "columns": [],
            "error": str(ve),
        }

    # Escape single quotes as an extra safety layer
    experiment_id = _escape_sql_string(experiment_id)
    city = _escape_sql_string(city)
    service_value = _escape_sql_string(service_value)

    presto_connection = get_presto_connection(username)

    # Calculate extended start date for weekly CTE (14 days before start_date)
    try:
        start_dt = datetime.strptime(start_date, '%Y%m%d')
        extended_start_dt = start_dt - timedelta(days=14)
        extended_start_date = extended_start_dt.strftime('%Y%m%d')
    except ValueError:
        extended_start_date = start_date

    # Pre-compute time expression based on time_level
    time_expr = {
        'weekly': "concat(cast(year(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar),'_',cast(week(date_parse(a.yyyymmdd, '%Y%m%d')) as varchar))",
        'monthly': "concat(cast(year(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar),'_',cast(month(date_parse(a.yyyymmdd,'%Y%m%d')) as varchar))",
        'daily': "a.yyyymmdd"
    }.get(time_level.lower(), "a.yyyymmdd")

    # Pre-compute TOD-specific column selections
    tod = tod_level.lower()
    online_col = {
        'daily': 'count_captain_num_online_daily_city',
        'afternoon': 'count_num_online_afternoon_daily_city',
        'evening': 'count_num_online_evening_peak_daily_city',
        'morning': 'count_num_online_morning_peak_daily_city',
        'night': 'count_num_online_rest_midnight_daily_city',
        'all': 'count_captain_num_online_daily_city'
    }.get(tod, 'count_captain_num_online_daily_city')

    net_rides_taxi_col = {
        'daily': 'count_captain_net_rides_taxi_all_day_city',
        'afternoon': 'count_captain_net_rides_delivery_afternoon_city',
        'evening': 'count_captain_net_rides_taxi_evening_peak_city',
        'morning': 'count_captain_net_rides_taxi_morning_peak_city',
        'night': 'count_captain_net_rides_taxi_rest_midnight_city',
        'all': 'count_captain_net_rides_taxi_all_day_city'
    }.get(tod, 'count_captain_net_rides_taxi_all_day_city')

    net_rides_c2c_col = {
        'daily': 'count_captain_c2c_orders_all_day_city',
        'afternoon': 'count_captain_net_rides_c2c_afternoon_city',
        'evening': 'count_captain_net_rides_c2c_evening_peak_city',
        'morning': 'count_captain_net_rides_c2c_morning_peak_city',
        'night': 'count_captain_c2c_orders_all_day_city',
        'all': 'count_captain_c2c_orders_all_day_city'
    }.get(tod, 'count_captain_c2c_orders_all_day_city')

    net_rides_delivery_col = {
        'daily': 'count_captain_delivery_orders_all_day_city',
        'afternoon': 'count_captain_net_rides_delivery_afternoon_city',
        'evening': 'count_captain_net_rides_delivery_evening_peak_city',
        'morning': 'count_captain_net_rides_delivery_morning_peak_city',
        'night': 'count_captain_net_rides_taxi_all_day_city',
        'all': 'count_captain_net_rides_taxi_all_day_city'
    }.get(tod, 'count_captain_delivery_orders_all_day_city')

    accepted_orders_expr = {
        'daily': '(coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))',
        'afternoon': 'coalesce(count_captain_accepted_orders_afternoon_taxi, 0)',
        'evening': '(coalesce(count_captain_accepted_orders_evening_peak_c2c, 0) + coalesce(count_captain_accepted_orders_evening_peak_delivery, 0) + coalesce(count_captain_accepted_orders_evening_peak_taxi, 0))',
        'morning': '(coalesce(count_captain_accepted_pings_morning_peak_delivery, 0) + coalesce(count_captain_accepted_pings_morning_peak_c2c, 0) + coalesce(count_captain_accepted_orders_morning_peak_taxi, 0))',
        'night': 'coalesce(count_num_online_rest_midnight_daily_city, 0)',
        'all': '(coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))'
    }.get(tod, '(coalesce(count_captain_accepted_orders_all_day_taxi, 0) + coalesce(count_captain_accepted_orders_all_day_c2c, 0) + coalesce(count_captain_accepted_orders_all_day_delivery, 0))')

    # Combined query that extracts captain_ids from experiment and joins with AO funnel metrics
    query = f"""
    
    WITH experiment_captains AS (
        -- Extract captain_ids from experiment data
        SELECT DISTINCT
            experiment_id,
            sample_category as cohort,
            experiment_experimental_feature_id,
            -- Extract split_key_value (captain_id) from attributes JSON
            json_extract_scalar(
                attributes,
                '$.' || replace(
                    CASE 
                        WHEN experiment_split_attribute = '1==1' THEN 'captainId'
                        ELSE experiment_split_attribute
                    END,
                    '$payload.', 
                    ''
                )
            ) as captain_id
        FROM iceberg.experiments_internal.iceberg_experiment_v6_root 
        WHERE yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
        AND experiment_id = '{experiment_id}'
        AND attributes IS NOT NULL
        AND experiment_split_attribute IS NOT NULL
    ),
    
    captain_filter AS (
        SELECT DISTINCT captain_id, cohort, experiment_id, experiment_experimental_feature_id
        FROM experiment_captains
        WHERE captain_id IS NOT NULL AND captain_id != ''
    ),
     sdid AS (
                SELECT service_detail_id AS servicedetailid
                FROM datasets.service_level_mapping_qc
                WHERE lower(city_display_name) = lower('{city}')
                AND lower(service_category) IN ('link', 'c2c', 'delivery', 'auto', 'auto_c2c', 'cab')
                AND lower(mode_name) = '{service_value}'
                AND service_detail_id_isactive
            ),
    base AS (
        SELECT 
            cf.experiment_id,
            cf.cohort,
            cf.experiment_experimental_feature_id,
            lower(a.city) as city,
            a.captain_id,
            {time_expr} as time,
            sum(coalesce({online_col}, 0)) as online_events,
            count(distinct case when coalesce(count_captain_num_online_daily_city, 0) > 0 then a.yyyymmdd end) as online_days,
            count(distinct case when (coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) > 0 then a.yyyymmdd end) as net_days,
            sum(coalesce({net_rides_taxi_col}, 0)) as net_rides_taxi,
            sum(coalesce({net_rides_c2c_col}, 0)) as net_rides_c2c,
            sum(coalesce({net_rides_delivery_col}, 0)) as net_rides_delivery,
            count(distinct case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then a.yyyymmdd end) as accepted_days,
            avg({accepted_orders_expr}) as accepted_orders,
            sum(coalesce(count_captain_accepted_orders_all_day_taxi, 0)) as accepted_orders_sum,
            count(distinct case when (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) > 0 then a.yyyymmdd end) as gross_days,
            count(distinct case when coalesce(count_captain_number_app_open_captains_daily_all_day_city, 0) > 0 then a.yyyymmdd end) as ao_days,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 and (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) = 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh_nonO2a,
            sum(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) else 0 end) as total_lh_sum,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as total_lh,
            max(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_daily_city, 0) end) as max_lh_per_day,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_morning_peak_daily_city, 0) end) as total_lh_morning_peak,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_afternoon_daily_city, 0) end) as total_lh_afternoon,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_total_lh_evening_peak_daily_city, 0) end) as total_lh_evening_peak,
            avg(case when coalesce(count_captain_num_online_daily_city, 0) > 0 then coalesce(sum_captain_idle_lh_daily_city, 0) end) as idle_lh,
            sum(coalesce(count_captain_gross_pings_link_all_day_city, 0)) as total_pings_link,
            avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_gross_pings_taxi_all_day_city, 0) + coalesce(count_captain_gross_pings_delivery_all_day_city, 0)) end) as gross_pings,
            avg(case when (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) > 0 then (coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) end) as accepted_pings,
            sum(coalesce(count_captain_net_rides_taxi_all_day_city, 0) + coalesce(count_captain_c2c_orders_all_day_city, 0) + coalesce(count_captain_delivery_orders_all_day_city, 0)) / nullif(cast(sum(coalesce(count_captain_accepted_pings_taxi_all_day_city, 0) + coalesce(count_captain_accepted_pings_delivery_all_day_city, 0)) as double), 0) as dapr
        FROM metrics.captain_base_metrics_enriched a
        INNER JOIN captain_filter cf ON a.captain_id = cf.captain_id
        WHERE a.yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
        AND (a.city) = lower('{city}')
        GROUP BY 1, 2, 3, 4, 5, 6
    )
    SELECT * FROM base
    """

    try:
        df = pd.read_sql(query, presto_connection)
        df = df.drop_duplicates(subset=['time','captain_id'])

        if df.empty:
            return {
                "csv": "",
                "row_count": 0,
                "columns": [],
                "error": f"No data found for experiment {experiment_id} between {start_date} and {end_date} in {city}",
            }

        # Calculate stats for the report
        total_unique_captains = int(df['captain_id'].nunique())
        
        # Group by cohort and count unique captains
        cohort_stats = df.groupby(['cohort']).agg({'captain_id': 'nunique'}).reset_index()
        cohort_stats.columns = ['cohort', 'unique_captains']
        cohort_breakdown = cohort_stats.to_dict('records')

        # Convert DataFrame to CSV
        csv_buffer = io.StringIO()
        df.to_csv(csv_buffer, index=False)
        csv_string = csv_buffer.getvalue()

        return {
            "csv": csv_string,
            "row_count": len(df),
            "columns": list(df.columns),
            "experiment_id": experiment_id,
            "total_unique_captains": total_unique_captains,
            "cohort_breakdown": cohort_breakdown,
            "preview": df.head(10).to_dict('records'),
        }
    except Exception as e:
        logger.exception("get_experiment_performance query failed. Query: %s", query)
        return {
            "csv": "",
            "row_count": 0,
            "columns": [],
            "error": str(e),
        }


def _fetch_segment_transition_raw(
    username: str,
    start_date: str,
    end_date: str,
    city: str = 'delhi',
    service_category: str = 'bike_taxi',
    service_value: str = 'two_wheeler',
):
    """Run Presto query and return raw captain-level segment data (yyyymmdd, captain_id, consistency_segment)."""
    # --- Validate & sanitize all user-supplied inputs ---
    start_date = _validate_date(start_date, "start_date")
    end_date = _validate_date(end_date, "end_date")
    city = _escape_sql_string(_validate_city(city))
    service_category = _escape_sql_string(_validate_service_category(service_category))
    service_value = _escape_sql_string(_validate_service_value(service_value))

    presto_connection = get_presto_connection(username)
    query = f"""
    -- Get DAU captain IDs (captains who were online on each day)
    WITH captain_daily AS (
        SELECT
            t1.captainid AS captain_id,
            t1.yyyymmdd,
            DATE_PARSE(t1.yyyymmdd, '%Y%m%d') AS date_day,
            CASE WHEN COALESCE(t2.count_captain_num_online_daily_city, 0) > 0 THEN 1 ELSE 0 END AS is_online,
            CASE WHEN t1.net_orders > 0 THEN 1 ELSE 0 END AS has_orders
        FROM datasets.captain_svo_daily_kpi t1
        LEFT JOIN metrics.captain_base_metrics_enriched t2
            ON t1.captainid = t2.captain_id
            AND t1.yyyymmdd = t2.yyyymmdd
        WHERE LOWER(t1.service_name) = LOWER('{service_category}')
            AND LOWER(t1.city) = LOWER('{city}')
            AND DATE_PARSE(t1.yyyymmdd, '%Y%m%d') >= DATE_PARSE('{start_date}', '%Y%m%d') - INTERVAL '30' DAY
            AND DATE_PARSE(t1.yyyymmdd, '%Y%m%d') <= DATE_PARSE('{end_date}', '%Y%m%d')
    ),
    
    captain_rolling AS (
        SELECT
            captain_id,
            yyyymmdd,
            date_day,
            is_online AS dau,
            has_orders AS dtu,
            SUM(is_online) OVER (
                PARTITION BY captain_id 
                ORDER BY date_day 
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) AS days_online_30d,
            SUM(has_orders) OVER (
                PARTITION BY captain_id 
                ORDER BY date_day 
                ROWS BETWEEN 29 PRECEDING AND CURRENT ROW
            ) AS days_orders_30d
        FROM captain_daily
    ),
    
    dau_mau_captains AS (
        SELECT
            captain_id,
            yyyymmdd,
            date_day,
            dau,
            dtu,
            CASE WHEN days_online_30d > 0 THEN 1 ELSE 0 END AS mau,
            CASE WHEN days_orders_30d > 0 THEN 1 ELSE 0 END AS mtu
        FROM captain_rolling
        WHERE DATE_PARSE(yyyymmdd, '%Y%m%d') BETWEEN DATE_PARSE('{start_date}', '%Y%m%d') AND DATE_PARSE('{end_date}', '%Y%m%d')
    ),

    weekly AS (
        SELECT captain_id, service_value, lower(geo_city) as city, captain_net_weeks_last_28_days, week(date_parse(yyyymmdd,'%Y%m%d')) AS week_num
        FROM iceberg.mne_internal.captain_fact_snapshot_weekly_v1
        WHERE yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
        AND service_hierarchy='mode_name'
        AND lower(geo_city)=lower('{city}')
        AND lower(service_value)=lower('{service_value}')
    ),
    
    daily AS (
        SELECT captain_id, lower(geo_city) as city, service_value, yyyymmdd, captain_net_days_last_28_days,
            count_net_rides_last_28_days/nullif(captain_net_days_last_28_days,0) as rpr,
            captain_net_days_last_84_days, week(date_parse(yyyymmdd,'%Y%m%d')) AS week_num
        FROM iceberg.mne_internal.captain_fact_snapshot_daily
        WHERE yyyymmdd BETWEEN '{start_date}' AND '{end_date}'
        AND service_hierarchy='mode_name'
        AND lower(geo_city)=lower('{city}')
        AND lower(service_value)=lower('{service_value}')
    ),
    
    final_tbl AS (
        SELECT captain_id, service_value, city, yyyymmdd, captain_net_days_last_28_days, rpr, captain_net_days_last_84_days, captain_net_weeks_last_28_days, week_num
        FROM daily 
        INNER JOIN weekly USING(captain_id, service_value, city, week_num)
    )
    
    SELECT final_tbl.yyyymmdd, final_tbl.captain_id, final_tbl.city,
        CASE 
            WHEN captain_net_days_last_28_days >= 15 THEN 'daily'
            WHEN captain_net_days_last_28_days <= 14 AND captain_net_days_last_28_days >= 1 AND captain_net_weeks_last_28_days >= 3 THEN 'weekly'
            WHEN captain_net_days_last_28_days <= 14 AND captain_net_days_last_28_days >= 1 AND captain_net_weeks_last_28_days < 3 THEN 'monthly'
            WHEN captain_net_days_last_28_days = 0 AND captain_net_days_last_84_days > 0 THEN 'quarterly'
            ELSE 'rest' 
        END AS consistency_segment, 
        CASE 
            WHEN captain_net_days_last_28_days > 0 AND rpr > 15 THEN 'UHP'
            WHEN captain_net_days_last_28_days > 0 AND rpr > 10 THEN 'HP'
            WHEN captain_net_days_last_28_days > 0 AND rpr > 5 THEN 'MP'
            WHEN captain_net_days_last_28_days > 0 AND rpr > 0 THEN 'LP'
            ELSE 'ZP' 
        END AS performance_segment,
        dmc.dau,
        dmc.mau,
        dmc.dtu,
        dmc.mtu
    FROM final_tbl
    LEFT JOIN dau_mau_captains dmc
        ON final_tbl.captain_id = dmc.captain_id AND final_tbl.yyyymmdd = dmc.yyyymmdd
    """
    return pd.read_sql(query, presto_connection)


def get_segment_transitions(
    username: str,
    start_date: str,
    end_date: str,
    city: str = 'delhi',
    service_category: str = 'bike_taxi',
    service_value: str = 'two_wheeler',
    filter_type: str = None,
    period: str = 'D',
    raw_df: pd.DataFrame = None,
):
    """
    Query captain consistency segment transitions over time.
    If raw_df is provided (e.g. from session cache), no Presto call is made; period can be changed on the fly.

    Parameters:
        username: Presto username for connection
        start_date: Start date (YYYYMMDD format)
        end_date: End date (YYYYMMDD format)
        city: City name (default: 'delhi')
        service_category: Service category (default: 'bike_taxi')
        service_value: Service value (default: 'two_wheeler')
        filter_type: Optional filter - 'dau', 'mau', 'dtu', 'mtu' (default: None)
        period: Sankey aggregation period - 'D' (daily), 'W' (weekly), 'M' (monthly) (default: 'D')
        raw_df: Optional pre-fetched raw DataFrame from _fetch_segment_transition_raw (avoids Presto when set)

    Returns:
        Dictionary with transition data and Sankey diagram data
    """
    try:
        if raw_df is not None:
            df = raw_df.copy()
        else:
            df = _fetch_segment_transition_raw(
                username=username,
                start_date=start_date,
                end_date=end_date,
                city=city,
                service_category=service_category,
                service_value=service_value,
            )
        if df.empty:
            return {
                "row_count": 0,
                "columns": [],
                "data": [],
                "sankey_data": None,
                "error": f"No data found for {city} between {start_date} and {end_date}",
            }
        filtered_data = df.copy()
        if filter_type and filter_type in ['dau', 'mau', 'dtu', 'mtu']:
            filtered_data = filtered_data[filtered_data[filter_type] == 1]
        transition_df = create_consistency_transition_table(filtered_data)
        sankey_data = prepare_sankey_data(transition_df, period=period or 'D')
        return {
            "row_count": len(transition_df),
            "columns": list(transition_df.columns),
            "data": transition_df.to_dict('records'),
            "sankey_data": sankey_data,
            "error": None,
        }
    except Exception as e:
        return {
            "row_count": 0,
            "columns": [],
            "data": [],
            "sankey_data": None,
            "error": str(e),
        }


def get_segment_transition_captains(
    username: str,
    start_date: str,
    end_date: str,
    city: str,
    service_category: str,
    service_value: str,
    filter_type: str = None,
    period: str = 'D',
    from_period: str = '',
    to_period: str = '',
    from_segment: str = '',
    to_segment: str = '',
    raw_df: pd.DataFrame = None,
):
    """
    Return list of captain_ids.
    - If from_period and from_segment are provided: captains that transitioned from (from_period, from_segment) to (to_period, to_segment).
    - If only to_period and to_segment are provided: all captains in that segment/period (node click).
    If raw_df is provided (e.g. from session cache), no Presto call is made.
    """
    if raw_df is not None:
        df = raw_df.copy()
    else:
        df = _fetch_segment_transition_raw(
            username=username,
            start_date=start_date,
            end_date=end_date,
            city=city,
            service_category=service_category,
            service_value=service_value,
        )
    if df.empty:
        return []
    if filter_type and filter_type in ['dau', 'mau', 'dtu', 'mtu']:
        df = df[df[filter_type] == 1]
    df = df.copy()
    df['date'] = pd.to_datetime(df['yyyymmdd'], format='%Y%m%d')
    if period == 'D':
        df['period'] = df['date'].dt.strftime('%Y-%m-%d')
    elif period == 'W':
        df['period'] = df['date'].dt.to_period('W').astype(str)
    else:
        df['period'] = df['date'].dt.to_period('M').astype(str)

    # Node click: just return all captains in to_period + to_segment
    if not from_period or not from_segment:
        node_rows = df[(df['period'] == to_period) & (df['consistency_segment'] == to_segment)]
        return [str(x) for x in node_rows['captain_id'].unique().tolist()]

    # Link click: captains that transitioned
    from_rows = df[(df['period'] == from_period) & (df['consistency_segment'] == from_segment)][['captain_id', 'yyyymmdd']].rename(columns={'yyyymmdd': 'from_date'})
    to_rows = df[(df['period'] == to_period) & (df['consistency_segment'] == to_segment)][['captain_id', 'yyyymmdd']].rename(columns={'yyyymmdd': 'to_date'})
    merged = from_rows.merge(to_rows, on='captain_id', how='inner')
    merged = merged[merged['from_date'] < merged['to_date']]
    return [str(x) for x in merged['captain_id'].unique().tolist()]


def create_consistency_transition_table(cons_transition):
    """
    Create a pivot table to track transitions between consistency segments.
    """
    # Sort by captain_id and date to track transitions
    cons_sorted = cons_transition.sort_values(['captain_id', 'yyyymmdd'])
    
    # Get previous day's segment for each captain
    cons_sorted['prev_segment'] = cons_sorted.groupby('captain_id')['consistency_segment'].shift(1)
    cons_sorted['prev_date'] = cons_sorted.groupby('captain_id')['yyyymmdd'].shift(1)
    
    # Segment abbreviation map
    segment_map = {'daily': 'D', 'weekly': 'W', 'monthly': 'M', 'quarterly': 'Q', 'rest': 'R'}
    
    # Create transition labels with current segment context
    def create_transition_label(row):
        curr_segment = row['consistency_segment']
        if pd.isna(row['prev_segment']):
            return f'NEW {curr_segment.upper()}'
        else:
            prev = segment_map.get(row['prev_segment'], row['prev_segment'])
            curr = segment_map.get(curr_segment, curr_segment)
            return f'{prev}-{curr}'
    
    cons_sorted['transition'] = cons_sorted.apply(create_transition_label, axis=1)
    
    # Group by date, current segment, and transition type
    transition_summary = cons_sorted.groupby(['yyyymmdd', 'consistency_segment', 'transition']).agg({'captain_id': 'nunique'}).reset_index()
    transition_summary.columns = ['yyyymmdd', 'consistency_segment', 'transition', 'count']
    
    # Pivot to show all transitions by date and segment
    transition_pivot = transition_summary.pivot_table(
        index=['yyyymmdd', 'consistency_segment'], 
        columns='transition', 
        values='count', 
        fill_value=0
    ).reset_index()
    
    # Calculate total captains per segment
    total_captains = cons_transition.groupby(['yyyymmdd', 'consistency_segment']).agg({'captain_id':'nunique'}).reset_index()
    total_captains.columns = ['yyyymmdd', 'consistency_segment', 'total_captain']
    
    # Merge with transition data
    final_df = total_captains.merge(transition_pivot, on=['yyyymmdd', 'consistency_segment'], how='left').fillna(0)
    
    # Define desired column order
    desired_columns = ['yyyymmdd', 'consistency_segment', 'total_captain',
                       'D-D', 'D-W', 'D-M', 'D-Q', 'D-R', 'NEW DAILY',
                       'W-D', 'W-W', 'W-M', 'W-Q', 'W-R', 'NEW WEEKLY',
                       'M-D', 'M-W', 'M-M', 'M-Q', 'M-R', 'NEW MONTHLY',
                       'Q-D', 'Q-W', 'Q-M', 'Q-Q', 'Q-R', 'NEW QUARTERLY',
                       'R-D', 'R-Q', 'R-R', 'NEW REST']
    
    # Add missing columns with 0 values
    for col in desired_columns:
        if col not in final_df.columns:
            final_df[col] = 0
    
    # Reorder columns (only include columns that exist)
    available_columns = [col for col in desired_columns if col in final_df.columns]
    final_df = final_df[available_columns]
    
    # Convert numeric columns to int for cleaner display
    numeric_cols = [col for col in final_df.columns if col not in ['yyyymmdd', 'consistency_segment']]
    final_df[numeric_cols] = final_df[numeric_cols].astype(int)
    
    return final_df


def prepare_sankey_data(final_df, period='D'):
    """
    Build Sankey nodes and links from create_consistency_transition_table output.
    Returns JSON for Plotly Sankey (node labels, colors, link source/target/value).
    Edges flow period-to-period: source = segment in previous period, target = segment in current period.
    """
    import numpy as np

    final_df = final_df.copy()
    final_df['date'] = pd.to_datetime(final_df['yyyymmdd'], format='%Y%m%d')
    if period == 'D':
        final_df['period'] = final_df['date'].dt.strftime('%Y-%m-%d')
    elif period == 'W':
        final_df['period'] = final_df['date'].dt.to_period('W').astype(str)
    elif period == 'M':
        final_df['period'] = final_df['date'].dt.to_period('M').astype(str)
    else:
        raise ValueError("period must be 'D', 'W', or 'M'")

    trans_cols = [
        'D-D', 'D-W', 'D-M', 'D-Q', 'D-R', 'W-D', 'W-W', 'W-M', 'W-Q', 'W-R',
        'M-D', 'M-W', 'M-M', 'M-Q', 'M-R', 'Q-D', 'Q-W', 'Q-M', 'Q-Q', 'Q-R',
        'R-D', 'R-W', 'R-M', 'R-Q', 'R-R',
    ]
    agg_dict = {'total_captain': 'sum'}
    for c in trans_cols:
        if c in final_df.columns:
            agg_dict[c] = 'sum'
    agg_df = final_df.groupby(['period', 'consistency_segment'], as_index=False).agg(agg_dict)

    all_periods = sorted(agg_df['period'].unique())
    max_periods = 10
    if len(all_periods) > max_periods:
        all_periods = all_periods[-max_periods:]
        agg_df = agg_df[agg_df['period'].isin(all_periods)]

    segment_names = ['daily', 'weekly', 'monthly', 'quarterly', 'rest']
    segment_display = ['Daily', 'Weekly', 'Monthly', 'Quarterly', 'Rest']
    segment_colors = ['#1f77b4', '#ff7f0e', '#2ca02c', '#d62728', '#9467bd']

    n_periods = len(all_periods)
    n_segments = len(segment_names)

    # Build nodes: labels, colors, x/y positions for Plotly layout
    node_labels = []
    node_colors = []
    node_x = []
    node_y = []
    node_meta = []  # (period, segment) for click handling
    node_index = {}
    idx = 0

    for period_idx, period_val in enumerate(all_periods):
        period_data = agg_df[agg_df['period'] == period_val]
        for seg_idx, (seg_name, seg_disp, color) in enumerate(zip(segment_names, segment_display, segment_colors)):
            seg_data = period_data[period_data['consistency_segment'] == seg_name]
            total = int(seg_data['total_captain'].sum()) if not seg_data.empty else 0
            label = f"{seg_disp}<br>{period_val}<br>({total:,})"
            node_labels.append(label)
            node_colors.append(color)
            # x: spread across periods; y: stack segments top-to-bottom
            x_val = 0.02 + (period_idx / max(n_periods - 1, 1)) * 0.96 if n_periods > 1 else 0.5
            y_val = 0.1 + (seg_idx / max(n_segments - 1, 1)) * 0.8
            node_x.append(x_val)
            node_y.append(y_val)
            node_meta.append({"period": period_val, "segment": seg_name, "total": total})
            node_key = f"{period_val}_{seg_name}"
            node_index[node_key] = idx
            idx += 1

    # Build links: source/target indices, values, colors
    transition_cols = {
        'D-D': ('daily', 'daily'), 'D-W': ('daily', 'weekly'), 'D-M': ('daily', 'monthly'),
        'D-Q': ('daily', 'quarterly'), 'D-R': ('daily', 'rest'),
        'W-D': ('weekly', 'daily'), 'W-W': ('weekly', 'weekly'), 'W-M': ('weekly', 'monthly'),
        'W-Q': ('weekly', 'quarterly'), 'W-R': ('weekly', 'rest'),
        'M-D': ('monthly', 'daily'), 'M-W': ('monthly', 'weekly'), 'M-M': ('monthly', 'monthly'),
        'M-Q': ('monthly', 'quarterly'), 'M-R': ('monthly', 'rest'),
        'Q-D': ('quarterly', 'daily'), 'Q-W': ('quarterly', 'weekly'), 'Q-M': ('quarterly', 'monthly'),
        'Q-Q': ('quarterly', 'quarterly'), 'Q-R': ('quarterly', 'rest'),
        'R-D': ('rest', 'daily'), 'R-W': ('rest', 'weekly'), 'R-M': ('rest', 'monthly'),
        'R-Q': ('rest', 'quarterly'), 'R-R': ('rest', 'rest'),
    }

    link_source = []
    link_target = []
    link_value = []
    link_color = []
    link_meta = []  # (from_period, from_segment, to_period, to_segment)

    def hex_to_rgba(hex_color, alpha=0.5):
        h = hex_color.lstrip('#')
        r, g, b = int(h[0:2], 16), int(h[2:4], 16), int(h[4:6], 16)
        return f"rgba({r},{g},{b},{alpha})"

    for period_idx, period_val in enumerate(all_periods):
        if period_idx == 0:
            continue
        prev_period = all_periods[period_idx - 1]
        period_data = agg_df[agg_df['period'] == period_val]
        for trans_col, (from_seg, to_seg) in transition_cols.items():
            if trans_col not in period_data.columns:
                continue
            to_rows = period_data[period_data['consistency_segment'] == to_seg]
            if to_rows.empty:
                continue
            value = int(to_rows[trans_col].sum())
            if value <= 0:
                continue
            source_key = f"{prev_period}_{from_seg}"
            target_key = f"{period_val}_{to_seg}"
            if source_key not in node_index or target_key not in node_index:
                continue
            link_source.append(node_index[source_key])
            link_target.append(node_index[target_key])
            link_value.append(value)
            link_color.append(hex_to_rgba(segment_colors[segment_names.index(to_seg)], 0.5))
            link_meta.append({
                "from_period": prev_period,
                "from_segment": from_seg,
                "to_period": period_val,
                "to_segment": to_seg,
                "value": value,
            })

    return {
        "node_labels": node_labels,
        "node_colors": node_colors,
        "node_x": node_x,
        "node_y": node_y,
        "node_meta": node_meta,
        "link_source": link_source,
        "link_target": link_target,
        "link_value": link_value,
        "link_color": link_color,
        "link_meta": link_meta,
        "periods": all_periods,
        "segments": segment_names,
        "segment_colors": segment_colors,
    }


def a2phh_summary(username: str, start_date: str, end_date: str, city: str, service: str, time_level: str):
    """
    Fetch A2PHH Summary M0 metrics from Presto
    
    Args:
        username: Presto username for connection
        start_date: Start date in YYYYMMDD format
        end_date: End date in YYYYMMDD format
        city: City name (e.g., 'bangalore', 'hyderabad')
        service: Service type (e.g., 'auto', 'bike', 'cab')
        time_level: Time aggregation level ('day', 'week', 'month')
    
    Returns:
        DataFrame with A2PHH Summary M0 metrics
    """
    presto_connection = get_presto_connection(username)
    query = f"""
    WITH act AS (
select * from (
    SELECT 
        DISTINCT captain_id,
        registration_city,
        mobile_number,
        activation_date,
        activation_time,
        date_trunc(lower('{time_level}'), cast(activation_date as date)) AS activation_bucket,
        CASE 
            WHEN lower(registration_city) IN ('jaipur', 'delhi', 'hyderabad', 'kolkata', 'bangalore', 'mumbai', 'chennai', 'pune') THEN registration_city
            WHEN lower(registration_city) IN ('ahmedabad', 'vijayawada', 'lucknow', 'indore', 'chandigarh', 'coimbatore', 'bhubaneswar', 'patna', 'ludhiana', 'vishakapatnam', 'guwahati', 'bhopal') THEN 'T2'
            ELSE 'T3'
        END AS tier,
        CASE
            WHEN mode_id = '642ae204b4b6b8ec5665ce87' THEN 'cab'
            WHEN mode_id = '5fbe8a8a9788ac0008c4eb98' THEN 'auto'
            WHEN mode_id = '5fbe8a6fb1c45500077393da' THEN 'link'
        END AS final_service
    FROM hive.datasets.captain_supply_journey_summary
    WHERE substr(replace(activation_date,'-',''),1,10) >='{start_date}'
    and substr(replace(activation_date,'-',''),1,10) <='{end_date}'
    
    and lower(registration_city) = lower('{city}')
)where final_service='{service}'),

ping AS (
    SELECT 
        captainid AS captain_id,
        yyyymmdd,
        date_trunc(lower('{time_level}'), parse_datetime(yyyymmdd, 'yyyyMMdd')) AS event_bucket,
        CASE 
            WHEN LOWER(ordertype) LIKE '%auto%' THEN 'auto'
            WHEN LOWER(ordertype) LIKE '%rick%' THEN 'auto'
            WHEN LOWER(ordertype) LIKE '%app%' THEN 'link'
            WHEN LOWER(ordertype) LIKE '%cab%' THEN 'cab'
            WHEN LOWER(ordertype) LIKE '%suv%' THEN 'cab'
            WHEN LOWER(ordertype) LIKE '%delivery%' THEN 'link'
        END AS service,
        net_orders,
        order_earning,
        accepted_pings,
        riderbusy_pings AS rider_busy_pings, 
        riderrejected_pings AS rider_reject_pings,
        ocara_rider_cancelled AS rider_cancelled_pings, 
        ocara_customer_cancelled AS customer_cancelled_pings,
        (accepted_pings + riderbusy_pings + riderrejected_pings) AS total_pings,
        total_login_hr AS login_hrs,
        idle_hours
    FROM datasets.captain_svo_daily_kpi 
    WHERE yyyymmdd >= '{start_date}'
     AND yyyymmdd <= '{end_date}'
    AND captainid IN (SELECT DISTINCT captain_id FROM act)
    and lower(city) = lower('{city}') 
),

ping_m0 AS (
    SELECT 
        p.captain_id,
        p.service,
        SUM(p.net_orders) AS net_orders,
        SUM(p.order_earning) AS order_earning,
        SUM(p.accepted_pings) AS accepted_pings,
        SUM(p.rider_busy_pings) AS rider_busy_pings, 
        SUM(p.rider_reject_pings) AS rider_reject_pings,
        SUM(p.rider_cancelled_pings) AS rider_cancelled_pings, 
        SUM(p.customer_cancelled_pings) AS customer_cancelled_pings,
        SUM(p.total_pings) AS total_pings,
        SUM(p.login_hrs) AS login_hrs,
        SUM(p.idle_hours) AS idle_hours,
        COUNT(DISTINCT CASE WHEN p.net_orders > 0 THEN p.yyyymmdd END) AS net_days
    FROM ping p
    INNER JOIN act a ON p.captain_id = a.captain_id
    WHERE p.event_bucket = a.activation_bucket
    GROUP BY 1, 2
)

-- Main query with M0 and M_rest metrics
select
    date_trunc(lower('{time_level}'), cast(activation_date as date)) as time_level,
    -- M0 metrics
    count(distinct act.captain_id) as "Activated_Captain_M0",
    count(distinct case when pm0.login_hrs > 0 then act.captain_id end) as "Online_Captains_M0",
    count(distinct case when pm0.total_pings > 0 then act.captain_id end) as "Ping_Received_Captains_M0",
    count(distinct case when pm0.accepted_pings > 0 then act.captain_id end) as "Ping_Accepted_Captains_M0",
    count(distinct case when pm0.net_orders > 0 then act.captain_id end) as "Net_Captains_M0",
    count(distinct case when pm0.net_days = 0 or pm0.net_days is null then act.captain_id end) as "Zero_Ride_M0",
    count(distinct case when pm0.net_days >= 1 and pm0.net_days <= 5 then act.captain_id end) as "HH_M0",
    count(distinct case when pm0.net_days >= 6 then act.captain_id end) as "PHH_M0",
    

    
    -- M0 percentages
    (count(distinct case when pm0.login_hrs > 0 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "Online%_M0",
    (count(distinct case when pm0.total_pings > 0 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "Ping_Received%_M0",
    (count(distinct case when pm0.accepted_pings > 0 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "Ping_Accepted%_M0",
    (count(distinct case when pm0.net_orders > 0 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "Net_Captains%_M0",
    (count(distinct case when pm0.net_days = 0 or pm0.net_days is null then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "Zero_Captain%_M0",
    (count(distinct case when pm0.net_days >= 1 and pm0.net_days <= 5 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "HH%_M0",
    (count(distinct case when pm0.net_days >= 6 then act.captain_id end) * 100.0) / 
        nullif(count(distinct act.captain_id), 0) as "PHH%_M0"
    


from act
left join ping_m0 pm0 on act.captain_id = pm0.captain_id and act.final_service = pm0.service
--left join ping_m_rest pmr on act.captain_id = pmr.captain_id and act.final_service = pmr.service
where lower(final_service) = lower('{service}')
group by 1
order by 1
    """
    df = pd.read_sql(query, presto_connection)
    return df
