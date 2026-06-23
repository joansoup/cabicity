import { useEffect, useRef } from "react";
import mapboxgl from "mapbox-gl";
import "mapbox-gl/dist/mapbox-gl.css";
import type { RouteGeo, LngLat } from "@/lib/transit/routeGeo";

interface Props {
  token: string;
  geo: RouteGeo;
  currentPos: LngLat;
  // bandera para distinguir tramos a pie
  dashedTipos?: string[];
}

export function MapboxRoute({ token, geo, currentPos, dashedTipos = ["andando"] }: Props) {
  const containerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<mapboxgl.Map | null>(null);
  const markerRef = useRef<mapboxgl.Marker | null>(null);

  // init
  useEffect(() => {
    if (typeof window === "undefined" || !containerRef.current) return;
    mapboxgl.accessToken = token;

    const map = new mapboxgl.Map({
      container: containerRef.current,
      style: "mapbox://styles/mapbox/light-v11",
      center: geo.origen,
      zoom: 12,
      attributionControl: false,
      cooperativeGestures: false,
      interactive: false,
    });
    mapRef.current = map;

    map.on("load", () => {
      // Fit bounds a toda la ruta
      const bounds = new mapboxgl.LngLatBounds();
      geo.flat.forEach((c) => bounds.extend(c as [number, number]));
      map.fitBounds(bounds, { padding: 56, duration: 0, maxZoom: 15 });

      // Sources & layers por tramo
      const routeColor = getComputedStyle(document.documentElement)
        .getPropertyValue("--route").trim() || "#7145d6";

      geo.segments.forEach((seg, i) => {
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
            "line-color": routeColor,
            "line-width": 5,
            ...(dashedTipos.includes(seg.tipo)
              ? { "line-dasharray": [1.2, 1.6] }
              : {}),
          },
        });
      });

      // Stops markers (white dot, brand border)
      geo.stops.forEach((s, idx) => {
        const isStartOrEnd = idx === 0 || idx === geo.stops.length - 1;
        const el = document.createElement("div");
        el.style.width = isStartOrEnd ? "16px" : "12px";
        el.style.height = isStartOrEnd ? "16px" : "12px";
        el.style.borderRadius = "999px";
        el.style.background = "#ffffff";
        el.style.border = `3px solid ${routeColor}`;
        el.style.boxShadow = "0 1px 4px rgba(0,0,0,0.18)";
        new mapboxgl.Marker({ element: el, anchor: "center" })
          .setLngLat(s as [number, number])
          .addTo(map);
      });

      // Marker que avanza
      const adv = document.createElement("div");
      adv.style.width = "20px";
      adv.style.height = "20px";
      adv.style.borderRadius = "999px";
      adv.style.background = routeColor;
      adv.style.border = "4px solid #ffffff";
      adv.style.boxShadow = "0 2px 8px rgba(113,69,214,0.45)";
      markerRef.current = new mapboxgl.Marker({ element: adv, anchor: "center" })
        .setLngLat(currentPos as [number, number])
        .addTo(map);
    });

    return () => {
      markerRef.current?.remove();
      markerRef.current = null;
      map.remove();
      mapRef.current = null;
    };
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [token]);

  // mover marker + easeTo cuando cambia el paso
  useEffect(() => {
    const m = mapRef.current;
    const mk = markerRef.current;
    if (!m || !mk) return;
    mk.setLngLat(currentPos as [number, number]);
    m.easeTo({ center: currentPos as [number, number], duration: 900, zoom: Math.max(m.getZoom(), 13.5) });
  }, [currentPos]);

  return <div ref={containerRef} className="absolute inset-0" />;
}
