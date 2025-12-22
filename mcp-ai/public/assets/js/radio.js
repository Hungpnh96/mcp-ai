import { fetchJson } from './common.js';

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

const radioState = {
  stations: [],
};

function setRadioStatus(data) {
  if (!radioOut) return;
  radioOut.textContent = typeof data === 'string' ? data : JSON.stringify(data, null, 2);
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

async function ensureRadioStations(force = false) {
  if (!force && radioState.stations.length) return radioState.stations;
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

document.addEventListener('DOMContentLoaded', () => {
  ensureRadioStations();
});
