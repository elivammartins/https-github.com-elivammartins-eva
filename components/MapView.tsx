
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  viewMode: '2D' | '3D';
  onSetDestination: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    // Inicialização segura do mapa
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: 16,
        fadeAnimation: true,
        markerZoomAnimation: true
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const icon = L.divIcon({
        className: 'vehicle-v100',
        html: `<div style="width: 50px; height: 50px; background: #3b82f6; border: 4px solid white; border-radius: 50%; box-shadow: 0 0 40px #3b82f6; display: flex; align-items: center; justify-content: center;"><i class="fas fa-location-arrow" style="color: white; font-size: 22px; transform: rotate(-45deg);"></i></div>`,
        iconSize: [50, 50], iconAnchor: [25, 25]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon }).addTo(mapRef.current);
    }
    
    return () => { 
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current && mapRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      if (!travel.destinationCoords) {
        mapRef.current.panTo(currentPosition, { animate: true });
      }
    }
  }, [currentPosition, travel.destinationCoords]);

  useEffect(() => {
    const getDetailedRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      
      const url = `https://router.project-osrm.org/route/v1/driving/${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords[1]},${travel.destinationCoords[0]}?overview=full&geometries=geojson&steps=true&languages=pt-BR`;
      
      try {
        const res = await fetch(url);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);

          const route = data.routes[0];
          routeLayerRef.current = L.geoJSON(route.geometry, { 
            style: { color: '#3b82f6', weight: 10, opacity: 0.8, lineCap: 'round', lineJoin: 'round' } 
          }).addTo(mapRef.current);
          
          mapRef.current.fitBounds(routeLayerRef.current.getBounds(), { padding: [100, 100], animate: true });

          const steps: RouteStep[] = route.legs[0].steps.map((s: any) => ({
            instruction: s.maneuver.instruction,
            street: s.name || 'Via Principal',
            distance: Math.round(s.distance),
            maneuver: s.maneuver.modifier || 'straight'
          }));

          if (onRouteUpdate) {
            onRouteUpdate(steps, route.duration, route.distance);
          }
        }
      } catch (e) { 
        console.error("Erro no motor de rota OSRM:", e);
      }
    };

    getDetailedRoute();
  }, [travel.destinationCoords, travel.destination]);

  return <div id="map-container" ref={mapContainerRef} className="w-full h-full bg-[#0c0c0e] animate-fade-in" />;
};

export default MapView;
