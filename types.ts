
export interface HealthTelemetry {
  heartRate: number;
  stressLevel: 'CALM' | 'NORMAL' | 'HIGH' | 'CRITICAL';
  fatigueIndex: number; // 0-100 (PERCLOS style)
  respirationRate: number;
  lastBlinkRate: number;
}

export interface SuggestedStop {
  id: string;
  name: string;
  lat: number;
  lng: number;
  type: 'COFFEE' | 'GAS' | 'REST';
  isOpen?: boolean;
  openingHours?: string;
}

export interface SecurityTelemetry {
  violenceIndex: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  policeNearby: boolean;
  radarDistance: number;
  radarLimit: number;
  lanePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  vehicleAheadDistance: number;
  isZigZagging?: boolean; 
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: any[];
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  hasTrafficAlert?: boolean;
  destIsOpen?: boolean;
  destHours?: string;
}

export type MapMode = '2D' | '3D';
export type MapLayer = 'DARK' | 'SATELLITE' | 'HYBRID';

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}

export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | string;
  distance: string;
  rating: number;
  isOpen?: boolean;
  openingHours?: string;
}

export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type PrivacyMode = 'PRIVATE' | 'SHARED' | 'ANONYMOUS';
export type VideoPlaybackMode = 'PICTURE_IN_PICTURE' | 'FULLSCREEN' | 'HIDDEN';

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName?: string;
}

export interface AppSettings {
  userName: string;
  credentials?: StreamingCredential[];
  privacyMode?: PrivacyMode;
  playbackMode?: VideoPlaybackMode;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'TV';
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  albumArt?: string;
  duration?: number;
  currentTime?: number;
  season?: number;
  episode?: number;
}

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  duration: string;
  participants: string[];
}
