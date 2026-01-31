
import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking?: boolean;
  videoUrl?: string | null;
  onAnimateClick: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isListening, isSpeaking }) => {
  const avatarUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=300&auto=format&fit=crop";

  return (
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden">
      {/* Efeito de brilho ao falar */}
      <div className={`absolute inset-0 transition-all duration-700 ${
        isSpeaking ? 'bg-blue-400/30' : 
        isListening ? 'bg-red-500/20' : 
        'bg-transparent'
      }`} />

      <img 
        src={avatarUrl} 
        alt="Eva" 
        className={`w-full h-full object-cover transition-all duration-700 ${
          isSpeaking || isListening ? 'brightness-125 saturate-150 scale-110' : 'brightness-[0.6] grayscale-[0.2]'
        }`}
        style={{ filter: 'hue-rotate(180deg) contrast(1.1)' }}
      />

      {/* Animação de Voz */}
      {isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-4 bg-blue-900/10">
           {[...Array(6)].map((_, i) => (
             <div key={i} className="w-1.5 bg-blue-300 rounded-full animate-vibe shadow-lg" style={{ animationDelay: `${i*0.1}s` }}></div>
           ))}
        </div>
      )}

      <style>{`
        @keyframes vibe { 0%, 100% { height: 15%; } 50% { height: 70%; } }
        .animate-vibe { animation: vibe 0.4s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Avatar;
