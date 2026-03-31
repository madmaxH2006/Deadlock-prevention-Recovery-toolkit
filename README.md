# Deadlock-prevention-Recovery-toolkit
a toolkit that detects, prevents, and recovers from deadlocks in real-time.
A real-time web toolkit for detecting, preventing, and recovering from deadlocks in operating systems. Implements Banker's Algorithm, Resource Allocation Graph (RAG) visualization, and interactive deadlock simulation.

---

## 🚀 Features

| Feature | Description |
|---|---|
| **Banker's Algorithm** | Full safety algorithm with configurable processes and resources |
| **Resource Allocation Graph** | Live visual graph with cycle detection |
| **Deadlock Simulator** | Build custom scenarios step-by-step or use presets |
| **Recovery Strategies** | Process termination, resource preemption, rollback, and auto-recovery |
| **Preset Scenarios** | Circular Wait, Dining Philosophers, Producer-Consumer, Two-Process |

---

## 📁 Project Structure

```
deadlock-toolkit/
├── index.html              # Main HTML (all 4 sections)
├── css/
│   └── style.css           # Full dark cyberpunk theme
└── js/
    ├── banker.js           # Banker's Algorithm logic
    ├── graph.js            # RAG canvas renderer + cycle detection
    ├── simulator.js        # Scenario builder + simulation engine
    ├── recovery.js         # Recovery strategy implementations
    └── app.js              # Orchestrator + hero canvas animation
```

---

## 🌐 Running Locally

**Option 1 — Open directly:**
```bash
open index.html
```
> Note: Some browsers block local file canvas rendering. Use a server if needed.

**Option 2 — Python local server:**
```bash
cd deadlock-toolkit
python3 -m http.server 8080
# Visit http://localhost:8080
```

**Option 3 — Node.js / npx:**
```bash
cd deadlock-toolkit
npx serve .
# Visit the URL shown in terminal
```

---

## 🎮 How to Use

### Banker's Algorithm
1. Set number of processes and resources
2. Click **Generate Tables**
3. Fill in **Allocation**, **Max Demand**, and **Available** matrices
4. Click **Run Banker's Algorithm**
5. View safe sequence or deadlock warning

> Use **Load Example** for the classic OS textbook example (5 processes, 3 resources).

### Resource Allocation Graph
1. After running Banker's, click **Sync from Banker's**
2. Processes (circles) and resources (squares) appear with allocation/request edges
3. Click **Detect Cycle** to check for deadlock cycles (highlighted in red)

### Simulator
1. **Custom**: Select process/action/resource and add steps, then run
2. **Presets**: Click any preset scenario button for instant demo
3. The RAG updates live after each simulation
4. Deadlocked processes are highlighted in red

### Recovery
- **Process Termination**: Select and terminate a deadlocked process
- **Resource Preemption**: Forcibly reassign a resource from one process
- **Rollback**: Restore a process to its last safe checkpoint
- **Auto Recovery**: Automatically finds and resolves the deadlock

---

## 🧠 Algorithms Implemented

### Banker's Safety Algorithm
```
Work = Available
Finish[i] = false for all i

Find i such that:
  Finish[i] == false AND Need[i] <= Work
  → Work += Allocation[i], Finish[i] = true

If all Finish[i] == true → SAFE STATE
Else → UNSAFE STATE (potential deadlock)
```

### Cycle Detection (RAG)
- DFS-based cycle detection on the directed resource allocation graph
- Process → Resource edges = request edges
- Resource → Process edges = assignment edges
- A cycle in RAG = **deadlock** (for single-instance resources)

### Recovery Heuristics
- **Minimum cost termination**: Terminate the process holding the fewest resources
- **Preemption**: Transfer resource ownership and mark process for rollback
- **Auto-recovery**: Combines cycle detection + minimum cost termination

---

## 🚀 Deploying to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy (from project root)
cd deadlock-toolkit
vercel

# Follow prompts — select static deployment
```

Or connect the GitHub repo directly at [vercel.com](https://vercel.com) for auto-deploys.

---

## 📚 References

- Silberschatz, Galvin & Gagne — *Operating System Concepts* (Banker's Algorithm, Ch. 8)
- Tanenbaum — *Modern Operating Systems* (Deadlock detection & recovery)
- Coffman et al. (1971) — *System deadlocks* (Four necessary conditions)

---

## 📄 License

MIT — free to use, modify, and distribute.
