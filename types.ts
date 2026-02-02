
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MapMode = '2D' | '3D' | 'SATELLITE' | 'STREET';
export type MapLayer = 'DARK' | 'SATELLITE' | 'HYBRID';
export type PrivacyMode = 'GHOST' | 'RESTRICTED' | 'TOTAL';

export interface RouteWarning {
  id: string;
  type: string;
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
  season?: number;
  episode?: number;
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'TV' | 'COMM';
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
  privacyMode: PrivacyMode;
  safetyDistance: number;
  alertVoiceEnabled: boolean;
  preferredMusicApp: string;
  preferredVideoApp: string;
  preferredTvApp: string;
  credentials: StreamingCredential[];
  totalOdometer: number;
  currentFuelLiters: number;
  odometerAtLastRefuel: number;
}

export interface MessageNotification {
  id: string;
  sender: string;
  content: string;
  timestamp: string;
  app: 'WHATSAPP' | 'SMS' | 'PHONE';
}

export interface StopRecommendation {
  id: string;
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'PARK';
  distance: string;
  rating: number;
  coords: [number, number];
}

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  participants?: number;
}

export type CarAction = 'LOCK' | 'START' | 'UNLOCK' | 'STOP' | 'WINDOWS_DOWN' | 'WINDOWS_UP' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}
