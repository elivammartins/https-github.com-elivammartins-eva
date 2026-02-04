
import { RiskLevel } from '../types';

export function calculateRisk(lat: number, lng: number): { level: RiskLevel; score: number } {
  const hour = new Date().getHours();
  let score = 10; // Base safe

  // Simulação de zonas de risco baseadas em horário (Noite = Maior risco)
  if (hour >= 22 || hour <= 5) score += 40;
  
  // Áreas específicas (Simulação de geofencing de risco)
  if (lat < -15.8 && lng < -47.9) score += 30;

  if (score >= 80) return { level: 'CRITICAL', score };
  if (score >= 60) return { level: 'DANGER', score };
  if (score >= 30) return { level: 'CAUTION', score };
  return { level: 'SAFE', score };
}
