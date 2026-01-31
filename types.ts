
export interface LocationData {
  latitude: number;
  longitude: number;
  speed: number;
  leadVehicleSpeed: number;
  distanceToLead: number;
  heading: number | null;
}

export type WarningType = 'RADAR' | 'ACCIDENT' | 'HAZARD' | 'POLICE' | 'TRAFFIC';
export type WarningSource = 'WAZE' | 'RADARBOT' | 'GOOGLE_MAPS';

export interface RouteWarning {
  type: WarningType;
  count: number;
  source?: WarningSource;
}

export interface TurnByTurnInstruction {
  instruction: string;
  distance: string;
  icon: string;
}

export interface StopInfo {
  name: string;
  timeToReach: number; 
  distance: string; 
  coords?: [number, number]; 
  warnings?: RouteWarning[]; 
}

export interface StopRecommendation {
  name: string;
  type: 'GAS' | 'FOOD' | 'REST' | 'COFFEE' | 'OTHER';
  distance: string;
  rating: number;
  coords: [number, number];
}

export interface TravelInfo {
  destination: string;
  destinationCoords?: [number, number];
  eta: string;
  distanceRemaining: string;
  drivingTimeMinutes: number;
  elapsedTimeMinutes: number;
  stops: StopInfo[];
  isRerouting?: boolean;
  nextInstruction?: TurnByTurnInstruction;
}

export interface TrackMetadata {
  title: string;
  artist: string;
  isPlaying: boolean;
  progress: number;
  duration: number;
}

export interface MeetingInfo {
  id: string;
  title: string;
  startTime: string;
  endTime: string;
  status: 'SCHEDULED' | 'CANCELED' | 'IN_PROGRESS';
  organizer: string;
  app: 'teams' | 'meet' | 'zoom';
}

export enum LayoutMode {
  STANDARD = 'STANDARD',
  FULL_MAP = 'FULL_MAP',
  MAXIMIZED_WIDGET = 'MAXIMIZED_WIDGET',
  EVA_FOCUS = 'EVA_FOCUS'
}

export type ColumnSide = 'LEFT' | 'RIGHT';

export interface MediaApp {
  id: string;
  name: string;
  icon: string;
  color: string;
  category: 'AUDIO' | 'VIDEO' | 'MEETING' | 'METRICS' | 'NAV' | 'WEATHER';
}

export interface AppSettings {
  layoutMode: LayoutMode;
  columnASide: ColumnSide;
  mapStyle: '2D' | '3D' | 'SATELLITE';
  pinnedAppSlot1: string; 
  pinnedAppSlot2: string; 
  enabledAppIds: string[]; 
  v2vThreshold: number;
  v2vDistance: number; // Nova propriedade para definir distância alvo
  v2vWarningEnabled: boolean;
  voiceVolume: number;
  outlookAccount: string;
  userName: string;
  showTurnByTurn: boolean;
  audioPlayerMode: 'MINI' | 'FULL';
}
