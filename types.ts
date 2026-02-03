
export interface HealthTelemetry {
  heartRate: number;
  stressLevel: 'CALM' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  fatigueIndex: number; 
  respirationRate: number;
  lastBlinkRate: number;
  breathingStability: number;
}

export interface SuggestedStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'COFFEE' | 'GAS' | 'REST' | 'FOOD';
  isOpen?: boolean;
  openingHours?: string;
  distanceFromRoute?: string;
}

export interface SecurityTelemetry {
  violenceIndex: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  policeNearby: boolean;
  radarDistance: number;
  radarLimit: number;
  lanePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  vehicleAheadDistance: number;
  vehicleAheadSpeed: number;
  isZigZagging: boolean;
  collisionWarning: boolean;
}

export interface RouteStep {
  instruction: string;
  distance: number;
  name: string;
  maneuver: string;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: SuggestedStop[];
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  arrivalTime: string;
  nextManeuver?: RouteStep;
  currentStepIndex: number;
}

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName?: string;
}

export interface AppSettings {
  userName: string;
  safetyDistance: number; // Padrão 20m
  privacyMode: boolean;
  credentials: StreamingCredential[];
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'TV';
  scheme: string;
}

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  season?: number;
  episode?: number;
  sourceApp?: string;
}

// Added missing exports for component integrations
export interface LocationData {
  latitude: number;
  longitude: number;
  speed?: number;
  heading?: number;
}

export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'COFFEE' | 'FOOD' | 'REST';
  distance: string;
  rating: number;
  lat: number;
  lng: number;
}

export type PrivacyMode = 'PRIVATE' | 'SHARED' | 'ANONYMOUS';

export type VideoPlaybackMode = 'SAFETY' | 'ALWAYS_ON' | 'VOICE_ONLY';

export interface MeetingInfo {
  title: string;
  startTime: string;
  endTime?: string;
  organizer?: string;
  platform?: 'TEAMS' | 'ZOOM' | 'MEET';
}

export type MapMode = '2D' | '3D';

export type MapLayer = 'DARK' | 'LIGHT' | 'SATELLITE' | 'HYBRID';
