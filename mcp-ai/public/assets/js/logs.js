import { fetchJson } from './common.js';

let metricTotalReq;
let metricPerRoute;
let metricRecentReq;
let metricRecentErrors;
let btnRefreshLogs;
let lastAccessData = null;
let lastErrorData = null;

function renderPerRoute(perRoute = {}) {
  if (!metricPerRoute) return;
  const entries = Object.entries(perRoute);
  metricPerRoute.innerHTML = entries.length
    ? entries.map(([route, count]) => `<li><strong>${route}</strong>: ${count}</li>`).join('')
    : '<li>Chưa có dữ liệu.</li>';
}

function renderRecentRequests(recent = []) {
  if (!metricRecentReq) return;
  metricRecentReq.textContent = recent.length
    ? recent
        .slice(0, 10)
        .map((req) => `${req.at} · ${req.method} ${req.route} -> ${req.status} (${req.duration}ms)`)
        .join('\n')
    : '(chưa có dữ liệu)';
}

function renderRecentErrors(recentErrors = []) {
  if (!metricRecentErrors) return;
  metricRecentErrors.textContent = recentErrors.length
    ? recentErrors
        .slice(0, 10)
        .map((err) => `${err.at} · ${err.method} ${err.route} -> ${err.status} · ${err.message || ''}`)
        .join('\n')
    : '(không có lỗi gần đây)';
}

function updateMetrics(accessData = {}, errorData = {}) {
  lastAccessData = accessData;
  lastErrorData = errorData;
  if (metricTotalReq) metricTotalReq.textContent = accessData?.totalRequests ?? '0';
  renderPerRoute(accessData?.perRoute);
  renderRecentRequests(accessData?.recentRequests);
  renderRecentErrors(errorData?.recentErrors);
}

async function fetchAndRenderMetrics() {
  try {
    if (metricRecentReq) metricRecentReq.textContent = 'Đang tải...';
    if (metricRecentErrors) metricRecentErrors.textContent = 'Đang tải...';
    const [access, errors] = await Promise.all([
      fetchJson('/metrics/access'),
      fetchJson('/metrics/errors'),
    ]);
    updateMetrics(access, errors);
  } catch (err) {
    const msg = `Không tải được metrics: ${String(err)}`;
    if (metricRecentReq) metricRecentReq.textContent = msg;
    if (metricRecentErrors) metricRecentErrors.textContent = msg;
  }
}

export function initMetricsPanel({ autoLoad = true } = {}) {
  metricTotalReq = document.getElementById('metricTotalReq');
  metricPerRoute = document.getElementById('metricPerRoute');
  metricRecentReq = document.getElementById('metricRecentReq');
  metricRecentErrors = document.getElementById('metricRecentErrors');
  btnRefreshLogs = document.getElementById('btnRefreshLogs');

  if (!metricTotalReq || !metricPerRoute || !metricRecentReq || !metricRecentErrors) {
    return;
  }

  btnRefreshLogs?.addEventListener('click', fetchAndRenderMetrics);

  document.addEventListener('metrics:updated', (evt) => {
    const detail = evt.detail || {};
    const access = detail.access ?? detail;
    const errors = detail.errors;
    if (access || errors) {
      updateMetrics(access, errors);
    }
  });

  if (autoLoad) {
    fetchAndRenderMetrics();
  } else if (lastAccessData || lastErrorData) {
    updateMetrics(lastAccessData, lastErrorData);
  }
}
