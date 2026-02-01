
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
    <div className="relative w-full h-full flex items-center justify-center overflow-hidden bg-black">
      {/* Efeito de brilho Bioluminescente ao falar */}
      <div className={`absolute inset-0 transition-all duration-700 ${
        isSpeaking ? 'bg-cyan-400/30' : 
        isListening ? 'bg-red-500/20' : 
        'bg-cyan-900/10'
      }`} />

      <img 
        src={avatarUrl} 
        alt="Eva" 
        className={`w-full h-full object-cover transition-all duration-700 ${
          isSpeaking || isListening ? 'brightness-125 saturate-200 scale-110' : 'brightness-[0.5] grayscale-[0.3]'
        }`}
        style={{ filter: 'hue-rotate(150deg) contrast(1.2)' }}
      />

      {/* Animação de Voz Sincronizada (Avatar Style) */}
      {isSpeaking && (
        <div className="absolute inset-0 flex items-center justify-center gap-1.5 px-6">
           {[...Array(8)].map((_, i) => (
             <div 
               key={i} 
               className="w-1 bg-cyan-300 rounded-full animate-vibe shadow-[0_0_15px_rgba(34,211,238,0.8)]" 
               style={{ animationDelay: `${i*0.08}s` }}
             ></div>
           ))}
        </div>
      )}

      {/* Camada de conexão neural estática */}
      <div className="absolute inset-0 opacity-10 pointer-events-none bg-[url('https://www.transparenttextures.com/patterns/carbon-fibre.png')]"></div>

      <style>{`
        @keyframes vibe { 0%, 100% { height: 10%; opacity: 0.3; } 50% { height: 80%; opacity: 1; } }
        .animate-vibe { animation: vibe 0.5s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Avatar;
