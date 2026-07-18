/**
 * app.js — Portada (index.html): muestra "Continuar aventura" solo
 * si hay progreso guardado, permite reiniciar con confirmación y
 * recuerda la preferencia de sonido.
 */
import * as Storage from './storage.js';

const RUTA_CONFIG = 'data/aventura-001.json';

document.addEventListener('DOMContentLoaded', async () => {
  let config = null;
  try {
    const resp = await fetch(RUTA_CONFIG);
    config = await resp.json();
  } catch (e) {
    // Sin configuración no se puede saber si hay partida; el botón
    // de continuar simplemente no aparece. juego.html mostrará el
    // error detallado para el adulto.
    console.warn('No se pudo leer la configuración desde la portada:', e);
  }

  const btnContinuar = document.getElementById('btn-continuar');
  const btnReiniciar = document.getElementById('btn-reiniciar');
  const btnSonido = document.getElementById('btn-sonido');

  let guardado = null;
  if (config) {
    guardado = Storage.cargar(config);
    if (guardado && !guardado.incompatible && guardado.inicio) {
      btnContinuar.classList.remove('oculto');
      btnReiniciar.classList.remove('oculto');
      if (guardado.fin) {
        btnContinuar.textContent = '🏆 Ver mi victoria';
      }
    }
    if (guardado && guardado.incompatible) {
      document.getElementById('aviso-version').classList.remove('oculto');
      btnReiniciar.classList.remove('oculto');
    }
  }

  btnReiniciar.addEventListener('click', () => {
    const seguro = confirm('¿Seguro que quieres reiniciar la aventura? Se borrará todo el progreso guardado en este teléfono.');
    if (seguro && config) {
      Storage.borrar(config.gameId);
      location.reload();
    }
  });

  // Preferencia de sonido (se aplica al crear/continuar la partida)
  let sonido = guardado && !guardado.incompatible ? guardado.sonido !== false : true;
  const pintarSonido = () => {
    btnSonido.textContent = sonido ? '🔊' : '🔇';
    btnSonido.setAttribute('aria-label', sonido ? 'Silenciar sonidos' : 'Activar sonidos');
  };
  pintarSonido();
  btnSonido.addEventListener('click', () => {
    sonido = !sonido;
    pintarSonido();
    if (guardado && !guardado.incompatible && guardado.inicio) {
      guardado.sonido = sonido;
      Storage.guardar(guardado);
    } else {
      try { localStorage.setItem('divertoons-tesoro:sonido-inicial', sonido ? '1' : '0'); } catch (e) {}
    }
  });
});
