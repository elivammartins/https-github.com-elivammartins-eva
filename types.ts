
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type MediaViewState = 'FULL' | 'PIP' | 'HIDDEN';
export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC';

export interface RouteStep {
  instruction: string;
  street: string;
  distance: number;
  maneuver: string;
}

export interface RouteWarning {
  id: string;
  type: WarningType;
  distance: number;
  description: string;
  coords: [number, number];
}

export interface StopInfo {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE';
  coords: [number, number];
}

export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE';
  distance: string;
  rating: number;
  coords: [number, number];
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: StopInfo[];
  nextInstruction?: RouteStep;
  allSteps?: RouteStep[];
  warnings: RouteWarning[];
  drivingTimeMinutes?: number;
  totalDistanceKm?: number;
  currentLimit?: number;
}

export interface Contact {
  name: string;
  phone: string;
}

export interface IncomingMessage {
  id: string;
  sender: string;
  content: string;
  timestamp: number;
  type: 'WHATSAPP' | 'SMS';
}

export interface AppSettings {
  userName: string;
  voiceVolume: number;
  privacyMode: boolean;
  messageLimit: 128 | 'full';
  playerProfiles: { appName: string; profileName: string }[];
}

export type CarAction = 
  | 'START' | 'STOP' 
  | 'LOCK' | 'UNLOCK' 
  | 'WINDOWS_UP' | 'WINDOWS_DOWN' 
  | 'HAZARD_LIGHTS' | 'HORN_LIGHTS';

export interface CarStatus {
  lastAction: string;
  isEngineRunning: boolean;
  areWindowsOpen: boolean;
  isLocked: boolean;
  isUpdating: boolean;
  hazardActive: boolean;
}

// Added MediaApp interface for dashboard and entertainment apps
export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO';
  scheme: string;
}

// Added TrackMetadata for media playback information
export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number;
}

// Added MeetingInfo for calendar and meeting views
export interface MeetingInfo {
  title: string;
  startTime: string;
}
