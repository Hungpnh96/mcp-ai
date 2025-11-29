const express = require('express');
const path = require('path');
const axios = require('axios');
const { ZingMp3 } = require('./dist');

const app = express();
const PORT = process.env.PORT || 8002;

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

const VNEXPRESS_RSS = {
  latest: 'https://vnexpress.net/rss/tin-moi-nhat.rss',
  'thoi-su': 'https://vnexpress.net/rss/thoi-su.rss',
  'the-gioi': 'https://vnexpress.net/rss/the-gioi.rss',
  'kinh-doanh': 'https://vnexpress.net/rss/kinh-doanh.rss',
  'giai-tri': 'https://vnexpress.net/rss/giai-tri.rss',
  'the-thao': 'https://vnexpress.net/rss/the-thao.rss',
  'phap-luat': 'https://vnexpress.net/rss/phap-luat.rss',
  'giao-duc': 'https://vnexpress.net/rss/giao-duc.rss',
  'suc-khoe': 'https://vnexpress.net/rss/suc-khoe.rss',
  'doi-song': 'https://vnexpress.net/rss/doi-song.rss',
  'du-lich': 'https://vnexpress.net/rss/du-lich.rss',
  'khoa-hoc': 'https://vnexpress.net/rss/khoa-hoc.rss',
  'so-hoa': 'https://vnexpress.net/rss/so-hoa.rss',
  'oto-xe-may': 'https://vnexpress.net/rss/oto-xe-may.rss',
  'y-kien': 'https://vnexpress.net/rss/y-kien.rss'
};

const RICH_TEXT_REGEX = /<[^>]+>/g;

const stripCdata = (value = '') => value.replace(/<!\[CDATA\[/g, '').replace(/\]\]>/g, '').trim();
const decodeHtml = (value = '') => value
  .replace(/&amp;/g, '&')
  .replace(/&lt;/g, '<')
  .replace(/&gt;/g, '>')
  .replace(/&quot;/g, '"')
  .replace(/&#39;/g, "'");

function parseRss(xml) {
  const items = [];
  const itemRegex = /<item>([\s\S]*?)<\/item>/g;
  let match;
  while ((match = itemRegex.exec(xml)) && items.length < 15) {
    const block = match[1];
    const pick = (tag) => {
      const tagMatch = new RegExp(`<${tag}>([\\s\\S]*?)<\/${tag}>`, 'i').exec(block);
      return tagMatch ? decodeHtml(stripCdata(tagMatch[1])) : null;
    };
    const descriptionRaw = pick('description') || '';
    const description = descriptionRaw.replace(RICH_TEXT_REGEX, '').trim();
    const thumbMatch = /<img[^>]+src="([^"]+)"/i.exec(descriptionRaw);
    items.push({
      title: pick('title'),
      link: pick('link'),
      description,
      thumb: thumbMatch ? thumbMatch[1] : undefined,
      publishedAt: pick('pubDate')
    });
  }
  return items.filter((item) => item.title && item.link);
}

async function fetchNewsFeed(rssUrl) {
  const { data } = await axios.get(rssUrl, {
    timeout: 8000,
    headers: { 'User-Agent': 'mp3-proxy-news/1.0' }
  });
  return parseRss(data);
}

// health
app.get('/health', (_req, res) => {
  res.json({ ok: true });
});

// basic demos
app.get('/api/top100', async (_req, res) => {
  try {
    const data = await ZingMp3.getTop100();
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/home', async (_req, res) => {
  try {
    const data = await ZingMp3.getHome();
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

// full list according to README
app.get('/api/song', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getSong(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

// redirect to stream URL for simple playback (avoid CORS)
app.get('/api/song/stream', async (req, res) => {
  try {
    const { id, quality = '128' } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const response = await ZingMp3.getSong(String(id));
    const url = response?.data?.[String(quality)];
    if (!url || typeof url !== 'string') {
      return res.status(404).json({ error: `Stream URL not found for quality ${quality}` });
    }
    res.redirect(url);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/detail-playlist', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getDetailPlaylist(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/chart-home', async (_req, res) => {
  try {
    const data = await ZingMp3.getChartHome();
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/newrelease-chart', async (_req, res) => {
  try {
    const data = await ZingMp3.getNewReleaseChart();
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/info-song', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getInfoSong(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/artist', async (req, res) => {
  try {
    const { name } = req.query;
    if (!name) return res.status(400).json({ error: 'Missing name' });
    const data = await ZingMp3.getArtist(String(name));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/artist-songs', async (req, res) => {
  try {
    const { id, page = '1', count = '15' } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getListArtistSong(String(id), String(page), String(count));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/lyric', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getLyric(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/search', async (req, res) => {
  try {
    const { q } = req.query;
    if (!q) return res.status(400).json({ error: 'Missing q' });
    const data = await ZingMp3.search(String(q));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/list-mv', async (req, res) => {
  try {
    const { id, page = '1', count = '15' } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getListMV(String(id), String(page), String(count));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/category-mv', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getCategoryMV(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/video', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).json({ error: 'Missing id' });
    const data = await ZingMp3.getVideo(String(id));
    res.json(data);
  } catch (e) {
    res.status(e?.response?.status || 500).json({ error: e?.message || 'Internal Error' });
  }
});

app.get('/api/news/latest', async (_req, res) => {
  try {
    const items = await fetchNewsFeed(VNEXPRESS_RSS.latest);
    res.json({ source: 'vnexpress', category: 'tin-moi-nhat', items });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Không lấy được tin mới nhất' });
  }
});

app.get('/api/news/category', async (req, res) => {
  try {
    const { slug } = req.query;
    if (!slug) return res.status(400).json({ error: 'Missing slug' });
    const key = String(slug).trim();
    const rssUrl = VNEXPRESS_RSS[key];
    if (!rssUrl) {
      return res.status(404).json({ error: 'Slug không hỗ trợ' });
    }
    const items = await fetchNewsFeed(rssUrl);
    res.json({ source: 'vnexpress', category: key, items });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Không lấy được tin theo mục' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
