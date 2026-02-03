
import React, { useEffect, useRef, memo } from 'react';
import { TravelInfo, MapMode, MapLayer, SuggestedStop, RouteStep } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  heading: number;
  isFullScreen: boolean;
  mode: MapMode;
  layer: MapLayer;
  zoom: number;
  suggestedStops: SuggestedStop[];
  onUpdateMetrics?: (distKm: number, timeMin: number, nextStep?: RouteStep) => void;
}

const MapView: React.FC<MapViewProps> = memo(({ travel, currentPosition, heading, onUpdateMetrics, zoom, mode, layer }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current || mapRef.current) return;
    
    mapRef.current = L.map(mapContainerRef.current, { 
      zoomControl: false, 
      attributionControl: false, 
      center: currentPosition, 
      zoom: zoom,
      fadeAnimation: true
    });

    routeLayerRef.current = L.layerGroup().addTo(mapRef.current);
    
    const icon = L.divIcon({
      className: 'v-marker',
      html: `<div id="v-cursor" class="transition-transform duration-300">
               <svg width="100" height="100" viewBox="0 0 100 100">
                 <path d="M50 0 L90 100 L50 80 L10 100 Z" fill="#3B82F6" stroke="white" stroke-width="4" />
               </svg>
             </div>`,
      iconSize: [100, 100], iconAnchor: [50, 50]
    });
    vehicleMarkerRef.current = L.marker(currentPosition, { icon, zIndexOffset: 2000 }).addTo(mapRef.current);

    updateLayer();

    const resizeObserver = new ResizeObserver(() => mapRef.current?.invalidateSize());
    resizeObserver.observe(mapContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  const updateLayer = () => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    
    const url = layer === 'SATELLITE' 
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/voyager_labels_under/{z}/{x}/{y}{r}.png';
    
    tileLayerRef.current = L.tileLayer(url, { maxZoom: 20 }).addTo(mapRef.current);
  };

  useEffect(() => { updateLayer(); }, [layer]);

  useEffect(() => {
    if (mapRef.current && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const cursor = document.getElementById('v-cursor');
      if (cursor) cursor.style.transform = `rotate(${heading}deg)`;
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), { animate: true, duration: 0.5 });
    }
  }, [currentPosition, heading]);

  useEffect(() => {
    if (!mapRef.current || !travel.destinationCoords) return;

    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords![1]},${travel.destinationCoords![0]}?overview=full&geometries=geojson&steps=true`;
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.code === 'Ok' && data.routes.length > 0) {
          routeLayerRef.current.clearLayers();
          const route = data.routes[0];
          const geometry = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          
          L.polyline(geometry, { color: '#1d4ed8', weight: 14, opacity: 0.9, lineJoin: 'round' }).addTo(routeLayerRef.current);
          
          const firstStep = route.legs[0]?.steps[0];
          const nextStep: RouteStep = {
            instruction: firstStep?.maneuver?.instruction || "Siga em frente",
            distance: Math.round(firstStep?.distance || 0),
            name: firstStep?.name || "",
            maneuver: firstStep?.maneuver?.type || "straight"
          };

          onUpdateMetrics?.(parseFloat((route.distance/1000).toFixed(1)), Math.round(route.duration/60), nextStep);
          mapRef.current.fitBounds(L.latLngBounds(geometry), { padding: [100, 100], maxZoom: 15 });
        }
      } catch (e) { console.error("OSRM Error:", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords]);

  return (
    <div className="absolute inset-0 w-full h-full bg-[#0a0a0a] overflow-hidden">
      <div 
        ref={mapContainerRef} 
        className="w-full h-full" 
        style={{ 
          transform: mode === '3D' ? 'perspective(1200px) rotateX(40deg) translateY(-80px) scale(1.3)' : 'none',
          transformOrigin: 'bottom',
          transition: 'transform 1s cubic-bezier(0.4, 0, 0.2, 1)'
        }} 
      />
      <style>{`
        .v-marker { filter: drop-shadow(0 0 30px #3B82F6); }
        .leaflet-tile-container { filter: brightness(0.7) saturate(1.2) contrast(1.1); }
      `}</style>
    </div>
  );
});

export default MapView;
