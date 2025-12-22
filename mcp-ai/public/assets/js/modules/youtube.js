export function initYoutubeModule({ scope = document, basePort = 8002 } = {}) {
  const queryInput = scope.getElementById('ytQuery');
  const maxResultsInput = scope.getElementById('ytMaxResults');
  const outEl = scope.getElementById('ytOut');
  const curlEl = scope.getElementById('curlYtSearch');
  const curlStreamEl = scope.getElementById('curlYtStream');
  const playerEl = scope.getElementById('ytPlayer');
  const videoIdInput = scope.getElementById('ytVideoId');
  const videoFrame = scope.getElementById('ytVideoFrame');

  const baseOrigin = basePort
    ? window.location.origin.replace(/:\d+$/, `:${basePort}`)
    : window.location.origin;

  const setOut = (data) => {
    if (!outEl) return;
    outEl.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
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

  const updateStreamPreview = (videoId) => {
    if (!videoId) return;
    const path = '/youtube/audio';
    const params = { id: videoId };
    const url = buildCurl(path, params);
    curlStreamEl && (curlStreamEl.textContent = `curl "${url}"`);
    if (playerEl) {
      // Không tự động phát audio nữa; chỉ giữ lại nếu cần test tay
      playerEl.src = new URL(path, window.location.origin).toString() + `?id=${encodeURIComponent(videoId)}`;
      playerEl.classList.add('hidden');
    }
    if (videoFrame) {
      // Preview video bằng YouTube embed (video đầy đủ hình ảnh)
      videoFrame.src = `https://www.youtube.com/embed/${encodeURIComponent(videoId)}?autoplay=1`;
    }
    if (videoIdInput) {
      videoIdInput.value = videoId;
    }
  };

  async function call(path, params) {
    const url = new URL(path, window.location.origin);
    if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
    setOut('Loading...');
    const res = await fetch(url);
    if (!res.ok) {
      throw new Error(`HTTP ${res.status}: ${await res.text()}`);
    }
    return res.json();
  }

  const renderResults = (_videos) => {
    // Không còn hiển thị danh sách kết quả trên UI; chỉ dùng video đầu tiên cho stream/preview
  };

  scope.getElementById('btnYtSearch')?.addEventListener('click', async () => {
    try {
      const q = queryInput?.value.trim();
      const maxResults = Number(maxResultsInput?.value || 5) || 5;
      if (!q) {
        setOut('Vui lòng nhập từ khóa');
        return;
      }
      curlEl && (curlEl.textContent = `curl "${buildCurl('/api/youtube/search', { q, maxResults })}"`);
      const data = await call('/api/youtube/search', { q, maxResults });
      const videos = Array.isArray(data?.videos) ? data.videos : [];
      renderResults(videos);
      if (videos.length > 0 && videos[0]?.videoId) {
        // Tự động chọn video đầu tiên giống flow music
        updateStreamPreview(videos[0].videoId);
      }
      setOut(data);
    } catch (err) {
      setOut(String(err));
    }
  });

  scope.getElementById('btnYtPlay')?.addEventListener('click', () => {
    const id = videoIdInput?.value.trim();
    if (!id) {
      setOut('Vui lòng nhập Video ID');
      return;
    }
    updateStreamPreview(id);
    setOut(`Đang phát từ /youtube/audio?id=${id}`);
  });
}
