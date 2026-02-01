
import React, { useState, useEffect, useRef, useCallback } from 'react';
import { GoogleGenAI, Modality, LiveServerMessage, Type, FunctionDeclaration } from '@google/genai';
import { TravelInfo, MediaApp, TrackMetadata, AppSettings, MapMode, MapLayer } from './types';
import Avatar from './components/Avatar';
import MapView from './components/MapView';
import AddStopModal from './components/AddStopModal';
import NavigationPanel from './components/NavigationPanel';
import MiniPlayer from './components/MiniPlayer';
import SettingsMenu from './components/SettingsMenu';
import { decode, decodeAudioData, createBlob } from './utils/audio';

const APP_DATABASE: MediaApp[] = [
  { id: 'spotify', name: 'Spotify', icon: 'fab fa-spotify', color: 'text-[#1DB954]', category: 'AUDIO', scheme: 'spotify:search:' },
  { id: 'deezer', name: 'Deezer', icon: 'fas fa-music', color: 'text-purple-400', category: 'AUDIO', scheme: 'deezer://search?q=' },
  { id: 'applemusic', name: 'Apple Music', icon: 'fab fa-apple', color: 'text-pink-500', category: 'AUDIO', scheme: 'music://search?term=' },
  { id: 'youtube', name: 'YouTube', icon: 'fab fa-youtube', color: 'text-red-600', category: 'VIDEO', scheme: 'youtube://results?search_query=' },
  { id: 'netflix', name: 'Netflix', icon: 'fas fa-n', color: 'text-red-700', category: 'VIDEO', scheme: 'netflix://search?q=' },
  { id: 'disneyplus', name: 'Disney+', icon: 'fas fa-plus', color: 'text-blue-400', category: 'VIDEO', scheme: 'disneyplus://search?q=' },
  { id: 'globoplay', name: 'Globoplay', icon: 'fas fa-play', color: 'text-pink-600', category: 'VIDEO', scheme: 'globoplay://busca/' },
  { id: 'primevideo', name: 'Prime Video', icon: 'fab fa-amazon', color: 'text-blue-300', category: 'VIDEO', scheme: 'primevideo://search?q=' },
  { id: 'max', name: 'Max (HBO)', icon: 'fas fa-m', color: 'text-blue-900', category: 'VIDEO', scheme: 'hbomax://search?q=' },
  { id: 'stremio', name: 'Stremio', icon: 'fas fa-film', color: 'text-purple-500', category: 'VIDEO', scheme: 'stremio://search?q=' },
  { id: 'skyplus', name: '