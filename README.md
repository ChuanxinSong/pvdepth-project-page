# PVDepth project page

Project website for **PVDepth: Panoramic Video Depth Estimation via Geometry-Aware Spatiotemporal Adaptation** (ICML 2026).

- Website: https://chuanxinsong.github.io/pvdepth-project-page/
- Paper: https://proceedings.mlr.press/v306/song26u.html
- Model code: https://github.com/ChuanxinSong/PVDepth
- PanoCARLA: https://huggingface.co/datasets/Soon122/PanoCARLA
- PanoCARLA-Static: https://huggingface.co/datasets/Soon122/PanoCARLA-Static

## Development

This is a buildless static website. Edit `index.html`, `styles.css`, `showcase.css`, `app.js`, and `showcase.js` directly. Images and videos are in `assets/`.

For local preview, run `python -m http.server 8765` from this directory and visit `http://localhost:8765/`.

## Deployment

GitHub Pages serves the root of this repository's `main` branch. Pushing a commit to `main` automatically updates the website. `.nojekyll` bypasses Jekyll processing. Keep all site-relative asset paths relative so the page works under `/pvdepth-project-page/`.

Videos are committed as ordinary Git files, not Git LFS pointers. Keep the `-filter` rule in `.gitattributes` when updating assets.

The research code remains in the separate [PVDepth repository](https://github.com/ChuanxinSong/PVDepth).

Figures and videos retain their original owners' rights. Refer to the paper, code repository, and dataset pages for their respective terms.

## Real-world examples

The gallery uses the following supplied visualization videos, in display order:

| Source file | Scene |
| --- | --- |
| `200033_vis.mp4` | Kitesurfing |
| `101648_vis.mp4` | Icebreaker |
| `200038_vis.mp4` | Street |
| `200055_vis.mp4` | Walkway |
| `200058_vis.mp4` | Shopping mall |
| `200139_vis.mp4` | Coastal fort |

Each source is a 1024 × 1024 video with RGB in the top half and the depth visualization in the bottom half. The two halves are cropped into synchronized 1024 × 512 videos, retaining all 100 frames at 20 fps (five seconds), the original depth colors, and source watermarks. Posters use the first frame. The shopping-mall example is indoors; training uses outdoor PanoCARLA data.
