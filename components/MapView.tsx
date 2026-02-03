
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
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: any[], duration: number, distance: number, segments: any[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, heading, mode, layer, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const layersRef = useRef<{ [key: string]: any }>({});
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: 18, 
        scrollWheelZoom: false, 
        doubleClickZoom: false,
        dragging: true,
        fadeAnimation: true
      });

      layersRef.current.DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png', {
        maxZoom: 20
      }).addTo(mapRef.current);

      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div id="nav-arrow" class="nav-container" style="transform: rotate(${heading}deg);">
            <div class="glow-effect"></div>
            <svg width="60" height="60" viewBox="0 0 100 100">
               <path d="M50 0 L100 100 L50 80 L0 100 Z" fill="#06B6D4" stroke="white" stroke-width="4" />
            </svg>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
      
      setTimeout(() => { mapRef.current.invalidateSize(); }, 500);
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const mapEl = mapContainerRef.current;
    if (mapEl) {
      if (mode === '3D') {
        mapEl.style.perspectiveOrigin = '50% 100%'; 
        mapEl.style.transform = 'perspective(1200px) rotateX(45deg) scale(1.6) translateY(-10%)';
        mapRef.current.setZoom(18); 
      } else {
        mapEl.style.transform = 'none';
        mapRef.current.setZoom(16);
      }
      setTimeout(() => mapRef.current.invalidateSize(), 300);
    }
  }, [mode]);

  useEffect(() => {
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
    }
    if (mapRef.current) {
      mapRef.current.panTo(currentPosition, { animate: true, duration: 0.5 });
    }
  }, [currentPosition]);

  return (
    <div className="absolute inset-0 w-full h-full overflow-hidden bg-[#080808]">
      <div ref={mapContainerRef} className="absolute inset-0 w-full h-full transition-all duration-1000 ease-in-out origin-center" />
      <style>{`
        .nav-container { position: relative; width: 60px; height: 60px; filter: drop-shadow(0 0 20px rgba(6,182,212,0.6)); }
        .glow-effect { position: absolute; top: 50%; left: 50%; width: 30px; height: 30px; background: #06B6D4; filter: blur(30px); transform: translate(-50%, -50%); opacity: 0.5; }
        .vehicle-marker { pointer-events: none !important; }
        .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(0.4) contrast(1.2) saturate(0.6); }
        .leaflet-container { background: #080808 !important; }
      `}</style>
    </div>
  );
};

export default MapView;
