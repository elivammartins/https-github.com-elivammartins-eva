
import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  onAnimateClick: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isListening, isSpeaking }) => {
  const avatarUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&fit=crop";

  return (
    <div className="relative w-full h-full aspect-square flex items-center justify-center bg-black overflow-hidden rounded-full border-2 border-white/5 shadow-2xl">
      {/* Glow Neural Dinâmico */}
      <div className={`absolute inset-0 transition-all duration-700 z-10 ${
        isSpeaking ? 'bg-cyan-500/30' : 
        isListening ? 'bg-red-500/30 shadow-[inset_0_0_100px_rgba(239,68,68,0.5)]' : 
        'bg-cyan-900/10'
      }`} />

      {/* A Imagem da EVA */}
      <img 
        src={avatarUrl} 
        alt="EVA Vita" 
        className={`w-full h-full object-cover transition-all duration-1000 ${
          isSpeaking || isListening ? 'brightness-110 saturate-150 scale-105' : 'brightness-40 grayscale opacity-30 scale-100'
        }`}
        style={{ filter: 'hue-rotate(180deg) contrast(1.1)' }}
      />

      {/* Visualizer de Voz Circular */}
      {isSpeaking && (
        <div className="absolute inset-0 z-20 flex items-center justify-center pointer-events-none">
           <div className="w-full h-full border-[6px] border-cyan-400 rounded-full animate-ping opacity-20"></div>
           <div className="absolute w-[90%] h-[90%] border-[4px] border-cyan-500 rounded-full animate-pulse opacity-40"></div>
        </div>
      )}

      {/* Scanlines Sci-Fi */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-20 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_4px]"></div>
    </div>
  );
};

export default Avatar;
