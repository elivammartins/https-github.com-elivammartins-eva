
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
        zoomControl: false, attributionControl: false, center: currentPosition, zoom: 18
      });

      layersRef.current.DARK = L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      layersRef.current.SATELLITE = L.tileLayer('https://server.arcgisonline.com/ArcGIS/rest/services/World_Imagery/MapServer/tile/{z}/{y}/{x}');

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
    }
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    const mapEl = mapContainerRef.current;
    if (mapEl) {
      if (mode === '3D') {
        mapEl.style.transform = 'perspective(1200px) rotateX(55deg) scale(1.5)';
        mapRef.current.setZoom(18);
      } else {
        mapEl.style.transform = 'none';
        mapRef.current.setZoom(16);
      }
    }
  }, [mode]);

  useEffect(() => {
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const arrow = document.getElementById('nav-arrow');
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
    }
    if (mapRef.current) {
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), { animate: true });
    }
  }, [currentPosition, heading]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!mapRef.current || (!travel.destinationCoords && travel.stops.length === 0)) {
        if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
        return;
      }
      
      const destination = travel.destinationCoords || [currentPosition[0], currentPosition[1]];
      const waypoints = [
        `${currentPosition[1]},${currentPosition[0]}`, 
        ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`), 
        `${destination[1]},${destination[0]}`
      ].join(';');

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, { 
            style: { color: '#06B6D4', weight: 18, opacity: 0.8, lineJoin: 'round', lineCap: 'round' } 
          }).addTo(mapRef.current);

          if (onRouteUpdate) {
            onRouteUpdate([], Math.round(data.routes[0].duration/60), Math.round(data.routes[0].distance/1000), []);
          }
        }
      } catch (e) { console.error("OSRM Failure", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.stops.length]);

  return (
    <div className="w-full h-full overflow-hidden relative bg-black">
      <div ref={mapContainerRef} className="w-full h-full transition-all duration-1000 ease-in-out origin-bottom" />
      <style>{`
        .nav-container { position: relative; width: 60px; height: 60px; transition: transform 0.2s ease-out; filter: drop-shadow(0 0 20px rgba(6,182,212,0.9)); }
        .glow-effect { position: absolute; top: 50%; left: 50%; width: 40px; height: 40px; background: #06B6D4; filter: blur(30px); transform: translate(-50%, -50%); opacity: 0.7; }
        .vehicle-marker { pointer-events: none !important; }
        .leaflet-tile-pane { filter: invert(100%) hue-rotate(180deg) brightness(0.6) contrast(1.2) saturate(0.5); }
      `}</style>
    </div>
  );
};

export default MapView;
