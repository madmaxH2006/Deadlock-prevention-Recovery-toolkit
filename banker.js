/**
 * banker.js — Banker's Algorithm Implementation
 * Deadlock Prevention & Recovery Toolkit
 */

const Banker = (() => {
  let state = {
    processes: 4,
    resources: 3,
    allocation: [],
    max: [],
    available: [],
    need: [],
    safeSequence: null,
    isSafe: false,
  };

  /* ── Generate dynamic tables ── */
  function generateTables() {
    state.processes = parseInt(document.getElementById('numProcesses').value) || 4;
    state.resources  = parseInt(document.getElementById('numResources').value) || 3;

    const container = document.getElementById('bankerTables');
    container.innerHTML = '';

    const resCols = Array.from({length: state.resources}, (_, i) => `R${i}`);

    // Available
    container.appendChild(createTable('available', 'Available Resources', ['Resource', 'Available'], 
      resCols.map((r, i) => ({ label: r, id: `avail_${i}` })), 1
    ));

    // Allocation
    container.appendChild(createProcessTable('allocation', 'Allocation Matrix', resCols));

    // Max Demand
    container.appendChild(createProcessTable('max', 'Max Demand Matrix', resCols));

    updateStats();
    addInputListeners();
  }

  function createTable(type, label, headers, cols, rows) {
    const block = document.createElement('div');
    block.className = 'table-block';
    block.innerHTML = `<div class="table-label">${label}</div>`;

    const table = document.createElement('table');
    table.className = 'data-table';

    // Header
    const thead = document.createElement('thead');
    const hrow = document.createElement('tr');
    headers.forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    // Body
    const tbody = document.createElement('tbody');
    const tr = document.createElement('tr');
    cols.forEach(col => {
      const td = document.createElement('td');
      td.innerHTML = `<span class="proc-label">${col.label}</span>`;
      tr.appendChild(td);
    });
    tbody.appendChild(tr);

    const tr2 = document.createElement('tr');
    cols.forEach(col => {
      const td = document.createElement('td');
      td.innerHTML = `<input type="number" id="${col.id}" min="0" max="99" value="0" />`;
      tr2.appendChild(td);
    });
    tbody.appendChild(tr2);

    table.appendChild(tbody);
    block.appendChild(table);
    return block;
  }

  function createProcessTable(type, label, resCols) {
    const block = document.createElement('div');
    block.className = 'table-block';
    block.innerHTML = `<div class="table-label">${label}</div>`;

    const table = document.createElement('table');
    table.className = 'data-table';

    const thead = document.createElement('thead');
    const hrow = document.createElement('tr');
    ['Process', ...resCols].forEach(h => {
      const th = document.createElement('th');
      th.textContent = h;
      hrow.appendChild(th);
    });
    thead.appendChild(hrow);
    table.appendChild(thead);

    const tbody = document.createElement('tbody');
    for (let p = 0; p < state.processes; p++) {
      const tr = document.createElement('tr');
      const tdLabel = document.createElement('td');
      tdLabel.innerHTML = `<span class="proc-label">P${p}</span>`;
      tr.appendChild(tdLabel);

      for (let r = 0; r < state.resources; r++) {
        const td = document.createElement('td');
        td.innerHTML = `<input type="number" id="${type}_${p}_${r}" min="0" max="99" value="0" />`;
        tr.appendChild(td);
      }
      tbody.appendChild(tr);
    }
    table.appendChild(tbody);
    block.appendChild(table);
    return block;
  }

  function addInputListeners() {
    document.querySelectorAll('.data-table input').forEach(input => {
      input.addEventListener('input', updateStats);
    });
  }

  function updateStats() {
    document.getElementById('statProcesses').textContent = state.processes;
    document.getElementById('statResources').textContent = state.resources;
  }

  /* ── Read data from inputs ── */
  function readData() {
    const n = state.processes, m = state.resources;
    state.available = Array.from({length: m}, (_, i) => parseInt(document.getElementById(`avail_${i}`)?.value) || 0);
    state.allocation = Array.from({length: n}, (_, p) =>
      Array.from({length: m}, (_, r) => parseInt(document.getElementById(`allocation_${p}_${r}`)?.value) || 0)
    );
    state.max = Array.from({length: n}, (_, p) =>
      Array.from({length: m}, (_, r) => parseInt(document.getElementById(`max_${p}_${r}`)?.value) || 0)
    );
    state.need = Array.from({length: n}, (_, p) =>
      Array.from({length: m}, (_, r) => Math.max(0, state.max[p][r] - state.allocation[p][r]))
    );
  }

  /* ── Banker's Safety Algorithm ── */
  function runSafetyAlgorithm() {
    readData();
    const n = state.processes, m = state.resources;
    const work = [...state.available];
    const finish = Array(n).fill(false);
    const sequence = [];
    const log = [];

    log.push(`Initial Available: [${work.join(', ')}]`);
    log.push(`─`.repeat(40));

    let progress = true;
    while (progress) {
      progress = false;
      for (let p = 0; p < n; p++) {
        if (finish[p]) continue;
        const canAllocate = state.need[p].every((need, r) => need <= work[r]);
        if (canAllocate) {
          log.push(`P${p}: Need [${state.need[p].join(',')}] ≤ Work [${work.join(',')}] → ✓ EXECUTE`);
          for (let r = 0; r < m; r++) work[r] += state.allocation[p][r];
          log.push(`  Release → Work becomes [${work.join(', ')}]`);
          finish[p] = true;
          sequence.push(p);
          progress = true;
        }
      }
    }

    state.isSafe = finish.every(Boolean);
    state.safeSequence = state.isSafe ? sequence : null;
    log.push(`─`.repeat(40));
    log.push(state.isSafe
      ? `✓ SAFE STATE — Sequence: ${sequence.map(p => 'P' + p).join(' → ')}`
      : `✗ UNSAFE STATE — Deadlock may occur!`
    );

    displayResult(state.isSafe, sequence, log);
    updateStatBadge();
    return { isSafe: state.isSafe, sequence, need: state.need, allocation: state.allocation, available: state.available };
  }

  function displayResult(isSafe, sequence, log) {
    const resultEl = document.getElementById('bankerResult');
    const icon = document.getElementById('resultIcon');
    const title = document.getElementById('resultTitle');
    const seqEl = document.getElementById('safeSequenceDisplay');
    const logEl = document.getElementById('resultLog');

    resultEl.style.display = 'block';
    resultEl.className = 'result-panel ' + (isSafe ? 'safe' : 'unsafe');
    icon.textContent = isSafe ? '✓' : '✗';
    title.textContent = isSafe ? 'SAFE STATE — No Deadlock' : 'UNSAFE STATE — Deadlock Risk!';

    if (isSafe) {
      seqEl.innerHTML = sequence.map((p, i) => {
        const arrow = i < sequence.length - 1 ? '<span class="seq-arrow">→</span>' : '';
        return `<span class="seq-process">P${p}</span>${arrow}`;
      }).join('');
      document.getElementById('statSafeSeq').textContent = sequence.map(p => `P${p}`).join('→');
    } else {
      seqEl.innerHTML = '<span style="color:var(--danger);font-family:var(--font-mono);font-size:0.85rem">No safe sequence exists. Deadlock may occur.</span>';
      document.getElementById('statSafeSeq').textContent = '—';
    }

    logEl.innerHTML = log.map(l => `<div>${escapeHtml(l)}</div>`).join('');
    logEl.scrollTop = logEl.scrollHeight;
    resultEl.scrollIntoView({ behavior: 'smooth', block: 'nearest' });
  }

  function updateStatBadge() {
    const badge = document.getElementById('systemStatus');
    const pulse = badge.querySelector('.pulse');
    const text  = badge.querySelector('.status-text');
    if (state.isSafe) {
      badge.className = 'status-badge';
      text.textContent = 'SYSTEM SAFE';
    } else {
      badge.className = 'status-badge danger';
      text.textContent = 'DEADLOCK RISK';
    }
  }

  /* ── Load Example ── */
  function loadExample() {
    document.getElementById('numProcesses').value = 5;
    document.getElementById('numResources').value = 3;
    generateTables();

    // Classic textbook example
    const alloc = [[0,1,0],[2,0,0],[3,0,2],[2,1,1],[0,0,2]];
    const maxD  = [[7,5,3],[3,2,2],[9,0,2],[2,2,2],[4,3,3]];
    const avail = [3,3,2];

    for (let p = 0; p < 5; p++)
      for (let r = 0; r < 3; r++) {
        const ae = document.getElementById(`allocation_${p}_${r}`);
        const me = document.getElementById(`max_${p}_${r}`);
        if (ae) ae.value = alloc[p][r];
        if (me) me.value = maxD[p][r];
      }
    for (let r = 0; r < 3; r++) {
      const ae = document.getElementById(`avail_${r}`);
      if (ae) ae.value = avail[r];
    }
  }

  function clearBanker() {
    document.querySelectorAll('.data-table input').forEach(i => i.value = 0);
    document.getElementById('bankerResult').style.display = 'none';
    document.getElementById('statSafeSeq').textContent = '—';
    state.isSafe = false;
    state.safeSequence = null;
    updateStatBadge();
  }

  function getState() { return state; }

  function escapeHtml(str) {
    return String(str).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
  }

  /* ── Init ── */
  function init() {
    generateTables();
    document.getElementById('generateTables').addEventListener('click', generateTables);
    document.getElementById('runBanker').addEventListener('click', runSafetyAlgorithm);
    document.getElementById('loadExample').addEventListener('click', loadExample);
    document.getElementById('clearBanker').addEventListener('click', clearBanker);
  }

  return { init, runSafetyAlgorithm, loadExample, getState, generateTables, readData };
})();
