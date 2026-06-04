"""
Centralized Trino (Presto) connection factory for Ladoo Metrics.

Every dashboard (DAPR, FE2Net, RTU, R2A, A2PHH, funnel) and every custom
metric query opens its Trino connection through ``get_trino_connection()`` so
the auth / host / token-cache configuration lives in exactly one place.

Auth
----
OAuth2 browser flow against the Plectrum Trino cluster. The ``user`` is the
signed-in analyst's ``@rapido.bike`` email (forwarded from the frontend via
Supabase auth) so queries are attributed to the real person running them and
each analyst gets their own cached token.

Token caching
-------------
* A single module-level ``OAuth2Authentication`` instance is shared by every
  connection. trino stores the bearer token *on that instance*, so the token
  obtained on the first query is reused by all subsequent queries in the same
  worker process — no repeated logins.
* If ``TRINO_TOKEN_CACHE_FILE`` is set, the token is additionally persisted to
  a file-backed keyring at that path, so the interactive login survives process
  restarts and is shared across uvicorn workers. trino keys this cache by
  ``(host, user)``, so analysts never collide.

Headless deployment note
------------------------
``OAuth2Authentication`` is an interactive flow. On the headless VM the default
handler can't open a browser, so it prints (and we log at WARNING) a login URL.
Find it once via ``journalctl -u ladoo-metrics``, open it in any browser to
complete the login, and the resulting token is cached to
``TRINO_TOKEN_CACHE_FILE`` for every subsequent request and restart.
"""
import os
import logging
import threading

logger = logging.getLogger(__name__)

# New Plectrum Trino cluster (OAuth2 over HTTPS). All overridable via env so the
# same code works locally and on the VM without edits.
DEFAULT_TRINO_HOST = "bi-trino-4.processing.data.plectrum.dev"
DEFAULT_TRINO_PORT = 443
DEFAULT_TRINO_HTTP_SCHEME = "https"
DEFAULT_TRINO_CATALOG = "hive"

# Where the OAuth2 bearer token is cached on disk by default. Caching is ON out of
# the box (no env needed) so the browser login is reused across queries AND across
# backend restarts. Override with TRINO_TOKEN_CACHE_FILE; set it empty to disable.
DEFAULT_TOKEN_CACHE_FILE = os.path.join(os.path.expanduser("~"), ".ladoo", "trino-token-cache.cfg")

_auth_lock = threading.Lock()
_oauth2_auth = None          # singleton trino.auth.OAuth2Authentication
_keyring_configured = False  # one-shot guard for token-cache-file setup

# Interactive login coordination. Per-thread state for capturing OAuth URLs.
_current = threading.local()    # per-thread: .user (email), .interactive (bool)
_coordinators = {}              # user email -> login coordinator entry (guarded by _auth_lock)


def _redirect_to_login(url: str) -> None:
    """During interactive login, capture the URL for the frontend popup.

    When start_login() runs in a background thread with interactive=True, this handler
    is invoked during the OAuth challenge. It captures the login URL and returns
    immediately, letting trino continue its token long-poll while the frontend opens
    the URL in a popup. If not interactive, raise immediately so the request fails fast
    with an auth error instead of hanging on the token poll.
    """
    user = getattr(_current, "user", None)
    interactive = getattr(_current, "interactive", False)

    logger.warning("Trino OAuth2 login required (user=%s, interactive=%s). Login URL:\n%s",
                   user, interactive, url)

    if interactive and user is not None:
        with _auth_lock:
            entry = _coordinators.get(user)
        if entry is not None:
            entry["login_url"] = url
            entry["event"].set()
        return  # let trino keep polling while the user logs in

    from trino.exceptions import TrinoAuthError
    raise TrinoAuthError("Trino authentication required")


def _configure_token_cache_file() -> None:
    """Point trino's OAuth2 token cache at an on-disk keyring file.

    trino persists OAuth2 tokens through python-keyring when a backend is
    available. We swap in a file-backed keyring so the login survives restarts and
    is shared across workers. This is enabled by default (DEFAULT_TOKEN_CACHE_FILE)
    — a deliberate choice over the OS keychain, which on macOS pops a per-access
    permission dialog that makes "cached" logins feel un-cached.

    Security: the file stores the bearer token base64-obfuscated, not encrypted, so
    we lock it to 0600. For a stronger backend, set ``TRINO_TOKEN_CACHE_FILE`` empty
    (disables this) and configure ``keyring`` via ``PYTHON_KEYRING_BACKEND``.
    """
    global _keyring_configured
    if _keyring_configured:
        return

    cache_file = os.environ.get("TRINO_TOKEN_CACHE_FILE", DEFAULT_TOKEN_CACHE_FILE)
    if not cache_file:
        _keyring_configured = True  # explicitly disabled; trino uses OS keyring / in-memory
        return

    try:
        import keyring
        from keyrings.alt.file import PlaintextKeyring

        resolved = os.path.abspath(os.path.expanduser(cache_file))
        os.makedirs(os.path.dirname(resolved) or ".", exist_ok=True)

        class _FileTokenKeyring(PlaintextKeyring):
            @property
            def file_path(self):  # type: ignore[override]
                return resolved

        keyring.set_keyring(_FileTokenKeyring())
        if os.path.exists(resolved):
            os.chmod(resolved, 0o600)
        logger.info("Trino OAuth2 token cache file enabled at %s", resolved)
    except Exception:
        logger.exception(
            "Could not configure file-backed Trino token cache "
            "(TRINO_TOKEN_CACHE_FILE=%s); falling back to in-process token cache.",
            cache_file,
        )
    finally:
        _keyring_configured = True


def _get_oauth2_auth():
    """Return the shared ``OAuth2Authentication`` singleton.

    The instance holds the in-memory bearer-token cache, so reusing one instance
    across all connections means a single login is reused by every query in the
    worker. Created lazily and guarded by a lock for thread safety.
    """
    global _oauth2_auth
    if _oauth2_auth is None:
        with _auth_lock:
            if _oauth2_auth is None:
                from trino.auth import OAuth2Authentication
                _configure_token_cache_file()
                _oauth2_auth = OAuth2Authentication(
                    redirect_auth_url_handler=_redirect_to_login
                )
    return _oauth2_auth


def get_trino_connection(username: str):
    """Open an OAuth2-authenticated Trino connection for the signed-in user.

    Args:
        username: the signed-in analyst's email (e.g. ``krishna.poddar@rapido.bike``),
            forwarded from the frontend. Used as the Trino ``user`` so queries are
            attributed to them and each analyst gets a separate cached token.

    Returns:
        A DBAPI2 ``trino.dbapi.Connection`` — compatible with ``pd.read_sql``.
    """
    import trino

    user = (username or "").strip()
    if not user:
        raise ValueError("A signed-in user email is required to open a Trino connection.")

    host = os.environ.get("TRINO_HOST", DEFAULT_TRINO_HOST)
    port = int(os.environ.get("TRINO_PORT", DEFAULT_TRINO_PORT))
    http_scheme = os.environ.get("TRINO_HTTP_SCHEME", DEFAULT_TRINO_HTTP_SCHEME)
    catalog = os.environ.get("TRINO_CATALOG", DEFAULT_TRINO_CATALOG)

    return trino.dbapi.connect(
        host=host,
        port=port,
        http_scheme=http_scheme,
        catalog=catalog,
        user=user,
        auth=_get_oauth2_auth(),
    )


def _run_login_probe(user: str, entry: dict) -> None:
    """Background worker for interactive login.

    Opens a connection and runs SELECT 1. If a cached token exists, succeeds
    instantly (status=authenticated, no popup). Otherwise, the OAuth flow invokes
    _redirect_to_login (which captures the URL, wakes start_login, and this thread
    keeps polling the token server) until the user completes login in the popup.
    """
    _current.user = user
    _current.interactive = True
    try:
        conn = get_trino_connection(user)
        try:
            cur = conn.cursor()
            cur.execute("SELECT 1")
            cur.fetchall()
        finally:
            try:
                conn.close()
            except Exception:
                pass
        entry["status"] = "authenticated"
        entry["error"] = None
    except Exception as exc:
        logger.warning("Trino interactive login probe failed for %s: %s", user, exc)
        entry["status"] = "error"
        entry["error"] = str(exc)
    finally:
        entry["event"].set()


def start_login(user: str, wait_seconds: float = 15.0) -> dict:
    """Begin or rejoin an interactive login attempt.

    Returns a dict with 'status' (one of 'authenticated', 'login_required',
    'error', 'pending') and optional 'login_url' or 'error' keys for the frontend.
    """
    user = (user or "").strip()
    if not user:
        return {
            "status": "error",
            "error": "A signed-in user email is required to log in to Trino.",
        }

    with _auth_lock:
        entry = _coordinators.get(user)
        thread = entry.get("thread") if entry else None
        in_flight = (entry is not None and thread is not None and
                     thread.is_alive() and entry["status"] == "pending")

        if not in_flight:
            entry = {
                "event": threading.Event(),
                "login_url": None,
                "status": "pending",
                "error": None,
                "thread": None,
            }
            _coordinators[user] = entry
            t = threading.Thread(target=_run_login_probe, args=(user, entry), daemon=True)
            entry["thread"] = t
            t.start()

    entry["event"].wait(timeout=wait_seconds)

    if entry["login_url"] and entry["status"] == "pending":
        return {"status": "login_required", "login_url": entry["login_url"]}
    if entry["status"] == "authenticated":
        return {"status": "authenticated"}
    if entry["status"] == "error":
        return {"status": "error", "error": entry["error"]}
    return {"status": "pending"}


def login_status(user: str) -> dict:
    """Check the status of an ongoing login for a user.

    Returns {'status': 'unknown' | 'pending' | 'authenticated' | 'error', ...}.
    """
    user = (user or "").strip()
    if not user:
        return {"status": "error", "error": "missing user"}

    with _auth_lock:
        entry = _coordinators.get(user)

    if entry is None:
        return {"status": "unknown"}

    return {"status": entry["status"], "error": entry.get("error")}


def is_trino_auth_error(exc: BaseException) -> bool:
    """True if the exception is a Trino auth/token failure.

    Endpoints use this to return a 401 with code='trino_auth_required'.
    """
    try:
        from trino.exceptions import TrinoAuthError
        if isinstance(exc, TrinoAuthError):
            return True
    except Exception:
        pass

    msg = str(exc).lower()
    markers = (
        "trinoautherror",
        "authentication required",
        "unauthorized",
        " 401",
        "401 ",
        "www-authenticate",
        "access token",
        "token expired",
        "expired token",
        "invalid_token",
        "oauth2",
    )
    return any(m in msg for m in markers)
