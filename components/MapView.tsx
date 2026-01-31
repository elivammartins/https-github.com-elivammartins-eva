
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

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;

    // Limpeza rigorosa para evitar tela branca em re-render
    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: currentPosition[0] === 0 ? [-23.5505, -46.6333] : currentPosition,
      zoom: 16,
      dragging: true,
      scrollWheelZoom: true,
      tap: true
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
      maxZoom: 20 
    }).addTo(mapRef.current);

    const vehicleIcon = L.divIcon({
      className: 'custom-vehicle-icon',
      html: `<div style="width: 26px; height: 26px; background: #2563eb; border-radius: 50%; border: 2px solid white; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 10px rgba(37,99,235,0.7);"><i class="fas fa-location-arrow" style="color: white; transform: rotate(45deg); font-size: 11px;"></i></div>`,
      iconSize: [26, 26],
      iconAnchor: [13, 13]
    });
    
    vehicleMarkerRef.current = L.marker(currentPosition, { 
      icon: vehicleIcon, 
      zIndexOffset: 1000 
    }).addTo(mapRef.current);

    // Observer de tamanho
    const ro = new ResizeObserver(() => {
      mapRef.current?.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []); // Só inicializa uma vez

  useEffect(() => {
    if (mapRef.current && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      if (!travel.destinationCoords) {
        mapRef.current.panTo(currentPosition, { animate: true });
      }
    }
  }, [currentPosition]);

  useEffect(() => {
    const fetchRoute = async () => {
      const map = mapRef.current;
      if (!map || !travel.destinationCoords) return;

      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);

      const destPos = travel.destinationCoords;
      const coords = `${currentPosition[1]},${currentPosition[0]};${destPos[1]},${destPos[0]}`;
      
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: { color: '#3b82f6', weight: 5, opacity: 0.8 }
          }).addTo(map);
          map.fitBounds(routeLayerRef.current.getBounds(), { padding: [30, 30] });
        }
      } catch (e) { }
    };
    fetchRoute();
  }, [travel.destinationCoords]);

  return <div id="map-container" ref={mapContainerRef} className="w-full h-full" />;
};

export default MapView;
