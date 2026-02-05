
// Definindo os níveis de risco e estados de humor para o sistema Pandora
export type RiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL';
export type PandoraMood = 'IDLE' | 'LISTENING' | 'THINKING' | 'WARNING' | 'SUGGESTING';

export interface MeetingInfo {
  id: string;
  subject: string;
  start: string;
  end: string;
  joinUrl?: string;
  organizer: string;
  // Campos de compatibilidade para componentes que usam nomes alternativos
  title?: string;
  startTime?: string;
}

export interface PandoraNotification {
  id: string;
  sender: string;
  text: string;
  content?: string; // Utilizado em NotificationOverlay
  app: 'WHATSAPP' | 'TEAMS' | 'SYSTEM';
  image?: string; 
  time: Date;
  timestamp?: Date; // Utilizado em NotificationOverlay (Date object)
}

export type LocationData = [number, number];

export interface Stop {
  id: string;
  name: string;
  lat?: number;
  lng?: number;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  totalDistanceKm: number;
  drivingTimeMinutes: number;
  stops: Stop[];
}

export interface StopRecommendation {
  id: string;
  name: string;
  distance: string;
  rating: number;
  type: 'GAS' | 'COFFEE' | 'FOOD';
}

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName?: string;
}

export type PrivacyMode = boolean;
export type VideoPlaybackMode = 'FULL' | 'PIP';

export interface AppSettings {
  userName: string;
  credentials: StreamingCredential[];
}

export interface MediaApp {
  id: string;
  name: string;
  category: 'AUDIO' | 'VIDEO' | 'TV';
  icon: string;
  color: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  cover?: string;
  progress?: number;
  season?: number;
  episode?: number;
}

export type MapMode = '2D' | '3D';
export type MapLayer = 'STREET' | 'SATELLITE';

export interface RouteStep {
  instruction: string;
  distance: number;
  name: string;
  maneuver: string;
}

export interface SuggestedStop {
  name: string;
  lat: number;
  lng: number;
}

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}

export interface SecurityTelemetry {
  vehicleAheadDistance: number;
  isZigZagging: boolean;
  lanePosition: 'LEFT' | 'RIGHT' | 'CENTER';
}

export interface HealthTelemetry {
  heartRate: number;
  fatigueIndex: number;
  lastBlinkRate: number;
}

export interface PandoraTravel {
  destination: string;
  eta: string;
  distanceTotal: string;
  nextStep: RouteStep | null;
}

export interface PandoraMedia {
  title: string;
  artist: string;
  cover: string;
  isPlaying: boolean;
  progress: number;
  service: string;
}

export interface SentinelStatus {
  speedLimit: number;
  floodRisk: boolean;
  temperature: number;
  weather: string;
  riskLevel: RiskLevel;
}

export interface AppState {
  isBooted: boolean;
  privacyMode: boolean;
  mood: PandoraMood;
  location: [number, number];
  speed: number;
  heading: number;
  meetings: MeetingInfo[];
  notifications: PandoraNotification[];
  isFatigued: boolean;
  eyeProbability: number;
  activeMedia: {
    title: string;
    artist: string;
    cover: string;
    isPlaying: boolean;
    progress: number;
  };
  // Estado para o componente TopBar
  sentinel?: SentinelStatus;
}
