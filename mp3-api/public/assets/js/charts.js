const chartRouteCanvas = document.getElementById('chartRouteDistribution');
const chartLatencyCanvas = document.getElementById('chartRecentLatency');
const routeCard = chartRouteCanvas?.closest('.chart-card');
const latencyCard = chartLatencyCanvas?.closest('.chart-card');
const btnRefreshCharts = document.getElementById('btnRefreshCharts');

let latestAccessMetrics = null;

let routeChartInstance = null;
let latencyChartInstance = null;

async function fetchAccessMetrics() {
  const response = await fetch('/metrics/access');
  if (!response.ok) {
    throw new Error(`HTTP ${response.status}`);
  }
  return response.json();
}

function destroyCharts() {
  routeChartInstance?.destroy();
  latencyChartInstance?.destroy();
  routeChartInstance = null;
  latencyChartInstance = null;
}

function setEmptyState(cardEl, canvasEl, message) {
  if (!cardEl || !canvasEl) return;
  let emptyEl = cardEl.querySelector('.chart-empty');
  if (message) {
    if (!emptyEl) {
      emptyEl = document.createElement('p');
      emptyEl.className = 'chart-empty';
      cardEl.appendChild(emptyEl);
    }
    emptyEl.textContent = message;
    emptyEl.hidden = false;
    canvasEl.style.display = 'none';
  } else if (emptyEl) {
    emptyEl.hidden = true;
    canvasEl.style.display = '';
  }
}

function renderChartsFromData(access = {}) {
  if (!window.Chart || !chartRouteCanvas || !chartLatencyCanvas) return;
  const { perRoute = {}, recentRequests = [] } = access;
  destroyCharts();

    const palette = [
      '#3b82f6',
      '#8b5cf6',
      '#10b981',
      '#f97316',
      '#ef4444',
      '#14b8a6',
      '#ec4899',
      '#fde047',
    ];

    const perRouteEntries = Object.entries(perRoute);
    if (perRouteEntries.length === 0) {
      setEmptyState(routeCard, chartRouteCanvas, 'Chưa có request nào để vẽ biểu đồ.');
    } else {
      setEmptyState(routeCard, chartRouteCanvas, null);
      routeChartInstance = new Chart(chartRouteCanvas, {
        type: 'doughnut',
        data: {
          labels: perRouteEntries.map(([route]) => route),
          datasets: [
            {
              label: 'Requests',
              data: perRouteEntries.map(([, count]) => count),
              backgroundColor: perRouteEntries.map((_, idx) => palette[idx % palette.length]),
              borderWidth: 0,
            },
          ],
        },
        options: {
          plugins: {
            legend: {
              position: 'bottom',
              labels: { color: getLegendColor() },
            },
          },
        },
      });
    }

    const recent = recentRequests.slice(0, 10).reverse();
    if (recent.length === 0) {
      setEmptyState(latencyCard, chartLatencyCanvas, 'Chưa có request nào gần đây.');
    } else {
      setEmptyState(latencyCard, chartLatencyCanvas, null);
      latencyChartInstance = new Chart(chartLatencyCanvas, {
        type: 'bar',
        data: {
          labels: recent.map((req) => `${req.method} ${req.route}`),
          datasets: [
            {
              label: 'Latency (ms)',
              data: recent.map((req) => req.duration),
              backgroundColor: '#38bdf8',
              borderRadius: 6,
            },
          ],
        },
        options: {
          scales: {
            x: {
              ticks: { color: getAxisColor(), maxRotation: 45, minRotation: 45 },
              grid: { display: false },
            },
            y: {
              ticks: { color: getAxisColor() },
              grid: { color: getGridColor() },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
}

function getLegendColor() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? '#0f172a' : '#cbd5f5';
}

function getAxisColor() {
  return document.documentElement.getAttribute('data-theme') === 'light' ? '#334155' : '#94a3b8';
}

function getGridColor() {
  const isLight = document.documentElement.getAttribute('data-theme') === 'light';
  return isLight ? 'rgba(51, 65, 85, 0.15)' : 'rgba(148, 163, 184, 0.15)';
}

async function renderCharts(forceFetch = false) {
  if (!window.Chart || !chartRouteCanvas || !chartLatencyCanvas) return;
  btnRefreshCharts && (btnRefreshCharts.disabled = true);
  try {
    if (forceFetch || !latestAccessMetrics) {
      latestAccessMetrics = await fetchAccessMetrics();
    }
    renderChartsFromData(latestAccessMetrics);
  } catch (err) {
    console.error('renderCharts error', err);
    if (routeCard) {
      setEmptyState(routeCard, chartRouteCanvas, 'Không render được biểu đồ.');
    }
    if (latencyCard) {
      setEmptyState(latencyCard, chartLatencyCanvas, 'Không render được biểu đồ.');
    }
  } finally {
    btnRefreshCharts && (btnRefreshCharts.disabled = false);
  }
}

btnRefreshCharts?.addEventListener('click', () => renderCharts(true));

document.addEventListener('metrics:updated', (evt) => {
  const detail = evt.detail || {};
  const access = detail.access ?? detail;
  if (access) {
    latestAccessMetrics = access;
    renderChartsFromData(access);
  }
});

// Preload data shortly after page ready
if (chartRouteCanvas && chartLatencyCanvas) {
  setTimeout(() => renderCharts(true), 1000);
}
