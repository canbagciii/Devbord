import React, { createContext, useContext, useState, useEffect, ReactNode } from 'react';

export type CapacityMetricType = 'hours' | 'storyPoints' | 'both';

interface CapacityMetricContextType {
  capacityMetric: CapacityMetricType;
  setCapacityMetric: (metric: CapacityMetricType) => void;
}

const CapacityMetricContext = createContext<CapacityMetricContextType | undefined>(undefined);

export const CapacityMetricProvider: React.FC<{ children: ReactNode }> = ({ children }) => {
  const [capacityMetric, setCapacityMetricState] = useState<CapacityMetricType>(() => {
    if (typeof localStorage !== 'undefined') {
      const stored = localStorage.getItem('globalCapacityMetric') as CapacityMetricType | null;
      return stored || 'hours';
    }
    return 'hours';
  });

  const setCapacityMetric = (metric: CapacityMetricType) => {
    setCapacityMetricState(metric);
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('globalCapacityMetric', metric);
    }
  };

  useEffect(() => {
    if (typeof localStorage !== 'undefined') {
      localStorage.setItem('globalCapacityMetric', capacityMetric);
    }
  }, [capacityMetric]);

  return (
    <CapacityMetricContext.Provider value={{ capacityMetric, setCapacityMetric }}>
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
