import { randomUUID, timingSafeEqual } from 'node:crypto';
import { Router } from 'express';

const ADMIN_SESSION_COOKIE = 'rvlry_admin_session';
const ADMIN_SESSION_TTL_MS = 1000 * 60 * 60 * 8;
const WORDLIST_USAGE = {
  describing: ['Imposter', 'DrawNGuess'],
  guessing: ['WhoWhatWhere', 'HatGame']
};

const parseCookies = (headerValue = '') =>
  String(headerValue)
    .split(';')
    .map((entry) => entry.trim())
    .filter(Boolean)
    .reduce((cookies, entry) => {
      const separatorIndex = entry.indexOf('=');
      if (separatorIndex <= 0) {
        return cookies;
      }

      const key = entry.slice(0, separatorIndex).trim();
      const value = entry.slice(separatorIndex + 1).trim();
      cookies[key] = decodeURIComponent(value);
      return cookies;
    }, {});

const passwordMatches = (expected, received) => {
  const expectedBuffer = Buffer.from(expected);
  const receivedBuffer = Buffer.from(received);
  if (expectedBuffer.length !== receivedBuffer.length) {
    return false;
  }

  return timingSafeEqual(expectedBuffer, receivedBuffer);
};

const buildWordlistSummary = (wordStore) => {
  const status = wordStore.status();
  return {
    sourceBaseUrl: status.sourceBaseUrl ?? null,
    lastSyncAt: status.lastSyncAt ?? null,
    lastCacheLoadAt: status.lastCacheLoadAt ?? null,
    lists: (status.types ?? []).map((entry) => ({
      ...entry,
      label: `${entry.type[0].toUpperCase()}${entry.type.slice(1)} wordlist`,
      usedBy: WORDLIST_USAGE[entry.type] ?? []
    }))
  };
};

export function adminRouter({
  wordStore,
  adminPassword = process.env.ADMIN_PASSWORD ?? '',
  sessions = new Map()
}) {
  const router = Router();
  const adminEnabled = adminPassword.trim().length > 0;

  const getValidSession = (req) => {
    if (!adminEnabled) {
      return null;
    }

    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[ADMIN_SESSION_COOKIE];
    if (!sessionToken) {
      return null;
    }

    const session = sessions.get(sessionToken);
    if (!session || session.expiresAt <= Date.now()) {
      sessions.delete(sessionToken);
      return null;
    }

    session.expiresAt = Date.now() + ADMIN_SESSION_TTL_MS;
    return { token: sessionToken, ...session };
  };

  const requireAdmin = (req, res, next) => {
    if (!adminEnabled) {
      res.status(503).json({ error: 'Admin access is not configured on this server.' });
      return;
    }

    const session = getValidSession(req);
    if (!session) {
      res.status(401).json({ error: 'Admin authentication required.' });
      return;
    }

    req.adminSession = session;
    next();
  };

  router.get('/session', (req, res) => {
    res.json({
      enabled: adminEnabled,
      authenticated: Boolean(getValidSession(req))
    });
  });

  router.post('/login', (req, res) => {
    if (!adminEnabled) {
      res.status(503).json({ error: 'Admin access is not configured on this server.' });
      return;
    }

    const submittedPassword = String(req.body?.password ?? '');
    if (!passwordMatches(adminPassword, submittedPassword)) {
      res.status(401).json({ error: 'Incorrect admin password.' });
      return;
    }

    const token = randomUUID();
    sessions.set(token, {
      createdAt: new Date().toISOString(),
      expiresAt: Date.now() + ADMIN_SESSION_TTL_MS
    });

    res.cookie(ADMIN_SESSION_COOKIE, token, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    res.json({ ok: true });
  });

  router.post('/logout', (req, res) => {
    const cookies = parseCookies(req.headers.cookie);
    const sessionToken = cookies[ADMIN_SESSION_COOKIE];
    if (sessionToken) {
      sessions.delete(sessionToken);
    }

    res.clearCookie(ADMIN_SESSION_COOKIE, {
      httpOnly: true,
      sameSite: 'strict',
      secure: process.env.NODE_ENV === 'production',
      path: '/'
    });
    res.json({ ok: true });
  });

  router.get('/status', requireAdmin, (_, res) => {
    res.json(buildWordlistSummary(wordStore));
  });

  router.post('/wordlists/refresh', requireAdmin, async (_, res) => {
    const syncResult = await wordStore.sync();
    res.json({
      ok: true,
      syncResult,
      status: buildWordlistSummary(wordStore)
    });
  });

  return router;
}
