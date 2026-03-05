/*
 * @Author: cuby-kimmy
 * @LastEditors: kimmy
 */
import { NextRequest, NextResponse } from 'next/server';
import { scrapeVideo } from '@/lib/scraper';
import { addOrUpdateVote } from '@/lib/db';

export async function POST(req: NextRequest) {
  try {
    let { url } = await req.json();
    if (!url) {
      return NextResponse.json({ error: 'URL is required' }, { status: 400 });
    }

    url = url.trim();

    const data = await scrapeVideo(url);
    const record = addOrUpdateVote({
      url,
      platform: data.platform,
      userId: data.user,
      likes: data.likes
    });

    return NextResponse.json(record);
  } catch (error: any) {
    console.error('Submission failed:', error);
    return NextResponse.json({ error: error.message || 'Internal Server Error' }, { status: 500 });
  }
}
