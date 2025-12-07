import { initShell, fetchJson } from './common.js';
import { initMetricsPanel } from './logs.js';

const refreshHealthBtn = document.getElementById('refreshHealth');
const healthStatus = document.getElementById('healthStatus');
const healthMeta = document.getElementById('healthMeta');
const statHealthLabel = document.getElementById('statHealthLabel');
const statHealthSubtitle = document.getElementById('statHealthSubtitle');
const statTotalReq = document.getElementById('statTotalReq');
const statLastUpdated = document.getElementById('statLastUpdated');
const statRadioCount = document.getElementById('statRadioCount');
const statCacheSize = document.getElementById('statCacheSize');

initShell({ currentPage: 'dashboard' });
initMetricsPanel();

function setStatus(ok, message) {
  if (!healthStatus || !healthMeta) return;
  healthStatus.classList.toggle('ok', ok);
  healthStatus.classList.toggle('fail', !ok);
  healthStatus.innerHTML = `<span></span>${ok ? 'Hoạt động' : 'Lỗi'}`;
  healthMeta.textContent = message;
}

function updateStats(healthData, metricsData) {
  if (statHealthLabel) {
    statHealthLabel.textContent = healthData?.ok ? 'Online' : 'Offline';
  }
  if (statHealthSubtitle) {
    statHealthSubtitle.textContent = `Cache: ${healthData?.adapter_cache_size ?? 0} bài`; 
  }
  if (statRadioCount) {
    statRadioCount.textContent = healthData?.radio_station_count ?? 0;
  }
  if (statCacheSize) {
    statCacheSize.textContent = (healthData?.cached_song_ids || []).length;
  }
  if (statTotalReq) {
    statTotalReq.textContent = metricsData?.totalRequests ?? 0;
  }
  if (statLastUpdated) {
    const ts = new Date();
    statLastUpdated.textContent = ts.toLocaleString('vi-VN');
  }
}

async function refreshHealth() {
  if (refreshHealthBtn) refreshHealthBtn.disabled = true;
  try {
    const [healthData, metricsAccess, metricsErrors] = await Promise.all([
      fetchJson('/health'),
      fetchJson('/metrics/access').catch(() => null),
      fetchJson('/metrics/errors').catch(() => null),
    ]);
    setStatus(Boolean(healthData?.ok), `Response: ${JSON.stringify(healthData)}`);
    updateStats(healthData, metricsAccess);
    document.dispatchEvent(
      new CustomEvent('metrics:updated', {
        detail: {
          access: metricsAccess,
          errors: metricsErrors,
        },
      }),
    );
  } catch (err) {
    setStatus(false, String(err));
  } finally {
    if (refreshHealthBtn) refreshHealthBtn.disabled = false;
  }
}

refreshHealthBtn?.addEventListener('click', refreshHealth);

refreshHealth();
