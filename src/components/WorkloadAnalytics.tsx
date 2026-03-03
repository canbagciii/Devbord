import React, { useState, useEffect, useMemo } from 'react';
import { DeveloperWorkload, WorkloadAnalytics as Analytics } from '../types';
import { jiraService } from '../lib/jiraService';
import { BarChart3, PieChart, TrendingUp, Users, Clock, Activity, Loader } from 'lucide-react';
import { useJiraData } from '../context/JiraDataContext';
import { useAuth } from '../context/AuthContext';

export const WorkloadAnalytics: React.FC = () => {
  const { workload, loading, error, refresh } = useJiraData();
  const { canViewDeveloperData } = useAuth();
  const [analytics, setAnalytics] = useState<Analytics | null>(null);

  const filteredWorkload = useMemo(() => {
    if (!workload) return [] as DeveloperWorkload[];
    return workload.filter(dev => canViewDeveloperData(dev.developer));
  }, [workload, canViewDeveloperData]);

  const memoizedAnalytics = useMemo(() => {
    if (!filteredWorkload.length) return null as Analytics | null;

    let totalTasks = 0;
    let totalHours = 0;
    let underloadedCount = 0;
    let adequateCount = 0;
    let overloadedCount = 0;
    const projectDistribution: { [project: string]: number } = {};
    const sprintDistribution: { [sprint: string]: number } = {};

    for (let i = 0; i < filteredWorkload.length; i++) {
      const dev = filteredWorkload[i];
      totalTasks += dev.totalTasks;
      totalHours += dev.totalHours;
      if (dev.status === 'Eksik Yük') underloadedCount++;
      else if (dev.status === 'Yeterli') adequateCount++;
      else if (dev.status === 'Aşırı Yük') overloadedCount++;

      const details = dev.details;
      for (let j = 0; j < details.length; j++) {
        const d = details[j];
        projectDistribution[d.project] = (projectDistribution[d.project] || 0) + d.hours;
        sprintDistribution[d.sprint] = (sprintDistribution[d.sprint] || 0) + d.hours;
      }
    }

    const totalDevelopers = filteredWorkload.length;
    const averageWorkload = totalDevelopers > 0 ? Math.round(totalHours / totalDevelopers) : 0;
    return {
      totalDevelopers,
      averageWorkload,
      underloadedCount,
      adequateCount,
      overloadedCount,
      totalTasks,
      totalHours,
      projectDistribution,
      sprintDistribution
    } as Analytics;
  }, [filteredWorkload]);

  useEffect(() => {
    setAnalytics(memoizedAnalytics);
  }, [memoizedAnalytics]);

  if (loading) {
    return (
      <div className="flex items-center justify-center py-12">
        <div className="flex items-center space-x-2">
          <Loader className="h-6 w-6 animate-spin text-blue-600" />
          <span className="text-gray-600">Analitik veriler hesaplanıyor...</span>
        </div>
      </div>
    );
  }

  if (error || !analytics) {
    return (
      <div className="bg-red-50 border border-red-200 rounded-lg p-6">
        <div className="flex items-center space-x-2">
          <BarChart3 className="h-5 w-5 text-red-600" />
          <p className="text-red-800">{error || 'Analiz verisi yüklenemedi'}</p>
        </div>
        <button
          onClick={refresh}
          className="mt-4 px-4 py-2 bg-red-600 text-white rounded-lg hover:bg-red-700 transition-colors"
        >
          Tekrar Dene
        </button>
      </div>
    );
  }

  const topProjects = useMemo(() => {
    return Object.entries(analytics.projectDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  }, [analytics.projectDistribution]);

  const topSprints = useMemo(() => {
    return Object.entries(analytics.sprintDistribution)
      .sort(([,a], [,b]) => b - a)
      .slice(0, 5);
  }, [analytics.sprintDistribution]);

  return (
    <div className="space-y-6">
      {/* Header */}
      <div>
        <h2 className="text-2xl font-bold text-gray-900">İş Yükü Analitikleri</h2>
        <p className="text-gray-600 mt-1">Detaylı istatistikler ve dağılım analizi</p>
      </div>

      {/* Main Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Yazılımcı</p>
              <p className="text-3xl font-bold text-blue-600">{analytics.totalDevelopers}</p>
            </div>
            <Users className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Görev</p>
              <p className="text-3xl font-bold text-green-600">{analytics.totalTasks}</p>
            </div>
            <Activity className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Süre</p>
              <p className="text-3xl font-bold text-purple-600">{analytics.totalHours}h</p>
            </div>
            <Clock className="h-8 w-8 text-purple-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ortalama Yük</p>
              <p className="text-3xl font-bold text-orange-600">{analytics.averageWorkload}h</p>
            </div>
            <TrendingUp className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Workload Distribution */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <PieChart className="h-5 w-5 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">İş Yükü Dağılımı</h3>
          </div>
          
          <div className="space-y-4">
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-yellow-500 rounded"></div>
                <span className="text-sm text-gray-600">Eksik Yük (&lt;70h)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-900">{analytics.underloadedCount}</span>
                <span className="text-sm text-gray-500">
                  ({Math.round((analytics.underloadedCount / analytics.totalDevelopers) * 100)}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-green-500 rounded"></div>
                <span className="text-sm text-gray-600">Yeterli (70-90h)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-900">{analytics.adequateCount}</span>
                <span className="text-sm text-gray-500">
                  ({Math.round((analytics.adequateCount / analytics.totalDevelopers) * 100)}%)
                </span>
              </div>
            </div>
            
            <div className="flex items-center justify-between">
              <div className="flex items-center space-x-2">
                <div className="w-4 h-4 bg-red-500 rounded"></div>
                <span className="text-sm text-gray-600">Aşırı Yük (&gt;90h)</span>
              </div>
              <div className="flex items-center space-x-2">
                <span className="text-lg font-semibold text-gray-900">{analytics.overloadedCount}</span>
                <span className="text-sm text-gray-500">
                  ({Math.round((analytics.overloadedCount / analytics.totalDevelopers) * 100)}%)
                </span>
              </div>
            </div>
          </div>

          {/* Visual representation */}
          <div className="mt-6">
            <div className="w-full bg-gray-200 rounded-full h-4 overflow-hidden">
              <div className="h-full flex">
                <div 
                  className="bg-yellow-500"
                  style={{ width: `${(analytics.underloadedCount / analytics.totalDevelopers) * 100}%` }}
                />
                <div 
                  className="bg-green-500"
                  style={{ width: `${(analytics.adequateCount / analytics.totalDevelopers) * 100}%` }}
                />
                <div 
                  className="bg-red-500"
                  style={{ width: `${(analytics.overloadedCount / analytics.totalDevelopers) * 100}%` }}
                />
              </div>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-2 mb-4">
            <BarChart3 className="h-5 w-5 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">En Yoğun Projeler</h3>
          </div>
          
          <div className="space-y-3">
            {topProjects.map(([project, hours], index) => (
              <div key={project} className="flex items-center justify-between">
                <div className="flex items-center space-x-2">
                  <span className="text-sm font-medium text-gray-600">#{index + 1}</span>
                  <span className="text-sm text-gray-900">{project}</span>
                </div>
                <div className="flex items-center space-x-2">
                  <div className="w-20 bg-gray-200 rounded-full h-2">
                    <div 
                      className="bg-green-500 h-2 rounded-full"
                      style={{ width: `${(hours / Math.max(...Object.values(analytics.projectDistribution))) * 100}%` }}
                    />
                  </div>
                  <span className="text-sm font-semibold text-gray-900 w-12 text-right">{hours}h</span>
                </div>
              </div>
            ))}
          </div>
        </div>
      </div>

      {/* Developer Performance Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Yazılımcı Performans Tablosu</h3>
        </div>
        
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead className="bg-gray-50 border-b border-gray-200">
              <tr>
                <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Yazılımcı
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Görev Sayısı
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Harcanan Süre
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Proje Sayısı
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Verimlilik
                </th>
                <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">
                  Durum
                </th>
              </tr>
            </thead>
            <tbody className="bg-white divide-y divide-gray-200">
              {workload?.filter(dev => canViewDeveloperData(dev.developer))
                .sort((a, b) => b.totalActualHours - a.totalActualHours)
                .map((developer, index) => {
                const uniqueProjects = Array.from(new Set(developer.details.map(d => d.project))).length;
                const efficiency = developer.totalTasks > 0 ? Math.round(developer.totalHours / developer.totalTasks) : 0;
                
                return (
                  <tr key={developer.developer} className={`hover:bg-gray-50 transition-colors ${
                    index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                  }`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-8 w-8 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-xs font-medium text-blue-800">
                            {developer.developer.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <span className="text-sm font-medium text-gray-900">{developer.developer}</span>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{developer.totalTasks}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm font-semibold text-gray-900">{Math.round(developer.totalActualHours * 10) / 10}h</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-900">{uniqueProjects}</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className="text-sm text-gray-900">{efficiency}h/görev</span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full ${
                        developer.status === 'Eksik Yük' ? 'bg-yellow-100 text-yellow-800' :
                        developer.status === 'Yeterli' ? 'bg-green-100 text-green-800' :
                        'bg-red-100 text-red-800'
                      }`}>
                        {developer.status}
                      </span>
                    </td>
                  </tr>
                );
              })}
            </tbody>
          </table>
        </div>
      </div>
    </div>
  );
};