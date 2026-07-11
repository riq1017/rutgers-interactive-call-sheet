# Play-Art Integration

This build includes a static SVG diagram for every current Rutgers play record.

## Behavior

- Best Call and Top Plays load the diagram assigned to that play.
- Every play has a local `diagramPath`.
- Missing or broken assets fall back to a formation schematic.
- Assets are lightweight SVG files and work on GitHub Pages.

## Accuracy labels

Current assets are marked `partial` / **Concept matched**. They are designed from the verified play name, formation, and concept family. They are not claimed to be exact in-game route art.

Future exact diagrams can replace individual SVG files without changing the engine or UI.
