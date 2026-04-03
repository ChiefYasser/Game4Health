const API = window.location.origin;
let socket = null;
let sessionId = null;
let hrChart = null;
let stressChart = null;
let durationInterval = null;
let sessionStartTime = null;

// ── Chart Setup ─────────────────────────────────────────
function initCharts() {
  const chartDefaults = {
    responsive: true,
    maintainAspectRatio: false,
    animation: { duration: 200 },
    scales: {
      x: {
        display: true,
        grid: { color: 'rgba(46,50,64,0.6)' },
        ticks: { color: '#8a8f9c', maxTicksLimit: 10, font: { size: 10 } },
      },
      y: {
        grid: { color: 'rgba(46,50,64,0.6)' },
        ticks: { color: '#8a8f9c', font: { size: 10 } },
      },
    },
    plugins: {
      legend: { display: false },
    },
  };

  const hrCtx = document.getElementById('hrChart').getContext('2d');
  hrChart = new Chart(hrCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: '#3b82f6',
        backgroundColor: 'rgba(59,130,246,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, min: 40, max: 160 },
      },
    },
  });

  const stressCtx = document.getElementById('stressChart').getContext('2d');
  stressChart = new Chart(stressCtx, {
    type: 'line',
    data: {
      labels: [],
      datasets: [{
        data: [],
        borderColor: '#ef4444',
        backgroundColor: 'rgba(239,68,68,0.08)',
        borderWidth: 2,
        pointRadius: 0,
        tension: 0.3,
        fill: true,
      }],
    },
    options: {
      ...chartDefaults,
      scales: {
        ...chartDefaults.scales,
        y: { ...chartDefaults.scales.y, min: 0, max: 100 },
      },
    },
  });
}

function addChartPoint(chart, label, value, maxPoints) {
  chart.data.labels.push(label);
  chart.data.datasets[0].data.push(value);
  if (chart.data.labels.length > (maxPoints || 60)) {
    chart.data.labels.shift();
    chart.data.datasets[0].data.shift();
  }
  chart.update('none');
}

// ── Time Formatting ─────────────────────────────────────
function formatTime(date) {
  return new Date(date).toLocaleTimeString('en-US', { hour12: false, hour: '2-digit', minute: '2-digit', second: '2-digit' });
}

function formatDuration(seconds) {
  const m = Math.floor(seconds / 60).toString().padStart(2, '0');
  const s = (seconds % 60).toString().padStart(2, '0');
  return `${m}:${s}`;
}

// ── Metric Updates ──────────────────────────────────────
function updateMetric(id, value, className) {
  const el = document.getElementById(id);
  el.innerHTML = value;
  if (className) el.className = 'metric-value ' + className;
}

function updateStressMetric(stress) {
  let cls = 'stress-low';
  if (stress >= 30 && stress < 65) cls = 'stress-mid';
  if (stress >= 65) cls = 'stress-high';
  updateMetric('metricStress', stress + ' <small>%</small>', cls);
}

// ── Events List ─────────────────────────────────────────
const eventColors = {
  enemy_encounter: 'danger',
  jump_scare: 'danger',
  player_death: 'danger',
  puzzle_start: 'info',
  puzzle_complete: 'success',
  safe_zone: 'success',
  level_change: 'warning',
  game_over: 'warning',
};

function formatEventType(type) {
  return type.replace(/_/g, ' ').replace(/\b\w/g, c => c.toUpperCase());
}

function addEventToList(eventType, heartRate, stress, timestamp) {
  const list = document.getElementById('eventsList');
  const empty = list.querySelector('.event-empty');
  if (empty) empty.remove();

  const color = eventColors[eventType] || 'info';
  const time = formatTime(timestamp || new Date());

  const item = document.createElement('div');
  item.className = 'event-item';
  item.innerHTML = `
    <span class="event-dot ${color}"></span>
    <span class="event-type">${formatEventType(eventType)}</span>
    <span class="event-meta">HR: ${heartRate || '--'} | Stress: ${stress || '--'}% | ${time}</span>
  `;

  list.prepend(item);
}

// ── Duration Timer ──────────────────────────────────────
function startDurationTimer() {
  sessionStartTime = Date.now();
  durationInterval = setInterval(() => {
    const elapsed = Math.floor((Date.now() - sessionStartTime) / 1000);
    updateMetric('metricDuration', formatDuration(elapsed));
  }, 1000);
}

function stopDurationTimer() {
  if (durationInterval) {
    clearInterval(durationInterval);
    durationInterval = null;
  }
}

// ── API Helpers ─────────────────────────────────────────
async function apiPost(path, body) {
  const res = await fetch(API + path, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify(body),
  });
  return res.json();
}

async function apiGet(path) {
  const res = await fetch(API + path);
  return res.json();
}

// ── Socket Connection ───────────────────────────────────
function connectDashboard(sid) {
  socket = io(API + '/dashboard');

  socket.on('connect', () => {
    document.getElementById('connectionBadge').textContent = 'Connected';
    document.getElementById('connectionBadge').classList.add('connected');
    socket.emit('join-session', { sessionId: sid });
  });

  socket.on('disconnect', () => {
    document.getElementById('connectionBadge').textContent = 'Disconnected';
    document.getElementById('connectionBadge').classList.remove('connected');
  });

  socket.on('session-state', (data) => {
    // Hydrate charts with existing readings
    if (data.readings && data.readings.length > 0) {
      data.readings.forEach((r) => {
        const time = formatTime(r.timestamp);
        addChartPoint(hrChart, time, r.heartRate, 120);
        if (r.phase === 'active') {
          addChartPoint(stressChart, time, r.stressScore, 120);
        }
      });
    }
    // Hydrate events
    if (data.events && data.events.length > 0) {
      data.events.forEach((e) => {
        addEventToList(e.eventType, e.heartRateAtEvent, e.stressAtEvent, e.timestamp);
      });
    }
    // Update session info
    if (data.session) {
      updateMetric('metricStatus', data.session.status, 'metric-value status-' + data.session.status);
      if (data.session.baselineHR) {
        updateMetric('metricBaseline', data.session.baselineHR + ' <small>BPM</small>');
        document.getElementById('calibrationBar').style.display = 'none';
      }
    }
  });

  socket.on('calibration-progress', (data) => {
    const pct = Math.round((data.readings / data.needed) * 100);
    document.getElementById('calibrationFill').style.width = pct + '%';
    document.getElementById('calibrationText').textContent = data.readings + ' / ' + data.needed + ' readings';
    updateMetric('metricStatus', 'Calibrating', 'metric-value status-calibrating');
  });

  socket.on('calibration-complete', (data) => {
    document.getElementById('calibrationBar').style.display = 'none';
    updateMetric('metricBaseline', data.baselineHR + ' <small>BPM</small>');
    updateMetric('metricStatus', 'Active', 'metric-value status-active');
    startDurationTimer();
  });

  socket.on('stress-update', (data) => {
    const time = formatTime(data.timestamp);
    addChartPoint(hrChart, time, data.heartRate, 60);
    addChartPoint(stressChart, time, data.stressScore, 60);

    updateMetric('metricHR', data.heartRate + ' <small>BPM</small>');
    updateStressMetric(data.stressScore);
    updateMetric('metricDifficulty', data.difficulty.charAt(0).toUpperCase() + data.difficulty.slice(1));
  });

  socket.on('game-event', (data) => {
    addEventToList(data.eventType, data.heartRateAtEvent, data.stressAtEvent, data.timestamp);
  });

  socket.on('session-report', (report) => {
    stopDurationTimer();
    updateMetric('metricStatus', 'Completed', 'metric-value status-completed');
    showReport(report);
  });
}

// ── Report Display ──────────────────────────────────────
function showReport(report) {
  const panel = document.getElementById('reportPanel');
  const grid = document.getElementById('reportGrid');
  const insight = document.getElementById('reportInsight');
  const s = report.summary;

  grid.innerHTML = `
    <div class="report-stat">
      <div class="report-stat-label">Avg Heart Rate</div>
      <div class="report-stat-value">${s.avgHeartRate || '--'} BPM</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Max Heart Rate</div>
      <div class="report-stat-value">${s.maxHeartRate || '--'} BPM</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Avg Stress</div>
      <div class="report-stat-value">${s.avgStress || '--'}%</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Max Stress</div>
      <div class="report-stat-value">${s.maxStress || '--'}%</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Duration</div>
      <div class="report-stat-value">${s.durationSeconds ? formatDuration(s.durationSeconds) : '--'}</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Total Readings</div>
      <div class="report-stat-value">${s.totalReadings}</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Game Events</div>
      <div class="report-stat-value">${s.totalGameEvents}</div>
    </div>
    <div class="report-stat">
      <div class="report-stat-label">Min Heart Rate</div>
      <div class="report-stat-value">${s.minHeartRate || '--'} BPM</div>
    </div>
  `;

  insight.innerHTML = `
    <div class="report-insight-label">AI-Generated Insight</div>
    <p>${report.aiInsight || 'No insight available.'}</p>
  `;

  panel.style.display = 'block';
  panel.scrollIntoView({ behavior: 'smooth' });
}

// ── Session Creation ────────────────────────────────────
document.getElementById('btnCreateSession').addEventListener('click', async () => {
  const playerName = document.getElementById('playerName').value || 'Anonymous';
  const difficulty = document.getElementById('difficulty').value;
  const age = parseInt(document.getElementById('age').value);
  const gender = document.getElementById('gender').value;
  const currentMood = document.getElementById('currentMood').value;
  const phobiaLevel = parseInt(document.getElementById('phobiaLevel').value);

  if (!age || age < 5 || age > 99) {
    alert('Please enter a valid age (5-99).');
    return;
  }

  // Create session
  const sessionRes = await apiPost('/api/sessions', { playerName, difficulty });
  if (!sessionRes.sessionId) {
    alert('Failed to create session: ' + (sessionRes.error || 'Unknown error'));
    return;
  }
  sessionId = sessionRes.sessionId;

  // Submit questionnaire
  await apiPost('/api/questionnaires/' + sessionId, {
    age,
    gender,
    currentMood,
    phobiaLevel,
    priorGamingExperience: 'casual',
  });

  // Switch to dashboard view
  document.getElementById('setupPanel').style.display = 'none';
  document.getElementById('dashboard').style.display = 'block';
  updateMetric('metricStatus', 'Created', 'metric-value');

  // Initialize charts and connect socket
  initCharts();
  connectDashboard(sessionId);
});

// ── Calibration Button ──────────────────────────────────
document.getElementById('btnCalibrate').addEventListener('click', async () => {
  if (!sessionId) return;
  await apiPost('/api/debug/start-calibration', { sessionId });
  updateMetric('metricStatus', 'Calibrating', 'metric-value status-calibrating');
  document.getElementById('calibrationBar').style.display = 'flex';
});

// ── End Session Button ──────────────────────────────────
document.getElementById('btnEndSession').addEventListener('click', async () => {
  if (!sessionId) return;
  stopDurationTimer();
  const report = await apiGet('/api/reports/' + sessionId);
  updateMetric('metricStatus', 'Completed', 'metric-value status-completed');
  showReport(report);
});

// ── Simulation: Single Reading ──────────────────────────
document.getElementById('btnSimSensor').addEventListener('click', async () => {
  if (!sessionId) return;
  const heartRate = parseInt(document.getElementById('simHR').value) || 75;
  const res = await apiPost('/api/debug/simulate-sensor', { sessionId, heartRate });

  // If still calibrating, manually update chart with calibration data
  if (res.reading && res.reading.phase === 'calibration') {
    const time = formatTime(new Date());
    addChartPoint(hrChart, time, heartRate, 60);
  }
});

// ── Simulation: Stress Burst ────────────────────────────
document.getElementById('btnSimBurst').addEventListener('click', async () => {
  if (!sessionId) return;
  const burstPattern = [75, 80, 88, 95, 105, 115, 110, 100, 92, 85, 78, 74];
  for (const hr of burstPattern) {
    await apiPost('/api/debug/simulate-sensor', { sessionId, heartRate: hr });
    await new Promise(r => setTimeout(r, 400));
  }
});

// ── Simulation: Calm Session ────────────────────────────
document.getElementById('btnSimCalm').addEventListener('click', async () => {
  if (!sessionId) return;
  const calmPattern = [72, 71, 73, 70, 72, 74, 71, 73, 72, 70];
  for (const hr of calmPattern) {
    await apiPost('/api/debug/simulate-sensor', { sessionId, heartRate: hr });
    await new Promise(r => setTimeout(r, 400));
  }
});

// ── Simulation: Game Event ──────────────────────────────
document.getElementById('btnSimEvent').addEventListener('click', async () => {
  if (!sessionId) return;
  const eventType = document.getElementById('simEventType').value;
  await apiPost('/api/debug/simulate-game-event', { sessionId, eventType });
});
