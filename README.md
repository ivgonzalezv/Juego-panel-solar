# ☀️ HELIOS TRACKER · Mixed Reality Solar Lab

Juego interactivo de **realidad mixta (merged reality)** donde operas un sistema solar real:
**panel 20W · 18V** + **servo de seguimiento 180°** + **batería Li-ion 12V 10Ah** + **3 salidas USB** cargando celulares.

El sol cruza el cielo de 06:00 a 20:00, el servo lo persigue, el panel genera energía
y los celulares se cargan en vivo. Tú controlas el clima, el servo y el tiempo.

![React](https://img.shields.io/badge/React-19-61dafb?logo=react)
![Vite](https://img.shields.io/badge/Vite-7-646cff?logo=vite)
![TailwindCSS](https://img.shields.io/badge/Tailwind-4-38bdf8?logo=tailwindcss)
![TypeScript](https://img.shields.io/badge/TypeScript-5-3178c6?logo=typescript)

## 🎮 Cómo se juega

- El **sol se arrastra** para viajar en el tiempo solar.
- El **servo** sigue al sol en modo **AUTO**, o toma el control en modo **MANUAL**
  (arrastra el panel o usa el deslizador, mantén el error < 6°).
- **Toca las nubes** para disiparlas, invoca rachas de nubes, tormentas de polvo
  y olas de calor: todo afecta la potencia real (W).
- **Clic en cada celular** para conectar/desconectar su USB. Al 100% ganas +60 XP.
- **Limpia el panel** cuando el polvo baje la eficiencia.
- Completa las **5 misiones**, sube de nivel y acumula Wh antes del atardecer.
- Activa **MR Cámara** 📷 para fusionar tu mundo real con el laboratorio (merged reality).

| Control | Acción |
|---|---|
| `Espacio` | Pausar / reanudar |
| `←` / `→` | Viajar en el tiempo |
| Arrastrar ☀️ | Cambiar la hora solar |
| Arrastrar panel (MANUAL) | Orientar el servo |

## 🚀 Ejecutar en local

Necesitas [Node.js](https://nodejs.org/) 18 o superior.

```bash
npm install     # instalar dependencias
npm run dev     # jugar en http://localhost:5173
npm run build   # compilar a dist/ (archivo único, listo para publicar)
```


## 📁 Estructura

```
src/
├── App.tsx               # Bucle de juego, física y estado global
├── game/engine.ts        # Sol, servo, energía, misiones, audio
├── components/Scene.tsx  # Escena 3D interactiva (cielo, panel, batería, celulares)
└── components/HudPanels.tsx  # Telemetría, controles, clima y misiones
```

## ⚡ Física simulada

- Azimut/elevación solar según la hora · seguimiento servo 180°
- Potencia = 20W × irradiancia × cos(error) × derating térmico × polvo
- Batería 120 Wh · celulares 15 Wh · carga USB ≈ 3.2 W por puerto

Hecho con fotones ☀️ — proyecto educativo de energía solar y realidad mixta.
