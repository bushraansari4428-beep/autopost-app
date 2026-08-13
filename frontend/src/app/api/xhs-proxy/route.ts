import { NextRequest, NextResponse } from 'next/server';

export const runtime = 'edge'; // Use Edge network for better IP reputation

export async function GET(request: NextRequest) {
  const { searchParams } = new URL(request.url);
  const targetUrl = searchParams.get('url');

  if (!targetUrl) {
    return NextResponse.json({ error: 'Missing url parameter' }, { status: 400 });
  }

  const xhsCookie = request.headers.get('x-xhs-cookie') || '';

  try {
    const headers: Record<string, string> = {
      'User-Agent': request.headers.get('user-agent') || 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': request.headers.get('accept') || 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,application/json,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    // Forward signature headers required by XHS API
    const xs = request.headers.get('x-s');
    if (xs) headers['x-s'] = xs;
    
    const xt = request.headers.get('x-t');
    if (xt) headers['x-t'] = xt;
    
    const xSCommon = request.headers.get('x-s-common');
    if (xSCommon) headers['x-s-common'] = xSCommon;
    
    const traceId = request.headers.get('x-b3-traceid');
    if (traceId) headers['x-b3-traceid'] = traceId;
    
    const referer = request.headers.get('referer');
    if (referer) headers['Referer'] = referer;
    
    if (xhsCookie) {
      if (xhsCookie.trim().startsWith('[')) {
        try {
          const cookieArray = JSON.parse(xhsCookie);
          headers['Cookie'] = cookieArray.map((c: any) => `${c.name}=${c.value}`).join('; ');
        } catch (e) {
          headers['Cookie'] = xhsCookie; // Fallback to raw string if parsing fails
        }
      } else {
        headers['Cookie'] = xhsCookie; // Raw string format
      }
    }

    const response = await fetch(targetUrl, {
      headers,
      // Vercel Edge proxies will fetch this from various global IPs
    });

    const html = await response.text();
    return new NextResponse(html, {
      headers: {
        'Content-Type': 'text/html',
        'Cache-Control': 'no-store',
        'X-Final-Url': response.url
      },
    });
  } catch (error: any) {
    return NextResponse.json({ error: error.message }, { status: 500 });
  }
}
