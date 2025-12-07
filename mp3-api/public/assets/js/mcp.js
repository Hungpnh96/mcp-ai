// ESP32 Smart Home Controller
// Uses HTTP REST API instead of WebSocket

const STORAGE_KEY = 'esp32_ip';
const POLL_INTERVAL = 2000; // 2 seconds
const MAX_LOG = 50;

let esp32IP = localStorage.getItem(STORAGE_KEY) || '192.168.2.23';
let pollTimer = null;
let activityLog = [];
let isConnected = false;

// Device state mapping
const deviceStates = {
  fan: false,
  light1: false,
  light2: false,
  light3: false,
};

// Logging
function addLog(message, type = 'info') {
  const timestamp = new Date().toLocaleTimeString('vi-VN');
  activityLog.unshift({ timestamp, message, type });
  if (activityLog.length > MAX_LOG) {
    activityLog = activityLog.slice(0, MAX_LOG);
  }
  updateLogDisplay();
}

function updateLogDisplay() {
  const logEl = document.getElementById('activityLog');
  if (!logEl) return;
  
  if (activityLog.length === 0) {
    logEl.textContent = '(chưa có hoạt động)';
    return;
  }
  
  const logText = activityLog
    .map(entry => `[${entry.timestamp}] [${entry.type.toUpperCase()}] ${entry.message}`)
    .join('\n');
  logEl.textContent = logText;
}

// API calls
function getBaseUrl() {
  return `http://${esp32IP}`;
}

async function fetchStatus() {
  try {
    const response = await fetch(`${getBaseUrl()}/api/status`, {
      method: 'GET',
      headers: { 'Content-Type': 'application/json' },
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const data = await response.json();
    updateDeviceStates(data);
    updateConnectionInfo(data);
    
    if (!isConnected) {
      isConnected = true;
      addLog('✅ Kết nối thành công với ESP32', 'success');
    }
    
    return data;
  } catch (error) {
    if (isConnected) {
      isConnected = false;
      addLog(`❌ Mất kết nối: ${error.message}`, 'error');
    }
    updateConnectionStatus(false, error.message);
    throw error;
  }
}

async function controlDevice(device, state) {
  const stateText = state ? 'BẬT' : 'TẮT';
  addLog(`⚡ Đang ${stateText} ${getDeviceName(device)}...`, 'info');
  
  try {
    const response = await fetch(`${getBaseUrl()}/api/control`, {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ device, state }),
      signal: AbortSignal.timeout(5000),
    });
    
    if (!response.ok) {
      throw new Error(`HTTP ${response.status}`);
    }
    
    const result = await response.json();
    
    if (result.success) {
      addLog(`✅ ${getDeviceName(device)} đã ${stateText}`, 'success');
      // Refresh status immediately
      await fetchStatus();
    } else {
      throw new Error(result.message || 'Lỗi không xác định');
    }
    
    return result;
  } catch (error) {
    addLog(`❌ Lỗi khi điều khiển ${getDeviceName(device)}: ${error.message}`, 'error');
    throw error;
  }
}

function getDeviceName(device) {
  const names = {
    fan: 'Quạt',
    light1: 'Đèn phòng khách',
    light2: 'Đèn phòng ngủ',
    light3: 'Đèn phòng bếp',
    all: 'Tất cả thiết bị',
  };
  return names[device] || device;
}

// UI Updates
function updateDeviceStates(data) {
  deviceStates.fan = data.fan || false;
  deviceStates.light1 = data.light1 || false;
  deviceStates.light2 = data.light2 || false;
  deviceStates.light3 = data.light3 || false;
  
  updateDeviceUI('fan', deviceStates.fan);
  updateDeviceUI('light1', deviceStates.light1);
  updateDeviceUI('light2', deviceStates.light2);
  updateDeviceUI('light3', deviceStates.light3);
}

function updateDeviceUI(device, isOn) {
  const statusEl = document.getElementById(`status-${device}`);
  if (!statusEl) return;
  
  statusEl.textContent = isOn ? '✅ ĐANG BẬT' : '⭕ ĐANG TẮT';
  statusEl.style.color = isOn ? '#10b981' : '#6b7280';
  statusEl.style.fontWeight = 'bold';
}

function updateConnectionInfo(data) {
  const statusEl = document.getElementById('connectionStatus');
  const ipEl = document.getElementById('deviceIP');
  const wifiEl = document.getElementById('wifiSignal');
  const updateEl = document.getElementById('lastUpdate');
  
  if (statusEl) {
    statusEl.textContent = '✅ Đã kết nối';
    statusEl.style.color = '#10b981';
    statusEl.style.fontWeight = 'bold';
  }
  
  if (ipEl) {
    ipEl.textContent = data.ip || esp32IP;
  }
  
  if (wifiEl) {
    const rssi = data.wifi_rssi || 0;
    wifiEl.textContent = `${rssi} dBm`;
    // Color based on signal strength
    if (rssi > -50) wifiEl.style.color = '#10b981';
    else if (rssi > -70) wifiEl.style.color = '#f59e0b';
    else wifiEl.style.color = '#ef4444';
  }
  
  if (updateEl) {
    updateEl.textContent = new Date().toLocaleTimeString('vi-VN');
  }
}

function updateConnectionStatus(connected, error = null) {
  const statusEl = document.getElementById('connectionStatus');
  
  if (!statusEl) return;
  
  if (connected) {
    statusEl.textContent = '✅ Đã kết nối';
    statusEl.style.color = '#10b981';
  } else {
    statusEl.textContent = `❌ Mất kết nối${error ? ': ' + error : ''}`;
    statusEl.style.color = '#ef4444';
  }
  
  statusEl.style.fontWeight = 'bold';
}

// Polling
function startPolling() {
  if (pollTimer) return;
  
  // Initial fetch
  fetchStatus().catch(() => {});
  
  // Start polling
  pollTimer = setInterval(() => {
    fetchStatus().catch(() => {});
  }, POLL_INTERVAL);
  
  addLog('🔄 Bắt đầu cập nhật tự động', 'info');
}

function stopPolling() {
  if (pollTimer) {
    clearInterval(pollTimer);
    pollTimer = null;
    addLog('⏸️ Dừng cập nhật tự động', 'info');
  }
}

// Event handlers
function handleDeviceControl(event) {
  const button = event.target.closest('.btn-device');
  if (!button) return;
  
  const device = button.dataset.device;
  const state = button.dataset.state === 'true';
  
  if (!device) return;
  
  // Disable button during request
  button.disabled = true;
  
  controlDevice(device, state)
    .catch(error => {
      console.error('Control error:', error);
    })
    .finally(() => {
      button.disabled = false;
    });
}

function handleSaveConfig() {
  const ipInput = document.getElementById('esp32IP');
  if (!ipInput) return;
  
  const newIP = ipInput.value.trim();
  if (!newIP) {
    addLog('❌ Vui lòng nhập địa chỉ IP', 'error');
    return;
  }
  
  // Validate IP format (basic)
  const ipRegex = /^\d{1,3}\.\d{1,3}\.\d{1,3}\.\d{1,3}$/;
  if (!ipRegex.test(newIP)) {
    addLog('❌ Địa chỉ IP không hợp lệ', 'error');
    return;
  }
  
  esp32IP = newIP;
  localStorage.setItem(STORAGE_KEY, esp32IP);
  addLog(`💾 Đã lưu IP: ${esp32IP}`, 'success');
  
  // Restart polling with new IP
  stopPolling();
  isConnected = false;
  startPolling();
}

function handleRefresh() {
  addLog('🔄 Làm mới thủ công...', 'info');
  fetchStatus().catch(() => {});
}

// Initialization
export function initMcpConsole() {
  // Load saved IP
  const ipInput = document.getElementById('esp32IP');
  if (ipInput) {
    ipInput.value = esp32IP;
  }
  
  // Attach event listeners
  document.querySelectorAll('.btn-device').forEach(btn => {
    btn.addEventListener('click', handleDeviceControl);
  });
  
  const btnSaveConfig = document.getElementById('btnSaveConfig');
  if (btnSaveConfig) {
    btnSaveConfig.addEventListener('click', handleSaveConfig);
  }
  
  const btnRefresh = document.getElementById('btnRefresh');
  if (btnRefresh) {
    btnRefresh.addEventListener('click', handleRefresh);
  }
  
  // Initial log
  addLog('🏠 ESP32 Smart Home Controller khởi động', 'info');
  addLog(`📡 Đang kết nối tới ${esp32IP}...`, 'info');
  
  // Start polling
  startPolling();
  
  // Cleanup on page unload
  window.addEventListener('beforeunload', () => {
    stopPolling();
  });
}
