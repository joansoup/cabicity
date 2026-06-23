// CLIENT-ONLY. Nunca importa mapbox-gl a nivel de módulo: lo carga
// dinámicamente dentro de un useEffect, con guarda de window. Si no hay
// VITE_MAPBOX_TOKEN, renderiza un fallback visual sin romper el SSR.

import { useEffect, useRef } from "react";
import { getMapboxToken } from "@/lib/transit/routeGeo";

export type LngLat = [number, number];

export interface MapaMarcador {
  pos: LngLat;
  color?: string;
  tamano?: number;
  borde?: string;
}

export interface MapaRutaSegmento {
  coords: LngLat[];
  color?: string;
  dashed?: boolean;
}

interface Props {
  centro: LngLat;
  zoom?: number;
  /** Tramos de la polyline (orden = orden visual). */
  ruta?: MapaRutaSegmento[];
  /** Paradas / waypoints estáticos. */
  marcadores?: MapaMarcador[];
  /** Punto que avanza por la ruta (se anima con easeTo al cambiar). */
  marcadorActivo?: LngLat;
  /** Si hay ruta, ajusta el encuadre a todos sus puntos al montar. */
  fitRuta?: boolean;
  className?: string;
  interactive?: boolean;
}

function MapaFallback({ className }: { className?: string }) {
  // Fallback simple cuando no hay token: degradado claro tipo mapa.
  return (
    <div
      className={`absolute inset-0 ${className ?? ""}`}
      aria-label="Mapa no disponible (sin VITE_MAPBOX_TOKEN)"
      style={{
        background:
          "linear-gradient(180deg, #f1f0f6 0%, #e7e6f0 100%)",
        backgroundImage:
          "radial-gradient(circle at 35% 40%, rgba(113,69,214,0.08), transparent 60%)," +
          "linear-gradient(180deg, #f1f0f6 0%, #e7e6f0 100%)," +
          "repeating-linear-gradient(0deg, transparent 0 39px, #00000008 39px 40px)," +
          "repeating-linear-gradient(90deg, transparent 0 39px, #00000008 39px 40px)",
      }}
    />
  );
}

export function MapaMapbox({
  centro,
  zoom = 12,
  ruta,
  marcadores,
  marcadorActivo,
  fitRuta = true,
  className,
  interactive = false,
}: Props) {
  const token = getMapboxToken();
  const containerRef = useRef<HTMLDivElement>(null);
  // Referencias mutables sin tipar mapbox a nivel de módulo.
  const mapRef = useRef<unknown>(null);
  const movingMarkerRef = useRef<unknown>(null);

  // Init mapa (cliente only, import dinámico)
  useEffect(() => {
    if (typeof window === "undefined") return;
    if (!token || !containerRef.current) return;

    let cancelled = false;
    let mapInstance: { remove: () => void } | null = null;

    (async () => {
      const mapboxgl = (await import("mapbox-gl")).default;
      await import("mapbox-gl/dist/mapbox-gl.css");
      if (cancelled || !containerRef.current) return;

      mapboxgl.accessToken = token;

      const routeColor =
        getComputedStyle(document.documentElement)
          .getPropertyValue("--route")
          .trim() || "#7145d6";

      const map = new mapboxgl.Map({
        container: containerRef.current,
        style: "mapbox://styles/mapbox/light-v11",
        center: centro,
        zoom,
        attributionControl: false,
        interactive,
      });
      mapInstance = map;
      mapRef.current = map;

      map.on("load", () => {
        // Pintar ruta
        if (ruta && ruta.length > 0) {
          ruta.forEach((seg, i) => {
            const id = `seg-${i}`;
            map.addSource(id, {
              type: "geojson",
              data: {
                type: "Feature",
                properties: {},
                geometry: { type: "LineString", coordinates: seg.coords },
              },
            });
            map.addLayer({
              id: `${id}-casing`,
              type: "line",
              source: id,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": "#ffffff",
                "line-width": 8,
                "line-opacity": 0.95,
              },
            });
            map.addLayer({
              id: `${id}-line`,
              type: "line",
              source: id,
              layout: { "line-cap": "round", "line-join": "round" },
              paint: {
                "line-color": seg.color || routeColor,
                "line-width": 5,
                ...(seg.dashed ? { "line-dasharray": [1.2, 1.6] } : {}),
              },
            });
          });

          if (fitRuta) {
            const bounds = new mapboxgl.LngLatBounds();
            ruta.forEach((s) => s.coords.forEach((c) => bounds.extend(c)));
            map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 15 });
          }
        }

        // Paradas estáticas
        marcadores?.forEach((m) => {
          const el = document.createElement("div");
          const size = m.tamano ?? 12;
          el.style.width = `${size}px`;
          el.style.height = `${size}px`;
          el.style.borderRadius = "999px";
          el.style.background = m.color ?? "#ffffff";
          el.style.border = `3px solid ${m.borde ?? routeColor}`;
          el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.18)";
          new mapboxgl.Marker({ element: el, anchor: "center" })
            .setLngLat(m.pos)
            .addTo(map);
        });

        // Marker que avanza
        if (marcadorActivo) {
          const adv = document.createElement("div");
          adv.style.width = "20px";
          adv.style.height = "20px";
          adv.style.borderRadius = "999px";
          adv.style.background = routeColor;
          adv.style.border = "4px solid #ffffff";
          adv.style.boxShadow = "0 2px 8px rgba(113,69,214,0.45)";
          movingMarkerRef.current = new mapboxgl.Marker({
            element: adv,
            anchor: "center",
          })
            .setLngLat(marcadorActivo)
            .addTo(map);
        }
      });
    })();

    return () => {
      cancelled = true;
      if (mapInstance) {
        try {
          mapInstance.remove();
        } catch {
          /* ignore */
        }
      }
      mapRef.current = null;
      movingMarkerRef.current = null;
    };
    // Re-montamos cuando cambia el token; el resto se actualiza en efectos
    // dedicados de abajo para no recrear el mapa en cada render.
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // Animar marcador activo cuando cambia
  useEffect(() => {
    const map = mapRef.current as { easeTo: (o: unknown) => void; getZoom: () => number } | null;
    const mk = movingMarkerRef.current as { setLngLat: (p: LngLat) => void } | null;
    if (!map || !mk || !marcadorActivo) return;
    mk.setLngLat(marcadorActivo);
    map.easeTo({
      center: marcadorActivo,
      duration: 900,
      zoom: Math.max(map.getZoom(), 13.5),
    });
  }, [marcadorActivo]);

  if (!token) {
    return <MapaFallback className={className} />;
  }

  return (
    <div
      ref={containerRef}
      className={className}
      // Inline style: gana en especificidad/orden a `.mapboxgl-map { position: relative }`
      // de mapbox-gl.css, que si no colapsa la altura del contenedor (inset-0 deja de
      // aplicar al volverse relative) y el mapa se queda en blanco.
      style={{ position: "absolute", inset: 0 }}
    />
  );
}
