# Funnel Analysis Feature Guide

## Overview
A complete wizard-like interface for uploading mobile numbers, fetching captain IDs from Presto, and retrieving AO funnel metrics.

## Features Implemented

### 1. Backend Changes

#### New API Endpoints (`backend/main.py`)
- **POST** `/funnel-analysis/upload-mobile-numbers` - Upload CSV with mobile numbers
- **POST** `/funnel-analysis/get-captain-ids` - Fetch captain IDs from Presto
- **POST** `/funnel-analysis/get-ao-funnel` - Fetch AO funnel metrics
- **DELETE** `/funnel-analysis/session` - Clear funnel session

#### Updated Functions (`backend/funnel.py`)
- `get_presto_connection(username)` - Create Presto connection with username
- `get_captain_id(mobile_number_df, username)` - Fetch captain IDs with username parameter
- `get_ao_funnel(captain_id_df, username, start_date, end_date, time_level, tod_level)` - Fetch AO funnel with configurable parameters

#### New Schemas (`backend/schemas.py`)
- `MobileNumberUploadResponse` - Response for mobile number upload
- `CaptainIdRequest/Response` - Request/response for captain ID fetch
- `AOFunnelRequest/Response` - Request/response for AO funnel fetch

### 2. Frontend Changes

#### New Component (`frontend/src/components/FunnelAnalysis.tsx`)
A complete wizard interface with 3 steps:

**Step 1: Upload Mobile Numbers**
- Drag & drop or click to upload CSV
- Requires `mobile_number` column
- Optional `cohort` column
- Shows preview of first 5 rows

**Step 2: Get Captain IDs**
- Input Presto username (default: krishna.poddar@rapido.bike)
- Fetches captain IDs from Presto
- Shows summary (total rows, captains found)
- Shows preview with captain IDs

**Step 3: Get AO Funnel**
- Configure parameters:
  - Start Date (default: 20250801)
  - End Date (default: 20251031)
  - Time Level (daily/weekly/monthly)
  - Time of Day Level (daily/afternoon/evening/morning/night/all)
- Fetches funnel metrics from Presto
- Shows preview of first 10 rows
- Displays all available metrics

#### New API Functions (`frontend/src/lib/api.ts`)
- `uploadMobileNumbers(file)` - Upload mobile numbers CSV
- `getCaptainIds(username)` - Fetch captain IDs
- `getAOFunnel(request)` - Fetch AO funnel data
- `clearFunnelSession()` - Clear funnel session

#### App Integration (`frontend/src/App.tsx`)
- FunnelAnalysis component added as separate section
- Always visible at the top of the page
- Independent from main cohort analysis workflow

## Usage

### Step-by-Step Guide

1. **Upload CSV File**
   - Prepare CSV with at least `mobile_number` column
   - Optionally include `cohort` column
   - Upload via drag & drop or click
   - Preview first 5 rows

2. **Fetch Captain IDs**
   - Enter your Presto username (e.g., `your.name@rapido.bike`)
   - Click "Get Captain IDs"
   - View summary and preview with captain IDs

3. **Get AO Funnel Metrics**
   - Adjust date range if needed (default: 20250801 to 20251031)
   - Select time aggregation level (daily/weekly/monthly)
   - Select time of day level (daily/afternoon/evening/morning/night/all)
   - Click "Get AO Funnel"
   - View funnel data with all available metrics

4. **Start New Analysis**
   - Click "Start New Analysis" to reset the wizard
   - Upload new data and repeat the process

## CSV Format

### Required Columns
- `mobile_number` - Mobile phone numbers (will be converted to string)

### Optional Columns
- `cohort` - Cohort identifier (will be converted to string)

### Example CSV
```csv
mobile_number,cohort
9876543210,test_group
9876543211,control_group
9876543212,test_group
```

## Default Parameters

### Presto Connection
- Host: `presto-gateway.processing.data.production.internal`
- Port: `80`
- Username: Configurable via UI (default: `krishna.poddar@rapido.bike`)

### AO Funnel Parameters
- Start Date: `20250801`
- End Date: `20251031`
- Time Level: `daily`
- Time of Day Level: `daily`

## Available Metrics

The AO funnel returns multiple metrics including:
- `online_events`
- `online_days`
- `net_days`
- `net_rides_taxi`
- `net_rides_c2c`
- `net_rides_delivery`
- `accepted_days`
- `accepted_orders`
- `gross_days`
- `ao_days`
- `total_lh`
- `idle_lh`
- `gross_pings`
- `accepted_pings`
- `dapr` (Daily Acceptance Rate)
- And more...

## Session Management

- Funnel analysis uses a separate session store (independent from main cohort analysis)
- Session ID stored in localStorage as `funnel_session_id`
- Data persists across page refreshes until session is cleared
- Each step updates the session with new data

## Error Handling

The system provides clear error messages for:
- Invalid CSV format
- Missing required columns
- Presto connection failures
- Invalid captain IDs
- Database query errors

## Notes

- The funnel analysis section is always visible on the page
- You can work on funnel analysis independently from the main cohort analysis
- All Presto queries run through the backend for security
- Data is stored in-memory on the backend (cleared on server restart)

