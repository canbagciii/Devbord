import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';
import { supabase } from '../lib/supabase';

export type CapacityMetricType = 'hours' | 'storyPoints' | 'both';

interface CapacityMetricContextType {
  capacityMetric: CapacityMetricType;
  setCapacityMetric: (metric: CapacityMetricType) => void;
  dailyHours: number;
  dailyStoryPoints: number;
  setDailyHours: (hours: number) => void;
  setDailyStoryPoints: (points: number) => void;
}

const CapacityMetricContext = createContext<CapacityMetricContextType | undefined>(undefined);

const getDailyHoursFromStorage = (): number => {
  try {
    const stored = localStorage.getItem('dailyHours');
    const v = stored ? parseFloat(stored) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return 8;
};

const getDailyStoryPointsFromStorage = (): number => {
  try {
    const stored = localStorage.getItem('dailyStoryPoints');
    const v = stored ? parseFloat(stored) : NaN;
    if (Number.isFinite(v) && v > 0) return v;
  } catch {}
  return 8;
};

export const CapacityMetricProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [capacityMetric, setCapacityMetricState] = useState<CapacityMetricType>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('globalCapacityMetric') as CapacityMetricType | null;
      return stored || 'hours';
    }
    return 'hours';
  });

  const [dailyHours, setDailyHoursState] = useState<number>(getDailyHoursFromStorage);
  const [dailyStoryPoints, setDailyStoryPointsState] = useState<number>(getDailyStoryPointsFromStorage);

  useEffect(() => {
    const loadCapacitySettings = async () => {
      const companyId = localStorage.getItem('companyId');
      if (!companyId) return;

      const { data, error } = await supabase
        .from('capacity_settings')
        .select('capacity_metric, daily_hours, daily_story_points')
        .eq('company_id', companyId)
        .maybeSingle();

      if (!error && data) {
        if (data.capacity_metric) {
          setCapacityMetricState(data.capacity_metric as CapacityMetricType);
        }
        if (data.daily_hours) {
          setDailyHoursState(Number(data.daily_hours));
        }
        if (data.daily_story_points) {
          setDailyStoryPointsState(Number(data.daily_story_points));
        }
      }
    };

    loadCapacitySettings();
  }, []);

  const setCapacityMetric = (metric: CapacityMetricType) => {
    setCapacityMetricState(metric);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('globalCapacityMetric', metric);
    }
  };

  const setDailyHours = (hours: number) => {
    setDailyHoursState(hours);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dailyHours', String(hours));
    }
  };

  const setDailyStoryPoints = (points: number) => {
    setDailyStoryPointsState(points);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('dailyStoryPoints', String(points));
    }
  };

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('globalCapacityMetric', capacityMetric);
    }
  }, [capacityMetric]);

  return (
    <CapacityMetricContext.Provider value={{
      capacityMetric,
      setCapacityMetric,
      dailyHours,
      dailyStoryPoints,
      setDailyHours,
      setDailyStoryPoints
    }}>
      {children}
    </CapacityMetricContext.Provider>
  );
};

export const useCapacityMetric = () => {
  const context = useContext(CapacityMetricContext);
  if (context === undefined) {
    throw new Error('useCapacityMetric must be used within a CapacityMetricProvider');
  }
  return context;
};
