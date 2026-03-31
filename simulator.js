/**
 * simulator.js — Deadlock Scenario Simulator
 * Deadlock Prevention & Recovery Toolkit
 */

const Simulator = (() => {
  let steps = [];
  let simState = { held: {}, requested: {}, processes: [], resources: [] };
  let canvas, ctx;

  const PRESETS = {
    circular: {
      name: 'Circular Wait (Classic)',
      processes: ['P0','P1','P2'],
      resources: ['R0','R1','R2'],
      steps: [
        { proc:'P0', action:'hold',    res:'R0' },
        { proc:'P1', action:'hold',    res:'R1' },
        { proc:'P2', action:'hold',    res:'R2' },
        { proc:'P0', action:'request', res:'R1' },
        { proc:'P1', action:'request', res:'R2' },
        { proc:'P2', action:'request', res:'R0' },
      ]
    },
    dining: {
      name: 'Dining Philosophers',
      processes: ['Philo0','Philo1','Philo2','Philo3','Philo4'],
      resources: ['Fork0','Fork1','Fork2','Fork3','Fork4'],
      steps: [
        { proc:'Philo0', action:'hold',    res:'Fork0' },
        { proc:'Philo1', action:'hold',    res:'Fork1' },
        { proc:'Philo2', action:'hold',    res:'Fork2' },
        { proc:'Philo3', action:'hold',    res:'Fork3' },
        { proc:'Philo4', action:'hold',    res:'Fork4' },
        { proc:'Philo0', action:'request', res:'Fork1' },
        { proc:'Philo1', action:'request', res:'Fork2' },
        { proc:'Philo2', action:'request', res:'Fork3' },
        { proc:'Philo3', action:'request', res:'Fork4' },
        { proc:'Philo4', action:'request', res:'Fork0' },
      ]
    },
    producerconsumer: {
      name: 'Producer-Consumer',
      processes: ['Producer','Consumer'],
      resources: ['Buffer','Mutex'],
      steps: [
        { proc:'Producer', action:'hold',    res:'Mutex'  },
        { proc:'Consumer', action:'hold',    res:'Buffer' },
        { proc:'Producer', action:'request', res:'Buffer' },
        { proc:'Consumer', action:'request', res:'Mutex'  },
      ]
    },
    twoprocess: {
      name: 'Two-Process Deadlock',
      processes: ['P0','P1'],
      resources: ['R0','R1'],
      steps: [
        { proc:'P0', action:'hold',    res:'R0' },
        { proc:'P1', action:'hold',    res:'R1' },
        { proc:'P0', action:'request', res:'R1' },
        { proc:'P1', action:'request', res:'R0' },
      ]
    }
  };

  function init() {
    canvas = document.getElementById('simCanvas');
    ctx = canvas.getContext('2d');

    populateSelects();
    document.getElementById('addSimStep').addEventListener('click', addStep);
    document.getElementById('runSimulation').addEventListener('click', runSimulation);
    document.getElementById('clearSimulator').addEventListener('click', clearSimulator);
    document.getElementById('createDeadlock').addEventListener('click', () => loadPreset('circular'));

    document.querySelectorAll('.preset-btn').forEach(btn => {
      btn.addEventListener('click', () => loadPreset(btn.dataset.preset));
    });

    drawEmpty();
  }

  function populateSelects() {
    const bs = Banker.getState();
    const procSel = document.getElementById('simProcess');
    const resSel  = document.getElementById('simResource');
    const n = bs.processes || 4;
    const m = bs.resources  || 3;

    procSel.innerHTML = Array.from({length: n}, (_, i) => `<option value="P${i}">P${i}</option>`).join('');
    resSel.innerHTML  = Array.from({length: m}, (_, i) => `<option value="R${i}">R${i}</option>`).join('');
  }

  function addStep() {
    const proc   = document.getElementById('simProcess').value;
    const action = document.getElementById('simAction').value;
    const res    = document.getElementById('simResource').value;
    steps.push({ proc, action, res });
    renderSteps();
  }

  function renderSteps() {
    const container = document.getElementById('simSteps');
    if (!steps.length) {
      container.innerHTML = '<div class="empty-steps">No steps added yet. Build a scenario above.</div>';
      return;
    }
    container.innerHTML = steps.map((s, i) => `
      <div class="step-entry">
        <span style="color:var(--text-dim);font-size:0.65rem;">${String(i+1).padStart(2,'0')}</span>
        <span class="step-tag ${s.action}">${s.action}</span>
        <span style="color:var(--accent)">${s.proc}</span>
        <span style="color:var(--text-dim)">→</span>
        <span style="color:var(--warning)">${s.res}</span>
        <button class="step-remove" onclick="Simulator.removeStep(${i})">×</button>
      </div>
    `).join('');
  }

  function removeStep(i) {
    steps.splice(i, 1);
    renderSteps();
  }

  function runSimulation() {
    resetSimState();
    const log = document.getElementById('simLog');
    log.innerHTML = '';

    const allProcs = [...new Set(steps.map(s => s.proc))];
    const allRes   = [...new Set(steps.map(s => s.res))];
    simState.processes = allProcs;
    simState.resources = allRes;

    allProcs.forEach(p => { simState.held[p] = []; simState.requested[p] = []; });

    let deadlockDetected = false;

    steps.forEach((s, i) => {
      addLogEntry(log, `Step ${i+1}: ${s.proc} ${s.action}s ${s.res}`, 'info');

      if (s.action === 'hold') {
        simState.held[s.proc] = simState.held[s.proc] || [];
        if (!simState.held[s.proc].includes(s.res)) {
          simState.held[s.proc].push(s.res);
          addLogEntry(log, `  ✓ ${s.proc} now holds ${s.res}`, 'success');
        }
      } else if (s.action === 'request') {
        simState.requested[s.proc] = simState.requested[s.proc] || [];
        // Check if resource is free
        const holder = findHolder(s.res);
        if (!holder) {
          simState.held[s.proc].push(s.res);
          addLogEntry(log, `  ✓ ${s.proc} acquired ${s.res} (was free)`, 'success');
        } else {
          simState.requested[s.proc].push(s.res);
          addLogEntry(log, `  ⚠ ${s.proc} blocked — ${s.res} held by ${holder}`, 'warning');
        }
      } else if (s.action === 'release') {
        simState.held[s.proc] = (simState.held[s.proc] || []).filter(r => r !== s.res);
        simState.requested[s.proc] = (simState.requested[s.proc] || []).filter(r => r !== s.res);
        addLogEntry(log, `  ✓ ${s.proc} released ${s.res}`, 'success');
      }
    });

    // Deadlock detection
    const deadlocked = detectDeadlock();
    if (deadlocked.length > 1) {
      deadlockDetected = true;
      addLogEntry(log, '─'.repeat(38), 'info');
      addLogEntry(log, `✗ DEADLOCK DETECTED!`, 'error');
      addLogEntry(log, `Deadlocked processes: ${deadlocked.join(', ')}`, 'error');
      document.getElementById('systemStatus').className = 'status-badge danger';
      document.querySelector('#systemStatus .status-text').textContent = 'DEADLOCK!';
      document.querySelector('#systemStatus .pulse').style.background = 'var(--danger)';
    } else {
      addLogEntry(log, '─'.repeat(38), 'info');
      addLogEntry(log, '✓ No deadlock detected', 'success');
    }

    // Draw simulation graph
    drawSimGraph(deadlocked);

    // Sync to RAG
    const held = [];
    const requested = [];
    Object.entries(simState.held).forEach(([proc, res]) => res.forEach(r => held.push([proc, r])));
    Object.entries(simState.requested).forEach(([proc, res]) => res.forEach(r => requested.push([proc, r])));
    RAGraph.buildFromSimulator(allProcs, allRes, held, requested);

    Recovery.updateFromSim(allProcs, allRes, simState);
  }

  function findHolder(res) {
    for (const [proc, resources] of Object.entries(simState.held)) {
      if (resources.includes(res)) return proc;
    }
    return null;
  }

  function detectDeadlock() {
    // Detect circular wait: P→R→P→R...
    const blocked = {};
    Object.entries(simState.requested).forEach(([proc, resources]) => {
      resources.forEach(res => {
        const holder = findHolder(res);
        if (holder && holder !== proc) {
          blocked[proc] = holder;
        }
      });
    });

    // Find cycles in blocked graph
    const visited = new Set();
    const deadlocked = new Set();

    function traceCycle(start, current, path) {
      if (path.includes(current)) {
        const cycleStart = path.indexOf(current);
        path.slice(cycleStart).forEach(p => deadlocked.add(p));
        return true;
      }
      if (visited.has(current)) return false;
      visited.add(current);
      if (blocked[current]) {
        return traceCycle(start, blocked[current], [...path, current]);
      }
      return false;
    }

    Object.keys(blocked).forEach(p => {
      if (!visited.has(p)) traceCycle(p, p, []);
    });

    return [...deadlocked];
  }

  function drawSimGraph(deadlocked) {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    const W = canvas.width, H = canvas.height;

    // Background grid
    ctx.save();
    ctx.strokeStyle = 'rgba(0,229,255,0.04)';
    ctx.lineWidth = 1;
    for (let x = 0; x < W; x += 30) { ctx.beginPath(); ctx.moveTo(x,0); ctx.lineTo(x,H); ctx.stroke(); }
    for (let y = 0; y < H; y += 30) { ctx.beginPath(); ctx.moveTo(0,y); ctx.lineTo(W,y); ctx.stroke(); }
    ctx.restore();

    const procs = simState.processes;
    const ress  = simState.resources;
    const nodePos = {};

    // Position processes in left column
    procs.forEach((p, i) => {
      nodePos[p] = { x: W * 0.22, y: (H / (procs.length + 1)) * (i + 1) };
    });
    // Position resources in right column
    ress.forEach((r, i) => {
      nodePos[r] = { x: W * 0.75, y: (H / (ress.length + 1)) * (i + 1) };
    });

    // Draw edges
    // Held: R→P
    Object.entries(simState.held).forEach(([proc, resources]) => {
      resources.forEach(res => {
        if (nodePos[res] && nodePos[proc]) {
          drawSimEdge(nodePos[res], nodePos[proc], '#00e676', deadlocked.includes(proc));
        }
      });
    });
    // Requested: P→R
    Object.entries(simState.requested).forEach(([proc, resources]) => {
      resources.forEach(res => {
        if (nodePos[proc] && nodePos[res]) {
          drawSimEdge(nodePos[proc], nodePos[res], '#ffa726', deadlocked.includes(proc));
        }
      });
    });

    // Draw nodes
    procs.forEach(p => {
      if (!nodePos[p]) return;
      const isDeadlocked = deadlocked.includes(p);
      const color = isDeadlocked ? '#ff3b5c' : '#00e5ff';
      drawCircleNode(ctx, nodePos[p].x, nodePos[p].y, 18, p, color);
    });
    ress.forEach(r => {
      if (!nodePos[r]) return;
      drawSquareNode(ctx, nodePos[r].x, nodePos[r].y, 18, r, '#ffa726');
    });
  }

  function drawSimEdge(from, to, color, isDeadlock) {
    ctx.save();
    ctx.strokeStyle = isDeadlock ? '#ff3b5c' : color;
    ctx.lineWidth = isDeadlock ? 2.5 : 1.5;
    if (isDeadlock) { ctx.shadowColor = '#ff3b5c'; ctx.shadowBlur = 8; }
    const angle = Math.atan2(to.y - from.y, to.x - from.x);
    const r = 20;
    ctx.beginPath();
    ctx.moveTo(from.x + r*Math.cos(angle), from.y + r*Math.sin(angle));
    ctx.lineTo(to.x - r*Math.cos(angle), to.y - r*Math.sin(angle));
    ctx.stroke();
    // Arrowhead
    const ex = to.x - r*Math.cos(angle);
    const ey = to.y - r*Math.sin(angle);
    ctx.fillStyle = isDeadlock ? '#ff3b5c' : color;
    ctx.beginPath();
    ctx.moveTo(ex, ey);
    ctx.lineTo(ex - 10*Math.cos(angle-0.4), ey - 10*Math.sin(angle-0.4));
    ctx.lineTo(ex - 10*Math.cos(angle+0.4), ey - 10*Math.sin(angle+0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawCircleNode(ctx, x, y, r, label, color) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.arc(x, y, r, 0, Math.PI*2);
    ctx.fillStyle = 'rgba(0,10,20,0.7)';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '10px Share Tech Mono'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function drawSquareNode(ctx, x, y, r, label, color) {
    ctx.save();
    ctx.shadowColor = color; ctx.shadowBlur = 10;
    ctx.beginPath(); ctx.rect(x-r, y-r, r*2, r*2);
    ctx.fillStyle = 'rgba(0,10,20,0.7)';
    ctx.strokeStyle = color; ctx.lineWidth = 2;
    ctx.fill(); ctx.stroke();
    ctx.shadowBlur = 0;
    ctx.font = '10px Share Tech Mono'; ctx.fillStyle = color;
    ctx.textAlign = 'center'; ctx.textBaseline = 'middle';
    ctx.fillText(label, x, y);
    ctx.restore();
  }

  function drawEmpty() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    ctx.save();
    ctx.font = '12px Share Tech Mono';
    ctx.fillStyle = 'rgba(58,90,106,0.6)';
    ctx.textAlign = 'center';
    ctx.fillText('Run simulation to visualize', canvas.width/2, canvas.height/2);
    ctx.restore();
  }

  function addLogEntry(container, msg, type) {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  function loadPreset(name) {
    const preset = PRESETS[name];
    if (!preset) return;
    steps = [...preset.steps];
    renderSteps();

    // Update selects
    const procSel = document.getElementById('simProcess');
    const resSel  = document.getElementById('simResource');
    procSel.innerHTML = preset.processes.map(p => `<option value="${p}">${p}</option>`).join('');
    resSel.innerHTML  = preset.resources.map(r => `<option value="${r}">${r}</option>`).join('');

    simState.processes = preset.processes;
    simState.resources = preset.resources;

    addLogEntry(document.getElementById('simLog'), `Preset loaded: ${preset.name}`, 'info');
  }

  function resetSimState() {
    simState = { held: {}, requested: {}, processes: simState.processes, resources: simState.resources };
  }

  function clearSimulator() {
    steps = [];
    renderSteps();
    resetSimState();
    drawEmpty();
    document.getElementById('simLog').innerHTML = '<div class="log-entry info">Simulation reset.</div>';
    populateSelects();
  }

  return { init, removeStep, loadPreset, clearSimulator };
})();
