/**
 * ui.js — Utilidades de interfaz: pantallas, modales, avisos
 * accesibles (aria-live), confeti y el efecto linterna.
 */

/** Cambia de pantalla (secciones con clase .pantalla). */
export function mostrarPantalla(id) {
  document.querySelectorAll('.pantalla').forEach(p => p.classList.remove('activa'));
  const destino = document.getElementById(id);
  if (destino) {
    destino.classList.add('activa');
    window.scrollTo({ top: 0 });
  }
}

/** Abre / cierra modales (elementos con clase .modal). */
export function abrirModal(id) {
  const m = document.getElementById(id);
  if (!m) return;
  m.classList.add('abierto');
  const foco = m.querySelector('button, input, [tabindex]');
  if (foco) foco.focus();
}
export function cerrarModal(id) {
  const m = document.getElementById(id);
  if (m) m.classList.remove('abierto');
}
export function cerrarModales() {
  document.querySelectorAll('.modal.abierto').forEach(m => m.classList.remove('abierto'));
}

/** Aviso flotante + anuncio para lectores de pantalla. */
let avisoTimer = null;
export function avisar(texto, ms = 2600) {
  const aviso = document.getElementById('aviso');
  const vivo = document.getElementById('anuncios');
  if (vivo) vivo.textContent = texto;
  if (!aviso) return;
  aviso.textContent = texto;
  aviso.classList.add('visible');
  clearTimeout(avisoTimer);
  avisoTimer = setTimeout(() => aviso.classList.remove('visible'), ms);
}

/** Confeti de celebración (usa canvas-confetti si está cargado). */
export function confeti(grande = false) {
  if (typeof window.confetti !== 'function') return;
  const reducir = window.matchMedia('(prefers-reduced-motion: reduce)').matches;
  if (reducir) return;
  const base = { spread: 75, origin: { y: 0.65 } };
  window.confetti({ ...base, particleCount: grande ? 160 : 60 });
  if (grande) {
    setTimeout(() => window.confetti({ ...base, particleCount: 120, angle: 60, origin: { x: 0 } }), 350);
    setTimeout(() => window.confetti({ ...base, particleCount: 120, angle: 120, origin: { x: 1 } }), 700);
  }
}

/**
 * Efecto linterna: cubre un texto con "oscuridad" que el niño
 * borra arrastrando el dedo, como si alumbrara con una linterna.
 */
export function iniciarLinterna(contenedor) {
  const canvas = contenedor.querySelector('canvas');
  const texto = contenedor.querySelector('.linterna__texto');
  if (!canvas || !texto) return;

  // El canvas cubre el texto; lo vamos "borrando" con el dedo.
  const ajustar = () => {
    const alto = Math.max(texto.offsetHeight, 140);
    canvas.width = contenedor.offsetWidth * devicePixelRatio;
    canvas.height = alto * devicePixelRatio;
    canvas.style.height = alto + 'px';
    const ctx = canvas.getContext('2d');
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.fillStyle = '#10233f';
    ctx.fillRect(0, 0, contenedor.offsetWidth, alto);
    // Estrellitas para que se sienta "de noche"
    ctx.fillStyle = 'rgba(255,255,255,0.7)';
    for (let i = 0; i < 24; i++) {
      ctx.fillRect(Math.random() * contenedor.offsetWidth, Math.random() * alto, 2, 2);
    }
  };
  ajustar();

  const ctx = canvas.getContext('2d');
  const alumbrar = (x, y) => {
    const rect = canvas.getBoundingClientRect();
    ctx.save();
    ctx.setTransform(devicePixelRatio, 0, 0, devicePixelRatio, 0, 0);
    ctx.globalCompositeOperation = 'destination-out';
    const grad = ctx.createRadialGradient(x - rect.left, y - rect.top, 8, x - rect.left, y - rect.top, 46);
    grad.addColorStop(0, 'rgba(0,0,0,1)');
    grad.addColorStop(1, 'rgba(0,0,0,0)');
    ctx.fillStyle = grad;
    ctx.beginPath();
    ctx.arc(x - rect.left, y - rect.top, 46, 0, Math.PI * 2);
    ctx.fill();
    ctx.restore();
  };

  canvas.addEventListener('pointerdown', e => { canvas.setPointerCapture(e.pointerId); alumbrar(e.clientX, e.clientY); });
  canvas.addEventListener('pointermove', e => { if (e.buttons) alumbrar(e.clientX, e.clientY); });

  // Si prefieren menos interacción/movimiento, un toque doble lo revela todo.
  canvas.addEventListener('dblclick', () => { canvas.style.display = 'none'; });
  return { reiniciar: ajustar };
}

/** Rellena un elemento con texto de forma segura (sin HTML). */
export function texto(id, valor) {
  const el = document.getElementById(id);
  if (el) el.textContent = valor;
}
