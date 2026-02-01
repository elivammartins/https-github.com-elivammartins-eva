
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MediaViewState = 'FULL' | 'PIP' | 'HIDDEN';
export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC' | 'COLLISION' | 'FLOOD';

export type CarAction = 'LOCK' | 'UNLOCK' | 'START' | 'STOP' | 'WINDOWS_UP' | 'WINDOWS_DOWN' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface RouteWarning {
  id: string;
  type: WarningType;
  distance: number;
  description: string;
  coords: [number, number];
  speedLimit?: number; 
}

export interface RouteStep {
  instruction: string;
  distance: number;
  duration: number;
}

export interface RouteSegment {
  from: string;
  to: string;
  distanceKm: number;
  durationMin: number;
}

export interface StopInfo {
  id: string;
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'DESTINATION';
  coords: [number, number];
  distanceFromPrev?: number;
  timeFromPrev?: number;
}

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
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  segments: RouteSegment[];
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

export interface MeetingInfo {
  title: string;
  startTime: string;
}
