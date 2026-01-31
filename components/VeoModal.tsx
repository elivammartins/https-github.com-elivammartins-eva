
import React, { useState, useRef } from 'react';
import { GoogleGenAI } from '@google/genai';

interface VeoModalProps {
  isOpen: boolean;
  onClose: () => void;
  onVideoGenerated: (videoUri: string) => void;
  initialImage?: string;
}

const VeoModal: React.FC<VeoModalProps> = ({ isOpen, onClose, onVideoGenerated, initialImage }) => {
  const [prompt, setPrompt] = useState('Animate this character with cinematic lighting');
  const [image, setImage] = useState<string | null>(initialImage || null);
  const [isGenerating, setIsGenerating] = useState(false);
  const [progress, setProgress] = useState('');
  const fileInputRef = useRef<HTMLInputElement>(null);

  const generateVideo = async () => {
    if (!image) return;
    try {
      setIsGenerating(true);
      setProgress('Iniciando Veo...');
      const ai = new GoogleGenAI({ apiKey: process.env.API_KEY });
      let operation = await ai.models.generateVideos({
        model: 'veo-3.1-fast-generate-preview',
        prompt,
        image: { imageBytes: image.split(',')[1], mimeType: 'image/png' },
        config: { numberOfVideos: 1, resolution: '720p', aspectRatio: '9:16' }
      });
      while (!operation.done) {
        setProgress('Processando quadros...');
        await new Promise(resolve => setTimeout(resolve, 10000));
        operation = await ai.operations.getVideosOperation({ operation: operation });
      }
      const downloadLink = operation.response?.generatedVideos?.[0]?.video?.uri;
      if (downloadLink) {
        onVideoGenerated(`${downloadLink}&key=${process.env.API_KEY}`);
        onClose();
      }
    } catch (e) { setProgress('Erro na geração.'); }
    finally { setIsGenerating(false); }
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 z-[6000] flex items-center justify-center p-6 italic uppercase">
      {/* Backdrop */}
      <div className="fixed inset-0 bg-black/95 backdrop-blur-xl cursor-pointer" onClick={onClose} />
      
      <div 
        className="relative bg-[#0c0c0e] w-full max-w-4xl rounded-[50px] border border-white/10 flex flex-col shadow-2xl overflow-hidden animate-fade-in"
        onClick={(e) => e.stopPropagation()}
      >
        <div className="p-8 border-b border-white/5 flex justify-between items-center bg-gradient-to-r from-blue-900/20 to-transparent shrink-0">
          <h2 className="text-2xl font-black text-white">Veo Core Animator</h2>
          <button onClick={onClose} className="w-12 h-12 rounded-full bg-white/5 flex items-center justify-center text-xl text-white">
            <i className="fas fa-times"></i>
          </button>
        </div>

        <div className="p-8 flex gap-8">
           <div 
             onClick={() => fileInputRef.current?.click()}
             className="w-1/2 h-64 bg-white/5 rounded-3xl border-2 border-dashed border-white/10 flex flex-col items-center justify-center cursor-pointer overflow-hidden"
           >
              {image ? <img src={image} className="w-full h-full object-cover" /> : <span>Carregar Imagem</span>}
              <input type="file" ref={fileInputRef} hidden onChange={(e) => {
                const f = e.target.files?.[0];
                if (f) {
                  const r = new FileReader();
                  r.onload = () => setImage(r.result as string);
                  r.readAsDataURL(f);
                }
              }} />
           </div>
           <div className="flex-1 flex flex-col gap-4">
              <textarea 
                value={prompt} 
                onChange={e => setPrompt(e.target.value)}
                className="flex-1 bg-black/40 border border-white/10 rounded-2xl p-4 text-white resize-none outline-none focus:border-blue-500"
              />
              <button 
                disabled={isGenerating || !image}
                onClick={generateVideo}
                className="h-16 bg-blue-600 rounded-2xl text-white font-black hover:bg-blue-500 transition-all disabled:opacity-50"
              >
                {isGenerating ? progress : 'Animar EVA'}
              </button>
           </div>
        </div>
      </div>
    </div>
  );
};

export default VeoModal;
