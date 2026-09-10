repo: martinPino/futbol-ai
branch: main

## Last sync
date: 2026-09-10T06:49:47Z
commit: e0132afe8a26
### Updated in this project
- Fix móvil: los controles táctiles se mostraban sobre el menú de inicio y tapaban JUGAR (ahora solo aparecen con `body.playing`). Selector de estadio convertido en slider con orden Al Wakrah · Euro Arena · Estadio Central (commit e0132afe8a26).
- Publicado en Vercel: proyecto `futbol-ai` (equipo martinpinos-projects), producción https://futbol-ai-alpha.vercel.app. `vercel.json` reescribe `/` a `football-game.html`; `.vercel` y `.env*` ignorados. Deploy manual con `npx vercel deploy --prod` (repo no conectado a Vercel todavía).
- Tercer push: eliminados por indicación del usuario LICENSE, three-d-stage.js y assets/stadium/raw-model.bin (commit e08aee2f6223). Nota: football-kit.html, estadio-real.html y estrellas.html siguen referenciando three-d-stage.js.
- Segundo push (commit 5c1a65e73c75): mejoras del HUD táctil en football-game.html (barra de potencia flotante sobre el jugador, barra de esquina sobre el joystick, ayuda de gestos en el menú, ocultar medidores/radar/teclas en táctil).
- Primer push (commit 7d7575898e1e): juego completo, módulos, páginas de previsualización, assets y README ampliado.
- Identidad git de este repo fijada en local (`git config --local user.email`), sin tocar la config global.

## Screen map
| Screen | Repo files |
|---|---|
| football-game.html | football-game.html |
| football-kit.html | football-kit.html, support.js |
| estadio-real.html | estadio-real.html, stadium-model.js |
| estrellas.html | estrellas.html, hero-models.js, player-rig.js |
