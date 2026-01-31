
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  heading: number | null;
}

export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC';

export interface RouteWarning {
  id: string;
  type: WarningType;
  distance: number; // em metros
  description: string;
  coords: [number, number];
}

export interface StopInfo {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE';
  coords: [number, number];
}

// Added StopRecommendation to resolve error in RecommendationCard.tsx
export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE';
  distance: string;
  rating: number;
}

// Added AppSettings to resolve error in SettingsMenu.tsx
export interface AppSettings {
  userName: string;
  voiceVolume: number;
}

// Added MeetingInfo to resolve error in MeetingView.tsx
export interface MeetingInfo {
  title: string;
  startTime: string;
  id?: string;
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  stops: StopInfo[];
  nextInstruction?: { instruction: string; distance: string; icon: string };
  warnings: RouteWarning[];
  // Added drivingTimeMinutes to resolve property access in Dashboard.tsx
  drivingTimeMinutes?: number;
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
  category: 'AUDIO' | 'VIDEO' | 'NAV' | 'METRICS';
}

export enum LayoutMode {
  HUD = 'HUD',
  FULL_MAP = 'FULL_MAP',
  VIDEO_FOCUS = 'VIDEO_FOCUS'
}
