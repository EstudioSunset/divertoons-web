/**
 * game-engine.js — Motor del juego "Buscando el Tesoro".
 *
 * Orquesta: carga de configuración, pantallas, mapa, pistas
 * secuenciales, escáner, ayudas, desafíos, letras del cofre,
 * estrellas, insignias y victoria.
 */

import * as Storage from './storage.js';
import * as Audio from './audio.js';
import * as UI from './ui.js';
import * as Mapa from './map-controller.js';
import * as QR from './qr-scanner.js';

const RUTA_CONFIG = 'data/aventura-001.json';
const RUTA_MAPA = 'assets/maps/mapa-casa.svg';

let config = null;
let progreso = null;
let linterna = null;
const DEBUG = new URLSearchParams(location.search).get('debug') === 'true';

/* ══════════════ Arranque ══════════════ */

document.addEventListener('DOMContentLoaded', iniciar);

async function iniciar() {
  try {
    config = await cargarConfiguracion();
  } catch (err) {
    errorAdmin(err.message);
    return;
  }

  prepararBotonesGlobales();
  if (DEBUG) prepararDebug();

  const guardado = Storage.cargar(config);
  const quiereContinuar = new URLSearchParams(location.search).get('continuar') === '1';

  if (guardado && guardado.incompatible) {
    errorAdmin(
      'El archivo de la aventura cambió de versión y el progreso guardado ya no es compatible. ' +
      'Reinicia la aventura desde la pantalla de inicio.'
    );
    return;
  }

  if (guardado && guardado.inicio && quiereContinuar) {
    progreso = guardado;
    Audio.activarSonido(progreso.sonido);
    if (progreso.fin) {
      await prepararTablero();
      mostrarVictoria();
    } else {
      await prepararTablero();
      UI.mostrarPantalla('pantalla-juego');
      UI.avisar(`¡Hola de nuevo, ${progreso.jugador || 'aventurero'}! 🏴‍☠️`);
    }
  } else {
    progreso = Storage.progresoNuevo(config);
    try {
      if (localStorage.getItem('divertoons-tesoro:sonido-inicial') === '0') progreso.sonido = false;
    } catch (e) { /* opcional */ }
    Audio.activarSonido(progreso.sonido);
    prepararSeleccionJugador();
    UI.mostrarPantalla('pantalla-jugador');
  }
}

/** Carga y valida el JSON de la aventura. */
async function cargarConfiguracion() {
  let datos;
  try {
    const resp = await fetch(RUTA_CONFIG);
    if (!resp.ok) throw new Error('HTTP ' + resp.status);
    datos = await resp.json();
  } catch (e) {
    throw new Error(
      'No se pudo cargar ' + RUTA_CONFIG + '. Revisa que el archivo exista y sea JSON válido. ' +
      'Recuerda: la página debe abrirse desde un servidor (http/https), no con file://.'
    );
  }

  const faltantes = [];
  if (!datos.gameId) faltantes.push('gameId');
  if (!datos.version) faltantes.push('version');
  if (!Array.isArray(datos.clues) || datos.clues.length === 0) faltantes.push('clues');
  (datos.clues || []).forEach((c, i) => {
    ['id', 'order', 'areaId', 'riddle', 'qrToken', 'manualCode'].forEach(campo => {
      if (!c[campo]) faltantes.push(`clues[${i}].${campo}`);
    });
  });
  if (faltantes.length) {
    throw new Error('Faltan campos obligatorios en el JSON: ' + faltantes.join(', '));
  }

  datos.clues.sort((a, b) => a.order - b.order);
  return datos;
}

/* ══════════════ Selección de jugador ══════════════ */

function prepararSeleccionJugador() {
  const cont = document.getElementById('lista-personajes');
  cont.innerHTML = '';
  (config.personajes || []).forEach(p => {
    const btn = document.createElement('button');
    btn.type = 'button';
    btn.className = 'personaje';
    btn.setAttribute('aria-pressed', 'false');
    btn.dataset.personaje = p.id;
    btn.innerHTML = `<span class="personaje__cara" aria-hidden="true">${p.cara}</span>
                     <span class="personaje__nombre">${p.nombre}</span>`;
    btn.addEventListener('click', () => {
      cont.querySelectorAll('.personaje').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      progreso.personaje = p.id;
    });
    cont.appendChild(btn);
  });

  // Modo individual / equipo
  document.querySelectorAll('#modo-juego .btn').forEach(btn => {
    btn.addEventListener('click', () => {
      document.querySelectorAll('#modo-juego .btn').forEach(b => b.setAttribute('aria-pressed', 'false'));
      btn.setAttribute('aria-pressed', 'true');
      progreso.modo = btn.dataset.modo;
      document.getElementById('campo-equipo').classList.toggle('oculto', progreso.modo !== 'equipo');
    });
  });

  document.getElementById('btn-listo-jugador').addEventListener('click', () => {
    const nombre = document.getElementById('nombre-jugador').value.trim();
    if (!nombre) {
      UI.avisar('Escribe tu nombre o el de tu equipo ✏️');
      document.getElementById('nombre-jugador').focus();
      return;
    }
    if (!progreso.personaje) {
      UI.avisar('Elige un personaje de Divertoons 👇');
      return;
    }
    progreso.jugador = nombre;
    if (progreso.modo === 'equipo') {
      const integrantes = document.getElementById('integrantes-equipo').value
        .split(',').map(s => s.trim()).filter(Boolean);
      progreso.equipo = integrantes;
    }
    Audio.reproducir('inicio');
    mostrarIntro();
  });
}

/* ══════════════ Introducción ══════════════ */

function mostrarIntro() {
  UI.texto('intro-villano', `${config.villano?.cara || '🦜'} ${config.villano?.nombre || 'Un villano misterioso'}`);
  UI.mostrarPantalla('pantalla-intro');
  document.getElementById('btn-comenzar-mision').onclick = async () => {
    progreso.inicio = progreso.inicio || Date.now();
    Storage.guardar(progreso);
    await prepararTablero();
    UI.mostrarPantalla('pantalla-juego');
    Audio.reproducir('desbloqueo');
  };
}

/* ══════════════ Tablero principal ══════════════ */

async function prepararTablero() {
  // Datos del jugador en la cabecera
  const personaje = (config.personajes || []).find(p => p.id === progreso.personaje);
  UI.texto('jugador-nombre', progreso.jugador || 'Aventurero');
  document.getElementById('jugador-cara').textContent = personaje ? personaje.cara : '🙂';
  actualizarBotonSonido();

  await Mapa.cargarMapa(RUTA_MAPA, {
    nombres: config.areas || {},
    mostrarEtiquetas: config.opciones?.mostrarEtiquetas !== false,
    alTocarArea: mensaje => UI.avisar(mensaje)
  });

  pintarLetras();
  refrescarTablero();
}

/** Recalcula todo lo visible a partir del progreso. */
function refrescarTablero() {
  const total = config.clues.length;
  const hechas = progreso.completadas.length;
  const pista = pistaActual();

  // Progreso
  UI.texto('progreso-texto', pista
    ? `Pista ${Math.min(progreso.pistaActual, total)} de ${total}`
    : `¡${total} de ${total} pistas!`);
  document.getElementById('progreso-relleno').style.width = `${(hechas / total) * 100}%`;

  // Turnos en modo equipo
  const turno = document.getElementById('turno');
  if (progreso.modo === 'equipo' && progreso.equipo.length > 1) {
    const quien = progreso.equipo[progreso.turno % progreso.equipo.length];
    turno.textContent = `🔄 Le toca a ${quien}: lee la pista en voz alta y escanea`;
    turno.classList.remove('oculto');
  } else {
    turno.classList.add('oculto');
  }

  // Estados del mapa
  const idsCompletadas = [];
  config.clues.forEach(c => {
    if (progreso.completadas.includes(c.id)) {
      Mapa.estadoArea(c.areaId, 'completada');
      idsCompletadas.push(c.areaId);
    }
  });
  (progreso.areasDesbloqueadas || []).forEach(id => {
    if (!idsCompletadas.includes(id) && (!pista || pista.areaId !== id)) {
      Mapa.estadoArea(id, 'disponible');
    }
  });
  if (config.areaInicial && !idsCompletadas.includes(config.areaInicial)) {
    Mapa.estadoArea(config.areaInicial, 'disponible');
  }
  if (pista) {
    Mapa.estadoArea(pista.areaId, 'actual');
    Mapa.dibujarRuta([...idsCompletadas, pista.areaId]);
  } else {
    Mapa.dibujarRuta(idsCompletadas);
  }

  pintarMision();
  pintarLetras();
}

function pistaActual() {
  return config.clues.find(c => c.order === progreso.pistaActual) || null;
}

/* ─── Tarjeta de misión ─── */

function pintarMision() {
  const pista = pistaActual();
  const tarjeta = document.getElementById('mision');
  if (!pista) { tarjeta.classList.add('oculto'); return; }
  tarjeta.classList.remove('oculto');

  const personaje = (config.personajes || []).find(p => p.id === pista.character);
  UI.texto('mision-quien', personaje ? `${personaje.nombre} dice:` : 'Misión:');
  document.getElementById('mision-cara').textContent = personaje ? personaje.cara : '🗺️';
  UI.texto('mision-titulo', pista.title || `Pista ${pista.order}`);

  // Acertijo: normal o con linterna mágica
  const cajaLinterna = document.getElementById('linterna');
  const textoNormal = document.getElementById('mision-acertijo');
  if (pista.revelado === 'linterna') {
    textoNormal.classList.add('oculto');
    cajaLinterna.classList.remove('oculto');
    UI.texto('linterna-texto', pista.riddle);
    requestAnimationFrame(() => { linterna = UI.iniciarLinterna(cajaLinterna); });
  } else {
    cajaLinterna.classList.add('oculto');
    textoNormal.classList.remove('oculto');
    textoNormal.textContent = pista.riddle;
  }

  // Desafío previo (si existe y no se ha superado)
  const desafioPendiente = pista.challenge && !progreso.desafiosSuperados.includes(pista.id);
  document.getElementById('btn-abrir-desafio').classList.toggle('oculto', !desafioPendiente);
  document.getElementById('acciones-busqueda').classList.toggle('oculto', !!desafioPendiente);

  // Termómetro y ayuda
  document.getElementById('btn-temperatura').classList.toggle('oculto', !pista.temperatura);
  UI.texto('termometro-resultado', '');
  const usadas = progreso.ayudasUsadas[pista.id] || 0;
  const totalAyudas = (pista.hints || []).length;
  const btnAyuda = document.getElementById('btn-ayuda');
  btnAyuda.classList.toggle('oculto', totalAyudas === 0);
  btnAyuda.disabled = usadas >= totalAyudas;
  UI.texto('btn-ayuda-texto', usadas >= totalAyudas
    ? 'No hay más ayudas'
    : `Necesito una ayuda (${usadas}/${totalAyudas})`);
}

/* ─── Letras del cofre ─── */

function pintarLetras(nuevaLetra = false) {
  const palabra = config.opciones?.palabraFinal || '';
  if (!palabra) { document.getElementById('letras-cofre').classList.add('oculto'); return; }
  const cont = document.getElementById('letras-cofre');
  cont.innerHTML = '';
  for (let i = 0; i < palabra.length; i++) {
    const div = document.createElement('div');
    const letra = progreso.letras[i];
    div.className = 'letra' + (letra ? '' : ' letra--vacia');
    if (nuevaLetra && i === progreso.letras.length - 1) div.classList.add('letra--nueva');
    div.textContent = letra || '?';
    cont.appendChild(div);
  }
}

/* ══════════════ Desafíos ══════════════ */

function abrirDesafio() {
  const pista = pistaActual();
  if (!pista || !pista.challenge) return;
  const d = pista.challenge;
  const caja = document.getElementById('desafio-contenido');
  caja.innerHTML = '';

  if (d.tipo === 'opcion-multiple') {
    const preg = document.createElement('h3');
    preg.textContent = d.pregunta;
    caja.appendChild(preg);
    const lista = document.createElement('div');
    lista.className = 'desafio__opciones';
    d.opciones.forEach((op, i) => {
      const btn = document.createElement('button');
      btn.className = 'btn btn--bloque';
      btn.textContent = op;
      btn.addEventListener('click', () => {
        if (i === d.correcta) {
          superarDesafio(pista, d.mensajeExito || '¡Correcto!');
        } else {
          Audio.reproducir('incorrecto');
          btn.classList.add('anim-sacudida');
          UI.avisar(burlaDelVillano());
          setTimeout(() => btn.classList.remove('anim-sacudida'), 700);
        }
      });
      lista.appendChild(btn);
    });
    caja.appendChild(lista);
  } else if (d.tipo === 'fisico') {
    const p = document.createElement('p');
    p.textContent = d.mision;
    p.style.fontSize = 'var(--texto-lg)';
    caja.appendChild(p);
    const nota = document.createElement('p');
    nota.textContent = 'Un adulto o tu equipo puede confirmar que lo lograste. 😄';
    caja.appendChild(nota);
    const btn = document.createElement('button');
    btn.className = 'btn btn--aventura btn--bloque';
    btn.textContent = d.boton || '¡Misión completada!';
    btn.addEventListener('click', () => superarDesafio(pista, '¡Gran trabajo, pirata!'));
    caja.appendChild(btn);
  } else {
    // Tipo de desafío aún no implementado: no bloquear el juego.
    superarDesafio(pista, '');
    return;
  }
  UI.abrirModal('modal-desafio');
}

function superarDesafio(pista, mensaje) {
  progreso.desafiosSuperados.push(pista.id);
  Storage.guardar(progreso);
  UI.cerrarModal('modal-desafio');
  Audio.reproducir('correcto');
  Audio.vibrar(config.opciones?.vibracion ? 60 : 0);
  if (mensaje) UI.avisar(mensaje);
  pintarMision();
}

/* ══════════════ Ayudas ══════════════ */

function pedirAyuda() {
  const pista = pistaActual();
  if (!pista) return;
  const usadas = progreso.ayudasUsadas[pista.id] || 0;
  const ayudas = pista.hints || [];
  if (usadas >= ayudas.length) return;

  progreso.ayudasUsadas[pista.id] = usadas + 1;
  Storage.guardar(progreso);

  UI.texto('ayuda-numero', `Ayuda ${usadas + 1} de ${ayudas.length}`);
  UI.texto('ayuda-texto', ayudas[usadas]);
  UI.abrirModal('modal-ayuda');
  pintarMision();
}

/* ══════════════ Validación de códigos ══════════════ */

function validarCodigo(textoLeido) {
  const codigo = QR.normalizarCodigo(textoLeido);
  const pista = pistaActual();

  const porToken = config.clues.find(c => QR.normalizarCodigo(c.qrToken) === codigo);
  const porManual = config.clues.find(c => QR.normalizarCodigo(c.manualCode) === codigo);
  const encontrada = porToken || porManual;

  QR.cerrarEscaner();
  UI.cerrarModales();

  if (!encontrada) {
    progreso.intentosFallidos++;
    Storage.guardar(progreso);
    Audio.reproducir('incorrecto');
    Audio.vibrar(config.opciones?.vibracion ? [50, 60, 50] : 0);
    mostrarResultado('error', '¡Código equivocado!',
      'Este código no pertenece a esta aventura. Inténtalo otra vez.',
      burlaDelVillano());
    return;
  }

  if (progreso.completadas.includes(encontrada.id)) {
    mostrarResultado('info', 'Pista ya completada',
      'Esta pista ya fue completada. Revisa el mapa para continuar.', '');
    return;
  }

  if (pista && encontrada.order > pista.order) {
    mostrarResultado('info', '¡Pista secreta!',
      '¡Encontraste una pista antes de tiempo! Déjala en su lugar y completa primero la misión actual.',
      '');
    return;
  }

  // ✔ Código correcto de la pista actual
  completarPista(encontrada);
}

function completarPista(pista) {
  progreso.completadas.push(pista.id);
  if (pista.letra) progreso.letras.push(pista.letra);
  if (pista.unlocksArea && !progreso.areasDesbloqueadas.includes(pista.unlocksArea)) {
    progreso.areasDesbloqueadas.push(pista.unlocksArea);
  }
  progreso.pistaActual = pista.order + 1;
  if (progreso.modo === 'equipo' && progreso.equipo.length > 1) progreso.turno++;
  Storage.guardar(progreso);

  Audio.reproducir('correcto');
  Audio.vibrar(config.opciones?.vibracion ? [60, 40, 120] : 0);
  UI.confeti(false);

  Mapa.estadoArea(pista.areaId, 'completada', true);
  const esLaUltima = progreso.completadas.length === config.clues.length;

  mostrarResultado('exito',
    pista.successMessage || '¡Pista encontrada!',
    pista.letra ? `¡Ganaste la letra "${pista.letra}" para abrir el cofre!` : '',
    '',
    esLaUltima ? '¡Abrir el Cofre Dorado!' : 'Siguiente misión',
    () => {
      UI.cerrarModales();
      refrescarTablero();
      pintarLetras(true);
      if (esLaUltima) {
        abrirCofre();
      } else {
        Audio.reproducir('desbloqueo');
        UI.avisar('🗺️ ¡Una nueva zona apareció en el mapa!');
      }
    });
}

/* ─── Cofre final: escribir la palabra con las letras ganadas ─── */

function abrirCofre() {
  const palabra = QR.normalizarCodigo(config.opciones?.palabraFinal || '');
  if (!palabra) { terminarJuego(); return; }

  UI.texto('cofre-mensaje', config.treasure?.message ||
    'Escribe la palabra secreta con las letras que ganaste.');
  const input = document.getElementById('cofre-palabra');
  input.value = '';
  UI.abrirModal('modal-cofre');

  document.getElementById('btn-abrir-cofre').onclick = () => {
    if (QR.normalizarCodigo(input.value) === palabra) {
      UI.cerrarModal('modal-cofre');
      terminarJuego();
    } else {
      Audio.reproducir('incorrecto');
      input.classList.add('anim-sacudida');
      UI.avisar('Mira las letras que ganaste y ordénalas 👀');
      setTimeout(() => input.classList.remove('anim-sacudida'), 700);
    }
  };
}

/* ══════════════ Victoria ══════════════ */

function terminarJuego() {
  progreso.fin = progreso.fin || Date.now();
  Storage.guardar(progreso);
  Mapa.revelarTodo();
  mostrarVictoria();
}

function mostrarVictoria() {
  const totalAyudas = Object.values(progreso.ayudasUsadas).reduce((a, b) => a + b, 0);
  const estrellas = !config.opciones?.sistemaEstrellas ? null
    : totalAyudas === 0 ? 3 : totalAyudas === 1 ? 2 : 1;
  const minutos = progreso.fin && progreso.inicio
    ? Math.max(1, Math.round((progreso.fin - progreso.inicio) / 60000))
    : null;

  UI.texto('victoria-nombre', progreso.jugador || 'Aventurero');
  UI.texto('victoria-tiempo', minutos ? `Duración de la aventura: ${minutos} min` : '');
  UI.texto('victoria-ayudas', `Ayudas usadas: ${totalAyudas}`);
  const cajaEstrellas = document.getElementById('victoria-estrellas');
  if (estrellas === null) {
    cajaEstrellas.classList.add('oculto');
  } else {
    cajaEstrellas.classList.remove('oculto');
    cajaEstrellas.textContent = '⭐'.repeat(estrellas) + '☆'.repeat(3 - estrellas);
    cajaEstrellas.setAttribute('aria-label', `${estrellas} de 3 estrellas`);
  }

  // Insignias
  const insignias = [{ icono: '🗺️', nombre: 'Explorador Total' }];
  if (totalAyudas === 0) insignias.push({ icono: '🦅', nombre: 'Ojo de Águila' });
  if (minutos !== null && minutos <= 15) insignias.push({ icono: '⚡', nombre: 'Rayo Veloz' });
  if (progreso.intentosFallidos >= 3) insignias.push({ icono: '💪', nombre: 'Pirata Persistente' });
  const cajaIns = document.getElementById('victoria-insignias');
  cajaIns.innerHTML = '';
  insignias.forEach(ins => {
    const div = document.createElement('div');
    div.className = 'insignia';
    div.innerHTML = `<div class="insignia__icono" aria-hidden="true">${ins.icono}</div>
                     <div class="insignia__nombre">${ins.nombre}</div>`;
    cajaIns.appendChild(div);
  });

  // Diploma imprimible
  const personaje = (config.personajes || []).find(p => p.id === progreso.personaje);
  UI.texto('diploma-nombre', progreso.jugador || 'Aventurero');
  UI.texto('diploma-personaje', personaje ? `Con la ayuda de ${personaje.nombre} ${personaje.cara}` : '');
  UI.texto('diploma-estrellas', estrellas ? '⭐'.repeat(estrellas) : '⭐⭐⭐');
  UI.texto('diploma-fecha', new Date(progreso.fin || Date.now()).toLocaleDateString('es', {
    day: 'numeric', month: 'long', year: 'numeric'
  }));

  UI.mostrarPantalla('pantalla-victoria');
  Audio.reproducir('victoria');
  UI.confeti(true);
}

/* ══════════════ Villano ══════════════ */

function burlaDelVillano() {
  const burlas = config.villano?.burlas || ['¡Inténtalo otra vez!'];
  return burlas[Math.floor(Math.random() * burlas.length)];
}

/* ══════════════ Modal de resultado ══════════════ */

function mostrarResultado(tipo, titulo, detalle, burla, botonTexto = 'Continuar', alContinuar = null) {
  const caja = document.getElementById('resultado');
  caja.className = 'resultado resultado--' + (tipo === 'exito' ? 'exito' : tipo === 'error' ? 'error' : 'info');
  document.getElementById('resultado-icono').textContent =
    tipo === 'exito' ? '🎉' : tipo === 'error' ? '🦜' : '🤔';
  UI.texto('resultado-titulo', titulo);
  UI.texto('resultado-detalle', detalle);
  UI.texto('resultado-loro', burla);
  const btn = document.getElementById('btn-resultado-ok');
  btn.textContent = botonTexto;
  btn.onclick = alContinuar || (() => UI.cerrarModal('modal-resultado'));
  UI.abrirModal('modal-resultado');
}

/* ══════════════ Botones globales ══════════════ */

function prepararBotonesGlobales() {
  // Escáner
  document.getElementById('btn-escanear').addEventListener('click', () => {
    UI.abrirModal('modal-escaner');
    UI.texto('escaner-estado', 'Abriendo la cámara…');
    QR.abrirEscaner(
      texto => { UI.texto('escaner-estado', 'Revisando el código…'); validarCodigo(texto); },
      mensajeError => {
        UI.texto('escaner-estado', mensajeError);
        document.getElementById('btn-manual-desde-escaner').classList.remove('oculto');
      }
    );
  });
  document.getElementById('btn-cerrar-escaner').addEventListener('click', () => {
    QR.cerrarEscaner();
    UI.cerrarModal('modal-escaner');
  });
  document.getElementById('btn-manual-desde-escaner').addEventListener('click', () => {
    QR.cerrarEscaner();
    UI.cerrarModal('modal-escaner');
    UI.abrirModal('modal-manual');
  });

  // Código manual
  document.getElementById('btn-manual').addEventListener('click', () => {
    document.getElementById('codigo-manual').value = '';
    UI.abrirModal('modal-manual');
    document.getElementById('codigo-manual').focus();
  });
  document.getElementById('btn-validar-manual').addEventListener('click', () => {
    const valor = document.getElementById('codigo-manual').value;
    if (!QR.normalizarCodigo(valor)) { UI.avisar('Escribe el código de la tarjeta ✏️'); return; }
    validarCodigo(valor);
  });
  document.getElementById('codigo-manual').addEventListener('keydown', e => {
    if (e.key === 'Enter') document.getElementById('btn-validar-manual').click();
  });

  // Ayudas, desafío y termómetro
  document.getElementById('btn-ayuda').addEventListener('click', pedirAyuda);
  document.getElementById('btn-abrir-desafio').addEventListener('click', abrirDesafio);
  document.getElementById('btn-temperatura').addEventListener('click', () => {
    const pista = pistaActual();
    if (pista && pista.temperatura) {
      UI.texto('termometro-resultado', pista.temperatura);
    }
  });

  // Cerrar modales genéricos
  document.querySelectorAll('[data-cerrar-modal]').forEach(btn => {
    btn.addEventListener('click', () => UI.cerrarModal(btn.dataset.cerrarModal));
  });

  // Sonido
  document.getElementById('btn-sonido-juego').addEventListener('click', () => {
    progreso.sonido = !progreso.sonido;
    Audio.activarSonido(progreso.sonido);
    Storage.guardar(progreso);
    actualizarBotonSonido();
    UI.avisar(progreso.sonido ? 'Sonidos activados 🔊' : 'Sonidos silenciados 🔇');
  });

  // Victoria
  document.getElementById('btn-ver-mapa').addEventListener('click', () => {
    Mapa.revelarTodo();
    UI.mostrarPantalla('pantalla-juego');
    document.getElementById('mision').classList.add('oculto');
    UI.avisar('🗺️ Mapa completo revelado. ¡La X marca el tesoro!');
  });
  document.getElementById('btn-imprimir-diploma').addEventListener('click', () => window.print());
  document.getElementById('btn-jugar-otra-vez').addEventListener('click', () => {
    if (confirm('¿Empezar una nueva aventura? El progreso actual se borrará.')) {
      Storage.borrar(config.gameId);
      location.href = 'juego.html';
    }
  });
}

function actualizarBotonSonido() {
  const btn = document.getElementById('btn-sonido-juego');
  btn.textContent = progreso.sonido ? '🔊' : '🔇';
  btn.setAttribute('aria-label', progreso.sonido ? 'Silenciar sonidos' : 'Activar sonidos');
}

/* ══════════════ Errores para el adulto ══════════════ */

function errorAdmin(mensaje) {
  const caja = document.getElementById('error-admin');
  caja.classList.remove('oculto');
  caja.querySelector('p').textContent = mensaje;
  UI.mostrarPantalla('pantalla-error');
}

/* ══════════════ Modo de prueba (?debug=true) ══════════════ */

function prepararDebug() {
  const panel = document.createElement('div');
  panel.className = 'debug';
  panel.innerHTML = '<strong>DEBUG</strong>';
  const acciones = [
    ['Ver IDs', () => {
      document.querySelectorAll('.area').forEach(a => {
        UI.avisar([...document.querySelectorAll('.area')].map(x => x.dataset.area).join(' · '), 6000);
      });
    }],
    ['Código OK', () => { const p = pistaActual(); if (p) validarCodigo(p.qrToken); }],
    ['Avanzar', () => { const p = pistaActual(); if (p) completarPista(p); }],
    ['Retroceder', () => {
      const ultima = progreso.completadas.pop();
      if (ultima) {
        const pista = config.clues.find(c => c.id === ultima);
        progreso.pistaActual = pista.order;
        progreso.letras.pop();
        Storage.guardar(progreso);
        refrescarTablero();
      }
    }],
    ['Revelar mapa', () => Mapa.revelarTodo()],
    ['Borrar guardado', () => { Storage.borrar(config.gameId); location.reload(); }],
    ['Estado', () => { console.log('Estado actual:', JSON.parse(JSON.stringify(progreso))); UI.avisar('Estado impreso en la consola'); }]
  ];
  acciones.forEach(([nombre, fn]) => {
    const b = document.createElement('button');
    b.textContent = nombre;
    b.addEventListener('click', fn);
    panel.appendChild(b);
  });
  document.body.appendChild(panel);
}
