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
let avisosEspeciales = {};

/** Carga el SVG dentro del marco y prepara los gestos. */
export async function cargarMapa(rutaSvg, opciones = {}) {
  marco = document.getElementById('mapa-marco');
  nombresAreas = opciones.nombres || {};
  alTocarArea = opciones.alTocarArea || null;
  avisosEspeciales = opciones.avisosEspeciales || {};

  const resp = await fetch(rutaSvg);
  if (!resp.ok) throw new Error('No se pudo cargar el mapa: ' + rutaSvg);
  const texto = await resp.text();
  const cont = document.createElement('div');
  cont.innerHTML = texto;
  svg = cont.querySelector('svg');
  if (!svg) throw new Error('El archivo del mapa no contiene un SVG válido.');

  marco.innerHTML = '';
  marco.appendChild(svg);

  // Botones de zoom: alternativa clara al pellizco (y accesibles por teclado)
  const zoom = document.createElement('div');
  zoom.className = 'mapa-zoom';
  [['+', 'Acercar el mapa', 2], ['−', 'Alejar el mapa', -2], ['⤢', 'Ver el mapa completo', 0]]
    .forEach(([signo, etiqueta, paso]) => {
      const b = document.createElement('button');
      b.type = 'button';
      b.textContent = signo;
      b.setAttribute('aria-label', etiqueta);
      b.addEventListener('click', e => { e.stopPropagation(); acercar(paso); });
      // Que tocar el botón no arrastre el mapa ni cuente como parte de
      // un doble toque sobre el mapa (evita que dos toques rápidos en
      // los botones disparen también el zoom por doble toque).
      b.addEventListener('pointerdown', e => e.stopPropagation());
      b.addEventListener('pointerup', e => e.stopPropagation());
      zoom.appendChild(b);
    });
  marco.appendChild(zoom);

  if (opciones.mostrarEtiquetas === false) {
    svg.classList.add('mapa-sin-etiquetas');
  }

  // Todas las zonas empiezan bloqueadas.
  areas().forEach(a => { if (a.dataset.tipo === 'jugable') ponerEstado(a, 'bloqueada'); });

  prepararGestos();
  prepararToquesDeArea();
  vistaInicial();
  return svg;
}

/**
 * Vista con la que arranca el mapa: encuadrada en la casa (mitad inferior
 * del SVG), que es la zona de juego real. Ancla la vista al borde inferior
 * y la centra horizontalmente. El botón − (o alejar con los dedos) lleva
 * gradualmente hasta el mapa completo; ⤢ salta directo a él.
 *
 * El tablero (y por tanto #mapa-marco) sigue oculto con display:none en
 * el momento en que se llama a cargarMapa(), así que offsetWidth/Height
 * todavía valen 0. Se espera a que el marco tenga tamaño real (cuando la
 * pantalla del juego se muestra) antes de calcular el encuadre.
 */
function vistaInicial() {
  if (marco.offsetWidth > 0 && marco.offsetHeight > 0) {
    aplicarVistaInicial();
    return;
  }
  const obs = new ResizeObserver(entradas => {
    for (const entrada of entradas) {
      if (entrada.contentRect.width > 0 && entrada.contentRect.height > 0) {
        obs.disconnect();
        aplicarVistaInicial();
        return;
      }
    }
  });
  obs.observe(marco);
}

// Fracción del marco que debe ocupar la casa en la vista de partida
// (deja un margen alrededor en vez de dejarla pegada a los bordes).
const MARGEN_VISTA_CASA = 0.82;

// Tope máximo de acercado (pellizco o botón +). 3 sólo dejaba ver medio
// cuarto a la vez; con 12 hasta un cuarto pequeño (un baño) puede llenar
// la pantalla del mapa, y uno mediano como El Porche sobra de margen.
const ESCALA_MAX = 12;

/**
 * Calcula el encuadre de partida a partir de la caja que envuelve a
 * TODAS las zonas jugables (la casa), leída del propio SVG con
 * getBBox() — no de coordenadas fijas — para no depender de que el
 * diseño de la casa dentro del mapa no cambie nunca.
 */
function aplicarVistaInicial() {
  const zonasCasa = areas().filter(a => a.dataset.tipo === 'jugable');
  if (!zonasCasa.length) {
    escalaInicial = 1;
    gesto.escala = 1; gesto.x = 0; gesto.y = 0;
    aplicarTransformacion();
    return;
  }

  let minX = Infinity, minY = Infinity, maxX = -Infinity, maxY = -Infinity;
  zonasCasa.forEach(g => {
    const b = g.getBBox();
    minX = Math.min(minX, b.x); minY = Math.min(minY, b.y);
    maxX = Math.max(maxX, b.x + b.width); maxY = Math.max(maxY, b.y + b.height);
  });
  const anchoCasa = maxX - minX, altoCasa = maxY - minY;
  const centroX = minX + anchoCasa / 2, centroY = minY + altoCasa / 2;

  const { p0, offX0, offY0 } = medidasBase();
  escalaInicial = Math.min(ESCALA_MAX, Math.max(1, Math.min(
    (marco.offsetWidth * MARGEN_VISTA_CASA) / (anchoCasa * p0),
    (marco.offsetHeight * MARGEN_VISTA_CASA) / (altoCasa * p0)
  )));

  gesto.escala = escalaInicial;
  gesto.x = marco.offsetWidth / 2 - escalaInicial * (offX0 + centroX * p0);
  gesto.y = marco.offsetHeight / 2 - escalaInicial * (offY0 + centroY * p0);
  aplicarTransformacion();
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
  areas().forEach(a => { if (a.dataset.tipo === 'jugable') ponerEstado(a, 'completada'); });
  mostrarTesoro();
}

/** Dibuja la ruta punteada entre los centros de las zonas completadas. */
export function dibujarRuta(idsEnOrden) {
  const ruta = svg && svg.querySelector('#ruta-tesoro');
  if (!ruta || idsEnOrden.length < 2) return;
  const puntos = idsEnOrden.map(id => {
    const c = centro(id);
    return c ? `${c.x},${c.y}` : null;
  }).filter(Boolean);
  if (puntos.length < 2) return;
  ruta.setAttribute('d', 'M' + puntos.join(' L'));
  ruta.setAttribute('opacity', '0.9');
}

/**
 * Centro de una zona, en coordenadas del SVG. Usa getBBox() del grupo
 * completo (no atributos x/y/width/height de .suelo) para que funcione
 * también con zonas cuyo .suelo es un <path> en vez de un <rect>.
 */
function centro(id) {
  const g = area(id);
  if (!g) return null;
  const b = g.getBBox();
  return { x: b.x + b.width / 2, y: b.y + b.height / 2 };
}

/**
 * Dibuja una flecha punteada animada desde la zona recién completada
 * hasta la siguiente, para que el niño vea hacia dónde ir.
 */
export function rutaHaciaSiguiente(desdeId, hastaId) {
  if (!svg) return;
  let ruta = svg.querySelector('#ruta-siguiente');
  if (!ruta) {
    ruta = document.createElementNS('http://www.w3.org/2000/svg', 'path');
    ruta.setAttribute('id', 'ruta-siguiente');
    ruta.setAttribute('marker-end', 'url(#punta-flecha)');
    svg.appendChild(ruta);
    // Punta de flecha
    const defs = svg.querySelector('defs');
    if (defs && !svg.querySelector('#punta-flecha')) {
      const marker = document.createElementNS('http://www.w3.org/2000/svg', 'marker');
      marker.setAttribute('id', 'punta-flecha');
      marker.setAttribute('viewBox', '0 0 10 10');
      marker.setAttribute('refX', '7'); marker.setAttribute('refY', '5');
      marker.setAttribute('markerWidth', '5'); marker.setAttribute('markerHeight', '5');
      marker.setAttribute('orient', 'auto-start-reverse');
      const p = document.createElementNS('http://www.w3.org/2000/svg', 'path');
      p.setAttribute('d', 'M0 0 L10 5 L0 10 z');
      p.setAttribute('fill', '#D9534F');
      marker.appendChild(p);
      defs.appendChild(marker);
    }
  }
  const a = centro(desdeId), b = centro(hastaId);
  if (!a || !b) { ruta.setAttribute('d', ''); return; }
  // Curva suave para que se lea como un camino, no como una regla
  const mx = (a.x + b.x) / 2;
  const my = (a.y + b.y) / 2 - Math.abs(b.x - a.x) * 0.12 - 20;
  ruta.setAttribute('d', `M${a.x},${a.y} Q${mx},${my} ${b.x},${b.y}`);
  ruta.setAttribute('opacity', '1');
}

export function borrarRutaSiguiente() {
  const ruta = svg && svg.querySelector('#ruta-siguiente');
  if (ruta) ruta.setAttribute('opacity', '0');
}

/** Lleva la vista del navegador hasta el mapa. */
export function enfocarMapa() {
  if (!marco) return;
  marco.scrollIntoView({ behavior: 'smooth', block: 'center' });
}

/** Toques sobre las habitaciones: muestra nombre y estado. */
function prepararToquesDeArea() {
  areas().forEach(g => {
    const activar = () => {
      // Ignorar el toque si fue parte de un arrastre del mapa
      if (gesto.arrastro) return;
      const id = g.dataset.area;
      const tipo = g.dataset.tipo || 'jugable';
      const nombre = nombresAreas[id] || g.getAttribute('aria-label') || id;

      // Zonas prohibidas o que requieren un adulto: aviso propio.
      if (tipo !== 'jugable') {
        const aviso = (avisosEspeciales[tipo] || {})[id];
        if (aviso) {
          g.classList.add('rechazada');
          setTimeout(() => g.classList.remove('rechazada'), 700);
          if (alTocarArea) alTocarArea(aviso, tipo);
          return;
        }
      }

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
// Escala con la que arranca el mapa (encuadrada en la casa), calculada en
// aplicarVistaInicial(). 1 = mapa completo sin recortes: el límite mínimo
// de alejado y el único estado en el que un dedo no tiene nada que
// arrastrar (por eso ahí el dedo vuelve a deslizar la página).
let escalaInicial = 1;

const gesto = {
  escala: 1, x: 0, y: 0,
  punteros: new Map(),
  inicioDist: 0, inicioEscala: 1,
  inicioX: 0, inicioY: 0, origenX: 0, origenY: 0,
  arrastro: false
};

/**
 * Con object-fit:contain el SVG puede no llenar el marco entero (si el
 * marco es más ancho o más alto que la proporción 3:2 del mapa, sobra
 * espacio a los lados o arriba/abajo). Devuelve cuántos píxeles ocupa
 * cada unidad del viewBox (p0) y en qué desplazamiento interno empieza
 * el mapa dentro del marco (offX0, offY0) a escala 1, para poder ubicar
 * cualquier punto del mapa en la pantalla con precisión.
 */
function medidasBase() {
  const vb = svg.viewBox.baseVal;
  const p0 = Math.min(marco.offsetWidth / vb.width, marco.offsetHeight / vb.height);
  const contentW0 = vb.width * p0;
  const contentH0 = vb.height * p0;
  return {
    p0,
    offX0: (marco.offsetWidth - contentW0) / 2,
    offY0: (marco.offsetHeight - contentH0) / 2,
    contentW0, contentH0
  };
}

function aplicarTransformacion() {
  // Límites: escala 1 (mapa completo) – ESCALA_MAX, desplazamiento
  // acotado para que el mapa siga cubriendo el marco entero (sin huecos).
  gesto.escala = Math.min(ESCALA_MAX, Math.max(1, gesto.escala));
  const { offX0, offY0, contentW0, contentH0 } = medidasBase();
  let minX = marco.offsetWidth - gesto.escala * (offX0 + contentW0);
  let maxX = -gesto.escala * offX0;
  let minY = marco.offsetHeight - gesto.escala * (offY0 + contentH0);
  let maxY = -gesto.escala * offY0;
  // Si a esta escala el mapa todavía es más angosto/bajo que el marco en
  // algún eje (letterbox de object-fit:contain), no hay margen real para
  // arrastrar en ese eje: se centra en vez de forzar un límite inválido.
  if (minX > maxX) { minX = maxX = (minX + maxX) / 2; }
  if (minY > maxY) { minY = maxY = (minY + maxY) / 2; }
  gesto.x = Math.min(maxX, Math.max(minX, gesto.x));
  gesto.y = Math.min(maxY, Math.max(minY, gesto.y));
  svg.style.transform = `translate(${gesto.x}px, ${gesto.y}px) scale(${gesto.escala})`;
  // En cuanto hay algo de zoom (incluida la vista de partida, ya
  // acercada a la casa) el dedo arrastra el mapa; sólo con el mapa
  // completo (escala 1, sin nada que arrastrar) el dedo vuelve a
  // deslizar la página (esencial en pantallas verticales).
  marco.classList.toggle('ampliado', gesto.escala > 1.02);
}

/**
 * Cambia la escala manteniendo fijo en pantalla el punto (px, py) del
 * marco (por defecto su centro): así acercar no salta a una zona vacía
 * cualquiera, sino que sigue mirando lo mismo que ya se veía.
 */
function acercarSobre(nuevaEscala, px, py) {
  nuevaEscala = Math.min(ESCALA_MAX, Math.max(1, nuevaEscala));
  const factor = nuevaEscala / gesto.escala;
  gesto.x = px - factor * (px - gesto.x);
  gesto.y = py - factor * (py - gesto.y);
  gesto.escala = nuevaEscala;
  aplicarTransformacion();
}

/** Zoom desde los botones + / − (y para reiniciar la vista). */
export function acercar(paso) {
  if (paso === 0) {
    gesto.escala = 1; gesto.x = 0; gesto.y = 0;
    aplicarTransformacion();
    return;
  }
  acercarSobre(gesto.escala + paso, marco.offsetWidth / 2, marco.offsetHeight / 2);
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

    if (gesto.punteros.size === 1 && gesto.escala > 1.02) {
      const dx = e.clientX - gesto.inicioX;
      const dy = e.clientY - gesto.inicioY;
      if (Math.hypot(dx, dy) > 8) gesto.arrastro = true;
      gesto.x = gesto.origenX + dx;
      gesto.y = gesto.origenY + dy;
      aplicarTransformacion();
    } else if (gesto.punteros.size === 2) {
      gesto.arrastro = true;
      const d = distancia(gesto.punteros);
      const nuevaEscala = gesto.inicioEscala * (d / gesto.inicioDist);
      const [a, b] = [...gesto.punteros.values()];
      const marcoRect = marco.getBoundingClientRect();
      const medioX = (a.x + b.x) / 2 - marcoRect.left;
      const medioY = (a.y + b.y) / 2 - marcoRect.top;
      acercarSobre(nuevaEscala, medioX, medioY);
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
      // Si ya está acercado (a la vista de la casa o más), el doble toque
      // aleja al mapa completo; si no, vuelve a encuadrar la casa.
      if (gesto.escala > 1.02) {
        gesto.escala = 1; gesto.x = 0; gesto.y = 0;
        aplicarTransformacion();
      } else {
        aplicarVistaInicial();
      }
    }
    ultimoToque = ahora;
  });
}
