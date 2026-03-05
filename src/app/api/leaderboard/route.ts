import { NextResponse } from 'next/server';
import { getLeaderboard } from '@/lib/db';

export async function GET() {
  const data = getLeaderboard();
  return NextResponse.json(data);
}
