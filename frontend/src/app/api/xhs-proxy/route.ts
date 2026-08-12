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
      'User-Agent': 'Mozilla/5.0 (Windows NT 10.0; Win64; x64) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/124.0.0.0 Safari/537.36',
      'Accept': 'text/html,application/xhtml+xml,application/xml;q=0.9,image/avif,image/webp,*/*;q=0.8',
      'Accept-Language': 'en-US,en;q=0.9',
    };
    
    if (xhsCookie) {
      headers['Cookie'] = xhsCookie;
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
