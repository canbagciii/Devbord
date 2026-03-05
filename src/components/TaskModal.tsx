import React, { useState, useEffect } from 'react';
import { Task } from '../types';
import { X, Save } from 'lucide-react';
import { developers, banks, assigners } from '../data/mockData';

interface TaskModalProps {
  isOpen: boolean;
  onClose: () => void;
  onSave: (task: Partial<Task>) => void;
  editingTask?: Task;
  selectedBank: string;
}

export const TaskModal: React.FC<TaskModalProps> = ({ isOpen, onClose, onSave, editingTask, selectedBank }) => {
  const [formData, setFormData] = useState({
    title: '',
    description: '',
    assignedTo: '',
    bank: selectedBank,
    status: 'todo' as const,
    estimatedHours: '',
    actualHours: '',
    assignedBy: ''
  });

  useEffect(() => {
    if (editingTask) {
      setFormData({
        title: editingTask.title,
        description: editingTask.description || '',
        assignedTo: editingTask.assignedTo,
        bank: editingTask.bank,
        status: editingTask.status,
        estimatedHours: editingTask.estimatedHours?.toString() || '',
        actualHours: editingTask.actualHours?.toString() || '',
        assignedBy: editingTask.assignedBy || ''
      });
    } else {
      setFormData({
        title: '',
        description: '',
        assignedTo: '',
        bank: selectedBank,
        status: 'todo',
        estimatedHours: '',
        actualHours: '',
        assignedBy: ''
      });
    }
  }, [editingTask, isOpen]);

  // Update bank when selectedBank changes
  useEffect(() => {
    if (!editingTask) {
      setFormData(prev => ({ ...prev, bank: selectedBank }));
    }
  }, [selectedBank, editingTask]);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    
    const taskData: Partial<Task> = {
      ...formData,
      estimatedHours: formData.estimatedHours ? parseInt(formData.estimatedHours) : undefined,
      actualHours: formData.actualHours ? parseInt(formData.actualHours) : undefined,
      updatedAt: new Date()
    };

    if (!editingTask) {
      taskData.id = Date.now().toString();
      taskData.createdAt = new Date();
    }

    onSave(taskData);
    onClose();
  };

  if (!isOpen) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
      <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
        <div className="flex justify-between items-center p-6 border-b border-gray-200">
          <h2 className="text-xl font-semibold text-gray-900">
            {editingTask ? 'Görev Düzenle' : 'Yeni Görev Ekle'}
          </h2>
          <button
            onClick={onClose}
            className="text-gray-400 hover:text-gray-600 transition-colors"
          >
            <X className="h-6 w-6" />
          </button>
        </div>

        <form onSubmit={handleSubmit} className="p-6 space-y-4">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Görev Başlığı *
            </label>
            <input
              type="text"
              required
              value={formData.title}
              onChange={(e) => setFormData(prev => ({ ...prev, title: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Görev başlığını girin"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Açıklama
            </label>
            <textarea
              value={formData.description}
              onChange={(e) => setFormData(prev => ({ ...prev, description: e.target.value }))}
              rows={3}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              placeholder="Görev açıklamasını girin (isteğe bağlı)"
            />
          </div>

          <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Atanan Kişi *
              </label>
              <select
                required
                value={formData.assignedTo}
                onChange={(e) => setFormData(prev => ({ ...prev, assignedTo: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {developers.map(dev => (
                  <option key={dev.id} value={dev.name}>{dev.name}</option>
                ))}
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Banka/Kurum *
              </label>
              <select
                required
                value={formData.bank}
                onChange={(e) => setFormData(prev => ({ ...prev, bank: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="">Seçiniz</option>
                {banks.map(bank => (
                  <option key={bank.id} value={bank.name}>{bank.name}</option>
                ))}
              </select>
            </div>
          </div>

          <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Durum *
              </label>
              <select
                required
                value={formData.status}
                onChange={(e) => setFormData(prev => ({ ...prev, status: e.target.value as Task['status'] }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
              >
                <option value="todo">Bekliyor</option>
                <option value="in-progress">Devam Ediyor</option>
                <option value="done">Tamamlandı</option>
              </select>
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Tahmini Süre (saat)
              </label>
              <input
                type="number"
                min="0"
                value={formData.estimatedHours}
                onChange={(e) => setFormData(prev => ({ ...prev, estimatedHours: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>

            <div>
              <label className="block text-sm font-medium text-gray-700 mb-1">
                Gerçekleşen Süre (saat)
              </label>
              <input
                type="number"
                min="0"
                value={formData.actualHours}
                onChange={(e) => setFormData(prev => ({ ...prev, actualHours: e.target.value }))}
                className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                placeholder="0"
              />
            </div>
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">
              Atayan Kişi
            </label>
            <select
              value={formData.assignedBy}
              onChange={(e) => setFormData(prev => ({ ...prev, assignedBy: e.target.value }))}
              className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            >
              <option value="">Seçiniz (isteğe bağlı)</option>
              {assigners.map(assigner => (
                <option key={assigner.id} value={assigner.name}>{assigner.name}</option>
              ))}
            </select>
          </div>

          <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
            <button
              type="button"
              onClick={onClose}
              className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors"
            >
              İptal
            </button>
            <button
              type="submit"
              className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors flex items-center space-x-2"
            >
              <Save className="h-4 w-4" />
              <span>{editingTask ? 'Güncelle' : 'Kaydet'}</span>
            </button>
          </div>
        </form>
      </div>
    </div>
  );
};