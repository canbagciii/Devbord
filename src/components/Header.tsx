import React from 'react';
import { BarChart3, Calendar } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useThemeClasses } from '../hooks/useThemeClasses';
import { UserProfile } from './UserProfile';

export const Header: React.FC = () => {
  const { refresh, loading, sprintType, setSprintType, lastRefreshAt } = useJiraData();
  const { getBgClass, getHoverBgClass, getRingClass } = useThemeClasses();

  const formatLastRefresh = () => {
    if (!lastRefreshAt) return 'Henüz yenilenmedi';
    const d = new Date(lastRefreshAt);
    return d.toLocaleString('tr-TR', {
      day: '2-digit',
      month: '2-digit',
      year: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    });
  };
 
  return (
<header className="bg-white shadow-sm border-b border-gray-200 sticky top-0 z-40">
<div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8">
<div className="flex justify-between items-center h-14">
            {/* Left Side - Logo and Title */}
<div className="flex items-center space-x-3">
<div className="flex items-center space-x-2">
<div className={`flex items-center justify-center w-8 h-8 ${getBgClass()} rounded-lg`}>
<BarChart3 className="h-4 w-4 text-white" />
</div>
<div>
<h1 className="text-base font-semibold text-gray-900">Devbord</h1>
<p className="text-xs text-gray-600">Sprint Ve Yazılımcı Takip Sistemi</p>
</div>
</div>
</div>
 
            {/* Right Side - Controls and User */}
<div className="flex items-center space-x-4">
            {/* Sprint Type Selector + Refresh */}
<div className="flex items-center space-x-3">
  <div className="flex items-center space-x-1.5">
<Calendar className="h-4 w-4 text-gray-500" />
<select
                    value={sprintType}
                    onChange={(e) => setSprintType(e.target.value as 'active' | 'closed')}
                    className={`text-xs border border-gray-300 rounded-lg px-2.5 py-1.5 focus:ring-2 ${getRingClass()} focus:border-transparent bg-white`}
                    disabled={loading}
>
<option value="active">Aktif Sprintler</option>
<option value="closed">Son Kapatılan Sprint</option>
</select>
</div>

  {/* Son yenileme bilgisi */}
  <div className="text-[11px] text-gray-500">
    Son yenileme: {formatLastRefresh()}
  </div>
 
                {/* Refresh Button */}
<button
                  onClick={refresh}
                  disabled={loading}
                  className={`flex items-center space-x-1.5 px-3 py-1.5 ${getBgClass()} text-white rounded-lg ${getHoverBgClass()} disabled:opacity-50 transition-colors text-xs font-medium`}
                  title="Tüm verileri yenile"
>
<BarChart3 className={`h-3.5 w-3.5 ${loading ? 'animate-pulse' : ''}`} />
<span>{loading ? 'Yenileniyor...' : 'Yenile'}</span>
</button>
</div>
 
              {/* User Profile */}
<UserProfile />
</div>
</div>
</div>
</header>
  );
};