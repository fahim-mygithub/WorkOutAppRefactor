# Muscle Group Icon Credits

All seven SVG glyphs in this directory are derived from
[Tabler Icons](https://tabler.io/icons), distributed under the
[MIT License](https://github.com/tabler/tabler-icons/blob/main/LICENSE).

The MIT license does not require attribution; this file is kept for
transparency about provenance and to make future audits easier.

The original SVG path data is embedded inline in each component (no runtime
dependency on an icon library). Tabler is stroke-based, so each path
preserves `stroke="currentColor"` with `fill="none"` on the parent `<svg>`
so callers can tint via Tailwind `text-muscle-{group}` utilities.

| Muscle group | Tabler icon | Source URL                              |
| ------------ | ----------- | --------------------------------------- |
| push         | barbell     | https://tabler.io/icons/icon/barbell    |
| pull         | weight      | https://tabler.io/icons/icon/weight     |
| legs         | run         | https://tabler.io/icons/icon/run        |
| core         | body-scan   | https://tabler.io/icons/icon/body-scan  |
| cardio       | heartbeat   | https://tabler.io/icons/icon/heartbeat  |
| full-body    | gymnastics  | https://tabler.io/icons/icon/gymnastics |
| mobility     | yoga        | https://tabler.io/icons/icon/yoga       |

## Notes on substitutions

- **pull**: Tabler does not currently publish a `pull-up` or `chinstrap`
  glyph, so the kettlebell-shaped `weight` is used as the closest visual
  stand-in for pulling movements.
- **full-body**: `gymnastics` is preferred over `stretching` so the full-body
  glyph reads distinctly from the mobility (`yoga`) glyph.

## License

Tabler Icons is licensed under the MIT License. Full license text:
https://github.com/tabler/tabler-icons/blob/main/LICENSE
