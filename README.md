# Cornfield Drone Run

A simple mobile-first web game built with plain HTML, CSS, and JavaScript. It is designed to run directly on GitHub Pages with no backend, no build step, and no external assets.

## Game concept

Drive through a cornfield and chase a drone before the timer expires. Collect signal pings to gain time and boost charge. Avoid hay bales, rocks, and broken fence posts.

This project uses an original cornfield drone chase theme and does not include movie names, characters, logos, dialogue, music, or protected assets.

## Controls

- Mobile: drag left or right to steer, tap and hold the lightning button to boost.
- Desktop: use `A` / `D` or arrow keys to steer, hold `Space` to boost, press `P` to pause.

## Files

- `index.html` - app markup and UI panels
- `style.css` - responsive mobile UI styling
- `game.js` - Canvas rendering, controls, gameplay, collisions, and state management
- `.github/workflows/pages.yml` - GitHub Pages deployment workflow

## Deploy on GitHub Pages

The included workflow publishes the repository root as a static GitHub Pages site whenever changes are pushed to `main`. In repository settings, make sure Pages is set to deploy from GitHub Actions.
