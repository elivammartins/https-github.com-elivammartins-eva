
import React, { useEffect, useRef } from 'react';
import { TravelInfo, RouteStep, RouteSegment } from '../types';

declare const L: any;

interface MapViewProps {
  travel: TravelInfo;
  currentPosition: [number, number];
  isFullScreen: boolean;
  onToggleFullScreen: () => void;
  onRouteUpdate?: (steps: RouteStep[], duration: number, distance: number, segments: RouteSegment[]) => void;
}

const MapView: React.FC<MapViewProps> = ({ travel, currentPosition, isFullScreen, onToggleFullScreen, onRouteUpdate }) => {
  const mapContainerRef = useRef<HTMLDivElement>(null);
  const mapRef = useRef<any>(null);
  const routeLayerRef = useRef<any>(null);
  const vehicleMarkerRef = useRef<any>(null);

  useEffect(() => {
    if (typeof L === 'undefined' || !mapContainerRef.current) return;
    
    if (!mapRef.current) {
      mapRef.current = L.map(mapContainerRef.current, { 
        zoomControl: false, 
        attributionControl: false, 
        center: currentPosition, 
        zoom: 17
      });

      L.tileLayer('https://{s}.basemaps.cartocdn.com/rastertiles/dark_all/{z}/{x}/{y}{r}.png').addTo(mapRef.current);
      
      const vehicleIcon = L.divIcon({
        className: 'vehicle-marker',
        html: `
          <div style="width: 70px; height: 70px; background: rgba(51,204,255,0.1); border: 2px solid #33CCFF; border-radius: 50%; box-shadow: 0 0 40px rgba(51,204,255,0.4); display: flex; align-items: center; justify-content: center; transform: rotate(45deg);">
            <div style="width: 20px; height: 20px; background: white; border-radius: 50%; border: 3px solid #33CCFF;"></div>
          </div>
        `,
        iconSize: [70, 70], iconAnchor: [35, 35]
      });

      vehicleMarkerRef.current = L.marker(currentPosition, { icon: vehicleIcon }).addTo(mapRef.current);
    }

    return () => { 
      if (mapRef.current) { mapRef.current.remove(); mapRef.current = null; } 
    };
  }, []);

  useEffect(() => {
    if (vehicleMarkerRef.current) vehicleMarkerRef.current.setLatLng(currentPosition);
    if (mapRef.current && !isFullScreen) {
       mapRef.current.panTo(currentPosition, { animate: true });
    }
  }, [currentPosition, isFullScreen]);

  useEffect(() => {
    const fetchRoute = async () => {
      if (!mapRef.current || !travel.destinationCoords) return;
      
      const waypoints = [
        `${currentPosition[1]},${currentPosition[0]}`, 
        ...travel.stops.map(s => `${s.coords[1]},${s.coords[0]}`), 
        `${travel.destinationCoords[1]},${travel.destinationCoords[0]}`
      ];

      try {
        const res = await fetch(`https://router.project-osrm.org/route/v1/driving/${waypoints.join(';')}?overview=full&geometries=geojson&steps=true`);
        const data = await res.json();
        
        if (data.routes?.[0]) {
          const route = data.routes[0];
          
          if (routeLayerRef.current) mapRef.current.removeLayer(routeLayerRef.current);
          routeLayerRef.current = L.geoJSON(route.geometry, { 
            style: { color: '#33CCFF', weight: 8, opacity: 0.6 } 
          }).addTo(mapRef.current);

          const totalDuration = Math.round(route.duration / 60);
          const totalDistance = Math.round(route.distance / 1000);
          
          // Cálculo de segmentos (entre waypoints)
          const segments: RouteSegment[] = [];
          if (route.legs) {
            route.legs.forEach((leg: any, i: number) => {
              segments.push({
                from: i === 0 ? "ATUAL" : travel.stops[i-1].name,
                to: i === route.legs.length - 1 ? travel.destination : travel.stops[i].name,
                distanceKm: Math.round(leg.distance / 1000),
                durationMin: Math.round(leg.duration / 60)
              });
            });
          }

          if (onRouteUpdate) onRouteUpdate([], totalDuration, totalDistance, segments);
        }
      } catch (e) { console.error("OSRM Error:", e); }
    };
    fetchRoute();
  }, [travel.destinationCoords, travel.stops, currentPosition]);

  return (
    <div className="w-full h-full relative" onClick={onToggleFullScreen}>
       <div ref={mapContainerRef} className="w-full h-full" />
    </div>
  );
};

export default MapView;
