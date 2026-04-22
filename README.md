# Magic Sound Lab

Aplicacion web interactiva para crear musica con gestos de manos usando MediaPipe Hands y Web Audio API.

## Estructura

- `index.html`: punto de entrada.
- `src/styles/main.css`: estilos principales.
- `src/scripts/app.js`: logica de camara, deteccion de gestos y UI.
- `src/scripts/soundinstrument.js`: motor de instrumentos y reproduccion de notas.
- `assets/`: carpeta reservada para imagenes, audio y recursos estaticos.

## Ejecutar local

Abre `index.html` con un servidor local (recomendado), por ejemplo Live Server en VS Code/Cursor.

## Notas

- Permite acceso a la camara cuando el navegador lo solicite.
- Si no suena audio al principio, interactua con la pagina (click) para activar el contexto de audio.
