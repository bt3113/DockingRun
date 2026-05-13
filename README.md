# Docking Run

**Docking Run** is a mobile/web cinematic browser game built with WebGL and Three.js.

The game is about high-risk orbital flight, data recovery, time-dilation scoring, and a final docking sequence. It uses original visuals and procedural WebGL effects.

## Current build

- Mobile and desktop browser support
- WebGL / Three.js rendering
- Shader-based accretion disk visual
- 3D starfield
- 3D spacecraft
- 3D rotating station
- Data packet collection
- Debris hazards
- Hull and fuel systems
- Risk-based dilation multiplier
- Final docking mini-game
- Local best score
- Copyable scorecard
- GitHub Pages workflow

## Play locally

Serve the repo with a local web server:

```bash
python3 -m http.server 5173
```

Open:

```text
http://localhost:5173
```

## Controls

### Desktop

- **A**: steer left
- **D**: steer right
- **W** or **Space**: burn
- **E** or **Enter**: dock / confirm
- **R**: restart from score screen

### Mobile

Use the on-screen controls below the game.

## Gameplay

1. Launch into orbit.
2. Fly closer to the gravity well for a higher multiplier.
3. Collect data packets.
4. Avoid debris and hull damage.
5. Enter the docking corridor.
6. Match station alignment and dock.
7. Copy and share your scorecard.

## Deployment

This repo includes `.github/workflows/pages.yml`.

To publish:

1. Go to **Settings → Pages**.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main`.

## License

MIT License. See [`LICENSE`](LICENSE).
