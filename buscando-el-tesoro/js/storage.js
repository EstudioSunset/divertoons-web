/**
 * storage.js — Guardado local del progreso.
 *
 * IMPORTANTE: localStorage guarda el progreso SOLO en este dispositivo.
 * No hay sincronización en tiempo real entre celulares (eso requeriría
 * un backend, que esta versión no usa a propósito).
 */

const PREFIJO = 'divertoons-tesoro:';

function clave(gameId) {
  return PREFIJO + gameId;
}

/** Crea un progreso vacío para una partida nueva. */
export function progresoNuevo(config) {
  return {
    gameId: config.gameId,
    version: config.version,
    jugador: '',
    personaje: null,
    modo: 'individual',           // 'individual' | 'equipo'
    equipo: [],                   // nombres de los integrantes (modo equipo)
    turno: 0,                     // índice del integrante al que le toca
    pistaActual: 1,               // número de orden (1..n)
    completadas: [],              // ids de pistas completadas
    areasDesbloqueadas: [],       // ids de áreas visibles
    ayudasUsadas: {},             // { pistaId: cantidad }
    desafiosSuperados: [],        // ids de pistas cuyo desafío ya se superó
    letras: [],                   // letras del cofre recolectadas
    intentosFallidos: 0,
    sonido: true,
    inicio: null,                 // timestamp
    fin: null                     // timestamp
  };
}

/** Guarda el progreso. Devuelve false si localStorage no está disponible. */
export function guardar(progreso) {
  try {
    localStorage.setItem(clave(progreso.gameId), JSON.stringify(progreso));
    return true;
  } catch (e) {
    console.warn('No se pudo guardar el progreso:', e);
    return false;
  }
}

/**
 * Carga el progreso guardado para esta aventura.
 * Devuelve null si no existe o si la versión ya no es compatible
 * (en ese caso marca .incompatible para avisar al adulto).
 */
export function cargar(config) {
  try {
    const crudo = localStorage.getItem(clave(config.gameId));
    if (!crudo) return null;
    const progreso = JSON.parse(crudo);
    if (progreso.version !== config.version) {
      return { incompatible: true };
    }
    return progreso;
  } catch (e) {
    console.warn('Progreso guardado ilegible, se ignora:', e);
    return null;
  }
}

/** Borra el progreso de esta aventura. */
export function borrar(gameId) {
  try {
    localStorage.removeItem(clave(gameId));
  } catch (e) {
    console.warn('No se pudo borrar el progreso:', e);
  }
}

/** ¿Hay una partida empezada y compatible? */
export function hayPartida(config) {
  const p = cargar(config);
  return !!(p && !p.incompatible && p.inicio && !p.fin);
}
