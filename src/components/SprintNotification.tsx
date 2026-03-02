import React from 'react';
import { useJiraData } from '../context/JiraDataContext';
import { Calendar, X, ArrowRight } from 'lucide-react';

export const SprintNotification: React.FC = () => {
  const { showSprintNotification, hideSprintNotification, sprintType, setSprintType } = useJiraData();

  if (!showSprintNotification) return null;

  const handleSwitchToClosed = () => {
    setSprintType('closed');
    hideSprintNotification();
  };

  return (
    <div className="fixed bottom-4 right-4 z-50 max-w-sm">
      <div className="bg-blue-600 text-white rounded-lg shadow-lg border border-blue-700 p-4">
        <div className="flex items-start space-x-3">
          <Calendar className="h-5 w-5 text-blue-200 mt-0.5 flex-shrink-0" />
          <div className="flex-1 min-w-0">
            <h4 className="text-sm font-semibold text-white mb-1">
              Aktif Sprintler Gösteriliyor
            </h4>
            <p className="text-sm text-blue-100 mb-3">
              Son kapatılan sprint&apos;i görmek için tıklayınız.
            </p>
            <div className="flex items-center space-x-2">
              <button
              onClick={handleSwitchToClosed}
                className="flex items-center space-x-2 px-3 py-1.5 bg-white text-blue-600 rounded-md hover:bg-blue-50 transition-colors text-sm font-medium"
              >
                <span>Son Sprint&apos;e Geç</span>
                <ArrowRight className="h-4 w-4" />
              </button>
              <button
                onClick={hideSprintNotification}
                className="p-1.5 text-blue-200 hover:text-white hover:bg-blue-700 rounded-md transition-colors"
                title="Bildirimi kapat"
              >
                <X className="h-4 w-4" />
              </button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};