
# 🚀 PANDORA CORE EVA - Guia de Deploy

Este projeto foi otimizado para rodar como um **PWA** (Progressive Web App), permitindo que você o instale no seu Android como se fosse um aplicativo nativo para usar no carro.

## 📦 Como Hospedar Grátis

1. **GitHub**:
   - Crie um novo repositório chamado `pandora-eva`.
   - Faça o upload de todos os arquivos deste projeto.

2. **Vercel (Hospedagem Recomendada)**:
   - Acesse [vercel.com](https://vercel.com).
   - Conecte sua conta do GitHub.
   - Importe o repositório `pandora-eva`.
   - **IMPORTANTE**: Em "Environment Variables", adicione:
     - `API_KEY`: Sua chave da Gemini API (Obtenha em [aistudio.google.com](https://aistudio.google.com)).
   - Clique em **Deploy**.

## 📱 Como Testar no Android

1. Abra a URL gerada pela Vercel no **Google Chrome** do seu celular.
2. Clique nos 3 pontinhos do Chrome e selecione **"Instalar Aplicativo"**.
3. Abra o ícone da **EVA** que apareceu na sua tela inicial.
4. **Permissões**: Permita o acesso ao microfone e localização.
5. **Spotify**: Abra o Spotify no celular antes e comece uma música. A EVA agora terá o controle sobre o player!

## 🛠 Tecnologias
- **React 19** via ESM.
- **Gemini 2.5 Multi-modal** para voz e visão.
- **MediaSession API** para controle de áudio do sistema.
- **Leaflet** para mapas em tempo real.
