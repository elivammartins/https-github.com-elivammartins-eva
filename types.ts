
export type RiskLevel = 'SAFE' | 'CAUTION' | 'DANGER' | 'CRITICAL';
export type PandoraMood = 'IDLE' | 'LISTENING' | 'THINKING' | 'WARNING' | 'SUGGESTING';
export type PrivacyMode = 'STEALTH' | 'PUBLIC' | 'PRIVATE';

export interface SentinelStatus {
  riskLevel: RiskLevel;
  weather: string;
  temperature: number;
  violenceIndex: number;
  floodRisk: boolean;
  speedLimit: number;
}

export interface PandoraTravel {
  destination: string;
  eta: string;
  distanceTotal: string;
  nextStep: {
    instruction: string;
    distance: string;
    maneuver: string;
  } | null;
}

export interface PandoraMedia {
  title: string;
  artist: string;
  cover: string;
  isPlaying: boolean;
  service: 'SPOTIFY' | 'YOUTUBE' | 'NETFLIX' | 'TV';
  progress: number;
}

export interface AppState {
  isBooted: boolean;
  isInteractionView: boolean;
  privacyMode: boolean;
  mood: PandoraMood;
  sentinel: SentinelStatus;
  travel: PandoraTravel;
  media: PandoraMedia;
  userLocation: [number, number];
  heading: number;
  currentSpeed: number;
}

// Added missing types based on component usage
export interface TravelInfo {
  destination: string;
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  stops: { id: string; name: string }[];
  destinationCoords?: [number, number];
}

export interface LocationData {
  latitude: number;
  longitude: number;
}

export interface StopRecommendation {
  type: 'GAS' | 'COFFEE' | 'FOOD';
  name: string;
  distance: string;
  rating: number;
}

export interface AppSettings {
  userName: string;
  credentials: StreamingCredential[];
}

export interface MediaApp {
  id: string;
  category: 'AUDIO' | 'VIDEO' | 'TV';
  icon: string;
  color: string;
  name: string;
}

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName: string;
}

export type VideoPlaybackMode = 'FULLSCREEN' | 'PIP' | 'MINIMIZED';

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  season?: number;
  episode?: number;
}

export interface MeetingInfo {
  title: string;
  startTime: string;
}

export type MapMode = '2D' | '3D';
export type MapLayer = 'SATELLITE' | 'STREET';

export interface SuggestedStop {
  id: string;
  name: string;
  coords: [number, number];
}

export interface RouteStep {
  instruction: string;
  distance: number;
  name: string;
  maneuver: string;
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
  fatigueIndex: number;
  heartRate: number;
  lastBlinkRate: number;
}
