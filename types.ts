
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MapMode = '2D' | '3D';
export type MapLayer = 'DARK' | 'SATELLITE' | 'HYBRID';

export interface LaneGuidance {
  totalLanes: number;
  activeLanes: number[];
  direction: 'LEFT' | 'RIGHT' | 'STRAIGHT';
}

export interface RouteStep {
  instruction: string;
  distance: number;
  type: string;
  lanes?: LaneGuidance;
}

export interface SecurityTelemetry {
  violenceIndex: 'LOW' | 'MODERATE' | 'HIGH' | 'CRITICAL';
  policeNearby: boolean;
  radarDistance: number;
  radarLimit: number;
  lanePosition: 'LEFT' | 'CENTER' | 'RIGHT';
  vehicleAheadDistance: number;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: any[];
  drivingTimeMinutes: number;
  totalDistanceKm: number;
  nextStep?: RouteStep;
  hasTrafficAlert?: boolean;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'TV' | 'COMM';
  scheme: string;
}

// Added missing types for AppSettings and media components
export type VideoPlaybackMode = 'PIP' | 'FULL';
export type PrivacyMode = 'GHOST' | 'RESTRICTED' | 'TOTAL';

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName?: string;
}

export interface AppSettings {
  userName: string;
  voiceVolume: number;
  safetyDistance: number;
  videoPlaybackMode: VideoPlaybackMode;
  privacyMode: PrivacyMode;
  credentials: StreamingCredential[];
}

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}

// Added missing types for specialized components
export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'GENERAL';
  distance: string;
  rating: number;
  lat: number;
  lng: number;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  albumArt?: string;
  duration?: number;
  isPlaying?: boolean;
  season?: number;
  episode?: number;
}

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  organizer: string;
  participantsCount: number;
}
