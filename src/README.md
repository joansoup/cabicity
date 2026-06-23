# Cabify · Kit de Design System para Lovable

Todo lo necesario para que Lovable construya con la identidad **real** de Cabify,
extraído del repo `cabify-design-system` (pipeline de tokens Style Dictionary + assets).

> El DS **no tiene componentes React** (es tokens + assets). Por eso no se "instala":
> le damos a Lovable los **tokens (CSS)**, las **fuentes** y los **iconos**, y Lovable
> construye los componentes (shadcn/Tailwind) usando esos tokens.

## Contenido

```
src/styles/cabify-tokens.css   ← TODOS los tokens reales (RAW + Color + Map) + capa de app
public/fonts/                  ← Cabify Circular (Book = 450, Bold = 700) en woff2
public/icons/                  ← 28 iconos reales del DS (modos, mapa, recompensa)
```

## Cómo integrarlo en Lovable (recomendado: GitHub sync)

1. En Lovable, crea el proyecto y activa **GitHub** (Settings → GitHub → Connect).
2. Clona ese repo de GitHub en local (o usa la subida web de GitHub).
3. Copia dentro del repo de Lovable:
   - `src/styles/cabify-tokens.css`
   - `public/fonts/*`
   - `public/icons/*`
4. En `src/index.css`, **lo primero de todo**:
   ```css
   @import "./styles/cabify-tokens.css";
   ```
5. Añade el mapeo de Tailwind (abajo) y haz commit/push. Lovable lo recoge.
6. Pega en el chat de Lovable el contenido de `LOVABLE-PROMPT.txt`.

> ¿Sin GitHub? Pide a Lovable crear `src/styles/cabify-tokens.css` y pega el contenido.
> Las **fuentes** sí o sí necesitan GitHub (o subirlas), porque el bucket público del DS
> da 404. Para iconos de transporte que el DS no tiene, usa `lucide-react` (ver abajo).

## Mapeo de Tailwind (`tailwind.config.ts` → `theme.extend`)

```ts
colors: {
  bg:            "var(--bg)",
  "bg-subdued":  "var(--bg-subdued)",
  surface:       "var(--surface)",
  field:         "var(--field-bg)",
  text:          "var(--text)",
  "text-secondary": "var(--text-secondary)",
  brand:         "var(--brand)",          // #7145d6
  "brand-subtle":"var(--brand-subtle)",   // #f5f1fc
  "on-brand":    "var(--on-brand)",
  border:        "var(--border)",
  "eco-bg":      "var(--eco-bg)",         // #dafaeb
  "eco-text":    "var(--eco-text)",       // #017251
  "cashback-bg": "var(--cashback-bg)",    // #f5f1fc
  "cashback-text":"var(--cashback-text)", // #7145d6
  route:         "var(--route)",
},
fontFamily: { cabify: "var(--font-cabify)".split(",") }, // o define a mano
borderRadius: {
  field: "var(--radius-field)",   // 8px
  card:  "var(--radius-card)",    // 16px
  sheet: "var(--radius-sheet)",   // 24px
},
boxShadow: {
  resting: "var(--shadow-resting)",
  rised:   "var(--shadow-rised)",
  over:    "var(--shadow-over)",
},
```

Así en los prompts puedes decir `bg-brand`, `text-eco-text`, `rounded-card`, `shadow-rised`, etc.

## Iconos por modo de movilidad

| Modo | Icono |
|---|---|
| Cabify | `/icons/ic_cabify.svg` (o `ic_cabify_go.svg`) |
| Coche por minutos | `/icons/ic_car.svg` |
| Andando | `/icons/ic_walking.svg` |
| Bici | `/icons/ic_bicycle.svg` |
| Moto / scooter | `/icons/ic_scooter.svg` · `ic_motorbike.svg` |
| **Metro / Tren / Cercanías / Bus** | ⚠️ **no existen en el DS** → usa `lucide-react`: `TramFront` (metro), `TrainFront` (tren/AVE), `TrainFrontTunnel` (cercanías), `Bus` |
| Eco / sostenible | `/icons/ic_cabify_eco.svg` |
| Cashback / recompensa | `/icons/ic_coins.svg` · `ic_cabify_club_spark_color.svg` |
| ETA / tiempo | `/icons/ic_clock.svg` |
| Ruta | `/icons/ic_route.svg` · `ic_import_route.svg` |
| Ubicación / destino | `/icons/ic_location.svg` · `ic_pin.svg` · `ic_destination_mini.svg` |

> Los iconos de `core` son monocromos (tíntalos con `color`/`fill`). Los de `color`
> (`ic_cabify*`, `ic_coins`, `ic_cash`, medallas) son multicolor → úsalos como `<img>`.

## Alias semánticos disponibles (úsalos, no los `--raw-*`)

`--bg --bg-subdued --surface --field-bg --text --text-secondary --brand --brand-subtle
--on-brand --link --border --eco-bg --eco-text --cashback-bg --cashback-text
--route --map-demand-high --map-demand-med --sheet-handle`
y estilos de texto `--text-body --text-caption --text-heading-4 --text-heading-5 --text-badge`.

## Nota sobre la fuente

La home que clonamos usa **Cabify Circular** (incluida aquí). El DS más nuevo apunta a
**Cabify Ciudad** (también está en el repo, con más pesos). Para que el proto cuadre con
la pantalla real, usamos Circular. Si queréis alinearos con el DS nuevo, cambiad el
`@font-face` y `--font-cabify` a Cabify Ciudad.
