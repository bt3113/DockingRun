# Docking Run

**Docking Run** is a small open-source browser game inspired by cinematic hard-science-fiction themes: black-hole gravity, time dilation, limited fuel, data recovery, and a final docking maneuver.

This is an unofficial fan project. It does not use film logos, music, characters, dialogue, or copyrighted movie assets.

## Play locally

No build step is required.

```bash
python3 -m http.server 5173
```

Then open:

```text
http://localhost:5173
```

## Controls

- **W / Arrow Up / Space**: burn engine
- **A / Arrow Left**: rotate left
- **D / Arrow Right**: rotate right
- **E / Enter**: dock / confirm
- **R**: restart from score screen

Mobile controls are built into the page.

## Gameplay

1. Fly near the black hole to increase your dilation multiplier.
2. Collect data packets.
3. Avoid debris and the event horizon.
4. Save enough fuel for final docking.
5. Match the rotating station and dock for a large bonus.

## Scoring

Your final score is based on data recovered, survival time, best dilation multiplier, final docking grade, remaining fuel, and hull damage penalties.

Scores are stored locally in the player’s browser. A global leaderboard can be added later with Supabase, Firebase, or another small backend.

## Deploying with GitHub Pages

This repository includes a GitHub Actions workflow at `.github/workflows/pages.yml`.

To publish:

1. Go to **Settings → Pages** in this repository.
2. Set **Build and deployment → Source** to **GitHub Actions**.
3. Push to `main`.
4. The site should deploy from the workflow.

## Roadmap

- Shareable score image
- Optional global leaderboard
- More mission modes
- Daily challenge seed
- Sound effects using original generated tones, not copyrighted audio

## License

MIT License. See [`LICENSE`](LICENSE).
