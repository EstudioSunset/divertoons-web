/**
 * qr-scanner.js — Escáner de códigos QR.
 *
 * Usa la librería html5-qrcode cargada por CDN en juego.html.
 * Requisitos de la cámara: HTTPS (o localhost). En divertoons.com
 * (GitHub Pages) ya hay HTTPS, así que funciona.
 *
 * Si la cámara falla o el permiso se rechaza, el juego ofrece
 * siempre el código manual como alternativa.
 */

let lector = null;
let escaneando = false;
let ultimoCodigo = '';
let ultimoMomento = 0;

/**
 * Abre el escáner dentro del elemento #lector-qr.
 * @param {Function} alLeer   — recibe el texto del QR (con pausa anti-repetición)
 * @param {Function} alFallar — recibe un mensaje amigable si la cámara no se puede usar
 */
export async function abrirEscaner(alLeer, alFallar) {
  if (typeof Html5Qrcode === 'undefined') {
    alFallar('El lector de códigos no se pudo cargar. Usa el código escrito.');
    return;
  }
  if (escaneando) return;

  try {
    lector = lector || new Html5Qrcode('lector-qr');
    escaneando = true;
    await lector.start(
      { facingMode: 'environment' },           // cámara trasera primero
      { fps: 10, qrbox: { width: 230, height: 230 } },
      (texto) => {
        // Evitar procesar el mismo código muchas veces seguidas.
        const ahora = Date.now();
        if (texto === ultimoCodigo && ahora - ultimoMomento < 2500) return;
        ultimoCodigo = texto;
        ultimoMomento = ahora;
        alLeer(texto);
      },
      () => { /* fotograma sin QR: normal, se ignora */ }
    );
  } catch (err) {
    escaneando = false;
    console.warn('Cámara no disponible:', err);
    let mensaje = 'No pudimos abrir la cámara. ¡No pasa nada! Usa el código escrito.';
    const nombre = err && (err.name || String(err));
    if (/NotAllowed|Permission/i.test(nombre)) {
      mensaje = 'La cámara no tiene permiso. Pídele a un adulto que lo active, o usa el código escrito.';
    } else if (/NotFound|Overconstrained/i.test(nombre)) {
      mensaje = 'Este dispositivo no tiene una cámara compatible. Usa el código escrito.';
    }
    alFallar(mensaje);
  }
}

/** Detiene la cámara y libera el recurso. */
export async function cerrarEscaner() {
  if (lector && escaneando) {
    try { await lector.stop(); } catch (e) { /* ya estaba detenido */ }
  }
  escaneando = false;
}

/** Normaliza un código escrito a mano: mayúsculas y sin espacios. */
export function normalizarCodigo(texto) {
  return String(texto || '').toUpperCase().replace(/\s+/g, '').trim();
}
