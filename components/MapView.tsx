
import React, { useEffect, useRef } from 'react';
import { TravelInfo } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  onSetDestination: () => void;
  viewMode: '2D' | '3D';
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);
  const warningMarkersRef = useRef<any[]>([]);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: currentPosition,
      zoom: 17,
      dragging: true,
      scrollWheelZoom: true,
      tap: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { maxZoom: 20 }).addTo(mapRef.current);

    const vehicleIcon = L.divIcon({
      className: 'custom-vehicle-icon',
      html: `<div style="width: 40px; height: 40px; background: #3b82f6; border: 3px solid white; border-radius: 50%; box-shadow: 0 0 30px #3b82f6; display: flex; align-items: center; justify-content: center;"><i class="fas fa-location-arrow" style="color: white; transform: rotate(45deg); font-size: 18px;"></i></div>`,
      iconSize: [40, 40],
      iconAnchor: [20, 20]
    });
    
    vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon, zIndexOffset: 1000 }).addTo(mapRef.current);

    return () => { if (mapRef.current) mapRef.current.remove(); };
  }, []);

  // Atualiza posição do veículo e centraliza se não houver rota
  useEffect(() => {
    if (mapRef.current && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      if (!travel.destinationCoords) {
        mapRef.current.setView(currentPosition, mapRef.current.getZoom(), { animate: true });
      }
    }
  }, [currentPosition, travel.destinationCoords]);

  // Plota avisos proativos (Radares) no mapa
  useEffect(() => {
    if (!mapRef.current) return;
    warningMarkersRef.current.forEach(m => mapRef.current.removeLayer(m));
    warningMarkersRef.current = [];

    travel.warnings.forEach(w => {
      const icon = L.divIcon({
        className: 'warning-marker',
        html: `<div style="background: #ef4444; width: 30px; height: 30px; border-radius: 50%; display: flex; align-items: center; justify-content: center; border: 2px solid white; animation: pulse-red 1s infinite;"><i class="fas fa-camera" style="color: white; font-size: 12px;"></i></div>`
      });
      const marker = L.marker(w.coords, { icon }).addTo(mapRef.current);
      warningMarkersRef.current.push(marker);
    });
  }, [travel.warnings]);

  // TRAÇADO DE ROTA CRÍTICO
  useEffect(() => {
    const fetchRoute = async () => {
      const map = mapRef.current;
      if (!map || !travel.destinationCoords) {
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
        return;
      }

      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
      const coords = `${currentPosition[1]},${currentPosition[0]};${travel.destinationCoords[1]},${travel.destinationCoords[0]}`;
      
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: { color: '#3b82f6', weight: 10, opacity: 0.9, lineJoin: 'round', shadowBlur: 15, shadowColor: '#1e40af' }
          }).addTo(map);
          map.fitBounds(routeLayerRef.current.getBounds(), { padding: [120, 120], animate: true });
        }
      } catch (e) { console.error("Erro Rota:", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords]);

  return (
    <>
      <div id="map-container" ref={mapContainerRef} className="w-full h-full" />
      <style>{`
        @keyframes pulse-red { 0% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0.7); } 70% { box-shadow: 0 0 0 15px rgba(239, 68, 68, 0); } 100% { box-shadow: 0 0 0 0 rgba(239, 68, 68, 0); } }
      `}</style>
    </>
  );
};

export default MapView;
