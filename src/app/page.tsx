'use client';

import { useState, useEffect } from 'react';
import axios from 'axios';
import { Loader2, Plus, Trophy, RefreshCw } from 'lucide-react';
import { clsx, type ClassValue } from 'clsx';
import { twMerge } from 'tailwind-merge';

function cn(...inputs: ClassValue[]) {
  return twMerge(clsx(inputs));
}

interface VoteRecord {
  id: string;
  url: string;
  platform: 'bilibili' | 'douyin' | 'xiaohongshu';
  userId: string;
  likes: number;
  updatedAt: string;
}

export default function Home() {
  const [url, setUrl] = useState('');
  const [leaderboard, setLeaderboard] = useState<VoteRecord[]>([]);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const fetchLeaderboard = async () => {
    try {
      const { data } = await axios.get('/api/leaderboard');
      setLeaderboard(data);
    } catch (err) {
      console.error('Failed to fetch leaderboard:', err);
    }
  };

  useEffect(() => {
    fetchLeaderboard();
    const interval = setInterval(fetchLeaderboard, 30000); // Poll every 30s
    return () => clearInterval(interval);
  }, []);

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    if (!url) return;

    setLoading(true);
    setError(null);

    try {
      await axios.post('/api/submit', { url });
      setUrl('');
      await fetchLeaderboard();
    } catch (err: any) {
      console.error('Submission failed:', err);
      setError(err.response?.data?.error || 'Submission failed. Please check the URL and try again.');
    } finally {
      setLoading(false);
    }
  };

  return (
    <div className="min-h-screen bg-gray-50 text-gray-900 font-sans">
      <header className="bg-white border-b border-gray-200 py-6">
        <div className="container mx-auto px-4 max-w-4xl flex items-center justify-between">
          <h1 className="text-2xl font-bold flex items-center gap-2">
            <Trophy className="w-8 h-8 text-yellow-500" />
            Social Media Vote Tracker
          </h1>
          <button 
            onClick={fetchLeaderboard}
            className="p-2 hover:bg-gray-100 rounded-full transition-colors"
            title="Refresh Leaderboard"
          >
            <RefreshCw className="w-5 h-5 text-gray-500" />
          </button>
        </div>
      </header>

      <main className="container mx-auto px-4 py-8 max-w-4xl space-y-8">
        {/* Submission Form */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 p-6">
          <h2 className="text-lg font-semibold mb-4 flex items-center gap-2">
            <Plus className="w-5 h-5 text-blue-500" />
            Submit New Video
          </h2>
          <form onSubmit={handleSubmit} className="flex gap-4">
            <input
              type="url"
              placeholder="Paste Bilibili, Douyin, or Xiaohongshu link here..."
              className="flex-1 px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
              value={url}
              onChange={(e) => setUrl(e.target.value)}
              disabled={loading}
              required
            />
            <button
              type="submit"
              disabled={loading}
              className="px-6 py-2 bg-blue-600 text-white font-medium rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed flex items-center gap-2 transition-colors"
            >
              {loading ? (
                <>
                  <Loader2 className="w-4 h-4 animate-spin" />
                  Processing...
                </>
              ) : (
                'Submit'
              )}
            </button>
          </form>
          {error && (
            <p className="mt-3 text-sm text-red-600 bg-red-50 p-2 rounded border border-red-100">
              Error: {error}
            </p>
          )}
          <p className="mt-3 text-xs text-gray-500">
            Supported formats: b23.tv, bilibili.com, v.douyin.com, douyin.com, xhslink.com, xiaohongshu.com
          </p>
        </section>

        {/* Leaderboard */}
        <section className="bg-white rounded-xl shadow-sm border border-gray-200 overflow-hidden">
          <div className="p-6 border-b border-gray-200">
            <h2 className="text-lg font-semibold flex items-center gap-2">
              <Trophy className="w-5 h-5 text-yellow-500" />
              Live Leaderboard
            </h2>
          </div>
          
          <div className="overflow-x-auto">
            <table className="w-full text-left text-sm">
              <thead className="bg-gray-50 text-gray-600 font-medium uppercase tracking-wider">
                <tr>
                  <th className="px-6 py-3 w-16 text-center">Rank</th>
                  <th className="px-6 py-3 w-32">Platform</th>
                  <th className="px-6 py-3">User / Creator</th>
                  <th className="px-6 py-3 text-right">Likes</th>
                  <th className="px-6 py-3 text-right w-40">Last Updated</th>
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {leaderboard.length === 0 ? (
                  <tr>
                    <td colSpan={5} className="px-6 py-12 text-center text-gray-500">
                      No submissions yet. Be the first to add a video!
                    </td>
                  </tr>
                ) : (
                  leaderboard.map((record, index) => (
                    <tr key={record.id} className="hover:bg-gray-50 transition-colors group">
                      <td className="px-6 py-4 text-center font-bold text-gray-400 group-hover:text-blue-600">
                        {index + 1}
                      </td>
                      <td className="px-6 py-4">
                        <span className={cn(
                          "px-2 py-1 rounded text-xs font-medium uppercase",
                          record.platform === 'bilibili' && "bg-pink-100 text-pink-700",
                          record.platform === 'douyin' && "bg-black text-white", // Douyin black/white theme
                          record.platform === 'xiaohongshu' && "bg-red-100 text-red-700",
                        )}>
                          {record.platform}
                        </span>
                      </td>
                      <td className="px-6 py-4 font-medium text-gray-900 truncate max-w-[200px]" title={record.userId}>
                        {record.userId}
                      </td>
                      <td className="px-6 py-4 text-right font-mono font-bold text-blue-600">
                        {record.likes.toLocaleString()}
                      </td>
                      <td className="px-6 py-4 text-right text-gray-500 text-xs">
                        {new Date(record.updatedAt).toLocaleTimeString()}
                      </td>
                    </tr>
                  ))
                )}
              </tbody>
            </table>
          </div>
        </section>
      </main>
    </div>
  );
}
