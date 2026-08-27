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

## Pruebas

Las pruebas unitarias usan Vitest con entorno jsdom y cobertura v8.

```bash
npm install
npm test              # ejecuta la suite
npm run test:watch    # modo interactivo
npm run test:coverage # reporte de cobertura (texto, html y lcov en coverage/)
```

Los scripts de `src/scripts/` se cargan como scripts de navegador dentro de jsdom:
`soundinstrument.js` se prueba por su API publica y `app.js` se prueba a traves del
DOM real de `index.html`, con MediaPipe (`Hands`, `Camera`) y Web Audio simulados.

## Notas

- Permite acceso a la camara cuando el navegador lo solicite.
- Si no suena audio al principio, interactua con la pagina (click) para activar el contexto de audio.
