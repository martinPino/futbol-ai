# SUPER LIGA 26 — juego de fútbol 3D (three.js)

Juego de fútbol estilo arcade-realista que corre en el navegador. Sin build, sin `npm install`: three.js se carga desde CDN mediante un *import map* y todo el motor vive en `football-game.html` más unos módulos ES.

## Ejecutar

```bash
git clone https://github.com/martinPino/futbol-ai.git
cd futbol-ai
npx serve .          # o: python3 -m http.server 8080
# → http://localhost:8080/football-game.html
```

Hace falta un servidor estático (no `file://`) porque el juego carga módulos ES y modelos GLB/FBX. El clon pesa unos 140 MB por los assets 3D; no hay ningún paso de build.

## Controles

| Tecla | Acción |
|---|---|
| WASD / flechas | mover · en tiro libre: apuntar (A/D) y altura (W/S) |
| ESPACIO (mantener) | cargar y disparar · A/D mientras cargas: rosca |
| ESPACIO sin balón | barrida |
| X | pase raso · Z: pase bombeado / centro |
| SHIFT | sprint |
| Q / C / N / B / P | cambiar jugador · cámara · noche · estadio · pausa |
| R | panel VAR (motivo de cada decisión del árbitro) |
| H | público on/off |

**Móvil/tablet**: joystick táctil + botones DISPARO, PASE, BOMBEO, CAMBIAR, SPRINT; deslizador de rosca en jugadas detenidas.

## Estructura

### Motor y módulos del juego

- `football-game.html` — motor: física del balón (Magnus), IA, arquero (predicción + atajadas), árbitro (faltas/tarjetas/ventaja), jugadas detenidas, cámaras, HUD, controles táctiles.
- `player-rig.js` — animador procedural (locomoción, patada, barrida, caídas, atajadas, tarjetas).
- `mocap.js` / `mocap-layer.js` — retarget de la Universal Animation Library (Quaternius, CC0) al esqueleto de los jugadores.
- `team-models.js` / `hero-models.js` — modelos FBX de jugadores y estrellas.
- `football-kit-models.js` — estadio procedural, campo PBR 4K, porterías, balón.
- `stadium-model.js` — carga de estadios GLB (Al Wakrah, Euro Arena) en trozos gzip.
- `crowd-flags.js` — público instanciado sobre butacas reales + banderas.

### Páginas de desarrollo y previsualización

Páginas sueltas para inspeccionar piezas del juego de forma aislada. Se abren igual que el juego, desde el servidor estático.

- `football-kit.html` — estadio procedural, equipaciones y balón.
- `estadio-real.html` — modelo real del estadio Al Wakrah.
- `stadium-align.html` — alineación del estadio GLB con el campo.
- `estrellas.html` — previsualización de los modelos de jugadores estrella.
- `crowd-test.html` — prueba del público y las banderas.
- `anim-inspect.html` / `goal-inspect.html` — inspección de animaciones y de la portería.
- `three-d-stage.js` / `support.js` — visor 3D (`<three-d-stage>`) con órbita, luces de estudio y exportación OBJ/GLB que usan las páginas anteriores. `support.js` es un bundle generado; no editar a mano.

### Assets (`assets/`)

| Carpeta | Contenido |
|---|---|
| `anim/` | Universal Animation Library (GLB) |
| `ball/`, `goal/` | balón y red de la portería (GLB) |
| `grass/` | texturas PBR del césped (color, normal, roughness, AO, displacement) |
| `players/` | modelos FBX de jugadores estrella |
| `stadium/` | estadios Al Wakrah (`wc1`) y Euro Arena (`euro`) como GLB gzip partidos en dos trozos |

Las carpetas `uploads/`, `screenshots/` y `Tools/` son material de trabajo local y están en `.gitignore`.

## Créditos de assets

- Universal Animation Library — Quaternius (CC0)
- Grass004 — ambientCG (CC0)
- Estadios y modelos de jugadores — descargados por el autor de Sketchfab (ver licencias respectivas)

## Licencia

El código se publica bajo licencia MIT (ver `LICENSE`). Los assets 3D y texturas conservan las licencias de sus autores indicadas arriba.
