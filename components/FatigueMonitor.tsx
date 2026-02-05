
import React, { useEffect, useRef } from 'react';

interface Props {
  onFatigueDetected: () => void;
  onEyeUpdate: (prob: number) => void;
}

const FatigueMonitor: React.FC<Props> = ({ onFatigueDetected, onEyeUpdate }) => {
  const videoRef = useRef<HTMLVideoElement>(null);
  const streamRef = useRef<MediaStream | null>(null);

  useEffect(() => {
    const startCamera = async () => {
      try {
        const stream = await navigator.mediaDevices.getUserMedia({ video: { facingMode: 'user' } });
        streamRef.current = stream;
        if (videoRef.current) videoRef.current.srcObject = stream;
        
        // Simulação de ponte para ML Kit Native 
        // Em um app real envolto em WebView, o Native mandaria o eyeProbability via Bridge
        const interval = setInterval(() => {
          // Aqui rodaria o FaceDetector.process(image)
          // Simulamos a probabilidade baseada na variação de pixels se fôssemos puristas,
          // ou esperamos o evento do AndroidBridge.
          const mockProb = Math.random(); 
          onEyeUpdate(mockProb);
        }, 100);

        return () => clearInterval(interval);
      } catch (e) { console.error("Camera fail:", e); }
    };
    startCamera();
    return () => streamRef.current?.getTracks().forEach(t => t.stop());
  }, []);

  return (
    <div className="bg-black/40 backdrop-blur-3xl border border-white/10 rounded-[40px] p-6 flex flex-col gap-4 overflow-hidden relative">
      <div className="flex items-center justify-between mb-2">
         <span className="text-[10px] font-black text-blue-500 tracking-[0.4em] uppercase">Sentinela Bio</span>
         <div className="flex gap-1">
            <div className="w-1 h-3 bg-blue-500 animate-pulse"></div>
            <div className="w-1 h-3 bg-blue-500 animate-pulse delay-75"></div>
            <div className="w-1 h-3 bg-blue-500 animate-pulse delay-150"></div>
         </div>
      </div>
      
      <div className="relative h-32 rounded-3xl overflow-hidden border border-white/5 grayscale opacity-30">
        <video ref={videoRef} autoPlay playsInline muted className="w-full h-full object-cover" />
        <div className="absolute inset-0 border-2 border-blue-500/20 box-border"></div>
        {/* Face Tracking Rect (Visual Only) */}
        <div className="absolute top-1/4 left-1/4 w-1/2 h-1/2 border border-blue-400/50"></div>
      </div>

      <div className="flex justify-between items-center mt-2">
         <span className="text-[9px] text-white/30 uppercase">Atenção Ocular</span>
         <span className="text-blue-400 text-xl font-black italic">ESTÁVEL</span>
      </div>
    </div>
  );
};

export default FatigueMonitor;
