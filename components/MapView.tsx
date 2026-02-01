
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep, RouteSegment } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  heading: number;
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, heading, isFullScreen, onToggleFullScreen, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, attributionControl: false, center: currentPosition, zoom: 17,
        pitch: 45, bearing: heading
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div id="nav-arrow-3d" style="width: 60px; height: 60px; display: flex; align-items: center; justify-content: center; transform: rotate(${heading}deg); transition: transform 0.2s cubic-bezier(0.175, 0.885, 0.32, 1.275);">
            <svg width="50" height="50" viewBox="0 0 100 100">
               <filter id="glow">
                  <feGaussianBlur stdDeviation="3.5" result="coloredBlur"/>
                  <feMerge><feMergeNode in="coloredBlur"/><feMergeNode in="SourceGraphic"/></feMerge>
               </filter>
               <path d="M50 0 L100 100 L50 80 L0 100 Z" fill="#33CCFF" filter="url(#glow)" />
            </svg>
          </div>
        `,
        iconSize: [60, 60], iconAnchor: [30, 30]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
    }
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      const arrow = document.getElementById('nav-arrow-3d');
      if (arrow) arrow.style.transform = `rotate(${heading}deg)`;
    }
    if (mapRef.current && !isFullScreen) {
      mapRef.current.setView(currentPosition, mapRef.current.getZoom(), { animate: true });
    }
  }, [currentPosition, heading, isFullScreen]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      
      const waypoints = [
        `${currentPosition[1]},${currentPosition[0]}`, 
        ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`), 
        `${travel.destinationCoords[1]},${travel.destinationCoords[0]}`
      ].join(';');

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints}?overview=full&geometries=geojson`);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, { 
            style: { color: '#33CCFF', weight: 10, opacity: 0.9, lineJoin: 'round', dashArray: '1, 15' } 
          }).addTo(mapRef.current);

          if (onRouteUpdate) onRouteUpdate([], Math.round(data.routes[0].duration/60), Math.round(data.routes[0].distance/1000), []);
          mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [80, 80] });
        }
      } catch (e) { console.error("Route Engine Error", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.stops]);

  return <div ref={mapContainerRef} className="w-full h-full" onClick={onToggleFullScreen} />;
};

export default MapView;
