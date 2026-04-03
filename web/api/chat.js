/**
 * Node runtime with streaming passthrough for SSE requests.
 * Non-streaming requests are buffered and returned in full.
 * Pro: up to 300s. Hobby caps lower — upgrade or expect 504 on long parses.
 */
export const config = { runtime: 'nodejs', maxDuration: 300 };

/** Safety margin timeout (ms) — abort upstream before Vercel kills us. */
const UPSTREAM_TIMEOUT_MS = 280_000;

const rateLimitMap = new Map();

function cleanupOldEntries() {
  const now = Date.now();
  for (const [key, entry] of rateLimitMap) {
    if (now - entry.windowStart > 86400000) rateLimitMap.delete(key);
  }
}

function checkRateLimit(ip) {
  const limit = parseInt(process.env.RATE_LIMIT_PER_DAY || '30', 10);
  const now = Date.now();
  const entry = rateLimitMap.get(ip);

  if (!entry || now - entry.windowStart > 86400000) {
    rateLimitMap.set(ip, { windowStart: now, count: 1 });
    return { allowed: true, remaining: limit - 1 };
  }

  if (entry.count >= limit) {
    return { allowed: false, remaining: 0 };
  }

  entry.count++;
  return { allowed: true, remaining: limit - entry.count };
}

function header(req, name) {
  try {
    return req.headers?.get?.(name) || null;
  } catch (_) {
    return null;
  }
}

export default async function handler(request) {
  try {
    if (!request || typeof request.method !== 'string') {
      return new Response(JSON.stringify({ error: 'Invalid request' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    if (request.method === 'OPTIONS') {
      return new Response(null, {
        status: 204,
        headers: {
          'Access-Control-Allow-Origin': '*',
          'Access-Control-Allow-Methods': 'POST, OPTIONS',
          'Access-Control-Allow-Headers': 'Content-Type',
        },
      });
    }

    if (request.method !== 'POST') {
      return new Response(JSON.stringify({ error: 'Method not allowed' }), {
        status: 405,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const apiKey = (process.env.ANTHROPIC_API_KEY || '').trim();
    if (!apiKey || apiKey === 'your-key-here') {
      return new Response(JSON.stringify({ error: 'API key not configured' }), {
        status: 500,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const ip =
      header(request, 'x-forwarded-for')?.split(',')[0]?.trim() ||
      header(request, 'x-real-ip') ||
      'unknown';

    if (rateLimitMap.size > 10000) cleanupOldEntries();
    const { allowed, remaining } = checkRateLimit(ip);

    if (!allowed) {
      return new Response(
        JSON.stringify({ error: 'Rate limit exceeded. Please try again tomorrow.' }),
        {
          status: 429,
          headers: {
            'Content-Type': 'application/json',
            'X-RateLimit-Remaining': '0',
            'Retry-After': '86400',
          },
        }
      );
    }

    let payload;
    try {
      payload = await request.json();
    } catch {
      return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    let upstreamBody;
    try {
      upstreamBody = JSON.stringify(payload);
    } catch (err) {
      console.error('[knitwise/api/chat] JSON.stringify(payload) failed', err);
      return new Response(JSON.stringify({ error: 'Request body could not be serialized' }), {
        status: 400,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    const anthropicHeaders = {
      'Content-Type': 'application/json',
      'x-api-key': apiKey,
      'anthropic-version': '2023-06-01',
    };

    const ac = new AbortController();
    const timeout = setTimeout(() => ac.abort(), UPSTREAM_TIMEOUT_MS);

    let resp;
    try {
      resp = await fetch('https://api.anthropic.com/v1/messages', {
        method: 'POST',
        headers: anthropicHeaders,
        body: upstreamBody,
        signal: ac.signal,
      });
    } catch (fetchErr) {
      clearTimeout(timeout);
      if (fetchErr.name === 'AbortError') {
        return new Response(JSON.stringify({ error: 'Upstream request timed out' }), {
          status: 504,
          headers: { 'Content-Type': 'application/json', 'Access-Control-Allow-Origin': '*' },
        });
      }
      throw fetchErr;
    }

    const responseHeaders = new Headers();
    responseHeaders.set('X-RateLimit-Remaining', String(remaining));
    responseHeaders.set('Access-Control-Allow-Origin', '*');

    if (!resp.ok) {
      clearTimeout(timeout);
      const errText = await resp.text();
      const errHeaders = new Headers();
      errHeaders.set('Content-Type', 'application/json');
      errHeaders.set('X-RateLimit-Remaining', String(remaining));
      errHeaders.set('Access-Control-Allow-Origin', '*');
      return new Response(errText, {
        status: resp.status,
        headers: errHeaders,
      });
    }

    if (payload.stream) {
      // Stream SSE passthrough — keeps function alive only as long as data flows,
      // avoids buffering the entire generation in memory.
      responseHeaders.set('Content-Type', 'text/event-stream; charset=utf-8');
      responseHeaders.set('Cache-Control', 'no-cache');
      responseHeaders.set('Connection', 'keep-alive');

      const upstream = resp.body;
      const passthrough = new ReadableStream({
        async start(controller) {
          const reader = upstream.getReader();
          try {
            while (true) {
              const { done, value } = await reader.read();
              if (done) break;
              controller.enqueue(value);
            }
            controller.close();
          } catch (err) {
            controller.error(err);
          } finally {
            clearTimeout(timeout);
          }
        },
      });
      return new Response(passthrough, {
        status: resp.status,
        headers: responseHeaders,
      });
    }

    // Non-streaming: buffer and return.
    responseHeaders.set('Content-Type', 'application/json; charset=utf-8');
    const outBuf = await resp.arrayBuffer();
    clearTimeout(timeout);
    return new Response(outBuf, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch (err) {
    console.error('[knitwise/api/chat] unhandled', err && err.stack ? err.stack : err);
    return new Response(
      JSON.stringify({
        error: 'Internal server error',
        type: 'proxy_error',
      }),
      { status: 500, headers: { 'Content-Type': 'application/json' } }
    );
  }
}
