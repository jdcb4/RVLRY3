import { useCallback, useEffect, useState } from 'react';
import { Link } from 'react-router-dom';

const fetchAdminJson = async (url, options = {}) => {
  const response = await fetch(url, {
    credentials: 'same-origin',
    headers: {
      'Content-Type': 'application/json',
      ...(options.headers ?? {})
    },
    ...options
  });
  const payload = await response.json().catch(() => ({}));

  if (!response.ok) {
    throw new Error(payload.error ?? 'Admin request failed');
  }

  return payload;
};

const formatTimestamp = (value) => {
  if (!value) {
    return 'Not yet synced';
  }

  const parsed = new Date(value);
  if (Number.isNaN(parsed.getTime())) {
    return value;
  }

  return parsed.toLocaleString();
};

export function AdminScreen() {
  const [password, setPassword] = useState('');
  const [enabled, setEnabled] = useState(true);
  const [authenticated, setAuthenticated] = useState(false);
  const [status, setStatus] = useState(null);
  const [loading, setLoading] = useState(true);
  const [pendingAction, setPendingAction] = useState('');
  const [error, setError] = useState('');
  const [toastMessage, setToastMessage] = useState('');

  const loadStatus = useCallback(async () => {
    const payload = await fetchAdminJson('/api/admin/status');
    setStatus(payload);
    setAuthenticated(true);
    return payload;
  }, []);

  const loadSession = useCallback(async () => {
    setLoading(true);
    setError('');

    try {
      const session = await fetchAdminJson('/api/admin/session');
      setEnabled(session.enabled);
      setAuthenticated(session.authenticated);
      if (session.enabled && session.authenticated) {
        await loadStatus();
      } else {
        setStatus(null);
      }
    } catch (sessionError) {
      setError(sessionError instanceof Error ? sessionError.message : 'Unable to load admin state');
    } finally {
      setLoading(false);
    }
  }, [loadStatus]);

  useEffect(() => {
    loadSession();
  }, [loadSession]);

  useEffect(() => {
    if (!toastMessage) {
      return undefined;
    }

    const timeoutId = window.setTimeout(() => setToastMessage(''), 2200);
    return () => window.clearTimeout(timeoutId);
  }, [toastMessage]);

  const handleLogin = async () => {
    setPendingAction('login');
    setError('');

    try {
      await fetchAdminJson('/api/admin/login', {
        method: 'POST',
        body: JSON.stringify({ password })
      });
      setPassword('');
      await loadStatus();
    } catch (loginError) {
      setError(loginError instanceof Error ? loginError.message : 'Unable to log in');
    } finally {
      setPendingAction('');
    }
  };

  const handleRefresh = async () => {
    setPendingAction('refresh');
    setError('');

    try {
      const payload = await fetchAdminJson('/api/admin/wordlists/refresh', {
        method: 'POST',
        body: JSON.stringify({})
      });
      setStatus(payload.status);
      setToastMessage('Wordlists refreshed');
    } catch (refreshError) {
      setError(refreshError instanceof Error ? refreshError.message : 'Unable to refresh wordlists');
    } finally {
      setPendingAction('');
    }
  };

  const handleLogout = async () => {
    setPendingAction('logout');
    try {
      await fetchAdminJson('/api/admin/logout', {
        method: 'POST',
        body: JSON.stringify({})
      });
    } finally {
      setAuthenticated(false);
      setStatus(null);
      setPendingAction('');
    }
  };

  if (loading) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Admin</p>
        <h1 className="scene__title">Loading</h1>
      </main>
    );
  }

  if (!enabled) {
    return (
      <main className="scene scene--simple">
        <p className="scene__eyebrow">Admin</p>
        <h1 className="scene__title">Unavailable</h1>
        <p className="scene__lead">Set `ADMIN_PASSWORD` on the server to enable the admin interface.</p>
      </main>
    );
  }

  if (!authenticated) {
    return (
      <main className="hub-shell hub-shell--centered">
        <section className="hub-panel">
          <div className="panel-heading">
            <h1>Admin</h1>
          </div>

          <div className="field-stack">
            <label className="settings-field">
              <input
                type="password"
                placeholder="Admin password"
                value={password}
                onChange={(event) => setPassword(event.target.value)}
              />
            </label>

            {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}

            <div className="actions actions--stretch">
              <button disabled={pendingAction === 'login'} onClick={handleLogin}>
                {pendingAction === 'login' ? 'Signing in' : 'Sign in'}
              </button>
              <Link className="button-link button-link--secondary" to="/">
                Back to home
              </Link>
            </div>
          </div>
        </section>
      </main>
    );
  }

  return (
    <main className="hub-shell">
      <section className="hub-panel">
        <div className="panel-heading">
          <h1>Admin</h1>
        </div>

        <ul className="meta-list">
          <li className="stat-row">
            <span>Word source</span>
            <strong>{status?.sourceBaseUrl ?? 'Unknown'}</strong>
          </li>
          <li className="stat-row">
            <span>Last synced</span>
            <strong>{formatTimestamp(status?.lastSyncAt)}</strong>
          </li>
          <li className="stat-row">
            <span>Cache loaded</span>
            <strong>{formatTimestamp(status?.lastCacheLoadAt)}</strong>
          </li>
        </ul>

        {error ? <p className="connection-banner connection-banner--error">{error}</p> : null}

        <div className="actions actions--stretch">
          <button disabled={pendingAction === 'refresh'} onClick={handleRefresh}>
            {pendingAction === 'refresh' ? 'Refreshing' : 'Refresh wordlists'}
          </button>
          <button
            className="secondary-action"
            disabled={pendingAction === 'logout'}
            onClick={handleLogout}
          >
            Log out
          </button>
        </div>
      </section>

      <div className="panel-grid">
        {(status?.lists ?? []).map((list) => (
          <section key={list.type} className="panel panel--stacked">
            <div className="panel-heading">
              <h2>{list.label}</h2>
              <p>Used by {list.usedBy.join(', ')}</p>
            </div>

            <ul className="meta-list">
              <li className="stat-row">
                <span>Word count</span>
                <strong>{list.wordCount}</strong>
              </li>
              <li className="stat-row">
                <span>Categories</span>
                <strong>{list.categoryCount}</strong>
              </li>
              <li className="stat-row">
                <span>Last updated</span>
                <strong>{formatTimestamp(list.lastUpdatedAt)}</strong>
              </li>
            </ul>
          </section>
        ))}
      </div>

      {toastMessage ? <p className="toast">{toastMessage}</p> : null}
    </main>
  );
}
