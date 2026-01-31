
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  viewMode: '2D' | '3D';
  onSetDestination: () => void;
  onRouteUpdate?: (steps: RouteStep[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    mapRef.current = L.map(mapContainerRef.current, { zoomControl: false, attributionControl: false, center: currentPosition, zoom: 17 });
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
    
    const icon = L.divIcon({
      className: 'vehicle-v90',
      html: `<div style="width: 45px; height: 45px; background: #3b82f6; border: 4px solid white; border-radius: 50%; box-shadow: 0 0 40px #3b82f6; display: flex; align-items: center; justify-content: center; transform: rotate(45deg);"><i class="fas fa-location-arrow" style="color: white; font-size: 20px;"></i></div>`,
      iconSize: [45, 45], iconAnchor: [22, 22]
    });
    vehicleMarkerRef.current = L.marker(currentPosition, { icon }).addTo(mapRef.current);
    return () => { if (mapRef.current) mapRef.current.remove(); };
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current) vehicleMarkerRef.current.setLatLng(currentPosition);
    if (mapRef.current && !travel.destinationCoords) mapRef.current.setView(currentPosition);
  }, [currentPosition]);

  useEffect(() => {
    const getDetailedRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

      const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords[1]},${travel.destinationCoords[0]}?overview=full&geometries=geojson&steps=true&languages=pt-BR`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        if (data.routes?.[0]) {
          const route = data.routes[0];
          routeLayerRef.current = L.geoJSON(route.geometry, { style: { color: '#3b82f6', weight: 12, opacity: 0.8 } }).addTo(mapRef.current);
          mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [150, 150] });

          // Mapeia os passos para o formato da EVA
          const steps: RouteStep[] = route.legs[0].steps.map((s: any) => ({
            instruction: s.maneuver.type === 'turn' ? `Vire à ${s.maneuver.modifier === 'right' ? 'Direita' : 'Esquerda'}` : s.maneuver.instruction,
            street: s.name || 'Via Desconhecida',
            distance: Math.round(s.distance),
            maneuver: s.maneuver.modifier || 'straight'
          }));
          if (onRouteUpdate) onRouteUpdate(steps);
        }
      } catch (e) { console.error(e); }
    };
    getDetailedRoute();
  }, [travel.destinationCoords]);

  return <div id="map-container" ref={mapContainerRef} className="w-full h-full" />;
};

export default MapView;
