import React from 'react';
import { Task } from '../types';
import { BarChart3, Clock, CheckCircle, AlertCircle, Users } from 'lucide-react';

interface DashboardProps {
  bankName: string;
  tasks: Task[];
}

export const Dashboard: React.FC<DashboardProps> = ({ bankName, tasks }) => {
  const todoTasks = tasks.filter(task => task.status === 'todo');
  const inProgressTasks = tasks.filter(task => task.status === 'in-progress');
  const doneTasks = tasks.filter(task => task.status === 'done');

  const totalEstimatedHours = tasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
  const totalActualHours = tasks.reduce((sum, task) => sum + (task.actualHours || 0), 0);

  const uniqueDevelopers = Array.from(new Set(tasks.map(task => task.assignedTo)));
  const uniqueBanks = Array.from(new Set(tasks.map(task => task.bank)));

  const stats = [
    {
      title: 'Toplam Görev',
      value: tasks.length,
      icon: BarChart3,
      color: 'text-blue-600 bg-blue-100'
    },
    {
      title: 'Aktif Görevler',
      value: inProgressTasks.length,
      icon: Clock,
      color: 'text-yellow-600 bg-yellow-100'
    },
    {
      title: 'Tamamlanan',
      value: doneTasks.length,
      icon: CheckCircle,
      color: 'text-green-600 bg-green-100'
    },
    {
      title: 'Bekleyen',
      value: todoTasks.length,
      icon: AlertCircle,
      color: 'text-red-600 bg-red-100'
    }
  ];

  return (
    <div className="space-y-6">
      {/* Stats Grid */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-4 gap-6">
        {stats.map((stat, index) => (
          <div key={index} className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
            <div className="flex items-center justify-between">
              <div>
                <p className="text-sm font-medium text-gray-600">{stat.title}</p>
                <p className="text-3xl font-bold text-gray-900">{stat.value}</p>
              </div>
              <div className={`p-3 rounded-full ${stat.color}`}>
                <stat.icon className="h-6 w-6" />
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Sprint Info & Summary */}
      <div className="grid grid-cols-1 lg:grid-cols-2 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">
            {bankName === 'Tüm Bankalar' ? 'Genel Bilgiler' : 'Banka Bilgileri'}
          </h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">
                {bankName === 'Tüm Bankalar' ? 'Seçili Görünüm:' : 'Banka Adı:'}
              </span>
              <span className="font-medium">{bankName}</span>
            </div>
            {bankName === 'Tüm Bankalar' && (
              <div className="flex justify-between">
                <span className="text-gray-600">Aktif Banka:</span>
                <span className="font-medium">{uniqueBanks.length}</span>
              </div>
            )}
            <div className="flex justify-between">
              <span className="text-gray-600">Toplam Görev:</span>
              <span className="font-medium">{tasks.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Tamamlanan:</span>
              <span className={`px-2 py-1 rounded-full text-xs font-medium ${
                doneTasks.length > 0 ? 'bg-green-100 text-green-800' : 'bg-gray-100 text-gray-800'
              }`}>
                {doneTasks.length} görev
              </span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900 mb-4">Kaynak Dağılımı</h3>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Aktif Yazılımcı:</span>
              <span className="font-medium">{uniqueDevelopers.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Analist Tahmini Süre:</span>
              <span className="font-medium">{totalEstimatedHours} saat</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Gerçekleşen:</span>
              <span className="font-medium">{totalActualHours} saat</span>
            </div>
          </div>
        </div>
      </div>

      {/* Progress Bar */}
      <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
        <h3 className="text-lg font-semibold text-gray-900 mb-4">
          {bankName === 'Tüm Bankalar' ? 'Genel Görev İlerlemesi' : 'Banka Görev İlerlemesi'}
        </h3>
        <div className="space-y-2">
          <div className="flex justify-between text-sm">
            <span>Tamamlanan: {doneTasks.length}</span>
            <span>Toplam: {tasks.length}</span>
          </div>
          <div className="w-full bg-gray-200 rounded-full h-2">
            <div 
              className="bg-green-600 h-2 rounded-full transition-all duration-300"
              style={{ width: `${tasks.length > 0 ? (doneTasks.length / tasks.length) * 100 : 0}%` }}
            />
          </div>
        </div>
      </div>
    </div>
  );
};