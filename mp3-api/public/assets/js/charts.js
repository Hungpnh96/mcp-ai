const chartRouteCanvas = document.getElementById('chartRouteDistribution');
const chartLatencyCanvas = document.getElementById('chartRecentLatency');
const routeCard = chartRouteCanvas?.closest('.chart-card');
const latencyCard = chartLatencyCanvas?.closest('.chart-card');
const btnRefreshCharts = document.getElementById('btnRefreshCharts');
const logsTabBtn = document.querySelector('.module-nav button[data-target="logs"]');

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

async function renderCharts() {
  if (!window.Chart || !chartRouteCanvas || !chartLatencyCanvas) return;
  try {
    btnRefreshCharts && (btnRefreshCharts.disabled = true);
    destroyCharts();
    const { perRoute = {}, recentRequests = [] } = await fetchAccessMetrics();

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
              labels: { color: '#cbd5f5' },
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
              ticks: { color: '#94a3b8', maxRotation: 45, minRotation: 45 },
              grid: { display: false },
            },
            y: {
              ticks: { color: '#94a3b8' },
              grid: { color: 'rgba(148, 163, 184, 0.15)' },
            },
          },
          plugins: {
            legend: { display: false },
          },
        },
      });
    }
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

btnRefreshCharts?.addEventListener('click', renderCharts);
logsTabBtn?.addEventListener('click', () => {
  if (!routeChartInstance || !latencyChartInstance) {
    renderCharts();
  }
});

// Preload data shortly after page ready
if (chartRouteCanvas && chartLatencyCanvas) {
  setTimeout(renderCharts, 1500);
}
