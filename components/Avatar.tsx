
import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  onAnimateClick: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isListening, isSpeaking }) => {
  const avatarUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&fit=crop";

  return (
    <div className="relative w-full h-full flex items-center justify-center bg-black overflow-hidden group">
      {/* Glow Neural Dinâmico */}
      <div className={`absolute inset-0 transition-all duration-1000 ${
        isSpeaking ? 'bg-cyan-500/40 animate-pulse' : 
        isListening ? 'bg-red-500/30' : 
        'bg-cyan-900/10'
      }`} />

      {/* A Imagem da EVA */}
      <img 
        src={avatarUrl} 
        alt="EVA Core" 
        className={`w-full h-full object-cover transition-all duration-700 ${
          isSpeaking || isListening ? 'brightness-125 saturate-150 scale-105' : 'brightness-40 grayscale opacity-60'
        }`}
        style={{ filter: 'hue-rotate(180deg) contrast(1.1)' }}
      />

      {/* Visualizer de Voz (Aparece quando fala) */}
      {isSpeaking && (
        <div className="absolute bottom-6 left-0 right-0 flex items-center justify-center gap-1.5 px-4">
           {[...Array(8)].map((_, i) => (
             <div 
               key={i} 
               className="w-1.5 bg-cyan-400 rounded-full animate-wave shadow-[0_0_10px_rgba(34,211,238,0.8)]" 
               style={{ animationDelay: `${i*0.08}s`, height: '20px' }}
             ></div>
           ))}
        </div>
      )}

      {/* Scanlines Estilo Sci-Fi */}
      <div className="absolute inset-0 pointer-events-none opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%),linear-gradient(90deg,rgba(255,0,0,0.02),rgba(0,255,0,0.01),rgba(0,0,255,0.02))] bg-[length:100%_3px,3px_100%]"></div>

      <style>{`
        @keyframes wave { 0%, 100% { transform: scaleY(0.5); } 50% { transform: scaleY(2); } }
        .animate-wave { animation: wave 0.5s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default Avatar;
