
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MapMode = '2D' | '3D' | 'SATELLITE' | 'STREET';
export type MapLayer = 'DARK' | 'SATELLITE' | 'HYBRID';

export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC' | 'COLLISION' | 'FLOOD' | 'VIOLENCE';

export interface RouteWarning {
  id: string;
  type: WarningType;
  distance: number;
  description: string;
  coords: [number, number];
}

export interface StopInfo {
  id: string;
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'DESTINATION';
  coords: [number, number];
}

export interface StopRecommendation {
  id?: string;
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'DEFAULT' | string;
  distance: string;
  rating: number;
  coords: [number, number];
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: StopInfo[];
  warnings: RouteWarning[];
  drivingTimeMinutes: number;
  totalDistanceKm: number;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number;
  // Campos para séries e episódios
  season?: number;
  episode?: number;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'COMM';
  scheme: string;
}

export interface StreamingCredential {
  appId: string;
  user: string;
  pass: string;
  profileName: string;
}

export interface AppSettings {
  userName: string;
  voiceVolume: number;
  privacyMode: boolean;
  safetyDistance: number;
  alertVoiceEnabled: boolean;
  preferredMusicApp: string;
  preferredVideoApp: string;
  credentials: StreamingCredential[];
}

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  attendees?: string[];
}

export type CarAction = 'LOCK' | 'UNLOCK' | 'START' | 'STOP' | 'WINDOWS_UP' | 'WINDOWS_DOWN' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}
