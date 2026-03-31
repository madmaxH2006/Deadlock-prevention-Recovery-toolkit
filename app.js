/**
 * app.js — Main Orchestrator
 * Deadlock Prevention & Recovery Toolkit
 */

document.addEventListener('DOMContentLoaded', () => {
  // Init all modules
  Banker.init();
  RAGraph.init();
  Simulator.init();
  Recovery.init();

  // Nav smooth scroll + active state
  document.querySelectorAll('.nav-link').forEach(link => {
    link.addEventListener('click', e => {
      e.preventDefault();
      const id = link.dataset.section;
      document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' });
      document.querySelectorAll('.nav-link').forEach(l => l.classList.remove('active'));
      link.classList.add('active');
    });
  });

  // Hero canvas particle network
  initHeroCanvas();
});

/* ─── Hero Canvas ─── */
function initHeroCanvas() {
  const canvas = document.getElementById('heroCanvas');
  if (!canvas) return;
  const ctx = canvas.getContext('2d');

  function resize() {
    canvas.width  = canvas.offsetWidth;
    canvas.height = canvas.offsetHeight;
  }
  resize();
  window.addEventListener('resize', resize);

  const PARTICLE_COUNT = 60;
  const particles = Array.from({ length: PARTICLE_COUNT }, () => ({
    x: Math.random() * canvas.width,
    y: Math.random() * canvas.height,
    vx: (Math.random() - 0.5) * 0.4,
    vy: (Math.random() - 0.5) * 0.4,
    r: Math.random() * 2 + 1,
    alpha: Math.random() * 0.5 + 0.2,
    type: Math.random() > 0.5 ? 'process' : 'resource'
  }));

  const CONNECTION_DIST = 120;

  function draw() {
    ctx.clearRect(0, 0, canvas.width, canvas.height);

    // Draw connections
    for (let i = 0; i < particles.length; i++) {
      for (let j = i + 1; j < particles.length; j++) {
        const dx = particles[i].x - particles[j].x;
        const dy = particles[i].y - particles[j].y;
        const dist = Math.sqrt(dx*dx + dy*dy);
        if (dist < CONNECTION_DIST) {
          const alpha = (1 - dist/CONNECTION_DIST) * 0.15;
          const color = particles[i].type === particles[j].type ? '0,229,255' : '255,167,38';
          ctx.beginPath();
          ctx.strokeStyle = `rgba(${color},${alpha})`;
          ctx.lineWidth = 0.8;
          ctx.moveTo(particles[i].x, particles[i].y);
          ctx.lineTo(particles[j].x, particles[j].y);
          ctx.stroke();
        }
      }
    }

    // Draw particles
    particles.forEach(p => {
      ctx.save();
      ctx.globalAlpha = p.alpha;
      if (p.type === 'process') {
        ctx.beginPath();
        ctx.arc(p.x, p.y, p.r, 0, Math.PI*2);
        ctx.fillStyle = '#00e5ff';
        ctx.shadowColor = '#00e5ff';
        ctx.shadowBlur = 4;
        ctx.fill();
      } else {
        const s = p.r * 1.6;
        ctx.fillStyle = '#ffa726';
        ctx.shadowColor = '#ffa726';
        ctx.shadowBlur = 4;
        ctx.fillRect(p.x - s/2, p.y - s/2, s, s);
      }
      ctx.restore();

      // Move
      p.x += p.vx;
      p.y += p.vy;
      if (p.x < 0 || p.x > canvas.width)  p.vx *= -1;
      if (p.y < 0 || p.y > canvas.height) p.vy *= -1;
    });

    requestAnimationFrame(draw);
  }

  draw();
}
