import './observability.js';

// Tiny mouse parallax on the hero stage. Lifted from the design handoff.
const stage = document.querySelector('.stage');
if (stage) {
  let raf = null;
  document.addEventListener(
    'mousemove',
    (e) => {
      if (raf) return;
      raf = requestAnimationFrame(() => {
        const rect = stage.getBoundingClientRect();
        const cx = rect.left + rect.width / 2;
        const cy = rect.top + rect.height / 2;
        const dx = (e.clientX - cx) / window.innerWidth;
        const dy = (e.clientY - cy) / window.innerHeight;
        stage.querySelectorAll('.glyph').forEach((g, i) => {
          const k = (i + 1) * 6;
          g.style.translate = `${dx * k}px ${dy * k}px`;
        });
        const card = stage.querySelector('.lesson-card');
        if (card) card.style.translate = `${dx * -10}px ${dy * -10}px`;
        raf = null;
      });
    },
    { passive: true }
  );
}
