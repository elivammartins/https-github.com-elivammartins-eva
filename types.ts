
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MediaViewState = 'FULL' | 'PIP' | 'HIDDEN';
export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC' | 'COLLISION' | 'FLOOD';

// Fix: Defined missing CarAction type required by BluelinkPanel.tsx
export type CarAction = 'LOCK' | 'UNLOCK' | 'START' | 'STOP' | 'WINDOWS_UP' | 'WINDOWS_DOWN' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface RouteWarning {
  id: string;
  type: WarningType;
  distance: number;
  description: string;
  coords: [number, number];
  speedLimit?: number; // Para radares
}

// Fix: Defined missing RouteStep type required by MapView.tsx
export interface RouteStep {
  instruction: string;
  distance: number;
}

export interface StopInfo {
  id: string;
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'DESTINATION';
  coords: [number, number];
  distanceFromPrev?: string;
  timeFromPrev?: string;
}

// Fix: Defined missing StopRecommendation type required by RecommendationCard.tsx
export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE';
  distance: string;
  rating: number;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: StopInfo[];
  warnings: RouteWarning[];
  drivingTimeMinutes?: number;
  totalDistanceKm?: number;
  weatherStatus?: string;
  floodRisk?: 'LOW' | 'MEDIUM' | 'HIGH';
}

export interface AppSettings {
  userName: string;
  voiceVolume: number;
  privacyMode: boolean;
  hideSenderInfo: boolean;
  messageLimit: 128 | 'full';
  safetyDistance: number; 
  alertVoiceEnabled: boolean;
}

export interface CarStatus {
  lastAction: string;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  isLocked: boolean;
  isUpdating: boolean;
  hazardActive: boolean;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'COMM';
  scheme: string;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number;
  seriesName?: string;
  season?: number;
  episode?: number;
}

// Fix: Defined missing MeetingInfo type required by MeetingView.tsx
export interface MeetingInfo {
  title: string;
  startTime: string;
}
