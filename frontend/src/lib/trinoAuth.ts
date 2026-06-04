/**
 * Trino OAuth2 login coordination for the browser popup flow.
 *
 * When a dashboard query gets a 401 with code='trino_auth_required', the frontend:
 * 1. Calls ensureTrinoLogin(email) to start an interactive login
 * 2. The backend opens a probe thread, which triggers OAuth2 → prints login URL
 * 3. ensureTrinoLogin polls /auth/trino/status until authenticated
 * 4. The frontend retries the original query
 *
 * Local: popup opens automatically. Headless VM: URL comes through the frontend,
 * so the browser can open it. Token is cached on disk, so subsequent queries need no login.
 */

const BASE_URL = import.meta.env.VITE_API_BASE_URL ?? 'http://localhost:8001';

let currentTrinoUser = '';
let inFlight: Promise<void> | null = null;

export function setTrinoUser(email: string | null | undefined): void {
  currentTrinoUser = (email ?? '').trim();
}

export function getTrinoUser(): string {
  return currentTrinoUser;
}

const sleep = (ms: number) => new Promise((r) => setTimeout(r, ms));

async function runLogin(email: string): Promise<void> {
  if (!email) {
    throw new Error(
      'You must be signed in with your @rapido.bike account to query Trino.'
    );
  }

  const res = await fetch(`${BASE_URL}/auth/trino/login`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({ username: email }),
  });

  if (!res.ok) {
    throw new Error('Could not start Trino login. Please try again.');
  }

  const data = await res.json();

  if (data.status === 'authenticated') {
    return;
  }

  if (data.status === 'error') {
    throw new Error(data.error || 'Trino login failed.');
  }

  if (data.status !== 'login_required' || !data.login_url) {
    throw new Error('Trino login could not be started. Please retry.');
  }

  const popup = window.open(
    data.login_url,
    'trino-login',
    'width=520,height=640,menubar=no,toolbar=no,location=yes,status=no'
  );
  if (!popup) {
    throw new Error(
      'The Trino login popup was blocked. Allow popups for this site and retry.'
    );
  }

  const deadline = Date.now() + 3 * 60 * 1000; // 3 minute timeout
  try {
    while (Date.now() < deadline) {
      await sleep(2000);

      const sres = await fetch(
        `${BASE_URL}/auth/trino/status?username=${encodeURIComponent(email)}`
      );
      if (!sres.ok) {
        continue;
      }

      const status = await sres.json();
      if (status.status === 'authenticated') {
        return;
      }

      if (status.status === 'error') {
        throw new Error(status.error || 'Trino login failed.');
      }
    }

    throw new Error('Trino login timed out. Please try again.');
  } finally {
    try {
      popup.close();
    } catch {
      // popup may already be closed
    }
  }
}

/**
 * Ensure the user is logged into Trino. If not, spawn a login popup
 * (or resume an ongoing login). Blocks until authenticated or error.
 *
 * Designed to be called from a retry loop: failed query → ensureTrinoLogin → retry.
 */
export function ensureTrinoLogin(email: string): Promise<void> {
  if (!inFlight) {
    inFlight = runLogin(email).finally(() => {
      inFlight = null;
    });
  }
  return inFlight;
}
