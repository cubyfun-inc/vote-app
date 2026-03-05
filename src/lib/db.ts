import fs from 'fs';
import path from 'path';

const DB_PATH = process.env.NODE_ENV === 'production'
  ? '/tmp/db.json'
  : path.join(process.cwd(), 'data', 'db.json');

export interface VoteRecord {
  id: string;
  url: string;
  platform: 'bilibili' | 'douyin' | 'xiaohongshu';
  userId: string;
  likes: number;
  updatedAt: string;
  videoId?: string; // New field for deduplication
}

// Ensure DB exists
function ensureDB() {
  const dir = path.dirname(DB_PATH);
  if (!fs.existsSync(dir)) {
    fs.mkdirSync(dir, { recursive: true });
  }
  if (!fs.existsSync(DB_PATH)) {
    // If production (tmp), maybe pre-populate with some data if we wanted, but for now just empty array
    fs.writeFileSync(DB_PATH, JSON.stringify([], null, 2));
  }
}

// Read from file directly
function readDB(): VoteRecord[] {
  ensureDB();
  try {
    const data = fs.readFileSync(DB_PATH, 'utf-8');
    return JSON.parse(data);
  } catch (e) {
    console.error('Failed to parse DB', e);
    return [];
  }
}

// Write to file directly
function writeDB(data: VoteRecord[]) {
  ensureDB();
  try {
    fs.writeFileSync(DB_PATH, JSON.stringify(data, null, 2));
  } catch (e) {
    console.error('Failed to save DB', e);
  }
}

export function getLeaderboard(): VoteRecord[] {
  const records = readDB();
  // Filter out invalid records
  const validRecords = records.filter(r => 
    r.userId !== 'Unknown User' && 
    r.userId !== 'Unknown'
  );
  
  return validRecords.sort((a, b) => b.likes - a.likes);
}

export function addOrUpdateVote(record: Omit<VoteRecord, 'id' | 'updatedAt'>) {
  const records = readDB();
  
  // Try to find existing record by videoId (if available) OR url
  let existingIndex = -1;
  
  if (record.videoId) {
    existingIndex = records.findIndex(r => r.videoId === record.videoId);
  }
  
  // Fallback to URL match if videoId not found or not provided
  if (existingIndex === -1) {
    const normalize = (u: string) => u.trim().replace(/\/$/, '');
    const normalizedInputUrl = normalize(record.url);
    existingIndex = records.findIndex(r => normalize(r.url) === normalizedInputUrl);
  }
  
  const newRecord: VoteRecord = {
    ...record,
    id: existingIndex >= 0 ? records[existingIndex].id : Math.random().toString(36).substring(7),
    updatedAt: new Date().toISOString()
  };

  if (existingIndex >= 0) {
    // Merge new data into existing record
    records[existingIndex] = {
      ...records[existingIndex], // keep old ID
      ...newRecord, // update likes, userId, URL (to latest), videoId
    };
  } else {
    records.push(newRecord);
  }

  writeDB(records);
  return newRecord;
}

// One-time cleanup function (can be called manually)
export function cleanData() {
  const records = readDB();
  const uniqueRecords: VoteRecord[] = [];
  const seenUrls = new Set<string>();

  for (const r of records) {
    if (r.userId === 'Unknown User' || r.userId === 'Unknown') continue;
    if (r.likes === 0 && r.userId === 'Unknown') continue; 

    const normalizedUrl = r.url.trim().replace(/\/$/, '');
    if (seenUrls.has(normalizedUrl)) continue;
    seenUrls.add(normalizedUrl);
    
    uniqueRecords.push(r);
  }
  
  writeDB(uniqueRecords);
}
