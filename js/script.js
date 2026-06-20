/* ================================================================
   Náutica Azul — SVG Mask Scroll Transitions
   Baseado no código original: github.com/Hiro-kiii/Scroll-Transition
   Stack: GSAP 3 · ScrollTrigger · Lenis
   ================================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ── Lenis smooth scroll ──────────────────────────────────────── */
const isTouch = window.matchMedia('(pointer: coarse)').matches;
const lenis = new Lenis({
  lerp: 0.15,
  smoothWheel: true,
  smoothTouch: !isTouch,
});

lenis.on('scroll', ScrollTrigger.update);
gsap.ticker.add((time) => lenis.raf(time * 1000));
gsap.ticker.lagSmoothing(0);

/* ── Constantes ───────────────────────────────────────────────── */
const BLIND_COUNT = 30;
const SVG_NS = 'http://www.w3.org/2000/svg';

let blindsSets = [];
let master;

/* ── Cria os rects de blinds para um grupo SVG ───────────────── */
function createBlinds(groupId) {
  const g = document.getElementById(groupId);
  if (!g) return null;
  g.innerHTML = '';

  const width    = window.innerWidth;
  const height   = window.innerHeight;
  const vbHeight = (height / width) * 100;   // altura no sistema viewBox (largura = 100)
  const h        = vbHeight / BLIND_COUNT;    // altura de cada strip
  const blinds   = [];
  let currentY   = 0;

  for (let i = 0; i < BLIND_COUNT; i++) {
    // centerY conta de baixo para cima (espelha o eixo Y do SVG)
    const centerY = vbHeight - (currentY + h / 2);

    const rectTop    = document.createElementNS(SVG_NS, 'rect');
    const rectBottom = document.createElementNS(SVG_NS, 'rect');

    [rectTop, rectBottom].forEach((r) => {
      r.setAttribute('x', 0);
      r.setAttribute('width', 100);
      r.setAttribute('height', 0);
      r.setAttribute('fill', 'white');
      r.setAttribute('shape-rendering', 'crispEdges');
    });

    rectTop.setAttribute('y', centerY);
    rectBottom.setAttribute('y', centerY);

    g.appendChild(rectTop);
    g.appendChild(rectBottom);

    blinds.push({
      top:    rectTop,
      bottom: rectBottom,
      y:      centerY,
      h:      h / 2,
    });

    currentY += h;
  }

  return blinds;
}

/* ── Recalcula viewBox e rebuilda blinds para todos os layers ── */
function updateLayout() {
  const width    = window.innerWidth;
  const height   = window.innerHeight;
  const vbWidth  = 100;
  const vbHeight = (height / width) * 100;

  const layers = document.querySelectorAll('.layer');
  blindsSets = [];

  layers.forEach((svg) => {
    svg.setAttribute('viewBox', `0 0 ${vbWidth} ${vbHeight}`);

    const maskRect = svg.querySelector('mask rect');
    if (maskRect) {
      maskRect.setAttribute('width', vbWidth);
      maskRect.setAttribute('height', vbHeight);
    }

    const img = svg.querySelector('image');
    if (img) {
      img.setAttribute('width', vbWidth);
      img.setAttribute('height', vbHeight);
    }

    const gEl   = svg.querySelector('g[id^="blinds"]');
    const blinds = createBlinds(gEl.id);
    if (blinds) blindsSets.push(blinds);
  });

  buildMasterTimeline();
}

/* ── Animação: abre os blinds de uma layer ───────────────────── */
function openBlinds(blinds) {
  return gsap.timeline().to(
    blinds.flatMap((b) => [b.top, b.bottom]),
    {
      attr: {
        y: (i) => {
          const b = blinds[Math.floor(i / 2)];
          return i % 2 === 0 ? b.y - b.h : b.y;  // top sobe, bottom fica
        },
        height: (i) => {
          const b = blinds[Math.floor(i / 2)];
          return b.h + 0.01;   // +0.01 fecha brechas de subpixel
        },
      },
      ease: 'power3.out',
      stagger: { each: 0.02, from: 'start' },
    },
  );
}

/* ── Animações de texto ──────────────────────────────────────── */
function textIn(el) {
  const card = el.querySelector('.txt__card');
  const tl = gsap.timeline();
  tl.to(el, {
    clipPath: 'inset(0% 0% 0% 0%)',
    y: 0,
    duration: 1.5,
    ease: 'expo.out',
  }, 0);
  if (card) {
    tl.to(card, {
      x: 0,
      duration: 1.2,
      ease: 'expo.out',
    }, 0.15); // card entra levemente depois do clip, vindo da esquerda
  }
  return tl;
}

function textOut(el) {
  const card = el.querySelector('.txt__card');
  const tl = gsap.timeline();
  tl.to(el, {
    clipPath: 'inset(0% 0% 100% 0%)',
    y: -30,
    duration: 1.2,
    ease: 'power2.inOut',
  }, 0);
  if (card) {
    tl.to(card, {
      x: -60,
      duration: 0.9,
      ease: 'power2.in',
    }, 0);
  }
  return tl;
}

/* ── Master timeline (scrubbed ao scroll) ────────────────────── */
function buildMasterTimeline() {
  if (master) master.kill();
  ScrollTrigger.getAll()
    .filter((st) => st.vars.id !== 'progress')
    .forEach((st) => st.kill());

  const texts = gsap.utils.toArray('.txt');

  master = gsap.timeline({
    scrollTrigger: {
      trigger:           '.stage',
      start:             'top top',
      end:               'bottom bottom',
      scrub:             2.5,
      anticipatePin:     1,
      invalidateOnRefresh: true,
    },
  });

  // Para cada layer: abre blinds → texto entra → texto sai
  blindsSets.forEach((blinds, i) => {
    master.add(openBlinds(blinds));
    if (texts[i]) {
      master.add(textIn(texts[i]),  '-=0.3');
      master.add(textOut(texts[i]), '+=0.8');
    }
  });
}

/* ── Barra de progresso (ScrollTrigger separado) ─────────────── */
function initProgressBar() {
  const fills = gsap.utils.toArray('.progress-bar .fill');

  ScrollTrigger.create({
    id:      'progress',
    trigger: '.stage',
    start:   'top top',
    end:     'bottom bottom',
    scrub:   0.3,
    onUpdate: (self) => {
      const p     = self.progress;
      const total = fills.length;
      fills.forEach((fill, i) => {
        let seg = (p - i / total) * total;
        seg = Math.max(0, Math.min(1, seg));
        fill.style.width = `${seg * 100}%`;
      });
    },
  });
}

/* ── Inicialização ───────────────────────────────────────────── */
updateLayout();
initProgressBar();

let resizeTimer;
window.addEventListener('resize', () => {
  clearTimeout(resizeTimer);
  resizeTimer = setTimeout(updateLayout, 250);
});
