import { initShell, fetchJson } from './common.js';

initShell({ currentPage: 'logs' });

const metricTotalReq = document.getElementById('metricTotalReq');
const metricPerRoute = document.getElementById('metricPerRoute');
const metricRecentReq = document.getElementById('metricRecentReq');
const metricRecentErrors = document.getElementById('metricRecentErrors');
const btnRefreshLogs = document.getElementById('btnRefreshLogs');

async function refreshMetrics() {
  try {
    if (metricRecentReq) metricRecentReq.textContent = 'Đang tải...';
    if (metricRecentErrors) metricRecentErrors.textContent = 'Đang tải...';
    const [access, errors] = await Promise.all([
      fetchJson('/metrics/access'),
      fetchJson('/metrics/errors'),
    ]);

    if (metricTotalReq) metricTotalReq.textContent = access?.totalRequests ?? '0';

    if (metricPerRoute) {
      const perRoute = access?.perRoute || {};
      const entries = Object.entries(perRoute);
      metricPerRoute.innerHTML = entries.length
        ? entries
            .map(([route, count]) => `<li><strong>${route}</strong>: ${count}</li>`)
            .join('')
        : '<li>Chưa có dữ liệu.</li>';
    }

    if (metricRecentReq) {
      const recent = (access?.recentRequests || []).slice(0, 10);
      metricRecentReq.textContent = recent.length
        ? recent
            .map((req) => `${req.at} · ${req.method} ${req.route} -> ${req.status} (${req.duration}ms)`)
            .join('\n')
        : '(chưa có dữ liệu)';
    }

    if (metricRecentErrors) {
      const recentErr = errors?.recentErrors || [];
      metricRecentErrors.textContent = recentErr.length
        ? recentErr
            .map((err) => `${err.at} · ${err.method} ${err.route} -> ${err.status} · ${err.message || ''}`)
            .join('\n')
        : '(không có lỗi gần đây)';
    }
  } catch (err) {
    const msg = `Không tải được metrics: ${String(err)}`;
    if (metricRecentReq) metricRecentReq.textContent = msg;
    if (metricRecentErrors) metricRecentErrors.textContent = msg;
  }
}

btnRefreshLogs?.addEventListener('click', refreshMetrics);

refreshMetrics();
