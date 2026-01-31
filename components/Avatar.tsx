
import React from 'react';

interface AvatarProps {
  isListening: boolean;
  isSpeaking: boolean;
  isThinking?: boolean;
  videoUrl?: string | null;
  onAnimateClick: () => void;
}

const Avatar: React.FC<AvatarProps> = ({ isListening, isSpeaking, isThinking, videoUrl, onAnimateClick }) => {
  const avatarUrl = "https://images.unsplash.com/photo-1620641788421-7a1c342ea42e?q=80&w=400&auto=format&fit=crop";

  return (
    <div className="relative flex items-center justify-center group w-full h-full" onClick={onAnimateClick}>
      {/* Halo Bioluminescente */}
      <div className={`absolute inset-0 rounded-full blur-[12px] transition-all duration-1000 ${
        isSpeaking ? 'bg-cyan-400/50 scale-125' : 
        isThinking ? 'bg-purple-500/40 animate-pulse' :
        isListening ? 'bg-blue-500/30 animate-pulse-slow' : 
        'bg-white/5'
      }`} />

      {/* Container Principal */}
      <div className={`relative w-full h-full rounded-full z-10 transition-all duration-500 overflow-hidden border flex items-center justify-center bg-blue-950 shadow-inner ${
        isSpeaking ? 'border-cyan-300 animate-vibe shadow-cyan-500/60' : 
        isThinking ? 'border-purple-400 animate-pulse shadow-purple-500/50' :
        isListening ? 'border-blue-400 animate-glow shadow-blue-500/40' : 
        'border-white/10'
      }`}>
        
        {videoUrl ? (
          <video 
            src={videoUrl} 
            autoPlay 
            loop 
            muted 
            playsInline
            className={`w-full h-full object-cover transition-all duration-1000 ${
              isSpeaking || isListening || isThinking ? 'brightness-125 saturate-150' : 'brightness-[0.7]'
            }`}
          />
        ) : (
          <img 
            src={avatarUrl} 
            alt="Eva" 
            className={`w-full h-full object-cover transition-all duration-1000 ${
              isSpeaking || isListening || isThinking ? 'brightness-125 saturate-150' : 'brightness-[0.7]'
            }`}
            style={{ 
              filter: 'hue-rotate(180deg) contrast(1.2) saturate(1.8)' 
            }}
          />
        )}
      </div>

      <style>{`
        @keyframes vibe { 0%, 100% { transform: scale(1); } 50% { transform: scale(1.08); } }
        @keyframes glow { 0%, 100% { border-color: rgba(59, 130, 246, 0.5); } 50% { border-color: rgba(59, 130, 246, 1); } }
        @keyframes pulse-slow { 0%, 100% { transform: scale(1); opacity: 0.2; } 50% { transform: scale(1.15); opacity: 0.4; } }
        .animate-vibe { animation: vibe 0.12s ease-in-out infinite; }
        .animate-glow { animation: glow 2s ease-in-out infinite; }
        .animate-pulse-slow { animation: pulse-slow 3s ease-in-out infinite; }
      `}</style>
    </div>
  );
};

export default Avatar;
