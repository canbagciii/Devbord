import React from 'react';
import { Task } from '../types';
import { User, Building, Clock, CheckCircle, AlertCircle, BarChart3, Edit, Trash2 } from 'lucide-react';
import { banks, developers } from '../data/mockData';

interface DeveloperBankDistributionProps {
  allTasks: Task[];
}

export const DeveloperBankDistribution: React.FC<DeveloperBankDistributionProps> = ({ allTasks }) => {
  // Create a matrix of developer-bank assignments
  const distributionMatrix = developers.map(developer => {
    const developerTasks = allTasks.filter(task => task.assignedTo === developer.name);
    
    const bankAssignments = banks.map(bank => {
      const bankTasks = developerTasks.filter(task => task.bank === bank.name);
      const todoTasks = bankTasks.filter(task => task.status === 'todo');
      const inProgressTasks = bankTasks.filter(task => task.status === 'in-progress');
      const doneTasks = bankTasks.filter(task => task.status === 'done');
      const totalHours = bankTasks.reduce((sum, task) => sum + (task.estimatedHours || 0), 0);
      
      return {
        bank: bank.name,
        bankColor: bank.color,
        totalTasks: bankTasks.length,
        todoTasks: todoTasks.length,
        inProgressTasks: inProgressTasks.length,
        doneTasks: doneTasks.length,
        totalHours,
        tasks: bankTasks
      };
    }).filter(assignment => assignment.totalTasks > 0); // Only show banks with tasks
    
    return {
      developer: developer.name,
      totalTasks: developerTasks.length,
      bankAssignments
    };
  }).filter(dev => dev.totalTasks > 0); // Only show developers with tasks

  // Bank summary
  const bankSummary = banks.map(bank => {
    const bankTasks = allTasks.filter(task => task.bank === bank.name);
    const assignedDevelopers = Array.from(new Set(bankTasks.map(task => task.assignedTo)));
    
    return {
      name: bank.name,
      color: bank.color,
      totalTasks: bankTasks.length,
      developerCount: assignedDevelopers.length,
      developers: assignedDevelopers
    };
  }).filter(bank => bank.totalTasks > 0);

  const getStatusColor = (status: string) => {
    switch (status) {
      case 'todo': return 'bg-red-100 text-red-800 border-red-200';
      case 'in-progress': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'done': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const getStatusText = (status: string) => {
    switch (status) {
      case 'todo': return 'BEKLIYOR';
      case 'in-progress': return 'IN TEST';
      case 'done': return 'TAMAM';
      default: return status.toUpperCase();
    }
  };

  const getPriorityIcon = (status: string) => {
    switch (status) {
      case 'todo': return '🔴';
      case 'in-progress': return '🔵';
      case 'done': return '🟢';
      default: return '⚪';
    }
  };

  return (
    <div className="space-y-8">
      <div className="flex items-center space-x-2 mb-6">
        <User className="h-6 w-6 text-blue-600" />
        <h2 className="text-2xl font-bold text-gray-900">Yazılımcı-Banka Görev Dağılımı</h2>
      </div>

      {/* Bank Summary Cards */}
      <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4 mb-8">
        {bankSummary.map((bank) => (
          <div key={bank.name} className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
            <div className="flex items-center space-x-2 mb-3">
              <div 
                className="w-4 h-4 rounded-full"
                style={{ backgroundColor: bank.color }}
              />
              <h3 className="font-semibold text-gray-900 text-sm">{bank.name}</h3>
            </div>
            <div className="space-y-2 text-sm">
              <div className="flex justify-between">
                <span className="text-gray-600">Görev:</span>
                <span className="font-medium">{bank.totalTasks}</span>
              </div>
              <div className="flex justify-between">
                <span className="text-gray-600">Yazılımcı:</span>
                <span className="font-medium">{bank.developerCount}</span>
              </div>
            </div>
          </div>
        ))}
      </div>

      {/* Developer-Bank Matrix with Table Format */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="p-6 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Detaylı Dağılım Matrisi</h3>
        </div>
        
        <div className="space-y-8 p-6">
          {distributionMatrix.map((developerData) => (
            <div key={developerData.developer} className="border border-gray-200 rounded-lg overflow-hidden">
              <div className="bg-gray-50 px-6 py-4 border-b border-gray-200">
                <div className="flex items-center space-x-3">
                  <div className="flex items-center justify-center w-10 h-10 bg-blue-100 rounded-full">
                    <User className="h-5 w-5 text-blue-600" />
                  </div>
                  <div>
                    <h4 className="font-semibold text-gray-900">{developerData.developer}</h4>
                    <p className="text-sm text-gray-600">{developerData.totalTasks} toplam görev</p>
                  </div>
                </div>
              </div>
              
              {/* Tasks for each bank in table format */}
              {developerData.bankAssignments.map((assignment) => (
                <div key={assignment.bank} className="border-b border-gray-100 last:border-b-0">
                  <div className="bg-gray-25 px-6 py-3 border-b border-gray-100">
                    <div className="flex items-center justify-between">
                      <div className="flex items-center space-x-2">
                        <div 
                          className="w-3 h-3 rounded-full"
                          style={{ backgroundColor: assignment.bankColor }}
                        />
                        <h5 className="font-medium text-gray-900">{assignment.bank}</h5>
                        <span className="text-sm text-gray-500">({assignment.totalTasks} görev)</span>
                      </div>
                      <div className="flex space-x-2">
                        {assignment.todoTasks > 0 && (
                          <span className="px-2 py-1 rounded text-xs bg-red-100 text-red-800">
                            {assignment.todoTasks} bekliyor
                          </span>
                        )}
                        {assignment.inProgressTasks > 0 && (
                          <span className="px-2 py-1 rounded text-xs bg-blue-100 text-blue-800">
                            {assignment.inProgressTasks} devam
                          </span>
                        )}
                        {assignment.doneTasks > 0 && (
                          <span className="px-2 py-1 rounded text-xs bg-green-100 text-green-800">
                            {assignment.doneTasks} bitti
                          </span>
                        )}
                      </div>
                    </div>
                  </div>
                  
                  {/* Task table */}
                  {assignment.tasks.length > 0 && (
                    <div className="overflow-x-auto">
                      <table className="w-full">
                        <thead className="bg-gray-50">
                          <tr>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Görev
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Durum
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Süre
                            </th>
                            <th className="px-4 py-2 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">
                              Güncelleme
                            </th>
                          </tr>
                        </thead>
                        <tbody className="bg-white divide-y divide-gray-200">
                          {assignment.tasks.map((task, index) => (
                            <tr 
                              key={task.id} 
                              className={`hover:bg-gray-50 transition-colors ${
                                index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'
                              }`}
                            >
                              <td className="px-4 py-3">
                                <div className="flex items-start space-x-3">
                                  <span className="text-sm">{getPriorityIcon(task.status)}</span>
                                  <div className="flex-1 min-w-0">
                                    <div className="flex items-center space-x-2">
                                      <span className="text-xs font-medium text-blue-600">
                                        {task.id.slice(-6).toUpperCase()}
                                      </span>
                                    </div>
                                    <p className="text-sm font-medium text-gray-900 mt-1 line-clamp-2">
                                      {task.title}
                                    </p>
                                    {task.description && (
                                      <p className="text-xs text-gray-500 mt-1 line-clamp-1">
                                        {task.description}
                                      </p>
                                    )}
                                  </div>
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <span className={`inline-flex items-center px-2.5 py-0.5 rounded-full text-xs font-medium border ${getStatusColor(task.status)}`}>
                                  {getStatusText(task.status)}
                                </span>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-900">
                                  {task.estimatedHours && (
                                    <div className="flex items-center space-x-1">
                                      <Clock className="h-3 w-3 text-gray-400" />
                                      <span>{task.estimatedHours}h</span>
                                      {task.actualHours && (
                                        <span className="text-gray-500">/ {task.actualHours}h</span>
                                      )}
                                    </div>
                                  )}
                                </div>
                              </td>
                              <td className="px-4 py-3">
                                <div className="text-sm text-gray-500">
                                  <div>{task.updatedAt.toLocaleDateString('tr-TR')}</div>
                                  <div className="text-xs">{task.updatedAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                                </div>
                              </td>
                            </tr>
                          ))}
                        </tbody>
                      </table>
                    </div>
                  )}
                </div>
              ))}
            </div>
          ))}
        </div>
      </div>

      {/* Summary Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 gap-6">
        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <BarChart3 className="h-6 w-6 text-blue-600" />
            <h3 className="text-lg font-semibold text-gray-900">Genel İstatistikler</h3>
          </div>
          <div className="space-y-3">
            <div className="flex justify-between">
              <span className="text-gray-600">Aktif Yazılımcı:</span>
              <span className="font-medium">{distributionMatrix.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Aktif Banka:</span>
              <span className="font-medium">{bankSummary.length}</span>
            </div>
            <div className="flex justify-between">
              <span className="text-gray-600">Toplam Görev:</span>
              <span className="font-medium">{allTasks.length}</span>
            </div>
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <User className="h-6 w-6 text-green-600" />
            <h3 className="text-lg font-semibold text-gray-900">En Yoğun Yazılımcı</h3>
          </div>
          {distributionMatrix.length > 0 && (
            <div className="space-y-2">
              {distributionMatrix
                .sort((a, b) => b.totalTasks - a.totalTasks)
                .slice(0, 3)
                .map((dev, index) => (
                  <div key={dev.developer} className="flex justify-between">
                    <span className="text-gray-600">{index + 1}. {dev.developer}:</span>
                    <span className="font-medium">{dev.totalTasks} görev</span>
                  </div>
                ))}
            </div>
          )}
        </div>

        <div className="bg-white rounded-lg shadow-sm p-6 border border-gray-200">
          <div className="flex items-center space-x-3 mb-4">
            <Building className="h-6 w-6 text-purple-600" />
            <h3 className="text-lg font-semibold text-gray-900">En Yoğun Banka</h3>
          </div>
          {bankSummary.length > 0 && (
            <div className="space-y-2">
              {bankSummary
                .sort((a, b) => b.totalTasks - a.totalTasks)
                .slice(0, 3)
                .map((bank, index) => (
                  <div key={bank.name} className="flex justify-between">
                    <span className="text-gray-600">{index + 1}. {bank.name}:</span>
                    <span className="font-medium">{bank.totalTasks} görev</span>
                  </div>
                ))}
            </div>
          )}
        </div>
      </div>
    </div>
  );
};