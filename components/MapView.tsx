
import React, { useEffect, useRef, memo } from 'react';
import { TravelInfo, MapMode, MapLayer, SuggestedStop } from '../types';

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
  onUpdateMetrics?: (distKm: number, timeMin: number) => void;
}

const MapView: React.FC<MapViewProps> = memo(({ travel, currentPosition, heading, mode, layer, onUpdateMetrics, zoom, suggestedStops, isFullScreen }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const routeLayerGroupRef = useRef<any>(null);
  const suggestedLayerGroupRef = useRef<any>(null);
  const tileLayerRef = useRef<any>(null);

  // Inicialização Robusta
  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current || mapRef.current) return;
    
    mapRef.current = L.map(mapContainerRef.current, { 
      zoomControl: false, 
      attributionControl: false, 
      center: currentPosition, 
      zoom: zoom,
      fadeAnimation: false, // Otimização para Android Auto
      markerZoomAnimation: true
    });

    routeLayerGroupRef.current = L.layerGroup().addTo(mapRef.current);
    suggestedLayerGroupRef.current = L.layerGroup().addTo(mapRef.current);

    const vehicleIcon = L.divIcon({
      className: 'vehicle-marker',
      html: `<div id="nav-arrow" class="nav-container"><div class="glow-effect"></div><svg width="70" height="70" viewBox="0 0 100 100"><path d="M50 0 L100 100 L50 80 L0 100 Z" fill="#06B6D4" stroke="white" stroke-width="4" /></svg></div>`,
      iconSize: [70, 70], iconAnchor: [35, 35]
    });
    vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);

    // Observer de redimensionamento para evitar tela preta
    const resizeObserver = new ResizeObserver(() => {
      if (mapRef.current) {
        mapRef.current.invalidateSize();
      }
    });
    resizeObserver.observe(mapContainerRef.current);
    return () => resizeObserver.disconnect();
  }, []);

  // Força atualização de tamanho quando o estado isFullScreen muda
  useEffect(() => {
    if (mapRef.current) {
      setTimeout(() => {
        mapRef.current.invalidateSize();
      }, 100);
    }
  }, [isFullScreen]);

  // Marcadores de Sugestão com Status de Funcionamento Visual
  useEffect(() => {
    if (!mapRef.current || !suggestedLayerGroupRef.current) return;
    suggestedLayerGroupRef.current.clearLayers();

    suggestedStops.forEach(stop => {
      const color = stop.isOpen ? '#06B6D4' : '#ef4444';
      const statusIcon = stop.isOpen ? 'fa-check-circle' : 'fa-times-circle';
      const icon = L.divIcon({
        className: 'eva-suggest-marker',
        html: `
          <div class="relative flex flex-col items-center">
            <div class="w-14 h-14 rounded-full border-4 border-white flex items-center justify-center shadow-2xl ${stop.isOpen ? 'animate-bounce' : ''}" style="background: ${color}">
              <i class="fas ${stop.type === 'COFFEE' ? 'fa-coffee' : stop.type === 'GAS' ? 'fa-gas-pump' : 'fa-bed'} text-white text-xl"></i>
              ${!stop.isOpen ? '<div class="absolute -top-1 -right-1 bg-white rounded-full w-6 h-6 flex items-center justify-center text-red-600 text-[10px]"><i class="fas fa-times"></i></div>' : ''}
            </div>
            <div class="mt-2 bg-black px-3 py-1.5 rounded-xl border border-white/20 whitespace-nowrap flex flex-col items-center shadow-2xl">
              <span class="text-[9px] font-black italic text-white uppercase">${stop.name}</span>
              <span class="text-[7px] font-bold ${stop.isOpen ? 'text-emerald-400' : 'text-red-500'} uppercase">
                ${stop.isOpen ? 'ABERTO AGORA' : `FECHADO: ${stop.openingHours}`}
              </span>
            </div>
          </div>
        `,
        iconSize: [120, 120], iconAnchor: [60, 60]
      });
      L.marker([stop.lat, stop.lng], { icon }).addTo(suggestedLayerGroupRef.current);
      mapRef.current.setView([stop.lat, stop.lng], 16, { animate: true });
    });
  }, [suggestedStops]);

  useEffect(() => {
    if (!mapRef.current) return;
    if (tileLayerRef.current) mapRef.current.removeLayer(tileLayerRef.current);
    const tileUrl = layer === 'SATELLITE' ? 'https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}' : 'https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png';
    tileLayerRef.current = L.tileLayer(tileUrl, { maxZoom: 19 }).addTo(mapRef.current);
  }, [layer]);

  useEffect(() => {
    if (!mapRef.current || !travel.destinationCoords || currentPosition[0] === 0) {
      routeLayerGroupRef.current?.clearLayers();
      return;
    }
    const fetchRoute = async () => {
      try {
        const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords![1]},${travel.destinationCoords![0]}?overview=full&geometries=geojson`;
        const res = await fetch(url);
        const data = await res.json();
        if (data.code === 'Ok' && data.routes.length > 0) {
          routeLayerGroupRef.current.clearLayers();
          const route = data.routes[0];
          const latLngs = route.geometry.coordinates.map((c: any) => [c[1], c[0]]);
          L.polyline(latLngs, { 
            color: travel.destIsOpen ? '#06B6D4' : '#ef4444', 
            weight: 12, 
            opacity: 0.85, 
            className: 'route-line-neon' 
          }).addTo(routeLayerGroupRef.current);
          
          const destIcon = L.divIcon({
            className: 'dest-marker',
            html: `<div class="w-12 h-12 ${travel.destIsOpen ? 'bg-emerald-600 shadow-[0_0_20px_#10b981]' : 'bg-red-600 shadow-[0_0_20px_#ef4444]'} rounded-full border-4 border-white flex items-center justify-center animate-pulse"><i class="fas fa-flag-checkered text-white text-lg"></i></div>`,
            iconSize: [48, 48], iconAnchor: [24, 24]
          });
          L.marker([travel.destinationCoords![0], travel.destinationCoords![1]], { icon: destIcon }).addTo(routeLayerGroupRef.current);
          onUpdateMetrics?.(parseFloat((route.distance/1000).toFixed(1)), Math.round(route.duration/60));
        }
      } catch (e) {}
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.destIsOpen]);

  useEffect(() => {
    if (vehicleMarkerRef.current && mapRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const arrow = document.getElementById('nav-arrow');
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
      if (!travel.destinationCoords) mapRef.current.panTo(currentPosition, { animate: true });
    }
  }, [currentPosition, heading]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-black z-0">
      <div 
        ref={mapContainerRef} 
        className="absolute inset-0 w-full h-full" 
        style={{ 
          transform: mode === '3D' ? 'perspective(1000px) rotateX(35deg) scale(1.2) translateY(-5%)' : 'none',
          transition: 'transform 0.8s cubic-bezier(0.16, 1, 0.3, 1)'
        }} 
      />
      <style>{`
        .nav-container { position: relative; width: 70px; height: 70px; }
        .glow-effect { position: absolute; top: 50%; left: 50%; width: 50px; height: 50px; background: #06B6D4; filter: blur(35px); transform: translate(-50%, -50%); opacity: 0.7; }
        .route-line-neon { filter: drop-shadow(0 0 15px currentColor); }
        .leaflet-container { background: #000 !important; }
      `}</style>
    </div>
  );
});

export default MapView;
