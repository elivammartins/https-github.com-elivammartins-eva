
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

  // Inicialização do Mapa
  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;

    if (mapRef.current) {
      mapRef.current.remove();
      mapRef.current = null;
    }

    mapRef.current = L.map(mapContainerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: currentPosition,
      zoom: 16,
      dragging: true,
      scrollWheelZoom: true,
      tap: true,
      boxZoom: false,
      doubleClickZoom: false
    });

    // Estilo "Dark Night" para painéis de carro
    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', { 
      maxZoom: 20 
    }).addTo(mapRef.current);

    const vehicleIcon = L.divIcon({
      className: 'custom-vehicle-icon',
      html: `
        <div style="width: 32px; height: 32px; background: rgba(37,99,235,0.9); border: 2px solid white; border-radius: 50%; display: flex; align-items: center; justify-content: center; box-shadow: 0 0 20px rgba(37,99,235,1);">
          <i class="fas fa-location-arrow" style="color: white; transform: rotate(45deg); font-size: 14px;"></i>
        </div>`,
      iconSize: [32, 32],
      iconAnchor: [16, 16]
    });
    
    vehicleMarkerRef.current = L.marker(currentPosition, { 
      icon: vehicleIcon, 
      zIndexOffset: 1000 
    }).addTo(mapRef.current);

    // Ajuste de tamanho automático quando a janela redimensiona
    const ro = new ResizeObserver(() => {
      if (mapRef.current) mapRef.current.invalidateSize();
    });
    ro.observe(mapContainerRef.current);

    return () => {
      ro.disconnect();
      if (mapRef.current) {
        mapRef.current.remove();
        mapRef.current = null;
      }
    };
  }, []);

  // Atualiza posição do veículo
  useEffect(() => {
    if (mapRef.current && vehicleMarkerRef.current) {
      vehicleMarkerRef.current.setLatLng(currentPosition);
      // Se não houver rota ativa, segue o veículo
      if (!travel.destinationCoords) {
        mapRef.current.panTo(currentPosition, { animate: true, duration: 1.0 });
      }
    }
  }, [currentPosition, travel.destinationCoords]);

  // Busca e Traça a Rota (OSRM)
  useEffect(() => {
    const fetchRoute = async () => {
      const map = mapRef.current;
      if (!map || !travel.destinationCoords) {
        if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);
        return;
      }

      if (routeLayerRef.current) map.removeLayer(routeLayerRef.current);

      const destPos = travel.destinationCoords;
      // OSRM espera Lng,Lat
      const coords = `${currentPosition[1]},${currentPosition[0]};${destPos[1]},${destPos[0]}`;
      
      try {
        const response = await fetch(`https://router.project-osrm.org/route/v1/driving/${coords}?overview=full&geometries=geojson`);
        const data = await response.json();

        if (data.routes && data.routes[0]) {
          routeLayerRef.current = L.geoJSON(data.routes[0].geometry, {
            style: { 
              color: '#3b82f6', 
              weight: 8, 
              opacity: 0.8,
              lineJoin: 'round',
              shadowBlur: 10,
              shadowColor: '#1d4ed8'
            }
          }).addTo(map);

          // Ajusta a visão para mostrar a rota inteira
          map.fitBounds(routeLayerRef.current.getBounds(), { padding: [100, 100], animate: true });
        }
      } catch (e) {
        console.error("Erro ao traçar rota:", e);
      }
    };

    fetchRoute();
  }, [travel.destinationCoords]);

  return <div id="map-container" ref={mapContainerRef} className="w-full h-full" />;
};

export default MapView;
