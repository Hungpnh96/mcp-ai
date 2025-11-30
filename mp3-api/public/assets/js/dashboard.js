import { initMusicModule } from './modules/music.js';

const healthStatus = document.getElementById('healthStatus');
const healthMeta = document.getElementById('healthMeta');
const refreshHealthBtn = document.getElementById('refreshHealth');
const moduleButtons = document.querySelectorAll('.module-nav button');
const moduleSections = document.querySelectorAll('.module-section');
const newsLatestList = document.getElementById('newsLatestList');
const newsDetail = document.getElementById('newsDetail');
const newsDetailTitle = document.getElementById('newsDetailTitle');
const newsDetailLead = document.getElementById('newsDetailLead');
const newsDetailBody = document.getElementById('newsDetailBody');
const newsDetailLink = document.getElementById('newsDetailLink');
const weatherInfo = document.getElementById('weatherInfo');
const weatherCity = document.getElementById('weatherCity');
const lunarInfo = document.getElementById('lunarInfo');
const lunarDate = document.getElementById('lunarDate');
const radioOut = document.getElementById('radioOut');
const radioPlayer = document.getElementById('radioPlayer');
const radioStationSelect = document.getElementById('radioStationSelect');
const radioStationInput = document.getElementById('radioStationInput');
const radioQueryInput = document.getElementById('radioQuery');
const curlRadioPlay = document.getElementById('curlRadioPlay');
const btnRadioStations = document.getElementById('btnRadioStations');
const btnRadioStationsInline = document.getElementById('btnRadioStationsInline');
const btnRadioList = document.getElementById('btnRadioList');
const btnRadioPlay = document.getElementById('btnRadioPlay');
const btnRadioPlaySelected = document.getElementById('btnRadioPlaySelected');
const btnRadioSearch = document.getElementById('btnRadioSearch');
const btnOpenRadio = document.getElementById('btnOpenRadio');

function setStatus(ok, message) {
  healthStatus.classList.toggle('ok', ok);
  healthStatus.classList.toggle('fail', !ok);
  healthStatus.innerHTML = `<span></span>${ok ? 'Hoạt động' : 'Lỗi'}`;
  healthMeta.textContent = message;
}

function setRadioStatus(data) {
  if (radioOut) {
    radioOut.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
  }
}

async function fetchJson(path, params) {
  const url = new URL(path, window.location.origin);
  if (params) Object.entries(params).forEach(([k, v]) => url.searchParams.set(k, v));
  const res = await fetch(url);
  if (!res.ok) {
    const text = await res.text();
    throw new Error(`HTTP ${res.status}: ${text}`);
  }
  return res.json();
}

refreshHealthBtn?.addEventListener('click', async () => {
  refreshHealthBtn.disabled = true;
  try {
    const data = await fetchJson('/health');
    setStatus(Boolean(data?.ok), `Response: ${JSON.stringify(data)}`);
  } catch (err) {
    setStatus(false, String(err));
  } finally {
    refreshHealthBtn.disabled = false;
  }
});

function renderNews(items) {
  if (!newsLatestList) return;
  if (!Array.isArray(items) || !items.length) {
    newsLatestList.innerHTML = '<li>Không có dữ liệu.</li>';
    return;
  }
  newsLatestList.innerHTML = items
    .map((item, idx) => `
      <li data-link="${encodeURIComponent(item?.link || '')}" data-title="${encodeURIComponent(item?.title || '')}">
        <h4>${idx + 1}. ${item?.title || 'Không tiêu đề'}</h4>
        <p>${item?.description || ''}</p>
        <small>${item?.publishedAt || ''}</small>
        <div style="margin-top:6px; display:flex; gap:8px; flex-wrap:wrap;">
          <button class="secondary" data-action="read">Đọc nhanh</button>
          <a href="${item?.link}" target="_blank" rel="noreferrer noopener">Mở VNExpress</a>
        </div>
      </li>
    `)
    .join('');

  newsLatestList.querySelectorAll('button[data-action="read"]').forEach((btn) => {
    btn.addEventListener('click', async (evt) => {
      evt.stopPropagation();
      const li = btn.closest('li');
      if (!li) return;
      const link = decodeURIComponent(li.dataset.link || '');
      const title = decodeURIComponent(li.dataset.title || '');
      if (!link) return;

      newsDetail.style.display = 'block';
      newsDetailTitle.textContent = title || 'Không tiêu đề';
      newsDetailLead.textContent = 'Đang tải nội dung...';
      newsDetailBody.innerHTML = '';
      newsDetailLink.href = link;

      try {
        const article = await fetchJson('/api/news/read', { url: link });
        newsDetailLead.textContent = article?.lead || '';
        newsDetailBody.innerHTML = (article?.content || [])
          .map((paragraph) => `<p>${paragraph}</p>`)
          .join('') || '<p>Không có nội dung.</p>';
      } catch (err) {
        newsDetailLead.textContent = `Lỗi: ${String(err)}`;
        newsDetailBody.innerHTML = '';
      }
    });
  });
}

document.getElementById('btnNewsLatest')?.addEventListener('click', async () => {
  if (newsLatestList) newsLatestList.innerHTML = '<li>Đang tải...</li>';
  newsDetail.style.display = 'none';
  try {
    const data = await fetchJson('/api/news/latest');
    renderNews(data?.items?.slice(0, 10));
  } catch (err) {
    if (newsLatestList) newsLatestList.innerHTML = `<li>${String(err)}</li>`;
  }
});

const weatherDescriptions = {
  0: 'Quang mây',
  1: 'Nắng nhẹ',
  2: 'Có mây',
  3: 'U ám',
  45: 'Sương mù',
  48: 'Sương kết băng',
  51: 'Mưa phùn nhẹ',
  61: 'Mưa vừa',
  63: 'Mưa nặng hạt',
  80: 'Mưa rào nhẹ',
  95: 'Giông bão'
};

async function refreshWeather() {
  if (weatherInfo) weatherInfo.innerHTML = 'Đang tải...';
  const city = weatherCity?.value || 'ho-chi-minh';
  try {
    const data = await fetchJson('/api/weather/current', { city });
    if (weatherInfo && data?.current) {
      weatherInfo.innerHTML = `
        <strong>${data.current.temperature ?? '--'}°C</strong>
        <span>${weatherDescriptions[data.current.weathercode] || 'Không rõ thời tiết'}</span>
        <span>Gió: ${data.current.windspeed ?? '--'} km/h</span>
        <span>Thời gian: ${new Date(data.current.time).toLocaleString('vi-VN')}</span>
      `;
    } else {
      weatherInfo.innerHTML = 'Không có dữ liệu thời tiết.';
    }
  } catch (err) {
    if (weatherInfo) weatherInfo.innerHTML = `Lỗi: ${String(err)}`;
  }
}

document.getElementById('btnWeather')?.addEventListener('click', refreshWeather);

async function refreshLunar() {
  if (lunarInfo) lunarInfo.innerHTML = 'Đang tải...';
  const date = lunarDate?.value;
  try {
    const data = await fetchJson('/api/lunar-calendar', date ? { date } : undefined);
    if (lunarInfo && data?.lunar) {
      lunarInfo.innerHTML = `
        <span>Ngày âm: ${data.lunar.day} / ${data.lunar.month} / ${data.lunar.year}</span>
        <span>Can Chi: ${data.lunar.GanZhiYear} · ${data.lunar.GanZhiMonth} · ${data.lunar.GanZhiDay}</span>
        <span>Tiết khí: ${data.lunar.jieqi || '—'}</span>
      `;
    } else {
      lunarInfo.innerHTML = 'Không có dữ liệu lịch âm.';
    }
  } catch (err) {
    if (lunarInfo) lunarInfo.innerHTML = `Lỗi: ${String(err)}`;
  }
}

document.getElementById('btnLunar')?.addEventListener('click', refreshLunar);

const today = new Date();
const yyyy = today.getFullYear();
const mm = String(today.getMonth() + 1).padStart(2, '0');
const dd = String(today.getDate()).padStart(2, '0');
if (lunarDate) lunarDate.value = `${yyyy}-${mm}-${dd}`;

function activateModule(target) {
  moduleButtons.forEach((btn) => {
    btn.classList.toggle('active', btn.dataset.target === target);
  });
  moduleSections.forEach((section) => {
    section.classList.toggle('active', section.dataset.module === target);
  });
}

moduleButtons.forEach((btn) => {
  btn.addEventListener('click', () => {
    const target = btn.dataset.target;
    if (!target) return;
    activateModule(target);
    if (target === 'news') {
      document.getElementById('btnNewsLatest')?.click();
    }
    if (target === 'weather') {
      refreshWeather();
    }
    if (target === 'calendar') {
      refreshLunar();
    }
    if (target === 'radio') {
      ensureRadioStations();
    }
  });
});

const radioState = {
  stations: [],
};

async function ensureRadioStations(force = false) {
  if (!force && radioState.stations.length) return radioState.stations;
  try {
    setRadioStatus('Đang tải danh sách radio...');
    const data = await fetchJson('/radio/stations');
    radioState.stations = data?.stations || [];
    if (radioStationSelect) {
      radioStationSelect.innerHTML = radioState.stations
        .map((station) => `<option value="${station.key}">${station.name}</option>`)
        .join('');
    }
    setRadioStatus({ message: 'Đã tải danh sách radio', count: radioState.stations.length });
    return radioState.stations;
  } catch (err) {
    setRadioStatus(`Lỗi tải danh sách: ${String(err)}`);
    throw err;
  }
}

function updateRadioCurl(params) {
  if (!curlRadioPlay) return;
  const url = new URL('/radio/play', window.location.origin);
  Object.entries(params || {}).forEach(([key, value]) => {
    if (value) url.searchParams.set(key, value);
  });
  curlRadioPlay.textContent = `curl "${url.toString()}"`;
}

function playRadioStream(payload) {
  if (!payload) return;
  setRadioStatus(payload);
  updateRadioCurl({ station: payload.station_key });
  const streamUrl = payload.stream_url_absolute || payload.stream_url;
  if (radioPlayer && streamUrl) {
    radioPlayer.classList.remove('hidden');
    radioPlayer.src = streamUrl;
    radioPlayer.play().catch(() => {});
  }
}

async function handleRadioPlay(query) {
  if (!query) {
    setRadioStatus('Vui lòng nhập tên kênh hoặc chọn trong danh sách.');
    return;
  }
  try {
    setRadioStatus('Đang kết nối radio...');
    updateRadioCurl({ station: query });
    const payload = await fetchJson('/radio/play', { station: query });
    playRadioStream(payload);
  } catch (err) {
    setRadioStatus(`Lỗi gọi /radio/play: ${String(err)}`);
  }
}

btnRadioPlay?.addEventListener('click', () => {
  const value = radioStationInput?.value.trim();
  handleRadioPlay(value);
});

btnRadioSearch?.addEventListener('click', () => {
  const value = radioQueryInput?.value.trim();
  handleRadioPlay(value);
});

btnRadioPlaySelected?.addEventListener('click', () => {
  const value = radioStationSelect?.value;
  handleRadioPlay(value);
});

btnRadioStations?.addEventListener('click', () => ensureRadioStations(true));
btnRadioStationsInline?.addEventListener('click', () => ensureRadioStations(true));
btnRadioList?.addEventListener('click', () => ensureRadioStations(true));
btnOpenRadio?.addEventListener('click', () => activateModule('radio'));

document.getElementById('btnNewsLatest')?.click();
refreshWeather();
refreshLunar();
initMusicModule({ scope: document, basePort: 8002 });
