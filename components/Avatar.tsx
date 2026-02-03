
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
      <div className={`absolute inset-0 transition-all duration-1000 z-10 ${
        isSpeaking ? 'bg-cyan-500/20 animate-pulse' : 
        isListening ? 'bg-red-500/20' : 
        'bg-cyan-900/5'
      }`} />

      {/* A Imagem da EVA */}
      <img 
        src={avatarUrl} 
        alt="EVA Core" 
        className={`w-full h-full object-cover transition-all duration-700 ${
          isSpeaking || isListening ? 'brightness-125 saturate-150 scale-110' : 'brightness-40 grayscale opacity-40 scale-100'
        }`}
        style={{ filter: 'hue-rotate(180deg) contrast(1.1)' }}
      />

      {/* Visualizer de Voz */}
      {isSpeaking && (
        <div className="absolute bottom-4 left-0 right-0 z-20 flex items-center justify-center gap-1 px-4">
           {[...Array(6)].map((_, i) => (
             <div 
               key={i} 
               className="w-1 bg-cyan-400 rounded-full animate-wave" 
               style={{ animationDelay: `${i*0.1}s`, height: '12px' }}
             ></div>
           ))}
        </div>
      )}

      {/* Scanlines Sci-Fi */}
      <div className="absolute inset-0 pointer-events-none z-30 opacity-10 bg-[linear-gradient(rgba(18,16,16,0)_50%,rgba(0,0,0,0.25)_50%)] bg-[length:100%_2px]"></div>

      <style>{`
        @keyframes wave { 0%, 100% { transform: scaleY(0.6); } 50% { transform: scaleY(1.8); } }
        .animate-wave { animation: wave 0.5s infinite ease-in-out; }
      `}</style>
    </div>
  );
};

export default Avatar;
