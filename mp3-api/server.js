const express = require('express');
const path = require('path');
const axios = require('axios');
const cheerio = require('cheerio');
const solarlunar = require('solarlunar');
const { ZingMp3 } = require('./dist');

const app = express();
const PORT = process.env.PORT || 8002;
const MUSIC_TOKEN = process.env.MUSIC_TOKEN || process.env.MP3_API_TOKEN || '';
const ADAPTER_PUBLIC_URL = process.env.ADAPTER_PUBLIC_URL || '';
const ADAPTER_CACHE_LIMIT = Number(process.env.ADAPTER_CACHE_LIMIT || 10);
const STREAM_TIMEOUT_MS = Number(process.env.ADAPTER_STREAM_TIMEOUT || 120000);
const audioCache = new Map();
const inflightDownloads = new Map();

app.use(express.json());
app.use(express.static(path.join(__dirname, 'public')));

function trimCache() {
  while (audioCache.size > ADAPTER_CACHE_LIMIT && audioCache.size > 0) {
    const firstKey = audioCache.keys().next().value;
    audioCache.delete(firstKey);
  }
}

async function ensureAudioCached(songId) {
  if (!songId) throw new Error('Missing songId');
  if (audioCache.has(songId)) return audioCache.get(songId);
  if (inflightDownloads.has(songId)) return inflightDownloads.get(songId);

  const downloadPromise = (async () => {
    const songData = await ZingMp3.getSong(String(songId));
    const data = songData?.data || {};
    const streamUrl = data['128'] || data['320'] || data['lossless'];
    if (!streamUrl) throw new Error('Stream URL not available');
    const response = await axios.get(streamUrl, {
      responseType: 'arraybuffer',
      timeout: STREAM_TIMEOUT_MS,
      headers: MUSIC_TOKEN ? { token: MUSIC_TOKEN } : undefined,
    });
    const buffer = Buffer.from(response.data);
    audioCache.set(songId, buffer);
    trimCache();
    inflightDownloads.delete(songId);
    return buffer;
  })().catch((err) => {
    inflightDownloads.delete(songId);
    throw err;
  });

  inflightDownloads.set(songId, downloadPromise);
  return downloadPromise;
}

function buildAdapterResponse(songItem, meta) {
  const songId = songItem?.encodeId;
  const payload = {
    title: songItem?.title || meta?.song || 'Unknown',
    artist: songItem?.artistsNames || meta?.artist || 'Unknown',
    song_id: songId,
    album: songItem?.album?.title || '',
    duration: songItem?.duration || 0,
    thumbnail: songItem?.thumbnailM || songItem?.thumbnail || '',
    source: 'zingmp3',
    request_meta: meta,
    audio_url: `/proxy_audio?id=${songId}`,
    lyric_url: `/proxy_lyric?id=${songId}`,
  };

  if (ADAPTER_PUBLIC_URL) {
    payload.audio_url_absolute = `${ADAPTER_PUBLIC_URL}${payload.audio_url}`;
    payload.lyric_url_absolute = `${ADAPTER_PUBLIC_URL}${payload.lyric_url}`;
  }

  return payload;
}

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

async function fetchArticleContent(url) {
  const { data } = await axios.get(url, {
    timeout: 10000,
    headers: { 'User-Agent': 'mp3-proxy-reader/1.0' }
  });
  const $ = cheerio.load(data);
  const lead = $('.summary, .lead_detail').first().text().trim();
  const bodyParagraphs = [];
  $('.fck_detail p').each((_, el) => {
    const text = $(el).text().trim();
    if (text) bodyParagraphs.push(text);
  });
  return {
    lead,
    content: bodyParagraphs,
  };
}

async function fetchWeather(city) {
  const url = 'https://api.open-meteo.com/v1/forecast';
  const mapping = {
    'ho-chi-minh': { latitude: 10.82, longitude: 106.63 },
    'hanoi': { latitude: 21.03, longitude: 105.85 },
    'danang': { latitude: 16.07, longitude: 108.22 },
  };
  const key = city.toLowerCase().replace(/\s+/g, '-');
  const coords = mapping[key] || mapping['ho-chi-minh'];
  const { data } = await axios.get(url, {
    params: {
      latitude: coords.latitude,
      longitude: coords.longitude,
      current_weather: true,
      timezone: 'auto'
    },
    timeout: 8000,
  });
  return {
    city: key,
    current: data?.current_weather,
  };
}

// health
app.get('/health', (_req, res) => {
  res.json({
    ok: true,
    adapter_cache_size: audioCache.size,
    cached_song_ids: Array.from(audioCache.keys()),
  });
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

app.get('/stream_pcm', async (req, res) => {
  try {
    const { song, artist = '' } = req.query;
    if (!song) return res.status(400).json({ error: 'Missing song parameter' });

    const query = artist ? `${song} ${artist}` : song;
    const searchResponse = await ZingMp3.search(String(query));
    const songs = searchResponse?.data?.songs || [];
    const target = songs[0];

    if (!target?.encodeId) {
      return res.status(404).json({ error: 'Song not found', title: song, artist: artist || 'Unknown' });
    }

    await ensureAudioCached(target.encodeId);
    const payload = buildAdapterResponse(target, { song, artist, query });
    res.json(payload);
  } catch (e) {
    console.error('stream_pcm error', e.message);
    res.status(500).json({ error: e?.message || 'Internal server error' });
  }
});

app.get('/proxy_audio', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).send('Missing id parameter');
    const buffer = await ensureAudioCached(String(id));
    res.set({
      'Content-Type': 'audio/mpeg',
      'Content-Length': buffer.length,
      'Accept-Ranges': 'bytes',
    });
    res.send(buffer);
  } catch (e) {
    console.error('proxy_audio error', e.message);
    res.status(500).send('Failed to proxy audio');
  }
});

app.get('/proxy_lyric', async (req, res) => {
  try {
    const { id } = req.query;
    if (!id) return res.status(400).send('Missing id parameter');
    const lyricResponse = await ZingMp3.getLyric(String(id));
    const lyricData = lyricResponse?.data;

    if (lyricData?.file) {
      const lyricContent = await axios.get(lyricData.file);
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send(lyricContent.data);
    }

    if (Array.isArray(lyricData?.sentences)) {
      const lines = [];
      lyricData.sentences.forEach((sentence) => {
        const words = sentence?.words || [];
        words.forEach((word) => {
          const time = word.startTime || 0;
          const minutes = Math.floor(time / 60000);
          const seconds = Math.floor((time % 60000) / 1000);
          const ms = Math.floor((time % 1000) / 10);
          lines.push(`[${String(minutes).padStart(2, '0')}:${String(seconds).padStart(2, '0')}.${String(ms).padStart(2, '0')}]${word.data}`);
        });
      });
      res.set('Content-Type', 'text/plain; charset=utf-8');
      return res.send(lines.join('\n'));
    }

    res.status(404).send('Lyric not found');
  } catch (e) {
    console.error('proxy_lyric error', e.message);
    res.status(404).send('Lyric not found');
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

app.get('/api/news/read', async (req, res) => {
  try {
    const { url } = req.query;
    if (!url) return res.status(400).json({ error: 'Missing url' });
    const article = await fetchArticleContent(String(url));
    res.json({ url, ...article });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Không đọc được bài viết' });
  }
});

app.get('/api/weather/current', async (req, res) => {
  try {
    const { city = 'Ho Chi Minh' } = req.query;
    const data = await fetchWeather(String(city));
    res.json(data);
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Không lấy được thời tiết' });
  }
});

app.get('/api/lunar-calendar', (req, res) => {
  try {
    const now = new Date();
    const date = req.query.date
      ? new Date(String(req.query.date))
      : now;
    const lunar = solarlunar.solar2lunar(date.getFullYear(), date.getMonth() + 1, date.getDate());
    res.json({
      solar: {
        year: date.getFullYear(),
        month: date.getMonth() + 1,
        day: date.getDate(),
      },
      lunar,
    });
  } catch (e) {
    res.status(500).json({ error: e?.message || 'Không lấy được lịch âm' });
  }
});

app.listen(PORT, () => {
  console.log(`Server listening on http://localhost:${PORT}`);
});
