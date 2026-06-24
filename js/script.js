/* ================================================================
   Náutica Azul — SVG Mask Scroll Transitions
   Baseado no código original: github.com/Hiro-kiii/Scroll-Transition
   Stack: GSAP 3 · ScrollTrigger · Lenis
   ================================================================ */

gsap.registerPlugin(ScrollTrigger);

/* ── Lenis smooth scroll ──────────────────────────────────────── */
const isTouch = !window.matchMedia('(hover: hover) and (pointer: fine)').matches;
const lenis = new Lenis({
  lerp: 0.15,
  smoothWheel: true,
  smoothTouch: !isTouch,
});

const _navFrame = document.querySelector('.frame');

/* ScrollTrigger sync — deve estar dentro do evento Lenis para o scrub funcionar */
lenis.on('scroll', ScrollTrigger.update);

/* Nav hide via Lenis (desktop smooth scroll) */
lenis.on('scroll', ({ scroll, direction }) => {
  if (!_navFrame) return;
  if (scroll < 80) {
    _navFrame.classList.remove('nav--hidden');
  } else if (direction > 0) {
    _navFrame.classList.add('nav--hidden');
  } else {
    _navFrame.classList.remove('nav--hidden');
  }
});

/* Nav hide via native scroll (mobile touch) */
if (isTouch) {
  let _lastY = 0;
  window.addEventListener('scroll', () => {
    const y = window.scrollY;
    if (!_navFrame) return;
    if (y < 80) {
      _navFrame.classList.remove('nav--hidden');
    } else if (y > _lastY) {
      _navFrame.classList.add('nav--hidden');
    } else {
      _navFrame.classList.remove('nav--hidden');
    }
    _lastY = y;
  }, { passive: true });
}

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

/* ── Recalcula viewBox e rebuilda blinds (compartilhado desktop/mobile) ── */
function setupLayout() {
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

    const gEl    = svg.querySelector('g[id^="blinds"]');
    const blinds = createBlinds(gEl.id);
    if (blinds) blindsSets.push(blinds);
  });
}

function updateLayout() {
  setupLayout();
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
      end:               () => `+=${window.innerHeight * (isTouch ? 2.5 : 5)}`,
      pin:               true,
      scrub:             isTouch ? 0.5 : 2.5,
      anticipatePin:     1,
      invalidateOnRefresh: true,
    },
  });

  // Buffer inicial: vídeo fica visível ~1 viewport de scroll antes das imagens
  master.to({}, { duration: 3 });

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
    end:     () => `+=${window.innerHeight * (isTouch ? 2.5 : 5)}`,
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

/* ── Mobile Menu ─────────────────────────────────────────────── */
const hamburger   = document.querySelector('.hamburger');
const mobileMenu  = document.querySelector('.mobile-menu');
const menuClose   = document.querySelector('.mobile-menu__close');
const menuLinks   = document.querySelectorAll('.mobile-menu__nav a');

function openMenu() {
  mobileMenu.classList.add('is-open');
  mobileMenu.setAttribute('aria-hidden', 'false');
  hamburger.setAttribute('aria-expanded', 'true');
  hamburger.style.display = 'none';
  document.body.style.overflow = 'hidden';
}

function closeMenu() {
  mobileMenu.classList.remove('is-open');
  mobileMenu.setAttribute('aria-hidden', 'true');
  hamburger.setAttribute('aria-expanded', 'false');
  hamburger.style.display = 'flex';
  document.body.style.overflow = '';
}

hamburger.addEventListener('click', openMenu);
menuClose.addEventListener('click', closeMenu);
menuLinks.forEach((link) => link.addEventListener('click', closeMenu));

/* ── Nav Dropdown ────────────────────────────────────────────── */
const dropdownToggle = document.querySelector('.nav-dropdown__toggle');
const dropdownMenu   = document.querySelector('.nav-dropdown__menu');

dropdownToggle.addEventListener('click', (e) => {
  e.stopPropagation();
  const isOpen = dropdownMenu.classList.toggle('is-open');
  dropdownToggle.setAttribute('aria-expanded', isOpen);
});

document.addEventListener('click', () => {
  dropdownMenu.classList.remove('is-open');
  dropdownToggle.setAttribute('aria-expanded', false);
});

/* ── Seminovos — Dataset + Filtros ──────────── */
const YACHTS = [
  { ref: 1355, model: 'Atlantis 51',             brand: 'ATLANTIS',        year: 2023, feet: 51,  engines: '2x Volvo D8',      hp: 800,  img: 'https://yachtcollection.com.br/img/seminovos/destaque-seminovos_V2.jpeg',          href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1355-atlantis-51-51-diesel' },
  { ref: 696,  model: 'ISY 106 Aventura',        brand: 'ISY',             year: 2007, feet: 106, engines: '2x Volvo',          hp: 0,    img: 'https://easyacht.iyc.com.br/uploads/usados/696/medio_grandeimg33550_550.jpg',         href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=696-isy-106-106-diesel' },
  { ref: 1097, model: 'ISY 106 Aventura',        brand: 'ISY',             year: 2025, feet: 106, engines: '2x MAN',            hp: 800,  img: 'https://easyacht.iyc.com.br/uploads/usados/1097/medio_31_634.jpg',                  href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1097-isy-106-aventura-106-diesel' },
  { ref: 1338, model: 'Azimut 83',               brand: 'AZIMUT',          year: 2019, feet: 83,  engines: '2x MAN',            hp: 1800, img: 'https://easyacht.iyc.com.br/uploads/usados/1338/medio_azimut83_538.jpg',             href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1338-azimut-83-83-diesel' },
  { ref: 1347, model: 'Intermarine 80',          brand: 'INTERMARINE',     year: 2017, feet: 80,  engines: '2x MAN',            hp: 1550, img: 'https://easyacht.iyc.com.br/uploads/usados/1347/medio_1_962.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1347-intermarine-80-80-diesel' },
  { ref: 1356, model: 'Schaefer Yachts 77',      brand: 'SCHAEFER YACHTS', year: 2019, feet: 77,  engines: '3x Volvo Penta',    hp: 725,  img: 'https://easyacht.iyc.com.br/uploads/usados/1356/medio_1_782.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1356-schaefer-yachts-77-77-diesel' },
  { ref: 1343, model: 'Azimut 74',               brand: 'AZIMUT',          year: 2020, feet: 74,  engines: '2x MAN',            hp: 1400, img: 'https://easyacht.iyc.com.br/uploads/usados/1343/medio_1_754.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1343-azimut-74-74-diesel' },
  { ref: 1315, model: 'Segue 72',                brand: 'SEGUE',           year: 2012, feet: 72,  engines: '2x MTU',            hp: 1500, img: 'https://easyacht.iyc.com.br/uploads/usados/1315/medio_segue722012_583.jpg',          href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1315-segue-72-72-diesel' },
  { ref: 339,  model: 'Azimut 72 S',             brand: 'AZIMUT',          year: 2012, feet: 72,  engines: '2x MAN',            hp: 1800, img: 'https://easyacht.iyc.com.br/uploads/usados/339/medio_designsemnome_648.jpg',         href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=339-azimut-72-s-72-diesel' },
  { ref: 1298, model: 'Ferretti 70',             brand: 'FERRETTI',        year: 2010, feet: 70,  engines: '2x MAN',            hp: 1224, img: 'https://easyacht.iyc.com.br/uploads/usados/1298/medio_imagenssiteseminovos_878.jpg',  href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1298-ferretti-70-70-diesel' },
  { ref: 1098, model: 'Azimut 70',               brand: 'AZIMUT',          year: 2017, feet: 70,  engines: '2x MAN',            hp: 1400, img: 'https://easyacht.iyc.com.br/uploads/usados/1098/medio_designsemnome_196.jpg',        href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1098-azimut-70-70-diesel' },
  { ref: 1255, model: 'Azimut 70',               brand: 'AZIMUT',          year: 2017, feet: 70,  engines: '2x MAN',            hp: 1400, img: 'https://easyacht.iyc.com.br/uploads/usados/1255/medio_imagemseminos_500.jpg',        href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1255-azimut-70-70-diesel' },
  { ref: 1306, model: 'Intermarine 680 Full',    brand: 'INTERMARINE',     year: 2008, feet: 68,  engines: '2x MTU',            hp: 1200, img: 'https://easyacht.iyc.com.br/uploads/usados/1306/medio_intermarine6802008_288.jpg',   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1306-intermarine-680-full-68-diesel' },
  { ref: 1294, model: 'Global 68',               brand: 'GLOBAL',          year: 2020, feet: 68,  engines: 'Volvo Penta',       hp: 260,  img: 'https://easyacht.iyc.com.br/uploads/usados/1294/medio_global682020_309.jpg',         href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1294-global-68-68-diesel' },
  { ref: 1275, model: 'Azimut 62',               brand: 'AZIMUT',          year: 2022, feet: 62,  engines: '2x Volvo Penta',    hp: 900,  img: 'https://easyacht.iyc.com.br/uploads/usados/1275/medio_designsemnome_410.jpg',        href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1275-azimut-62-62-diesel' },
  { ref: 1336, model: 'Real 60 Luxury',          brand: 'REAL',            year: 2019, feet: 60,  engines: '2x Cummins',        hp: 600,  img: 'https://easyacht.iyc.com.br/uploads/usados/1336/medio_1_480.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1336-real-60-luxury-60-diesel' },
  { ref: 1307, model: 'Intermarine 60',          brand: 'INTERMARINE',     year: 2020, feet: 60,  engines: '2x Volvo Penta',    hp: 900,  img: 'https://easyacht.iyc.com.br/uploads/usados/1307/medio_intermarine602020_711.jpg',   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1307-intermarine-60-60-diesel' },
  { ref: 1361, model: 'Intermarine 60',          brand: 'INTERMARINE',     year: 2012, feet: 60,  engines: '2x Volvo Penta',    hp: 900,  img: 'https://easyacht.iyc.com.br/uploads/usados/1361/medio_1_939.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1361-intermarine-60-60-diesel' },
  { ref: 1286, model: 'Azimut 56',               brand: 'AZIMUT',          year: 2018, feet: 56,  engines: '2x Volvo',          hp: 725,  img: 'https://easyacht.iyc.com.br/uploads/usados/1286/medio_azimut56_742.jpg',            href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1286-azimut-56-56-diesel' },
  { ref: 1297, model: 'Power Cat AG 54',         brand: 'AG CATAMARAN',    year: 2025, feet: 54,  engines: '2x Yanmar',         hp: 315,  img: 'https://easyacht.iyc.com.br/uploads/usados/1297/medio_agpowercat54_593.jpg',        href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1297-power-cat-ag-54-54-diesel' },
  { ref: 813,  model: 'Intermarine 520 Full',    brand: 'INTERMARINE',     year: 2007, feet: 52,  engines: '2x Volvo Penta',    hp: 675,  img: 'https://easyacht.iyc.com.br/uploads/usados/813/medio_1_805.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=813-intermarine-520-full-52-diesel' },
  { ref: 1270, model: 'Azimut 50',               brand: 'AZIMUT',          year: 2015, feet: 50,  engines: '2x Cummins',        hp: 600,  img: 'https://easyacht.iyc.com.br/uploads/usados/1270/medio_designsemnome_72.jpg',        href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1270-azimut-50-50-diesel' },
  { ref: 1316, model: 'Intermarine 480 Full',    brand: 'INTERMARINE',     year: 2009, feet: 48,  engines: '2x Volvo Penta',    hp: 600,  img: 'https://easyacht.iyc.com.br/uploads/usados/1316/medio_intermarine480full2009_578.jpg', href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1316-intermarine-480-full-48-diesel' },
  { ref: 1280, model: 'Intermarine 46 OffShore', brand: 'INTERMARINE',     year: 2003, feet: 46,  engines: '2x Mercedes Benz',  hp: 720,  img: 'https://easyacht.iyc.com.br/uploads/usados/1280/medio_imagenssiteseminovos_91.jpg',  href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1280-intermarine-46-offshore-46-diesel' },
  { ref: 1207, model: 'Genesis 44',              brand: 'GENESIS',         year: 2012, feet: 44,  engines: '2x Volvo Penta',    hp: 435,  img: 'https://easyacht.iyc.com.br/uploads/usados/1207/medio_1_698.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1207-genesis-44-44-diesel' },
  { ref: 1332, model: 'Real 42',                 brand: 'REAL',            year: 2016, feet: 42,  engines: '2x Mercury',        hp: 370,  img: 'https://easyacht.iyc.com.br/uploads/usados/1332/medio_real422016id1332_805.jpg',    href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1332-real-42-42-diesel' },
  { ref: 1319, model: 'CarbrasMar 41',           brand: 'CARBRASMAR',      year: 1987, feet: 41,  engines: '2x Caterpillar',    hp: 460,  img: 'https://easyacht.iyc.com.br/uploads/usados/1319/medio_carbrasmar41id1319_465.jpg',  href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1319-carbrasmar-41-41-diesel' },
  { ref: 1349, model: 'Magnum 39',               brand: 'MAGNUM',          year: 2008, feet: 39,  engines: '2x Volvo D3',       hp: 220,  img: 'https://easyacht.iyc.com.br/uploads/usados/1349/medio_1_39.jpg',                   href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1349-magnum-39-39-diesel' },
  { ref: 1263, model: 'Intermarine Scarab 38',   brand: 'INTERMARINE',     year: 1992, feet: 38,  engines: '2x Volvo Penta',    hp: 250,  img: 'https://easyacht.iyc.com.br/uploads/usados/1263/medio_01_956.jpg',                 href: 'https://yachtcollection.com.br/barcos_exibir.php?ns=1263-intermarine-scarab-38-38-diesel' },
];

function renderSeminovos(boats) {
  const container = document.getElementById('seminovos-results');
  if (!container) return;

  if (boats.length === 0) {
    container.innerHTML = '<div class="seminovos-empty">Nenhuma embarcação encontrada para os filtros selecionados.</div>';
    return;
  }

  const countLabel = `<p class="seminovos-count">${boats.length} embarcaç${boats.length === 1 ? 'ão encontrada' : 'ões encontradas'}</p>`;

  const cards = boats.map((y) => `
    <article class="yacht-card">
      <a href="yacht?ref=${y.ref}" class="yacht-card__img-wrap">
        <img class="yacht-card__img" src="${y.img}" alt="${y.model}" loading="lazy"
             onerror="this.style.display='none'">
      </a>
      <div class="yacht-card__body">
        <p class="yacht-card__brand">${y.brand}</p>
        <h3 class="yacht-card__title">${y.model}</h3>
        <div class="yacht-card__meta">
          <span>${y.year}</span>
          <span>${y.feet} pés</span>
        </div>
        <p class="yacht-card__engines">${y.engines}${y.hp > 0 ? ' · ' + y.hp + ' HP' : ''}</p>
        <p class="yacht-card__ref">REF ${y.ref}</p>
        <a href="yacht?ref=${y.ref}" class="yacht-card__cta">Mais Detalhes</a>
      </div>
    </article>
  `).join('');

  container.innerHTML = countLabel + `<div class="yacht-grid">${cards}</div>`;
}

function filterSeminovos() {
  const brand   = document.getElementById('filter-brand').value.toUpperCase();
  const feet    = parseInt(document.getElementById('filter-feet').value) || 0;
  const text    = document.getElementById('filter-text').value.trim().toLowerCase();
  const refVal  = document.getElementById('filter-ref').value.trim();

  const results = YACHTS.filter((y) => {
    if (brand && y.brand.toUpperCase() !== brand) return false;
    if (feet  && y.feet < feet) return false;
    if (text  && !( y.model.toLowerCase().includes(text) ||
                    String(y.year).includes(text)        ||
                    y.engines.toLowerCase().includes(text) )) return false;
    if (refVal && String(y.ref) !== refVal) return false;
    return true;
  });

  renderSeminovos(results);
}

/* wire up */
const filterBtn = document.getElementById('filter-btn');
if (filterBtn) {
  filterBtn.addEventListener('click', filterSeminovos);
  ['filter-text', 'filter-ref'].forEach((id) => {
    const el = document.getElementById(id);
    if (el) el.addEventListener('keydown', (e) => { if (e.key === 'Enter') filterSeminovos(); });
  });
}

/* render all yachts on load, then apply URL params if coming from yacht detail */
renderSeminovos(YACHTS);

(function applyUrlParams() {
  const params = new URLSearchParams(window.location.search);
  if (!params.has('brand') && !params.has('feetMin') && !params.has('yearMin')) return;
  const brand = params.get('brand') || '';
  const feetMin = params.get('feetMin') || '';
  if (brand) { const el = document.getElementById('filter-brand'); if (el) el.value = brand; }
  if (feetMin) { const el = document.getElementById('filter-feet'); if (el) el.value = feetMin; }
  filterSeminovos();
  /* remove params from address bar without reloading */
  history.replaceState(null, '', window.location.pathname + window.location.hash);
})();

/* ── Scroll entrance animations ────────────────────────────── */
;(function () {
  /* On touch devices: ScrollTrigger + native scroll don't sync reliably enough
     to guarantee opacity:0 elements get revealed. Skip all entrance animations
     so content is always visible on mobile. */
  if (isTouch) return;

  /* Animates each matching element independently as it enters viewport */
  function rv(sel, fromVars, dur, triggerSel) {
    gsap.utils.toArray(sel).forEach((el) => {
      gsap.from(el, {
        ...fromVars,
        duration: dur || 0.85,
        ease: 'power3.out',
        scrollTrigger: {
          trigger: triggerSel ? (el.closest(triggerSel) || el) : el,
          start: 'top 88%',
          once: true,
        },
      });
    });
  }

  /* Staggers a group of elements that enter the viewport together */
  function rb(sel, fromVars, stagger, dur) {
    ScrollTrigger.batch(sel, {
      onEnter: (batch) =>
        gsap.from(batch, {
          ...fromVars,
          duration: dur || 0.8,
          ease: 'power3.out',
          stagger: stagger || 0.1,
        }),
      start: 'top 88%',
      once: true,
    });
  }

  /* ── A Empresa ─────────────────────────────────────────────── */
  rv('.empresa-eyebrow',  { opacity: 0, y: 18 }, 0.7);
  rv('.empresa-title',    { opacity: 0, y: 44 }, 1.05);
  rv('.empresa-subtitle', { opacity: 0, y: 28 }, 0.9);
  rv('.empresa-intro p',  { opacity: 0, y: 20 }, 0.8);
  rv('.empresa-closing',  { opacity: 0, y: 16 }, 0.7);
  rb('.pilar',            { opacity: 0, y: 40 }, 0.13, 0.85);

  /* ── Seminovos ─────────────────────────────────────────────── */
  rv('.seminovos-eyebrow', { opacity: 0, y: 18 }, 0.7);
  rv('.seminovos-title',   { opacity: 0, y: 36 }, 1.0);
  rv('.seminovos-filters', { opacity: 0, y: 20 }, 0.8);

  /* ── AG Catamaran ──────────────────────────────────────────── */
  rv('.ag-eyebrow',         { opacity: 0, y: 18 }, 0.7);
  rv('.ag-title',           { opacity: 0, y: 44 }, 1.05);
  rv('.ag-lead',            { opacity: 0, y: 24 }, 0.9);
  rv('.ag-gallery__banner', { opacity: 0, scale: 1.03 }, 1.1);
  rv('.ag-gallery__row',    { opacity: 0, y: 30 }, 0.9);
  rb('.ag-list li',         { opacity: 0, x: -20 }, 0.08, 0.7);
  rb('.ag-row',             { opacity: 0, y: 14 },  0.07, 0.65);
  rv('.ag-about',           { opacity: 0, y: 24 }, 0.85);

  /* ── Newsletter ────────────────────────────────────────────── */
  rv('.newsletter-inner', { opacity: 0, y: 30 }, 0.9);

  /* ── Charter Caribe ────────────────────────────────────────── */
  rv('.cc-eyebrow',       { opacity: 0, y: 18 }, 0.7,  '.cc-banner');
  rv('.cc-title',         { opacity: 0, y: 44 }, 1.05, '.cc-banner');
  rv('.cc-cta',           { opacity: 0, y: 20 }, 0.8,  '.cc-banner');
  rv('.cc-intro p',       { opacity: 0, y: 24 }, 0.85);
  rv('.cc-contact',       { opacity: 0, y: 20 }, 0.8);
  rv('.cc-yachts-title',  { opacity: 0, y: 24 }, 0.85);
  rb('.cc-yachts-grid li',{ opacity: 0, y: 22 }, 0.05, 0.55);

  /* ── Charter Europa ────────────────────────────────────────── */
  rv('.ce-eyebrow', { opacity: 0, y: 18 }, 0.7,  '.ce-banner');
  rv('.ce-title',   { opacity: 0, y: 44 }, 1.05, '.ce-banner');
  rv('.ce-intro',   { opacity: 0, y: 24 }, 0.85);
  rv('.ce-yachts',  { opacity: 0, y: 30 }, 0.9);
  rb('.ce-yachts-grid li', { opacity: 0, y: 22 }, 0.05, 0.55);

  /* ── Contato ───────────────────────────────────────────────── */
  rv('.contato-eyebrow', { opacity: 0, y: 18 }, 0.7);
  rv('.contato-title',   { opacity: 0, y: 44 }, 1.05);
  rv('.contato-item',    { opacity: 0, x: -28 }, 0.85);
  rv('.contato-form',    { opacity: 0, x: 28 },  0.9);

  /* ── Footer ────────────────────────────────────────────────── */
  rv('.footer-logo',  { opacity: 0, y: 14 }, 0.7);
  rv('.footer-nav',   { opacity: 0, y: 14 }, 0.7);
  rv('.footer-social',{ opacity: 0, y: 14 }, 0.7);
})();
