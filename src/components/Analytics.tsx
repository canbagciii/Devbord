import React from 'react';
import { Task } from '../types';
import { BarChart, PieChart, TrendingUp, Clock } from 'lucide-react';

interface AnalyticsProps {
  tasks: Task[];
}

export const Analytics: React.FC<AnalyticsProps> = ({ tasks }) => {
  // Ana görevlerin sürelerini alt görevleri ile toplayarak yeni liste oluştur
  const tasksWithTotals = tasks.map(task => {
    const subEstimated = (task.subtasks || []).reduce(
      (sum, sub) => sum + (sub.estimatedHours || 0),
      0
    );
    const subActual = (task.subtasks || []).reduce(
      (sum, sub) => sum + (sub.actualHours || 0),
      0
    );

    return {
      ...task,
      estimatedHours: (task.estimatedHours || 0) + subEstimated,
      actualHours: (task.actualHours || 0) + subActual,
    };
  });

  // Developer workload analysis
  const developerStats = tasksWithTotals.reduce((acc, task) => {
    if (!acc[task.assignedTo]) {
      acc[task.assignedTo] = { 
        total: 0, 
        completed: 0, 
        inProgress: 0, 
        todo: 0,
        estimatedHours: 0,
        actualHours: 0
      };
    }
    acc[task.assignedTo].total++;
    acc[task.assignedTo][
      task.status === 'done' ? 'completed' : 
      task.status === 'in-progress' ? 'inProgress' : 'todo'
    ]++;
    acc[task.assignedTo].estimatedHours += task.estimatedHours || 0;
    acc[task.assignedTo].actualHours += task.actualHours || 0;
    return acc;
  }, {} as Record<string, any>);

  // Bank distribution
  const bankStats = tasksWithTotals.reduce((acc, task) => {
    if (!acc[task.bank]) {
      acc[task.bank] = { count: 0, completed: 0 };
    }
    acc[task.bank].count++;
    if (task.status === 'done') {
      acc[task.bank].completed++;
    }
    return acc;
  }, {} as Record<string, any>);

  // Time analysis
  const timeStats = tasksWithTotals.reduce((acc, task) => {
    acc.totalEstimated += task.estimatedHours || 0;
    acc.totalActual += task.actualHours || 0;
    if (task.estimatedHours && task.actualHours) {
      acc.tasksWithBoth++;
      acc.variance += Math.abs(task.estimatedHours - task.actualHours);
    }
    return acc;
  }, { totalEstimated: 0, totalActual: 0, tasksWithBoth: 0, variance: 0 });

  const avgVariance = timeStats.tasksWithBoth > 0 ? 
    (timeStats.variance / timeStats.tasksWithBoth).toFixed(1) : '0';

  return (
    <div className="space-y-6">
      <div className="flex items-center space-x-2 mb-6">
        <BarChart className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Analiz & Raporlar</h2>
      </div>

      {/* Time Overview */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Tahmini Süre</p>
              <p className="text-2xl font-bold text-blue-600">{timeStats.totalEstimated}h</p>
            </div>
            <Clock className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam Gerçekleşen</p>
              <p className="text-2xl font-bold text-green-600">{timeStats.totalActual}h</p>
            </div>
            <TrendingUp className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Ortalama Sapma</p>
              <p className="text-2xl font-bold text-orange-600">{avgVariance}h</p>
            </div>
            <PieChart className="h-8 w-8 text-orange-600" />
          </div>
        </div>
      </div>

      {/* Developer Workload */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Yazılımcı İş Yükü Analizi</h3>
        <div className="overflow-x-auto">
          <table className="w-full">
            <thead>
              <tr className="border-b border-gray-200">
                <th className="text-left py-2 px-4 font-medium text-gray-600">Yazılımcı</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Toplam</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Tamamlandı</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Devam Eden</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Bekleyen</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Tahmini</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Gerçekleşen</th>
                <th className="text-center py-2 px-4 font-medium text-gray-600">Tamamlanma</th>
              </tr>
            </thead>
            <tbody>
              {Object.entries(developerStats).map(([developer, stats]: [string, any]) => (
                <tr key={developer} className="border-b border-gray-100">
                  <td className="py-3 px-4 font-medium text-gray-900">{developer}</td>
                  <td className="py-3 px-4 text-center">{stats.total}</td>
                  <td className="py-3 px-4 text-center text-green-600">{stats.completed}</td>
                  <td className="py-3 px-4 text-center text-yellow-600">{stats.inProgress}</td>
                  <td className="py-3 px-4 text-center text-red-600">{stats.todo}</td>
                  <td className="py-3 px-4 text-center">{stats.estimatedHours}h</td>
                  <td className="py-3 px-4 text-center">{stats.actualHours}h</td>
                  <td className="py-3 px-4 text-center">
                    <div className="flex items-center justify-center">
                      <span className="text-sm font-medium mr-2">
                        {((stats.completed / stats.total) * 100).toFixed(0)}%
                      </span>
                      <div className="w-16 bg-gray-200 rounded-full h-2">
                        <div 
                          className="bg-green-600 h-2 rounded-full"
                          style={{ width: `${(stats.completed / stats.total) * 100}%` }}
                        />
                      </div>
                    </div>
                  </td>
                </tr>
              ))}
            </tbody>
          </table>
        </div>
      </div>

      {/* Bank Distribution */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">Banka Görev Dağılımı</h3>
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
          {Object.entries(bankStats).map(([bank, stats]: [string, any]) => (
            <div key={bank} className="border border-gray-200 rounded-lg p-4">
              <h4 className="font-medium text-gray-900 mb-2">{bank}</h4>
              <div className="space-y-2">
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Toplam Görev:</span>
                  <span className="font-medium">{stats.count}</span>
                </div>
                <div className="flex justify-between">
                  <span className="text-sm text-gray-600">Tamamlanan:</span>
                  <span className="font-medium text-green-600">{stats.completed}</span>
                </div>
                <div className="w-full bg-gray-200 rounded-full h-2">
                  <div 
                    className="bg-blue-600 h-2 rounded-full"
                    style={{ width: `${(stats.completed / stats.count) * 100}%` }}
                  />
                </div>
              </div>
            </div>
          ))}
        </div>
      </div>
    </div>
  );
};
