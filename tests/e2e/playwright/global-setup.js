const { spawnSync } = require('node:child_process');
const http = require('node:http');
const https = require('node:https');

function isLocalBaseUrl(baseUrl) {
  try {
    const u = new URL(baseUrl);
    return u.hostname === '127.0.0.1' || u.hostname === 'localhost';
  } catch {
    return false;
  }
}

function httpGetJson(url) {
  return new Promise((resolve, reject) => {
    const u = new URL(url);
    const client = u.protocol === 'https:' ? https : http;

    const req = client.request(
      {
        method: 'GET',
        hostname: u.hostname,
        port: u.port,
        path: u.pathname + u.search,
        headers: { Accept: 'application/json' },
      },
      (res) => {
        let body = '';
        res.setEncoding('utf8');
        res.on('data', (chunk) => (body += chunk));
        res.on('end', () => {
          try {
            resolve({ status: res.statusCode || 0, json: JSON.parse(body) });
          } catch (e) {
            reject(new Error(`Failed to parse JSON from ${url}: ${e.message}`));
          }
        });
      }
    );

    req.on('error', reject);
    req.end();
  });
}

async function waitForTopics(baseUrl, timeoutMs = 10_000) {
  const deadline = Date.now() + timeoutMs;
  // eslint-disable-next-line no-constant-condition
  while (true) {
    try {
      const res = await httpGetJson(`${baseUrl}/api/quiz/topics`);
      const topics = res?.json?.topics;
      if (res.status === 200 && Array.isArray(topics) && topics.length > 0) return;
    } catch {
      // ignore until deadline
    }

    if (Date.now() > deadline) {
      throw new Error('Timed out waiting for seeded quiz topics to appear at /api/quiz/topics');
    }
    await new Promise((r) => setTimeout(r, 250));
  }
}

module.exports = async () => {
  const baseUrl = process.env.E2E_BASE_URL || 'http://127.0.0.1:8000';

  // Safety guard: do not seed non-local environments.
  if (!isLocalBaseUrl(baseUrl)) {
    // eslint-disable-next-line no-console
    console.log(`[global-setup] Skipping DB seed (non-local baseURL: ${baseUrl})`);
    return;
  }

  // If topics already exist, we're done.
  try {
    const res = await httpGetJson(`${baseUrl}/api/quiz/topics`);
    const topics = res?.json?.topics;
    if (res.status === 200 && Array.isArray(topics) && topics.length > 0) {
      // eslint-disable-next-line no-console
      console.log(`[global-setup] Quiz topics already present (${topics.length})`);
      return;
    }
  } catch {
    // If the server isn't reachable yet, we still attempt seeding; waitForTopics will enforce readiness.
  }

  const dbUrl =
    process.env.E2E_AUTH_DATABASE_URL ||
    process.env.AUTH_DATABASE_URL ||
    'postgresql+psycopg2://hispanistica_auth:hispanistica_auth@localhost:54320/hispanistica_auth';

  // eslint-disable-next-line no-console
  console.log('[global-setup] Seeding quiz demo topic for E2E...');

  const result = spawnSync(
    process.env.PYTHON || 'python',
    ['scripts/init_quiz_db.py', '--seed'],
    {
      cwd: process.cwd(),
      env: { ...process.env, AUTH_DATABASE_URL: dbUrl },
      encoding: 'utf8',
    }
  );

  if (result.error) {
    throw result.error;
  }

  if (result.status !== 0) {
    throw new Error(
      `Quiz DB seed failed (exit ${result.status}).\nSTDOUT:\n${result.stdout}\n\nSTDERR:\n${result.stderr}`
    );
  }

  await waitForTopics(baseUrl, 10_000);

  // eslint-disable-next-line no-console
  console.log('[global-setup] Quiz topics ready.');
};
