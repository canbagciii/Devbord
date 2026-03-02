import { useState, useEffect } from 'react';
import { kolayikService } from '../services/kolayikService';
import { DeveloperLeaveInfo, CapacityCalculation } from '../types/kolayik';
import { DeveloperWorkload } from '../types';

interface KolayIKIntegrationState {
  leaveInfo: DeveloperLeaveInfo[];
  capacityCalculations: CapacityCalculation[];
  loading: boolean;
  error: string | null;
  connectionStatus: { success: boolean; message: string; employeeCount?: number } | null;
}

export const useKolayIKIntegration = (
  workload: DeveloperWorkload[] | null,
  sprintStartDate: string | null,
  sprintEndDate: string | null
) => {
  const [state, setState] = useState<KolayIKIntegrationState>({
    leaveInfo: [],
    capacityCalculations: [],
    loading: false,
    error: null,
    connectionStatus: null
  });

  // API bağlantısını test et
  const testConnection = async () => {
    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      const result = await kolayikService.testConnection();
      setState(prev => ({ 
        ...prev, 
        connectionStatus: result,
        loading: false,
        error: result.success ? null : result.message
      }));
      return result;
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'Bağlantı testi başarısız';
      setState(prev => ({ 
        ...prev, 
        connectionStatus: { success: false, message: errorMessage },
        loading: false,
        error: errorMessage
      }));
      return { success: false, message: errorMessage };
    }
  };

  // İzin verilerini yükle ve kapasite hesapla
  const loadLeaveDataAndCalculateCapacities = async () => {
    if (!workload || !sprintStartDate || !sprintEndDate) {
      console.log('⚠️ Missing required data for leave calculation');
      return;
    }

    setState(prev => ({ ...prev, loading: true, error: null }));
    
    try {
      console.log('🔄 Loading leave data and calculating capacities...');
      
      const developerNames = workload.map(dev => dev.developer);
      
      // İzin verilerini çek
      const leaveInfo = await kolayikService.getDeveloperLeaveInfo(
        developerNames,
        sprintStartDate,
        sprintEndDate
      );
      
      // Kapasite hesaplamalarını yap
      const capacityCalculations = kolayikService.calculateAdjustedCapacities(
        developerNames,
        sprintStartDate,
        sprintEndDate,
        leaveInfo
      );
      
      setState(prev => ({
        ...prev,
        leaveInfo,
        capacityCalculations,
        loading: false,
        error: null
      }));
      
      console.log('✅ Leave data and capacity calculations completed');
      
    } catch (error) {
      const errorMessage = error instanceof Error ? error.message : 'İzin verileri yüklenirken hata oluştu';
      console.error('Error loading leave data:', error);
      
      setState(prev => ({
        ...prev,
        loading: false,
        error: errorMessage
      }));
    }
  };

  // Yazılımcının ayarlanmış kapasitesini getir
  const getAdjustedCapacity = (developerName: string): number => {
    const calculation = state.capacityCalculations.find(calc => calc.developerName === developerName);
    if (calculation) {
      return calculation.adjustedCapacity;
    }

    // Kapasite hesabı yoksa şirket konfigürasyonundan mantıklı bir varsayılan üret
    try {
      const metric = typeof localStorage !== 'undefined' ? localStorage.getItem('capacityMetric') : null;
      if (metric === 'hours') {
        const stored = typeof localStorage !== 'undefined' ? localStorage.getItem('dailyHours') : null;
        const dailyParsed = stored ? parseFloat(stored) : NaN;
        const dailyHours = Number.isFinite(dailyParsed) && dailyParsed > 0 ? dailyParsed : 7;
        // Ortalama 2 haftalık sprint ~ 10 iş günü
        return Math.round(dailyHours * 10);
      }
    } catch (e) {
      console.warn('Kapasite konfigürasyonu okunamadı, 70h varsayılan kullanılacak:', e);
    }

    return 70; // Eski davranış ile geriye dönük uyumluluk
  };

  // Yazılımcının izin detaylarını getir
  const getDeveloperLeaveDetails = (developerName: string): DeveloperLeaveInfo | null => {
    return state.leaveInfo.find(info => info.developerName === developerName) || null;
  };

  // Cache'i temizle
  const clearCache = () => {
    kolayikService.clearCache();
  };

  // Manuel yenileme
  const refresh = () => {
    clearCache();
    loadLeaveDataAndCalculateCapacities();
  };

  return {
    ...state,
    testConnection,
    loadLeaveDataAndCalculateCapacities,
    getAdjustedCapacity,
    getDeveloperLeaveDetails,
    clearCache,
    refresh
  };
};