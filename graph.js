/**
 * graph.js — Resource Allocation Graph (RAG) Renderer
 * Deadlock Prevention & Recovery Toolkit
 */

const RAGraph = (() => {
  let canvas, ctx;
  let nodes = [];   // { id, type:'process'|'resource', x, y, label }
  let edges = [];   // { from, to, type:'request'|'assignment' }
  let hasCycle = false;
  let cycleEdges = new Set();
  let animFrame;

  const COLORS = {
    process:    '#00e5ff',
    resource:   '#ffa726',
    request:    '#ffa726',
    assignment: '#00e676',
    cycle:      '#ff3b5c',
    bg:         '#0a1017',
    grid:       'rgba(0,229,255,0.04)',
    text:       '#e8f4f8',
    dim:        '#3a5a6a',
  };

  function init() {
    canvas = document.getElementById('ragCanvas');
    ctx = canvas.getContext('2d');
    canvas.addEventListener('mousemove', onHover);
    document.getElementById('syncFromBanker').addEventListener('click', syncFromBanker);
    document.getElementById('detectCycle').addEventListener('click', runCycleDetection);
    resizeCanvas();
    window.addEventListener('resize', resizeCanvas);
    drawEmpty();
  }

  function resizeCanvas() {
    const container = canvas.parentElement;
    const maxW = Math.min(900, container.clientWidth - 200);
    canvas.width = maxW;
    canvas.height = 480;
    if (nodes.length) draw();
    else drawEmpty();
  }

  function drawEmpty() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();
    ctx.save();
    ctx.font = '14px Share Tech Mono';
    ctx.fillStyle = COLORS.dim;
    ctx.textAlign = 'center';
    ctx.fillText('Run Banker\'s Algorithm and click "Sync from Banker\'s"', canvas.width/2, canvas.height/2 - 10);
    ctx.fillText('to visualize the resource allocation graph.', canvas.width/2, canvas.height/2 + 18);
    ctx.restore();
  }

  function drawGrid() {
    ctx.save();
    ctx.strokeStyle = COLORS.grid;
    ctx.lineWidth = 1;
    const step = 40;
    for (let x = 0; x < canvas.width; x += step) {
      ctx.beginPath(); ctx.moveTo(x, 0); ctx.lineTo(x, canvas.height); ctx.stroke();
    }
    for (let y = 0; y < canvas.height; y += step) {
      ctx.beginPath(); ctx.moveTo(0, y); ctx.lineTo(canvas.width, y); ctx.stroke();
    }
    ctx.restore();
  }

  function syncFromBanker() {
    const bs = Banker.getState();
    if (!bs.allocation.length) {
      Banker.generateTables();
      Banker.readData();
    }

    const bankerState = Banker.getState();
    buildGraph(bankerState);
    hasCycle = false;
    cycleEdges.clear();
    draw();
    document.getElementById('graphInfo').textContent =
      `Graph synced: ${bankerState.processes} processes, ${bankerState.resources} resources. ` +
      (bankerState.isSafe ? 'System is in SAFE state.' : 'System may be in UNSAFE state — check for cycles.');
  }

  function buildGraph(bs) {
    nodes = [];
    edges = [];
    const n = bs.processes, m = bs.resources;
    const W = canvas.width, H = canvas.height;

    // Layout: processes on left, resources on right
    const pStartY = H / (n + 1);
    for (let p = 0; p < n; p++) {
      nodes.push({ id: `P${p}`, type: 'process', x: W * 0.2, y: pStartY * (p + 1), label: `P${p}` });
    }

    const rStartY = H / (m + 1);
    for (let r = 0; r < m; r++) {
      nodes.push({ id: `R${r}`, type: 'resource', x: W * 0.75, y: rStartY * (r + 1), label: `R${r}` });
    }

    // Assignment edges: resource → process (if allocation > 0)
    for (let p = 0; p < n; p++) {
      for (let r = 0; r < m; r++) {
        if (bs.allocation[p] && bs.allocation[p][r] > 0) {
          edges.push({ from: `R${r}`, to: `P${p}`, type: 'assignment', weight: bs.allocation[p][r] });
        }
      }
    }

    // Request edges: process → resource (if need > 0)
    for (let p = 0; p < n; p++) {
      for (let r = 0; r < m; r++) {
        if (bs.need && bs.need[p] && bs.need[p][r] > 0) {
          edges.push({ from: `P${p}`, to: `R${r}`, type: 'request', weight: bs.need[p][r] });
        }
      }
    }
  }

  function runCycleDetection() {
    if (!nodes.length) {
      document.getElementById('graphInfo').textContent = 'Please sync from Banker\'s Algorithm first.';
      return;
    }

    // Build adjacency for processes: P→R (request) and R→P (assignment)
    // Deadlock cycle: P0→R0→P1→R1→P0
    const adj = {};
    nodes.forEach(n => adj[n.id] = []);
    edges.forEach(e => adj[e.from].push(e.to));

    const visited = {}, recStack = {}, parent = {};
    cycleEdges.clear();
    let foundCycle = false;

    function dfs(v, path) {
      visited[v] = true;
      recStack[v] = true;
      path.push(v);
      for (const u of (adj[v] || [])) {
        if (!visited[u]) {
          parent[u] = v;
          if (dfs(u, path)) return true;
        } else if (recStack[u]) {
          // Found cycle — mark edges
          let idx = path.indexOf(u);
          for (let i = idx; i < path.length - 1; i++) {
            cycleEdges.add(`${path[i]}->${path[i+1]}`);
          }
          cycleEdges.add(`${path[path.length-1]}->${u}`);
          foundCycle = true;
          return true;
        }
      }
      path.pop();
      recStack[v] = false;
      return false;
    }

    nodes.forEach(n => {
      if (!visited[n.id]) dfs(n.id, []);
    });

    hasCycle = foundCycle;
    draw();

    const info = document.getElementById('graphInfo');
    if (hasCycle) {
      info.innerHTML = '<span style="color:var(--danger)">⚠ CYCLE DETECTED — Deadlock exists in the resource allocation graph!</span>';
    } else {
      info.innerHTML = '<span style="color:var(--success)">✓ No cycle detected — System is deadlock-free.</span>';
    }
  }

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);
    drawGrid();

    // Draw edges first
    edges.forEach(e => drawEdge(e));

    // Draw nodes on top
    nodes.forEach(n => drawNode(n));
  }

  function drawEdge(e) {
    const from = nodes.find(n => n.id === e.from);
    const to   = nodes.find(n => n.id === e.to);
    if (!from || !to) return;

    const key = `${e.from}->${e.to}`;
    const isCycleEdge = cycleEdges.has(key);
    const color = isCycleEdge ? COLORS.cycle : (e.type === 'request' ? COLORS.request : COLORS.assignment);

    ctx.save();
    ctx.strokeStyle = color;
    ctx.lineWidth = isCycleEdge ? 2.5 : 1.5;
    if (isCycleEdge) {
      ctx.shadowColor = COLORS.cycle;
      ctx.shadowBlur = 8;
    }

    // Slightly curved edges
    const mx = (from.x + to.x) / 2;
    const my = (from.y + to.y) / 2;
    const dx = to.y - from.y, dy = -(to.x - from.x);
    const len = Math.sqrt(dx*dx+dy*dy) || 1;
    const curve = 25;
    const cpx = mx + (dx/len) * curve;
    const cpy = my + (dy/len) * curve;

    ctx.beginPath();
    ctx.moveTo(from.x, from.y);
    ctx.quadraticCurveTo(cpx, cpy, to.x, to.y);
    ctx.stroke();

    // Arrowhead
    drawArrow(ctx, cpx, cpy, to.x, to.y, color);

    // Weight label
    if (e.weight > 1) {
      ctx.font = '11px Share Tech Mono';
      ctx.fillStyle = color;
      ctx.textAlign = 'center';
      ctx.fillText(e.weight, (cpx + to.x) / 2, (cpy + to.y) / 2 - 6);
    }

    ctx.restore();
  }

  function drawArrow(ctx, fromX, fromY, toX, toY, color) {
    const angle = Math.atan2(toY - fromY, toX - fromX);
    const size = 10;
    const r = 22; // offset from center
    const ax = toX - r * Math.cos(angle);
    const ay = toY - r * Math.sin(angle);

    ctx.save();
    ctx.fillStyle = color;
    ctx.beginPath();
    ctx.moveTo(ax, ay);
    ctx.lineTo(ax - size * Math.cos(angle - 0.4), ay - size * Math.sin(angle - 0.4));
    ctx.lineTo(ax - size * Math.cos(angle + 0.4), ay - size * Math.sin(angle + 0.4));
    ctx.closePath();
    ctx.fill();
    ctx.restore();
  }

  function drawNode(n) {
    const isProcess  = n.type === 'process';
    const color = isProcess ? COLORS.process : COLORS.resource;
    const r = 20;

    ctx.save();
    ctx.shadowColor = color;
    ctx.shadowBlur = 12;

    if (isProcess) {
      // Circle for process
      ctx.beginPath();
      ctx.arc(n.x, n.y, r, 0, Math.PI * 2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(0,229,255,0.08)';
      ctx.fill();
      ctx.stroke();
    } else {
      // Square for resource
      ctx.beginPath();
      ctx.rect(n.x - r, n.y - r, r*2, r*2);
      ctx.strokeStyle = color;
      ctx.lineWidth = 2;
      ctx.fillStyle = 'rgba(255,167,38,0.08)';
      ctx.fill();
      ctx.stroke();

      // Dots inside representing instances
      ctx.shadowBlur = 0;
      ctx.fillStyle = COLORS.resource;
      const ri = parseInt(n.id.replace('R',''));
      const dots = Math.min(4, ri + 1);
      for (let d = 0; d < dots; d++) {
        const dx = (d % 2) * 10 - 5;
        const dy = Math.floor(d / 2) * 10 - 5;
        ctx.beginPath();
        ctx.arc(n.x + dx, n.y + dy, 3, 0, Math.PI*2);
        ctx.fill();
      }
    }

    ctx.shadowBlur = 0;
    ctx.font = '12px Orbitron, monospace';
    ctx.fillStyle = color;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(n.label, n.x, n.y);

    ctx.restore();
  }

  let hoveredNode = null;
  function onHover(e) {
    const rect = canvas.getBoundingClientRect();
    const mx = e.clientX - rect.left;
    const my = e.clientY - rect.top;
    const found = nodes.find(n => Math.hypot(n.x - mx, n.y - my) < 25);
    if (found !== hoveredNode) {
      hoveredNode = found;
      draw();
      if (hoveredNode) {
        ctx.save();
        ctx.font = '11px Share Tech Mono';
        ctx.fillStyle = 'rgba(0,229,255,0.9)';
        ctx.fillRect(mx + 8, my - 14, 80, 20);
        ctx.fillStyle = '#060a0f';
        ctx.fillText(hoveredNode.label + ' (' + hoveredNode.type + ')', mx + 10, my);
        ctx.restore();
      }
    }
  }

  function buildFromSimulator(processes, resources, held, requested) {
    nodes = [];
    edges = [];
    const W = canvas.width, H = canvas.height;
    const n = processes.length, m = resources.length;

    const pStep = H / (n + 1);
    processes.forEach((p, i) => {
      nodes.push({ id: p, type: 'process', x: W * 0.22, y: pStep * (i + 1), label: p });
    });

    const rStep = H / (m + 1);
    resources.forEach((r, i) => {
      nodes.push({ id: r, type: 'resource', x: W * 0.75, y: rStep * (i + 1), label: r });
    });

    held.forEach(([proc, res]) => {
      edges.push({ from: res, to: proc, type: 'assignment', weight: 1 });
    });
    requested.forEach(([proc, res]) => {
      edges.push({ from: proc, to: res, type: 'request', weight: 1 });
    });

    hasCycle = false;
    cycleEdges.clear();
    draw();
  }

  return { init, syncFromBanker, runCycleDetection, buildFromSimulator, draw };
})();
