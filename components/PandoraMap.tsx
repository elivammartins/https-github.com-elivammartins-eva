
import React, { useEffect, useRef, memo } from 'react';
import { RiskLevel } from '../types';

declare const L: any;

interface PandoraMapProps {
  location: [number, number];
  heading: number;
  riskLevel: RiskLevel;
}

const PandoraMap: React.FC<PandoraMapProps> = memo(({ location, heading, riskLevel }) => {
  const mapRef = useRef<any>(null);
  const vehicleRef = useRef<any>(null);
  const containerRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    if (!containerRef.current || mapRef.current) return;

    mapRef.current = L.map(containerRef.current, {
      zoomControl: false,
      attributionControl: false,
      center: location,
      zoom: 18,
      maxZoom: 20
    });

    L.tileLayer('https://{s}.basemaps.cartocdn.com/dark_all/{z}/{x}/{y}{r}.png', {
      maxZoom: 20
    }).addTo(mapRef.current);

    const eagleIcon = L.divIcon({
      className: 'eagle-cursor',
      html: `
        <div class="relative w-24 h-24 flex items-center justify-center">
           <div class="absolute inset-0 bg-blue-500/20 blur-2xl rounded-full"></div>
           <svg viewBox="0 0 100 100" class="w-14 h-14 drop-shadow-[0_0_15px_rgba(59,130,246,0.8)] transition-transform duration-300" id="eagle-svg">
              <path d="M50 0 L90 90 L50 70 L10 90 Z" fill="#3b82f6" stroke="white" stroke-width="4" />
           </svg>
        </div>
      `,
      iconSize: [96, 96],
      iconAnchor: [48, 48]
    });

    vehicleRef.current = L.marker(location, { icon: eagleIcon }).addTo(mapRef.current);

    const ro = new ResizeObserver(() => mapRef.current?.invalidateSize());
    ro.observe(containerRef.current);
    return () => ro.disconnect();
  }, []);

  useEffect(() => {
    if (!mapRef.current) return;
    mapRef.current.setView(location, mapRef.current.getZoom(), { animate: true });
    vehicleRef.current.setLatLng(location);
    const svg = document.getElementById('eagle-svg');
    if (svg) svg.style.transform = `rotate(${heading}deg)`;
  }, [location, heading]);

  return (
    <div className="w-full h-full relative overflow-hidden">
      <div 
        ref={containerRef} 
        className="w-full h-full transition-all duration-1000" 
        style={{ transform: 'perspective(1200px) rotateX(45deg) translateY(-100px) scale(1.4)' }}
      />
      
      {/* OVERLAY DE RISCO SENTINELA */}
      <div className={`absolute inset-0 pointer-events-none transition-all duration-1000 z-10 ${
        riskLevel === 'DANGER' ? 'bg-red-900/10 shadow-[inset_0_0_200px_rgba(220,38,38,0.4)]' : 
        riskLevel === 'CAUTION' ? 'bg-orange-900/5 shadow-[inset_0_0_150px_rgba(234,88,12,0.2)]' : 
        'bg-black/10'
      }`}></div>

      <style>{`
        .leaflet-tile { filter: brightness(0.5) saturate(1.2) contrast(1.1) !important; transition: filter 1s; }
        ${riskLevel === 'DANGER' ? '.leaflet-tile { filter: brightness(0.3) saturate(2) sepia(0.6) hue-rotate(-20deg) contrast(1.3) !important; }' : ''}
      `}</style>
    </div>
  );
});

export default PandoraMap;
