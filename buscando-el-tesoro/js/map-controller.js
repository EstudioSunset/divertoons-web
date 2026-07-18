/**
 * map-controller.js — Carga el SVG del mapa, controla los estados
 * de cada zona (bloqueada, disponible, actual, completada, tesoro),
 * el zoom/desplazamiento táctil y la ruta punteada del tesoro.
 */

const ESTADOS = ['bloqueada', 'disponible', 'actual', 'completada'];

let svg = null;
let marco = null;
let nombresAreas = {};
let alTocarArea = null;

/** Carga el SVG dentro del marco y prepara los gestos. */
export async function cargarMapa(rutaSvg, opciones = {}) {
  marco = document.getElementById('mapa-marco');
  nombresAreas = opciones.nombres || {};
  alTocarArea = opciones.alTocarArea || null;

  const resp = await fetch(rutaSvg);
  if (!resp.ok) throw new Error('No se pudo cargar el mapa: ' + rutaSvg);
  const texto = await resp.text();
  const cont = document.createElement('div');
  cont.innerHTML = texto;
  svg = cont.querySelector('svg');
  if (!svg) throw new Error('El archivo del mapa no contiene un SVG válido.');

  marco.innerHTML = '';
  marco.appendChild(svg);

  if (opciones.mostrarEtiquetas === false) {
    svg.classList.add('mapa-sin-etiquetas');
  }

  // Todas las zonas empiezan bloqueadas.
  areas().forEach(a => ponerEstado(a, 'bloqueada'));

  prepararGestos();
  prepararToquesDeArea();
  return svg;
}

function areas() {
  return svg ? [...svg.querySelectorAll('.area')] : [];
}

function area(id) {
  return svg ? svg.querySelector(`.area[data-area="${id}"]`) : null;
}

function ponerEstado(grupo, estado) {
  ESTADOS.forEach(e => grupo.classList.remove(e));
  grupo.classList.add(estado);
  const icono = grupo.querySelector('.estado');
  if (icono) {
    icono.textContent = estado === 'completada' ? '✅'
                      : estado === 'actual' ? '⭐'
                      : '';
  }
}

/** API pública de estados */
export function estadoArea(id, estado, animar = false) {
  const g = area(id);
  if (!g) { console.warn('Área no encontrada en el mapa:', id); return; }
  ponerEstado(g, estado);
  if (animar) {
    g.classList.add('recien-revelada');
    setTimeout(() => g.classList.remove('recien-revelada'), 900);
  }
}

export function mostrarTesoro() {
  const marca = svg && svg.querySelector('.marca-tesoro');
  if (marca) marca.setAttribute('opacity', '1');
}

export function revelarTodo() {
  areas().forEach(a => ponerEstado(a, 'completada'));
  mostrarTesoro();
}

/** Dibuja la ruta punteada entre los centros de las zonas completadas. */
export function dibujarRuta(idsEnOrden) {
  const ruta = svg && svg.querySelector('#ruta-tesoro');
  if (!ruta || idsEnOrden.length < 2) return;
  const puntos = idsEnOrden.map(id => {
    const g = area(id);
    if (!g) return null;
    const r = g.querySelector('.suelo');
    const x = parseFloat(r.getAttribute('x')) + parseFloat(r.getAttribute('width')) / 2;
    const y = parseFloat(r.getAttribute('y')) + parseFloat(r.getAttribute('height')) / 2;
    return `${x},${y}`;
  }).filter(Boolean);
  if (puntos.length < 2) return;
  ruta.setAttribute('d', 'M' + puntos.join(' L'));
  ruta.setAttribute('opacity', '0.9');
}

/** Toques sobre las habitaciones: muestra nombre y estado. */
function prepararToquesDeArea() {
  areas().forEach(g => {
    const activar = () => {
      // Ignorar el toque si fue parte de un arrastre del mapa
      if (gesto.arrastro) return;
      const id = g.dataset.area;
      const nombre = nombresAreas[id] || g.getAttribute('aria-label') || id;
      const estado = ESTADOS.find(e => g.classList.contains(e)) || 'bloqueada';
      const textos = {
        bloqueada: '🔒 Zona aún sin descubrir',
        disponible: '👀 Zona descubierta',
        actual: '⭐ ¡La pista está por aquí!',
        completada: '✅ Ya revisado'
      };
      if (alTocarArea) alTocarArea(`${nombre}: ${textos[estado]}`);
    };
    g.addEventListener('click', activar);
    g.addEventListener('keydown', e => {
      if (e.key === 'Enter' || e.key === ' ') { e.preventDefault(); activar(); }
    });
  });
}

/* ─── Zoom y desplazamiento táctil ───
   Un dedo: arrastrar · Dos dedos: pellizcar para zoom.
   Con límites para no perder el mapa de vista.            */
const gesto = {
  escala: 1, x: 0, y: 0,
  punteros: new Map(),
  inicioDist: 0, inicioEscala: 1,
  inicioX: 0, inicioY: 0, origenX: 0, origenY: 0,
  arrastro: false
};

function aplicarTransformacion() {
  // Límites: escala 1–3, desplazamiento proporcional al zoom.
  gesto.escala = Math.min(3, Math.max(1, gesto.escala));
  const maxX = marco.offsetWidth * (gesto.escala - 1);
  const maxY = marco.offsetHeight * (gesto.escala - 1);
  gesto.x = Math.min(0, Math.max(-maxX, gesto.x));
  gesto.y = Math.min(0, Math.max(-maxY, gesto.y));
  svg.style.transform = `translate(${gesto.x}px, ${gesto.y}px) scale(${gesto.escala})`;
}

function distancia(punteros) {
  const [a, b] = [...punteros.values()];
  return Math.hypot(a.x - b.x, a.y - b.y);
}

function prepararGestos() {
  marco.addEventListener('pointerdown', e => {
    marco.setPointerCapture(e.pointerId);
    gesto.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });
    gesto.arrastro = false;
    if (gesto.punteros.size === 1) {
      gesto.inicioX = e.clientX; gesto.inicioY = e.clientY;
      gesto.origenX = gesto.x;   gesto.origenY = gesto.y;
    } else if (gesto.punteros.size === 2) {
      gesto.inicioDist = distancia(gesto.punteros);
      gesto.inicioEscala = gesto.escala;
    }
  });

  marco.addEventListener('pointermove', e => {
    if (!gesto.punteros.has(e.pointerId)) return;
    gesto.punteros.set(e.pointerId, { x: e.clientX, y: e.clientY });

    if (gesto.punteros.size === 1 && gesto.escala > 1) {
      const dx = e.clientX - gesto.inicioX;
      const dy = e.clientY - gesto.inicioY;
      if (Math.hypot(dx, dy) > 8) gesto.arrastro = true;
      gesto.x = gesto.origenX + dx;
      gesto.y = gesto.origenY + dy;
      aplicarTransformacion();
    } else if (gesto.punteros.size === 2) {
      gesto.arrastro = true;
      const d = distancia(gesto.punteros);
      gesto.escala = gesto.inicioEscala * (d / gesto.inicioDist);
      aplicarTransformacion();
    }
  });

  const soltar = e => {
    gesto.punteros.delete(e.pointerId);
    // Al soltar todos los dedos con escala 1, recolocar en origen.
    if (gesto.punteros.size === 0 && gesto.escala <= 1.02) {
      gesto.escala = 1; gesto.x = 0; gesto.y = 0;
      aplicarTransformacion();
    }
    setTimeout(() => { gesto.arrastro = false; }, 50);
  };
  marco.addEventListener('pointerup', soltar);
  marco.addEventListener('pointercancel', soltar);

  // Doble toque para acercar/alejar rápido.
  let ultimoToque = 0;
  marco.addEventListener('pointerup', e => {
    const ahora = Date.now();
    if (ahora - ultimoToque < 300 && !gesto.arrastro) {
      gesto.escala = gesto.escala > 1.2 ? 1 : 2;
      if (gesto.escala === 1) { gesto.x = 0; gesto.y = 0; }
      aplicarTransformacion();
    }
    ultimoToque = ahora;
  });
}
