/**
 * Workload hesaplamaları için utility fonksiyonları
 * DeveloperWorkloadDashboard component'inden taşınmıştır
 */

import * as React from 'react';
import { AlertTriangle, CheckCircle, TrendingUp, Clock } from 'lucide-react';
import type { CapacityCalculation } from '../types/kolayik';

// DeveloperWorkload tipi types'tan import edilemiyor, bu yüzden any kullanıyoruz
// TODO: DeveloperWorkload tipini types/index.ts'den export et
type DeveloperWorkload = any;

/**
 * Developer status tipleri
 */
export type DeveloperStatus = 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük';

/**
 * Yazılımcının kapasitesini hesapla
 * İzin entegrasyonu aktifse ayarlanmış kapasiteyi kullanır
 */
export const getDeveloperCapacity = (
  developerName: string,
  getCapacity: (name: string) => number,
  showKolayIKIntegration: boolean,
  capacityCalculations: CapacityCalculation[]
): number => {
  let capacity = getCapacity(developerName);
  if (showKolayIKIntegration && capacityCalculations.length > 0) {
    const calc = capacityCalculations.find(c => c.developerName === developerName);
    if (calc) {
      capacity = calc.adjustedCapacity;
    }
  }
  return capacity;
};

/**
 * Yazılımcının durumunu hesapla (actualHours ve capacity'ye göre)
 */
export const calculateDeveloperStatus = (
  actualHours: number,
  capacity: number
): DeveloperStatus => {
  if (actualHours === capacity) {
    return 'Yeterli';
  } else if (actualHours < capacity) {
    return 'Eksik Yük';
  } else {
    return 'Aşırı Yük';
  }
};

/**
 * Status'a göre CSS class'larını döndür
 */
export const getStatusColor = (status: string): string => {
  switch (status) {
    case 'Eksik Yük':
      return 'bg-yellow-100 text-yellow-800 border-yellow-200';
    case 'Yeterli':
      return 'bg-green-100 text-green-800 border-green-200';
    case 'Aşırı Yük':
      return 'bg-red-100 text-red-800 border-red-200';
    default:
      return 'bg-gray-100 text-gray-800 border-gray-200';
  }
};

/**
 * Status'a göre React icon döndür
 */
export const getStatusIcon = (status: string): React.ReactElement => {
  switch (status) {
    case 'Eksik Yük':
      return React.createElement(AlertTriangle, { className: 'h-4 w-4' });
    case 'Yeterli':
      return React.createElement(CheckCircle, { className: 'h-4 w-4' });
    case 'Aşırı Yük':
      return React.createElement(TrendingUp, { className: 'h-4 w-4' });
    default:
      return React.createElement(Clock, { className: 'h-4 w-4' });
  }
};

/**
 * Workload istatistikleri interface'i
 */
export interface WorkloadStats {
  totalDevelopers: number;
  underloaded: number;
  adequate: number;
  overloaded: number;
  totalEstimatedHours: number;
  totalActualHours: number;
}

/**
 * Workload istatistiklerini hesapla
 */
export const calculateWorkloadStats = (
  filteredWorkload: DeveloperWorkload[],
  actualHoursData: Record<string, number>,
  capacityCalculations: CapacityCalculation[],
  showKolayIKIntegration: boolean,
  getCapacity: (name: string) => number
): WorkloadStats => {
  const stats: WorkloadStats = {
    totalDevelopers: filteredWorkload.length,
    underloaded: 0,
    adequate: 0,
    overloaded: 0,
    totalEstimatedHours: 0,
    totalActualHours: 0
  };

  // Her yazılımcı için durumu hesapla
  for (const dev of filteredWorkload) {
    const capacity = getDeveloperCapacity(
      dev.developer,
      getCapacity,
      showKolayIKIntegration,
      capacityCalculations
    );
    const actualHours = actualHoursData[dev.developer] || 0;
    const status = calculateDeveloperStatus(actualHours, capacity);

    // Status'a göre sayacı artır
    switch (status) {
      case 'Eksik Yük':
        stats.underloaded++;
        break;
      case 'Yeterli':
        stats.adequate++;
        break;
      case 'Aşırı Yük':
        stats.overloaded++;
        break;
    }

    // Toplam saatleri hesapla
    stats.totalEstimatedHours += dev.totalHours;
    stats.totalActualHours += actualHours;
  }

  // Toplam saatleri yuvarla
  stats.totalEstimatedHours = Math.round(stats.totalEstimatedHours * 100) / 100;
  stats.totalActualHours = Math.round(stats.totalActualHours * 100) / 100;

  return stats;
};

