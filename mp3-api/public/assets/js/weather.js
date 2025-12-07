import { fetchJson } from './common.js';

const weatherInfo = document.getElementById('weatherInfo');
const weatherCity = document.getElementById('weatherCity');
const btnWeather = document.getElementById('btnWeather');

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
    } else if (weatherInfo) {
      weatherInfo.innerHTML = 'Không có dữ liệu thời tiết.';
    }
  } catch (err) {
    if (weatherInfo) weatherInfo.innerHTML = `Lỗi: ${String(err)}`;
  }
}

btnWeather?.addEventListener('click', refreshWeather);

refreshWeather();
