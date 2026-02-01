
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

// Fix: Added missing StopRecommendation interface for RecommendationCard component
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
}

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'COMM';
  scheme: string;
}

// Fix: Added missing StreamingCredential interface for SettingsMenu component
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
  // Fix: Updated credentials from any[] to StreamingCredential[]
  credentials: StreamingCredential[];
}

// Fix: Added missing MeetingInfo interface for MeetingView component
export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  attendees?: string[];
}

// Fix: Added missing CarAction type for BluelinkPanel component
export type CarAction = 'LOCK' | 'UNLOCK' | 'START' | 'STOP' | 'WINDOWS_UP' | 'WINDOWS_DOWN' | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

// Fix: Added missing CarStatus interface for BluelinkPanel component
export interface CarStatus {
  isLocked: boolean;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  hazardActive: boolean;
  isUpdating: boolean;
}
