
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MapMode = '2D' | '3D' | 'SATELLITE' | 'STREET';
export type MapLayer = 'DARK' | 'SATELLITE' | 'HYBRID';

export interface RouteStep {
  instruction: string;
  distance: number;
  type: string;
}

export interface WeatherTelemetry {
  temp: number;
  condition: string;
  floodRisk: 'LOW' | 'MEDIUM' | 'HIGH';
  precipProb: number;
  alertTitle?: string;
}

export interface SecurityTelemetry {
  violenceIndex: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  policeNearby: boolean;
  radarDistance: number;
  radarLimit: number;
  lanePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  vehicleAheadDistance: number;
}

export interface CarTelemetry {
  fuelLevel: number; 
  autonomyKm: number;
  odometer: number;
  isFuelLow: boolean;
  model: string;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: any[];
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  nextStep?: RouteStep;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number;
  season?: number | string;
  episode?: number | string;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'TV' | 'COMM';
  scheme: string;
}

// Fix: Added missing types for video playback and privacy modes
export type VideoPlaybackMode = 'PIP' | 'FULL';
export type PrivacyMode = 'GHOST' | 'RESTRICTED' | 'TOTAL';

// Fix: Added missing interface for streaming credentials
export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName: string;
}

export interface AppSettings {
  userName: string;
  voiceVolume: number;
  safetyDistance: number;
  videoPlaybackMode: VideoPlaybackMode;
  privacyMode: PrivacyMode;
  // Fix: Added credentials array to AppSettings
  credentials: StreamingCredential[];
}

export interface MeetingInfo {
  title: string;
  startTime: string;
}

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}

// Fix: Added missing StopRecommendation interface
export interface StopRecommendation {
  name: string;
  distance: string;
  rating: number;
  type: string;
}
