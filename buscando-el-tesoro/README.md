# 🏴‍☠️ Buscando el Tesoro — Una aventura Divertoons

Juego web de búsqueda del tesoro para niños: siguen un mapa pirata de la casa en el celular, resuelven acertijos con los personajes de Divertoons y escanean códigos QR escondidos en lugares reales hasta abrir el Cofre Dorado.

Es un sitio 100% estático (HTML + CSS + JavaScript). No necesita servidor, base de datos ni compilación.

---

## 🚀 Probarlo en tu computadora

La página **no funciona abriendo el archivo con doble clic** (`file://`), porque el navegador bloquea la carga del mapa y del JSON por seguridad. Necesitas un mini servidor local. Opciones:

**Con Python (ya viene en la mayoría de sistemas):**

```
cd buscando-el-tesoro
python -m http.server 8000
```

Luego abre `http://localhost:8000` en el navegador.

**Con VS Code:** instala la extensión *Live Server*, clic derecho en `index.html` → "Open with Live Server".

> 📷 **Nota sobre la cámara:** el escáner QR requiere HTTPS o `localhost`. En tu computadora con `localhost` funciona; en el celular dentro de tu casa (por IP local, ej. `http://192.168.x.x:8000`) la cámara puede bloquearse por ser HTTP. La prueba definitiva hazla ya publicado en divertoons.com, que tiene HTTPS. Mientras tanto, el botón "Escribir código" siempre funciona como respaldo.

---

## 🌐 Publicarlo en divertoons.com (GitHub Pages)

1. Copia la carpeta **`buscando-el-tesoro/`** completa dentro de la carpeta de tu sitio (`D:\Divertoons web\site\`), al mismo nivel que `index.html`, `about.html`, etc.
2. Haz commit y push como siempre.
3. Listo: el juego quedará en **`https://www.divertoons.com/buscando-el-tesoro/`**
   - Generador de tarjetas: `.../buscando-el-tesoro/generador-qr.html`
   - Configurador: `.../buscando-el-tesoro/configurador.html`
   - Modo de prueba: `.../buscando-el-tesoro/juego.html?debug=true`

Si quieres, agrega un botón en tu página principal que enlace a `/buscando-el-tesoro/`.

---

## 🃏 Preparar el juego físico (el adulto)

1. Abre **`generador-qr.html`**. Genera una tarjeta imprimible por cada pista, con su QR y su código manual de respaldo.
2. Cada tarjeta trae una franja "✂️ Solo para el adulto" que dice **dónde esconderla** — recórtala o dóblala antes de esconder la tarjeta. También puedes imprimir sin esa franja (hay una casilla para eso).
3. Esconde las tarjetas en los lugares indicados. La primera pista se lee en el propio juego, así que no necesitas tarjeta de inicio.
4. Los QR **solo contienen un código del juego** (ej. `DT-001-P1-X7K9`). No llevan direcciones, nombres ni ningún dato personal.

---

## ✏️ Cambiar las pistas y los escondites

Todo el contenido vive en **`data/aventura-001.json`**. Dos formas de editarlo:

**A) Con el configurador (recomendado):** abre `configurador.html`, carga la aventura, edita/añade/reordena pistas y descarga el JSON nuevo. Como la página es estática **no puede guardar sola en el servidor**: sube tú el archivo descargado a la carpeta `data/` reemplazando el anterior.

**B) A mano:** edita el JSON con cualquier editor de texto. Campos de cada pista:

| Campo | Qué es |
|---|---|
| `riddle` | El acertijo que leen los niños |
| `areaId` | La zona del mapa donde está escondida (ver lista abajo) |
| `qrToken` | El texto que contiene el QR |
| `manualCode` | Código corto de respaldo (ej. `XAN-482`) |
| `letra` | Letra que gana el niño (entre todas forman `opciones.palabraFinal`) |
| `unlocksArea` | Zona del mapa que se revela al completarla |
| `hints` | Hasta 3 ayudas, de sutil a directa |
| `temperatura` | Texto del botón "¿Frío o caliente?" (opcional) |
| `revelado` | `"normal"` o `"linterna"` (el acertijo se alumbra con el dedo) |
| `challenge` | Desafío previo opcional: `opcion-multiple` o `fisico` |

**Zonas disponibles del mapa** (`areaId`): `dormitorio-principal`, `bano-principal`, `dormitorio-2`, `sala`, `cocina`, `pasillo`, `entrada`, `patio`, `bano-2`, `dormitorio-3`. Los nombres que ven los niños se cambian en la sección `"areas"` del JSON, sin tocar el SVG.

⚠️ **Después de cualquier cambio de pistas o códigos, vuelve a imprimir las tarjetas.** El configurador sube el número de `version` automáticamente: eso hace que los progresos guardados con la versión vieja pidan reiniciar (a propósito, para que nadie quede a mitad de juego con pistas que ya no existen).

---

## 🗺️ El mapa

`assets/maps/mapa-casa.svg` está dibujado siguiendo el plano real de la casa. Cada habitación es un grupo `<g class="area" data-area="...">`. Para ajustar tamaños o agregar habitaciones, edita ese SVG (cualquier editor sirve, incluso texto). El juego pinta automáticamente los estados: 🔒 bloqueada → 👀 descubierta → ⭐ pista actual → ✅ completada, más la ruta punteada y la ✕ del tesoro.

## 🎨 Colores y personajes

- **Colores:** todos centralizados en `css/variables.css`.
- **Personajes:** por ahora usan emojis (🔵 Xan, 🌞 Soli, 🏴‍☠️ Piri). Cuando tengas los PNG de tus personajes reales, guárdalos en `assets/characters/` y reemplaza los emojis en el JSON/HTML.
- **Logo:** `assets/img/logo.png`.

## 🔊 Sonidos (opcionales)

El juego busca estos archivos en `assets/audio/` y, si no existen, simplemente no suena nada (no da error):

`inicio.mp3` · `pista-correcta.mp3` · `codigo-incorrecto.mp3` · `zona-desbloqueada.mp3` · `victoria.mp3`

Puedes descargar efectos gratuitos (por ejemplo de pixabay.com) y renombrarlos así.

## 🧪 Modo de prueba

Abre `juego.html?debug=true` para ver un panel con: simular código correcto, avanzar/retroceder pista, revelar el mapa, borrar el guardado y ver el estado en consola. Sin ese parámetro, el panel no existe.

## 💾 Progreso y varios celulares

El avance se guarda en el propio teléfono (localStorage): si se cierra el navegador, al volver aparece "Continuar aventura". **No se sincroniza entre teléfonos** — eso requeriría un servidor. Para jugar en grupo con un solo teléfono está el modo equipo, que va rotando los turnos.

## ❓Problemas frecuentes

- **"No se pudo cargar…"** → estás abriendo con `file://` o falta el archivo. Usa un servidor local o el sitio publicado.
- **La cámara no abre** → revisa permiso de cámara del navegador; en iPhone debe ser Safari o dar permiso a Chrome. Siempre queda "Escribir código".
- **Cambié pistas y el juego pide reiniciar** → correcto: la versión del JSON subió. Reinicia desde la portada.
- **Quiero borrar el progreso de un niño** → portada → "Reiniciar aventura" (o el panel debug).

---

Hecho con ❤️ para Divertoons · www.divertoons.com
