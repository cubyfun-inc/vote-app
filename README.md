# Social Media Vote Tracker

A real-time leaderboard for tracking video likes from Bilibili, Douyin, and Xiaohongshu.

## Features
- **Multi-platform Support**: Bilibili, Douyin, Xiaohongshu.
- **Real-time Leaderboard**: Automatically updates like counts.
- **Modern UI**: Built with Next.js and Tailwind CSS.

## Tech Stack
- **Framework**: Next.js 15 (App Router)
- **Styling**: Tailwind CSS + Lucide Icons
- **Scraping**: Puppeteer (Headless Chrome) + Axios
- **Database**: Local JSON file (for demo persistence)

## Setup & Run

1. Install dependencies:
   ```bash
   pnpm install
   ```

2. Install Chrome for Puppeteer:
   ```bash
   npx puppeteer browsers install chrome
   ```

3. Run the development server:
   ```bash
   pnpm dev
   ```

4. Open [http://localhost:3000](http://localhost:3000).

## Deployment

To expose the local server to the internet temporarily:
```bash
npx localtunnel --port 3000
```

## Note on Scraping
- **Bilibili**: Uses public API, very reliable.
- **Douyin / Xiaohongshu**: Uses Puppeteer to scrape web pages. Due to strict anti-scraping measures (captchas, login walls), data extraction might fail or return 0 likes. For production use, consider using official APIs or third-party paid services.
