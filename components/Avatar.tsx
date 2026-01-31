
import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking?: boolean;
  videoUrl?: string | null;
  onAnimateClick: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isListening, isSpeaking, isThinking, videoUrl }) => {
  const avatarUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=200&auto=format&fit=crop";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Halo de Reatividade */}
      <div className={`absolute inset-0 transition-all duration-700 ${
        isSpeaking ? 'bg-blue-400/30' : 
        isListening ? 'bg-red-500/20' : 
        'bg-transparent'
      }`} />

      {/* Imagem EVA */}
      <img 
        src={avatarUrl} 
        alt="Eva" 
        className={`w-full h-full object-cover transition-all duration-1000 ${
          isSpeaking || isListening ? 'brightness-125 saturate-150 scale-110' : 'brightness-[0.6] grayscale-[0.5]'
        }`}
        style={{ filter: 'hue-rotate(180deg) contrast(1.1)' }}
      />

      {/* Ondas de Voz Simplificadas */}
      {isListening && (
        <div className="absolute inset-0 flex items-center justify-center gap-1 bg-black/40">
           {[...Array(4)].map((_, i) => (
             <div key={i} className="w-1 bg-blue-400 rounded-full animate-vibe" style={{ animationDelay: `${i*0.1}s` }}></div>
           ))}
        </div>
      )}

      <style>{`
        @keyframes vibe { 0%, 100% { height: 10%; } 50% { height: 60%; } }
        .animate-vibe { animation: vibe 0.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Avatar;
