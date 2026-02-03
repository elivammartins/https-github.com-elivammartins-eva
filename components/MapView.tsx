
import React, { useEffect, useRef } from 'react';
import { TravelInfo, MapMode, MapLayer } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  heading: number;
  isFullScreen: boolean;
  mode: MapMode;
  layer: MapLayer;
  zoom?: number;
  onUpdateMetrics?: (distKm: number, timeMin: number) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, heading, mode, layer, onUpdateMetrics, zoom = 18 }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: zoom,
        fadeAnimation: true
      });
      routeLayerGroupRef.current = L.layerGroup().addTo(mapRef.current);

      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div id="nav-arrow" class="nav-container transition-all duration-300" style="transform: rotate(${heading}deg);">
            <div class="glow-effect"></div>
            <svg width="60" height="60" viewBox="0 0 100 100">
               <path d="M50 0 L100 100 L50 80 L0 100 Z" fill="#06B6D4" stroke="white" stroke-width="4" />
            </svg>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
    }

    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    
    const tileUrl = layer === 'SATELLITE' 
      ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}'
      : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';

    tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 20 }).addTo(mapRef.current);
  }, [layer]);

  // MOTOR DE ROTA: SINCRONIA TOTAL COM HUD
  useEffect(() => {
    if (!mapRef.current || !travel.destinationCoords || (currentPosition[0] === 0)) {
      if (routeLayerGroupRef.current) routeLayerGroupRef.current.clearLayers();
      return;
    }

    const fetchRoute = async () => {
      try {
        const [startLat, startLng] = currentPosition;
        const [endLat, endLng] = travel.destinationCoords!;
        
        routeLayerGroupRef.current.clearLayers();

        const url = `https://router.project-osrm.org/route/v1/driving/${startLng},${startLat};${endLng},${endLat}?overview=full&geometries=geojson`;
        const response = await fetch(url);
        const data = await response.json();

        if (data.code === 'Ok' && data.routes.length > 0) {
          const route = data.routes[0];
          const coordinates = route.geometry.coordinates;
          const routeLatLngs = coordinates.map((coord: [number, number]) => [coord[1], coord[0]]);

          L.polyline(routeLatLngs, {
            color: '#06B6D4',
            weight: 12,
            opacity: 0.8,
            lineJoin: 'round',
            className: 'route-line-neon'
          }).addTo(routeLayerGroupRef.current);

          const destIcon = L.divIcon({
            className: 'dest-marker',
            html: `<div class="w-12 h-12 bg-red-600 rounded-full border-4 border-white flex items-center justify-center shadow-2xl animate-pulse"><i class="fas fa-flag-checkered text-white text-lg"></i></div>`,
            iconSize: [48, 48], iconAnchor: [24, 24]
          });
          L.marker([endLat, endLng], { icon: destIcon }).addTo(routeLayerGroupRef.current);

          // ATUALIZAÇÃO FORÇADA DAS MÉTRICAS NO HUD DO APP.TSX
          if (onUpdateMetrics) {
            const distKm = parseFloat((route.distance / 1000).toFixed(1));
            const timeMin = Math.round(route.duration / 60);
            onUpdateMetrics(distKm, timeMin);
          }

          const bounds = L.latLngBounds(routeLatLngs);
          mapRef.current.fitBounds(bounds, { padding: [150, 150], maxZoom: 16 });
        }
      } catch (e) { console.error("OSRM SYNC ERROR:", e); }
    };

    fetchRoute();
  }, [travel.destinationCoords, currentPosition]);

  useEffect(() => {
    if (!mapRef.current) return;
    const mapEl = mapContainerRef.current;
    if (mapEl) {
      if (mode === '3D') {
        mapEl.style.transform = 'rotateX(55deg) scale(1.6) translateY(-10%)';
      } else {
        mapEl.style.transform = 'none';
      }
      setTimeout(() => mapRef.current.invalidateSize(), 400);
    }
  }, [mode]);

  useEffect(() => {
    if (vehicleMarkerRef.current && (currentPosition[0] !== 0)) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const arrow = document.getElementById('nav-arrow');
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
      
      if (!travel.destinationCoords) {
        mapRef.current.panTo(currentPosition, { animate: true });
      }
    }
  }, [currentPosition, heading]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#080808]">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full transition-all duration-1000 origin-center ease-out" />
      <style>{`
        .nav-container { position: relative; width: 60px; height: 60px; filter: drop-shadow(0 0 25px rgba(6,182,212,1)); }
        .glow-effect { position: absolute; top: 50%; left: 50%; width: 45px; height: 45px; background: #06B6D4; filter: blur(35px); transform: translate(-50%, -50%); opacity: 0.6; }
        .route-line-neon { filter: drop-shadow(0 0 15px #06B6D4); stroke-linecap: round; }
        .leaflet-tile-pane { filter: ${layer === 'SATELLITE' ? 'brightness(0.6) contrast(1.1) saturate(0.8)' : 'invert(100%) hue-rotate(180deg) brightness(0.3) contrast(1.5)'}; }
      `}</style>
    </div>
  );
};

export default MapView;
