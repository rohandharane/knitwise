export const config = { maxDuration: 60 };

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

export default async function handler(request) {
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

  const apiKey = process.env.ANTHROPIC_API_KEY;
  if (!apiKey || apiKey === 'your-key-here') {
    return new Response(JSON.stringify({ error: 'API key not configured' }), {
      status: 500,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const ip = request.headers.get('x-forwarded-for')?.split(',')[0]?.trim()
    || request.headers.get('x-real-ip')
    || 'unknown';

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

  let body;
  try {
    body = await request.json();
  } catch {
    return new Response(JSON.stringify({ error: 'Invalid JSON body' }), {
      status: 400,
      headers: { 'Content-Type': 'application/json' },
    });
  }

  const anthropicHeaders = {
    'Content-Type': 'application/json',
    'x-api-key': apiKey,
    'anthropic-version': '2023-06-01',
  };

  try {
    const resp = await fetch('https://api.anthropic.com/v1/messages', {
      method: 'POST',
      headers: anthropicHeaders,
      body: JSON.stringify(body),
    });

    const responseHeaders = new Headers();
    responseHeaders.set('X-RateLimit-Remaining', String(remaining));

    if (body.stream) {
      responseHeaders.set('Content-Type', 'text/event-stream');
      responseHeaders.set('Cache-Control', 'no-cache');
      responseHeaders.set('Connection', 'keep-alive');
    } else {
      responseHeaders.set('Content-Type', 'application/json');
    }

    if (!resp.ok) {
      const errText = await resp.text();
      return new Response(errText, {
        status: resp.status,
        headers: { 'Content-Type': 'application/json' },
      });
    }

    return new Response(resp.body, {
      status: resp.status,
      headers: responseHeaders,
    });
  } catch {
    return new Response(JSON.stringify({ error: 'Upstream API error' }), {
      status: 502,
      headers: { 'Content-Type': 'application/json' },
    });
  }
}
