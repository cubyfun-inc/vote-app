import axios from 'axios';
import chromium from '@sparticuz/chromium-min';
import puppeteerCore, { Browser, Page } from 'puppeteer-core';

interface VideoData {
  platform: 'bilibili' | 'douyin' | 'xiaohongshu';
  likes: number;
  user: string;
  title?: string;
  duration?: string;
  originalUrl: string;
  videoId: string;
}

function formatDuration(seconds: number): string {
  if (!seconds) return '';
  const m = Math.floor(seconds / 60);
  const s = Math.floor(seconds % 60);
  return `${m}:${s.toString().padStart(2, '0')}`;
}

// Helper to resolve short links
async function resolveShortLink(url: string): Promise<string> {
  try {
    const response = await axios.get(url, {
      maxRedirects: 10,
      validateStatus: (status) => status >= 200 && status < 400,
      headers: {
        'User-Agent': 'Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1',
      },
    });
    return response.request.res.responseUrl || url;
  } catch (error: any) {
    console.error(`Error resolving link ${url}:`, error.message);
    return url;
  }
}

// Bilibili Scraper
async function scrapeBilibili(url: string): Promise<VideoData> {
  const longUrl = url.includes('b23.tv') ? await resolveShortLink(url) : url;
  
  const bvMatch = longUrl.match(/BV[a-zA-Z0-9]+/);
  if (!bvMatch) {
    throw new Error('Invalid Bilibili URL: No BV ID found');
  }
  const bvid = bvMatch[0];

  const apiUrl = `https://api.bilibili.com/x/web-interface/view?bvid=${bvid}`;
  const { data } = await axios.get(apiUrl);

  if (data.code !== 0) {
    throw new Error(`Bilibili API Error: ${data.message}`);
  }

  const videoInfo = data.data;
  return {
    platform: 'bilibili',
    likes: videoInfo.stat.like,
    user: videoInfo.owner.name,
    title: videoInfo.title,
    duration: formatDuration(videoInfo.duration),
    originalUrl: url,
    videoId: bvid
  };
}

let browserInstance: Browser | null = null;

async function getBrowser() {
  // If browser is disconnected, clear the instance
  if (browserInstance && !browserInstance.isConnected()) {
    browserInstance = null;
  }
  
  if (!browserInstance) {
    if (process.env.NODE_ENV === 'production' || process.env.VERCEL) {
      // Vercel / Production Environment
      // Configure sparticuz/chromium
      // Increase timeout for cold starts
      browserInstance = await puppeteerCore.launch({
        args: chromium.args,
        defaultViewport: { width: 1920, height: 1080 },
        executablePath: await chromium.executablePath('https://github.com/Sparticuz/chromium/releases/download/v141.0.0/chromium-v141.0.0-pack.x64.tar'),
        headless: true,
        ignoreHTTPSErrors: true,
      } as any) as unknown as Browser;
    } else {
      // Local Development Environment
      // Dynamically import puppeteer to avoid bundling in production
      const puppeteer = (await import('puppeteer')).default;
      browserInstance = await puppeteer.launch({
        headless: true,
        args: [
          '--no-sandbox',
          '--disable-setuid-sandbox',
          '--disable-dev-shm-usage',
          '--disable-blink-features=AutomationControlled',
          '--disable-infobars',
          '--window-size=375,812', // Mobile size
        ],
        ignoreDefaultArgs: ['--enable-automation'],
      });
    }
  }
  return browserInstance;
}

async function configurePage(page: Page) {
  // Common configuration for both environments
  await page.setUserAgent('Mozilla/5.0 (iPhone; CPU iPhone OS 16_6 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/16.6 Mobile/15E148 Safari/604.1');
  
  await page.evaluateOnNewDocument(() => {
    Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
    Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
    Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
  });
}

function findDeepValue(obj: any, key: string): any {
  if (!obj || typeof obj !== 'object') return undefined;
  if (key in obj) return obj[key];
  for (const k in obj) {
    const found = findDeepValue(obj[k], key);
    if (found !== undefined) return found;
  }
  return undefined;
}

// Douyin Scraper
async function scrapeDouyin(url: string): Promise<VideoData> {
  const longUrl = url.includes('v.douyin.com') ? await resolveShortLink(url) : url;
  
  let videoId = '';
  const idMatch = longUrl.match(/\/video\/(\d+)/) || longUrl.match(/modal_id=(\d+)/);
  if (idMatch) {
    videoId = idMatch[1];
  }

  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    await configurePage(page);
    await page.setExtraHTTPHeaders({
      'Accept-Language': 'zh-CN,zh;q=0.9,en;q=0.8',
    });

    await page.goto(longUrl, { waitUntil: 'networkidle2', timeout: 30000 });

    // 1. Primary Method: script#RENDER_DATA
    const renderData = await page.evaluate(() => {
        const script = document.querySelector('script#RENDER_DATA');
        if (!script) return null;
        try {
            return JSON.parse(decodeURIComponent(script.innerHTML));
        } catch (e) {
            return null;
        }
    });

    let likes = 0;
    let authorName = 'Unknown User';
    let durationStr = '';

    if (renderData) {
        likes = findDeepValue(renderData, 'diggCount') || findDeepValue(renderData, 'digg_count') || 0;
        authorName = findDeepValue(renderData, 'nickname') || findDeepValue(renderData, 'unique_id') || 'Unknown User';
        if (!videoId) {
            videoId = findDeepValue(renderData, 'awemeId') || findDeepValue(renderData, 'aweme_id') || '';
        }
        const durationMs = findDeepValue(renderData, 'duration') || findDeepValue(renderData, 'video_duration');
        if (durationMs) {
             durationStr = formatDuration(Math.floor(durationMs / 1000));
        }
    }

    // 2. Fallback: DOM Selectors (Mobile specific)
    if (likes === 0 || authorName === 'Unknown User') {
        try {
            await page.waitForSelector('.author-name, .nickname, [data-e2e="video-author-name"]', { timeout: 5000 });
        } catch(e) {}

        const domResult = await page.evaluate(() => {
            const authorSelectors = [
                '[data-e2e="video-author-name"]', 
                '.nickname', 
                '.author-name', 
                '.user-name',
                'h1.title'
            ];
            const likeSelectors = [
                '[data-e2e="like-count"]', 
                '[data-e2e="video-item-digg-count"]', 
                '.like-count', 
                '.digg-count',
                'span.count'
            ];
            
            let name = '';
            for (const sel of authorSelectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent) { name = el.textContent.trim(); break; }
            }
            
            let count = '';
            for (const sel of likeSelectors) {
                const el = document.querySelector(sel);
                if (el && el.textContent) { count = el.textContent.trim(); break; }
            }
            return { name, count };
        });
        
        if (!likes && domResult.count) likes = parseCount(domResult.count);
        if (authorName === 'Unknown User' && domResult.name) authorName = domResult.name;
    }
    
    // 3. Fallback: Regex on content
    if (likes === 0 || !videoId) {
        const content = await page.content();
        if (likes === 0) {
            const diggMatch = content.match(/"digg_count":\s*(\d+)/) || content.match(/"diggCount":\s*(\d+)/);
            if (diggMatch) likes = parseInt(diggMatch[1]);
        }
        if (!videoId) {
            const idMatchContent = content.match(/"aweme_id":"(\d+)"/) || content.match(/"awemeId":"(\d+)"/);
            if (idMatchContent) videoId = idMatchContent[1];
        }
        if (authorName === 'Unknown User') {
             const nameMatch = content.match(/"nickname":"([^"]+)"/);
             if (nameMatch) authorName = nameMatch[1];
        }
    }

    if (!videoId) {
        videoId = url; 
    }

    return {
      platform: 'douyin',
      likes: typeof likes === 'string' ? parseCount(likes) : (likes || 0),
      user: authorName || 'Unknown',
      duration: durationStr,
      originalUrl: url,
      videoId: videoId
    };
    
  } catch (e: any) {
    console.error('Douyin scraping failed:', e);
    throw e;
  } finally {
    await page.close();
  }
}

// Xiaohongshu Scraper
async function scrapeXiaohongshu(url: string): Promise<VideoData> {
  const longUrl = url.includes('xhslink.com') ? await resolveShortLink(url) : url;
  
  let videoId = '';
  const idMatch = longUrl.match(/\/explore\/(\w+)/);
  if (idMatch) videoId = idMatch[1];

  const browser = await getBrowser();
  const page = await browser.newPage();
  
  try {
    // XHS Desktop UA
    await page.setUserAgent('Mozilla/5.0 (Macintosh; Intel Mac OS X 10_15_7) AppleWebKit/537.36 (KHTML, like Gecko) Chrome/120.0.0.0 Safari/537.36');
    await page.evaluateOnNewDocument(() => {
        Object.defineProperty(navigator, 'webdriver', { get: () => undefined });
        Object.defineProperty(navigator, 'plugins', { get: () => [1, 2, 3, 4, 5] });
        Object.defineProperty(navigator, 'languages', { get: () => ['zh-CN', 'zh', 'en'] });
    });
    
    await page.goto(longUrl, { waitUntil: 'domcontentloaded', timeout: 30000 });
    
    const xhsData = await page.evaluate(() => {
        const scripts = Array.from(document.querySelectorAll('script'));
        for (const script of scripts) {
            if (script.innerHTML.includes('window.__INITIAL_STATE__')) {
                try {
                    const content = script.innerHTML;
                    const jsonStr = content.split('window.__INITIAL_STATE__=')[1]?.split(';')[0];
                    if (jsonStr) {
                        return JSON.parse(jsonStr.replace(/undefined/g, 'null'));
                    }
                } catch (e) { /* ignore */ }
            }
        }
        return null;
    });

    let user = 'Unknown';
    let likes = 0;
    let durationStr = '';

    if (xhsData) {
        const noteUser = xhsData.note?.user || xhsData.note?.author;
        if (noteUser) {
            user = noteUser.nickname || noteUser.name || 'Unknown';
        }
        
        if (user === 'Unknown') {
             user = findDeepValue(xhsData, 'nickname') || 'Unknown';
        }

        const noteStats = xhsData.note?.interactInfo || xhsData.note?.stats;
        if (noteStats) {
            likes = noteStats.likedCount || noteStats.liked_count || 0;
        }
        
        if (likes === 0) {
             likes = findDeepValue(xhsData, 'likedCount') || findDeepValue(xhsData, 'liked_count') || 0;
        }

        if (!videoId) {
            videoId = findDeepValue(xhsData, 'id') || findDeepValue(xhsData, 'noteId') || '';
        }
        
        const durationSec = findDeepValue(xhsData, 'duration') || (xhsData.note?.video?.duration);
        if (durationSec) {
            durationStr = formatDuration(durationSec);
        }
    }

    if (user === 'Unknown') {
        const userEl = await page.$('.username, .name, .author-name');
        if (userEl) {
            user = await page.evaluate(el => el.textContent || 'Unknown', userEl);
        }
    }
    
    if (likes === 0) {
        const likeEl = await page.$('.interaction-item .count, .like-wrapper .count, [class*="Like"] .count');
        if (likeEl) {
            const likeText = await page.evaluate(el => el.textContent || '0', likeEl);
            likes = parseCount(likeText);
        }
    }
    
    if (!videoId) videoId = url;

    return {
      platform: 'xiaohongshu',
      likes: typeof likes === 'string' ? parseCount(likes) : (likes || 0),
      user: user || 'Unknown',
      duration: durationStr,
      originalUrl: url,
      videoId
    };
  } catch (e) {
    console.error('XHS scraping failed:', e);
    throw e;
  } finally {
    await page.close();
  }
}

function parseCount(text: string | number): number {
  if (typeof text === 'number') return text;
  if (!text) return 0;
  text = text.trim();
  if (text.includes('万') || text.includes('w') || text.includes('W')) {
    return parseFloat(text.replace(/[万wW]/g, '')) * 10000;
  }
  return parseInt(text.replace(/[^0-9]/g, '')) || 0;
}

export async function scrapeVideo(url: string): Promise<VideoData> {
  if (url.includes('bilibili.com') || url.includes('b23.tv')) {
    return scrapeBilibili(url);
  } else if (url.includes('douyin.com')) {
    return scrapeDouyin(url);
  } else if (url.includes('xhslink.com') || url.includes('xiaohongshu.com')) {
    return scrapeXiaohongshu(url);
  }
  throw new Error('Unsupported platform');
}
