export function initMusicModule({ scope = document, basePort = 8002 } = {}) {
  const kwInput = scope.getElementById('kw');
  const artistInput = scope.getElementById('artist');
  const songIdInput = scope.getElementById('songId');
  const player = scope.getElementById('player');
  const direct128 = scope.getElementById('direct128');
  const note128 = scope.getElementById('note128');
  const outEl = scope.getElementById('out');

  const baseOrigin = basePort
    ? window.location.origin.replace(/:\d+$/, `:${basePort}`)
    : window.location.origin;
  let lastAdapterSong = null;

  const setOut = (data) => {
    if (!outEl) return;
    outEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  };

  const pickSongFields = (song) => ({
    encodeId: song?.encodeId,
    title: song?.title,
    artistsNames: song?.artistsNames,
    duration: song?.duration,
  });

  const resolveUrl = (maybeUrl) => {
    if (!maybeUrl) return null;
    if (/^https?:\/\//i.test(maybeUrl)) return maybeUrl;
    try {
      return new URL(maybeUrl, window.location.origin).toString();
    } catch (_err) {
      return maybeUrl;
    }
  };

  async function call(path, params, { showLoading = true } = {}) {
    const url = new URL(path, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    if (showLoading) setOut && setOut('Loading...');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  const rememberAdapterSong = (data) => {
    if (!data) return;
    lastAdapterSong = data;
    if (songIdInput && data.song_id) {
      songIdInput.value = data.song_id;
    }
    const streamUrl = data.audio_url_absolute || data.audio_url;
    if (streamUrl) {
      updateDirectLink(streamUrl);
    }
  };

  const buildCurl = (path, params = {}) => {
    const url = new URL(path, baseOrigin);
    Object.entries(params).forEach(([k, v]) => {
      if (v !== undefined && v !== null && v !== '') {
        url.searchParams.set(k, v);
      }
    });
    return url.toString();
  };

  const updateDirectLink = (rawUrl) => {
    if (!direct128) return;
    const resolved = resolveUrl(rawUrl);
    if (!resolved) return;
    direct128.href = resolved;
    direct128.textContent = resolved;
    direct128.classList.remove('hidden');
  };

  const playFromUrl = (rawUrl) => {
    const resolved = resolveUrl(rawUrl);
    if (!resolved) {
      alert('Không tìm được URL phát');
      return;
    }
    if (player) {
      player.src = resolved;
      player.classList.remove('hidden');
      player.play().catch(() => {});
    }
    updateDirectLink(resolved);
    note128?.classList.remove('hidden');
  };

  const ensureAdapterSong = async () => {
    const song = kwInput?.value.trim();
    if (!song) {
      setOut && setOut('Vui lòng nhập từ khóa (Song)');
      return null;
    }
    const artist = artistInput?.value.trim() || '';
    const curlEl = scope.getElementById('curlSearch');
    curlEl && (curlEl.textContent = `curl "${buildCurl('/stream_pcm', { song, artist })}"`);
    const data = await call('/stream_pcm', { song, artist });
    rememberAdapterSong(data);
    setOut && setOut(data);
    return data;
  };

  scope.getElementById('btnSearchV2')?.addEventListener('click', async () => {
    try {
      await ensureAdapterSong();
    } catch (err) {
      setOut && setOut(String(err));
    }
  });

  scope.getElementById('btnPlay')?.addEventListener('click', () => {
    const streamMeta = lastAdapterSong;
    if (streamMeta?.audio_url || streamMeta?.audio_url_absolute) {
      playFromUrl(streamMeta.audio_url_absolute || streamMeta.audio_url);
      return;
    }
    const id = songIdInput?.value.trim();
    if (!id) {
      alert('Vui lòng nhập Song ID');
      return;
    }
    playFromUrl(`/proxy_audio?id=${encodeURIComponent(id)}`);
  });

  scope.getElementById('btnGetLink')?.addEventListener('click', async () => {
    try {
      const meta = lastAdapterSong || (await ensureAdapterSong());
      if (meta?.audio_url || meta?.audio_url_absolute) {
        const curlEl = scope.getElementById('curlGetLink');
        const id = meta.song_id || songIdInput?.value.trim();
        curlEl && id && (curlEl.textContent = `curl "${buildCurl('/proxy_audio', { id })}"`);
        updateDirectLink(meta.audio_url_absolute || meta.audio_url);
        setOut && setOut(meta);
        return;
      }
    } catch (err) {
      setOut && setOut(String(err));
      return;
    }

    const id = songIdInput?.value.trim();
    if (!id) {
      setOut && setOut('Vui lòng nhập Song ID');
      return;
    }
    const curlEl = scope.getElementById('curlGetLink');
    curlEl && (curlEl.textContent = `curl "${buildCurl('/proxy_audio', { id })}"`);
    updateDirectLink(`/proxy_audio?id=${encodeURIComponent(id)}`);
    setOut && setOut('Đã tạo link proxy_audio, hãy dùng nút Phát nhạc để cache file.');
  });

  scope.getElementById('btnInfoSong')?.addEventListener('click', async () => {
    const id = songIdInput?.value.trim();
    if (!id) {
      setOut && setOut('Vui lòng nhập Song ID');
      return;
    }
    try {
      const res = await call('/api/info-song', { id });
      setOut && setOut(res);
    } catch (err) {
      setOut && setOut(String(err));
    }
  });

  scope.getElementById('btnLyric')?.addEventListener('click', async () => {
    const id = lastAdapterSong?.song_id || songIdInput?.value.trim();
    if (!id) {
      setOut && setOut('Vui lòng nhập Song ID');
      return;
    }
    const curlEl = scope.getElementById('curlLyric');
    curlEl && (curlEl.textContent = `curl "${buildCurl('/proxy_lyric', { id })}"`);
    try {
      const res = await fetch(`/proxy_lyric?id=${encodeURIComponent(id)}`);
      if (!res.ok) throw new Error(`HTTP ${res.status}`);
      const text = await res.text();
      setOut && setOut(text);
    } catch (err) {
      setOut && setOut(String(err));
    }
  });
}
