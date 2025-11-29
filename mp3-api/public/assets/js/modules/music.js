export function initMusicModule({ scope = document, basePort = 8002 } = {}) {
  const kwInput = scope.getElementById('kw');
  const songIdInput = scope.getElementById('songId');
  const player = scope.getElementById('player');
  const direct128 = scope.getElementById('direct128');
  const note128 = scope.getElementById('note128');
  const outEl = scope.getElementById('out');

  const baseCurl = window.location.origin.replace(/:\d+$/, `:${basePort}`);

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

  async function call(path, params) {
    const url = new URL(path, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    setOut && setOut('Loading...');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  scope.getElementById('btnSearchV2')?.addEventListener('click', async () => {
    const q = kwInput?.value.trim();
    if (!q) {
      setOut && setOut('Vui lòng nhập từ khóa');
      return;
    }
    const curlEl = scope.getElementById('curlSearch');
    curlEl && (curlEl.textContent = `curl "${baseCurl}/api/search?q=${encodeURIComponent(q)}"`);
    try {
      const res = await call('/api/search', { q });
      const songs = Array.isArray(res?.data?.songs) ? res.data.songs : [];
      const concise = songs.map(pickSongFields);
      if (concise[0]?.encodeId && songIdInput) {
        songIdInput.value = concise[0].encodeId;
      }
      setOut && setOut({ total: concise.length, songs: concise });
    } catch (err) {
      setOut && setOut(String(err));
    }
  });

  scope.getElementById('btnPlay')?.addEventListener('click', () => {
    const id = songIdInput?.value.trim();
    if (!id) {
      alert('Vui lòng nhập Song ID');
      return;
    }
    const streamUrl = `/api/song/stream?id=${encodeURIComponent(id)}`;
    if (player) {
      player.src = streamUrl;
      player.classList.remove('hidden');
      player.play().catch(() => {});
    }
    if (direct128) {
      direct128.href = streamUrl;
      direct128.textContent = streamUrl;
      direct128.classList.remove('hidden');
    }
    note128?.classList.remove('hidden');
  });

  scope.getElementById('btnGetLink')?.addEventListener('click', async () => {
    const id = songIdInput?.value.trim();
    if (!id) {
      setOut && setOut('Vui lòng nhập Song ID');
      return;
    }
    const curlEl = scope.getElementById('curlGetLink');
    curlEl && (curlEl.textContent = `curl "${baseCurl}/api/song?id=${encodeURIComponent(id)}"`);
    try {
      const res = await call('/api/song', { id });
      setOut && setOut(res);
    } catch (err) {
      setOut && setOut(String(err));
    }
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
    const id = songIdInput?.value.trim();
    if (!id) {
      setOut && setOut('Vui lòng nhập Song ID');
      return;
    }
    const curlEl = scope.getElementById('curlLyric');
    curlEl && (curlEl.textContent = `curl "${baseCurl}/api/lyric?id=${encodeURIComponent(id)}"`);
    try {
      const res = await call('/api/lyric', { id });
      const fileUrl = res?.data?.file;
      if (fileUrl) {
        try {
          const resp = await fetch(fileUrl);
          const lrc = await resp.text();
          const clean = lrc
            .split('\n')
            .map((line) => line.replace(/\s*\[[^\]]*\]\s*/g, '').trim())
            .filter(Boolean)
            .join('\n');
          setOut && setOut(`"file": "${fileUrl}"\n\n${clean}`);
        } catch (err) {
          setOut && setOut(res);
        }
      } else {
        setOut && setOut(res);
      }
    } catch (err) {
      setOut && setOut(String(err));
    }
  });
}
