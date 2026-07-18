/**
 * audio.js — Sonidos opcionales del juego.
 *
 * Los archivos viven en /assets/audio/. Si no existen, el juego
 * funciona igual y no muestra errores (los sonidos simplemente
 * no suenan). Nunca se reproduce nada antes de que el jugador
 * toque algo, para respetar las reglas de autoplay del navegador.
 */

const RUTA = 'assets/audio/';

const SONIDOS = {
  inicio:      'inicio.mp3',
  correcto:    'pista-correcta.mp3',
  incorrecto:  'codigo-incorrecto.mp3',
  desbloqueo:  'zona-desbloqueada.mp3',
  victoria:    'victoria.mp3'
};

const cache = {};
let activado = true;

export function activarSonido(valor) {
  activado = !!valor;
}

export function sonidoActivado() {
  return activado;
}

/** Reproduce un sonido si está activado y el archivo existe. */
export function reproducir(nombre) {
  if (!activado || !SONIDOS[nombre]) return;
  try {
    if (!cache[nombre]) {
      const audio = new Audio(RUTA + SONIDOS[nombre]);
      audio.preload = 'auto';
      // Si el archivo no existe, marcamos el sonido como no disponible
      // en silencio, sin ensuciar la consola para el niño.
      audio.addEventListener('error', () => { cache[nombre] = 'no-disponible'; }, { once: true });
      cache[nombre] = audio;
    }
    const audio = cache[nombre];
    if (audio === 'no-disponible') return;
    audio.currentTime = 0;
    const promesa = audio.play();
    if (promesa) promesa.catch(() => { /* autoplay bloqueado: se ignora */ });
  } catch (e) {
    /* nunca romper el juego por un sonido */
  }
}

/** Vibración corta (si el dispositivo y la config lo permiten). */
export function vibrar(patron = 60) {
  try {
    if (navigator.vibrate) navigator.vibrate(patron);
  } catch (e) { /* opcional */ }
}
