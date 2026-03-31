/**
 * recovery.js — Deadlock Recovery Strategies
 * Deadlock Prevention & Recovery Toolkit
 */

const Recovery = (() => {
  let currentProcesses = [];
  let currentResources = [];
  let simState = null;
  let recoveryHistory = [];

  function init() {
    document.getElementById('btnTerminate').addEventListener('click', terminateProcess);
    document.getElementById('btnPreempt').addEventListener('click', preemptResource);
    document.getElementById('btnRollback').addEventListener('click', rollbackProcess);
    document.getElementById('btnAutoRecover').addEventListener('click', autoRecover);
    refreshSelects();
  }

  function updateFromSim(procs, ress, state) {
    currentProcesses = procs;
    currentResources = ress;
    simState = JSON.parse(JSON.stringify(state));
    refreshSelects();
  }

  function refreshSelects() {
    const bs = Banker.getState();
    const procs = currentProcesses.length
      ? currentProcesses
      : Array.from({length: bs.processes || 4}, (_, i) => `P${i}`);
    const ress = currentResources.length
      ? currentResources
      : Array.from({length: bs.resources || 3}, (_, i) => `R${i}`);

    setOptions('terminateProcess', procs);
    setOptions('rollbackProcess', procs);
    setOptions('preemptResource', ress);
    setOptions('preemptFrom', procs);
  }

  function setOptions(id, values) {
    const el = document.getElementById(id);
    if (!el) return;
    el.innerHTML = values.map(v => `<option value="${v}">${v}</option>`).join('');
  }

  function terminateProcess() {
    const proc = document.getElementById('terminateProcess').value;
    if (!proc) return;

    const log = document.getElementById('recoveryLog');
    addLog(log, `[TERMINATE] Aborting process ${proc}...`, 'warning');

    if (simState) {
      const heldBefore = simState.held[proc] ? [...simState.held[proc]] : [];
      const reqBefore  = simState.requested[proc] ? [...simState.requested[proc]] : [];
      simState.held[proc] = [];
      simState.requested[proc] = [];

      if (heldBefore.length) {
        addLog(log, `  Released resources: ${heldBefore.join(', ')}`, 'success');
        addLog(log, `  These resources are now available to other processes.`, 'success');
      } else {
        addLog(log, `  ${proc} held no resources.`, 'info');
      }
      if (reqBefore.length) {
        addLog(log, `  Cancelled pending requests: ${reqBefore.join(', ')}`, 'success');
      }

      // Remove from lists
      currentProcesses = currentProcesses.filter(p => p !== proc);
      simState.processes = currentProcesses;

      addLog(log, `  ✓ Process ${proc} terminated. Check if deadlock is resolved.`, 'success');
    } else {
      addLog(log, `  ✓ Process ${proc} would be terminated, releasing all held resources.`, 'success');
      addLog(log, `  Run a simulation first to see concrete resource release details.`, 'info');
    }

    refreshSelects();
    recoveryHistory.push({ action: 'terminate', target: proc, timestamp: new Date().toISOString() });
    document.getElementById('systemStatus').className = 'status-badge';
    document.querySelector('#systemStatus .status-text').textContent = 'RECOVERING';
  }

  function preemptResource() {
    const res  = document.getElementById('preemptResource').value;
    const from = document.getElementById('preemptFrom').value;
    if (!res || !from) return;

    const log = document.getElementById('recoveryLog');
    addLog(log, `[PREEMPT] Taking ${res} from ${from}...`, 'warning');

    if (simState && simState.held[from]) {
      const idx = simState.held[from].indexOf(res);
      if (idx >= 0) {
        simState.held[from].splice(idx, 1);
        addLog(log, `  ✓ Resource ${res} preempted from ${from}.`, 'success');
        addLog(log, `  ${from} must roll back to a state before it acquired ${res}.`, 'warning');
        addLog(log, `  ${res} is now available for reallocation.`, 'success');

        // Check if preempted resource resolves a waiting request
        Object.entries(simState.requested).forEach(([proc, resources]) => {
          if (resources.includes(res) && proc !== from) {
            addLog(log, `  → ${proc} was waiting for ${res} — can now proceed!`, 'success');
          }
        });
      } else {
        addLog(log, `  ${from} does not currently hold ${res}.`, 'info');
      }
    } else {
      addLog(log, `  ✓ ${res} preempted from ${from} (conceptual). Run a simulation for live state.`, 'info');
    }

    recoveryHistory.push({ action: 'preempt', resource: res, from, timestamp: new Date().toISOString() });
  }

  function rollbackProcess() {
    const proc = document.getElementById('rollbackProcess').value;
    if (!proc) return;

    const log = document.getElementById('recoveryLog');
    addLog(log, `[ROLLBACK] Rolling back process ${proc} to last checkpoint...`, 'warning');

    if (simState && simState.held[proc]) {
      const held = [...(simState.held[proc] || [])];
      simState.held[proc] = [];
      simState.requested[proc] = [];

      addLog(log, `  Checkpoint restored. ${proc} releases all acquired resources.`, 'success');
      if (held.length) {
        addLog(log, `  Released: ${held.join(', ')}`, 'success');
        addLog(log, `  ${proc} will restart execution from the checkpoint state.`, 'info');
      } else {
        addLog(log, `  ${proc} had no resources at rollback — resetting request queue.`, 'info');
      }
      addLog(log, `  ✓ Rollback complete for ${proc}.`, 'success');
    } else {
      addLog(log, `  ✓ ${proc} rolled back to last safe checkpoint (conceptual).`, 'info');
      addLog(log, `  In a real OS, this restores CPU registers, memory state, and resource allocations.`, 'info');
    }

    recoveryHistory.push({ action: 'rollback', target: proc, timestamp: new Date().toISOString() });
  }

  function autoRecover() {
    const log = document.getElementById('recoveryLog');
    addLog(log, `[AUTO RECOVER] Scanning system for deadlock...`, 'info');

    if (!simState) {
      addLog(log, `  No simulation state found. Run a simulation first.`, 'warning');
      addLog(log, `  Auto-recovery requires active deadlock state to resolve.`, 'info');
      return;
    }

    // Find deadlocked processes (holding a resource AND waiting for another held by a cycled process)
    const waitGraph = {};
    Object.entries(simState.requested).forEach(([proc, resources]) => {
      resources.forEach(res => {
        const holder = findHolder(res);
        if (holder && holder !== proc) {
          waitGraph[proc] = holder;
        }
      });
    });

    const deadlocked = findCycledProcesses(waitGraph);

    if (!deadlocked.length) {
      addLog(log, `  ✓ No active deadlock detected. System appears healthy.`, 'success');
      document.getElementById('systemStatus').className = 'status-badge';
      document.querySelector('#systemStatus .status-text').textContent = 'SYSTEM SAFE';
      document.querySelector('#systemStatus .pulse').style.background = 'var(--success)';
      return;
    }

    addLog(log, `  Deadlocked processes: ${deadlocked.join(', ')}`, 'error');
    addLog(log, `  Strategy: Terminate minimum-cost process to break cycle.`, 'info');

    // Pick the process with fewest resources (minimum cost heuristic)
    const victim = deadlocked.reduce((min, p) => {
      const minHeld = (simState.held[min] || []).length;
      const pHeld   = (simState.held[p]   || []).length;
      return pHeld < minHeld ? p : min;
    }, deadlocked[0]);

    addLog(log, `  Selected victim: ${victim} (lowest held resource count)`, 'warning');

    const released = [...(simState.held[victim] || [])];
    simState.held[victim] = [];
    simState.requested[victim] = [];
    currentProcesses = currentProcesses.filter(p => p !== victim);
    simState.processes = currentProcesses;

    if (released.length) {
      addLog(log, `  Released resources from ${victim}: ${released.join(', ')}`, 'success');
    }

    addLog(log, `  ✓ Auto-recovery complete. Process ${victim} was terminated.`, 'success');
    addLog(log, `  System should now be in a safe state.`, 'success');

    document.getElementById('systemStatus').className = 'status-badge';
    document.querySelector('#systemStatus .status-text').textContent = 'RECOVERED';
    document.querySelector('#systemStatus .pulse').style.background = 'var(--success)';

    refreshSelects();
    recoveryHistory.push({ action: 'auto', victim, released, timestamp: new Date().toISOString() });
  }

  function findHolder(res) {
    if (!simState) return null;
    for (const [proc, resources] of Object.entries(simState.held)) {
      if (resources.includes(res)) return proc;
    }
    return null;
  }

  function findCycledProcesses(waitGraph) {
    const visited = new Set();
    const deadlocked = new Set();
    function trace(start, current, path) {
      if (path.includes(current)) {
        path.slice(path.indexOf(current)).forEach(p => deadlocked.add(p));
        return;
      }
      if (visited.has(current)) return;
      visited.add(current);
      if (waitGraph[current]) trace(start, waitGraph[current], [...path, current]);
    }
    Object.keys(waitGraph).forEach(p => { if (!visited.has(p)) trace(p, p, []); });
    return [...deadlocked];
  }

  function addLog(container, msg, type) {
    const div = document.createElement('div');
    div.className = `log-entry ${type}`;
    div.textContent = msg;
    container.appendChild(div);
    container.scrollTop = container.scrollHeight;
  }

  return { init, updateFromSim, refreshSelects };
})();
