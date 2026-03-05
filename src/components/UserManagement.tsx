import React, { useState, useEffect } from 'react';
import { useUsers, User } from '../hooks/useUsers';
import { useAuth } from '../context/AuthContext';
import { JiraFilterManagement } from './JiraFilterManagement';
import { jiraFilterService } from '../lib/jiraFilterService';
import { Users, Plus, CreditCard as Edit, Trash2, Shield, Eye, Settings, Search, Filter, UserPlus, UserX, RefreshCw, Save, X, AlertTriangle, CheckCircle, Mail, Key, Building, HelpCircle } from 'lucide-react';
import UserManagementOnboarding, { useUserManagementOnboarding } from './UserManagementOnboarding';

interface UserFormData {
  name: string;
  email: string;
  password: string;
  role: 'admin' | 'analyst' | 'developer';
  assignedProjects: string[];
  isActive: boolean;
}

export const UserManagement: React.FC = () => {
  const { hasRole } = useAuth();
  const {
    users,
    loading,
    error,
    addUser,
    updateUser,
    deleteUser,
    permanentlyDeleteUser,
    reactivateUser,
    refetch
  } = useUsers();
  const { isOnboardingOpen, openOnboarding, closeOnboarding } = useUserManagementOnboarding();

  const [activeTab, setActiveTab] = useState<'users'>('users');
  const [showForm, setShowForm] = useState(false);
  const [editingUser, setEditingUser] = useState<User | null>(null);
  const [searchTerm, setSearchTerm] = useState('');
  const [roleFilter, setRoleFilter] = useState<string>('all');
  const [statusFilter, setStatusFilter] = useState<string>('all');
  const [formData, setFormData] = useState<UserFormData>({
    name: '',
    email: '',
    password: '',
    role: 'developer',
    assignedProjects: [],
    isActive: true
  });
  const [formLoading, setFormLoading] = useState(false);
  const [projectOptions, setProjectOptions] = useState<Array<{ key: string; name: string }>>([]);
  const [projectsLoading, setProjectsLoading] = useState(true);

  const HAYAT_FINANS = { key: 'HF', name: 'Hayat Finans' };

  useEffect(() => {
    const loadProjects = async () => {
      try {
        setProjectsLoading(true);
        const selectedProjects = await jiraFilterService.getSelectedProjects();
        const options = selectedProjects.map(p => ({
          key: p.project_key,
          name: p.project_name
        }));
        if (!options.some(p => p.key === HAYAT_FINANS.key)) {
          options.push(HAYAT_FINANS);
          options.sort((a, b) => a.name.localeCompare(b.name));
        }
        setProjectOptions(options);
      } catch (error) {
        console.error('Error loading projects:', error);
      } finally {
        setProjectsLoading(false);
      }
    };
    loadProjects();
  }, []);

  if (!hasRole('admin')) {
    return (
      <div className="space-y-6">
        <div className="bg-red-50 border border-red-200 rounded-lg p-6">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">Bu sayfaya erişim yetkiniz bulunmuyor.</p>
          </div>
          <p className="text-red-700 text-sm mt-2">
            Kullanıcı yönetimi sadece Yönetici rolleri tarafından yapılabilir.
          </p>
        </div>
      </div>
    );
  }

  const resetForm = () => {
    setFormData({
      name: '',
      email: '',
      password: '',
      role: 'developer',
      assignedProjects: [],
      isActive: true
    });
    setEditingUser(null);
  };

  const handleAddUser = () => {
    resetForm();
    setShowForm(true);
  };

  const handleEditUser = (user: User) => {
    setFormData({
      name: user.name,
      email: user.email,
      password: '',
      role: user.role,
      assignedProjects: user.assignedProjects,
      isActive: user.isActive
    });
    setEditingUser(user);
    setShowForm(true);
  };

  const handleSubmit = async (e: React.FormEvent) => {
    e.preventDefault();
    setFormLoading(true);

    try {
      if (editingUser) {
        const updateData: Partial<User> = {
          name: formData.name,
          role: formData.role,
          assignedProjects: formData.assignedProjects,
          isActive: formData.isActive
        };
        await updateUser(editingUser.id, updateData);
      } else {
        if (!formData.password) {
          alert('Şifre gereklidir');
          return;
        }
        await addUser(formData);
      }
      setShowForm(false);
      resetForm();
    } catch (err) {
      console.error('Form submission error:', err);
    } finally {
      setFormLoading(false);
    }
  };

  const handleDeleteUser = async (user: User) => {
    if (window.confirm(`${user.name} kullanıcısını deaktif etmek istediğinizden emin misiniz?`)) {
      try {
        await deleteUser(user.id);
      } catch (err) {
        console.error('Delete error:', err);
      }
    }
  };

  const handlePermanentDelete = async (user: User) => {
    if (window.confirm(`${user.name} kullanıcısını kalıcı olarak silmek istediğinizden emin misiniz?\n\nBu işlem geri alınamaz!`)) {
      try {
        await permanentlyDeleteUser(user.id);
      } catch (err) {
        console.error('Permanent delete error:', err);
      }
    }
  };

  const handleReactivateUser = async (user: User) => {
    try {
      await reactivateUser(user.id);
    } catch (err) {
      console.error('Reactivate error:', err);
    }
  };

  const handleProjectToggle = (projectKey: string) => {
    setFormData(prev => ({
      ...prev,
      assignedProjects: prev.assignedProjects.includes(projectKey)
        ? prev.assignedProjects.filter(p => p !== projectKey)
        : [...prev.assignedProjects, projectKey]
    }));
  };

  const filteredUsers = users.filter(user => {
    const matchesSearch = user.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
                         user.email.toLowerCase().includes(searchTerm.toLowerCase());
    const matchesRole = roleFilter === 'all' || user.role === roleFilter;
    const matchesStatus = statusFilter === 'all' ||
                         (statusFilter === 'active' && user.isActive) ||
                         (statusFilter === 'inactive' && !user.isActive);
    return matchesSearch && matchesRole && matchesStatus;
  });

  const getRoleIcon = (role: string) => {
    switch (role) {
      case 'admin': return <Shield className="h-4 w-4 text-red-600" />;
      case 'analyst': return <Eye className="h-4 w-4 text-blue-600" />;
      case 'developer': return <Settings className="h-4 w-4 text-green-600" />;
      default: return <Users className="h-4 w-4 text-gray-600" />;
    }
  };

  const getRoleText = (role: string) => {
    switch (role) {
      case 'admin': return 'Yönetici';
      case 'analyst': return 'Analist';
      case 'developer': return 'Yazılımcı';
      default: return role;
    }
  };

  const getRoleBadgeColor = (role: string) => {
    switch (role) {
      case 'admin': return 'bg-red-100 text-red-800 border-red-200';
      case 'analyst': return 'bg-blue-100 text-blue-800 border-blue-200';
      case 'developer': return 'bg-green-100 text-green-800 border-green-200';
      default: return 'bg-gray-100 text-gray-800 border-gray-200';
    }
  };

  const stats = {
    total: users.length,
    active: users.filter(u => u.isActive).length,
    inactive: users.filter(u => !u.isActive).length,
    admins: users.filter(u => u.role === 'admin').length,
    analysts: users.filter(u => u.role === 'analyst').length,
    developers: users.filter(u => u.role === 'developer').length
  };

  return (
    <div className="space-y-6">
      {/* Onboarding Modal */}
      <UserManagementOnboarding isOpen={isOnboardingOpen} onClose={closeOnboarding} />

      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold text-gray-900">Kullanıcı Yönetimi</h2>
          <p className="text-gray-600 mt-1">Sistem kullanıcılarını yönetin ve proje erişimlerini düzenleyin</p>
        </div>
        <div className="flex items-center space-x-3">
          <button
            onClick={openOnboarding}
            className="flex items-center space-x-2 px-4 py-2 bg-white border border-gray-200 text-gray-600 rounded-lg hover:bg-gray-50 hover:border-gray-300 transition-colors shadow-sm"
            title="Sayfayı nasıl kullanacağınızı öğrenin"
          >
            <HelpCircle className="h-4 w-4" />
            <span>Nasıl Kullanılır?</span>
          </button>
          <button
            onClick={refetch}
            disabled={loading}
            className="flex items-center space-x-2 px-4 py-2 bg-gray-600 text-white rounded-lg hover:bg-gray-700 disabled:opacity-50 transition-colors"
          >
            <RefreshCw className={`h-4 w-4 ${loading ? 'animate-spin' : ''}`} />
            <span>Yenile</span>
          </button>
          <button
            onClick={handleAddUser}
            className="flex items-center space-x-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
          >
            <UserPlus className="h-5 w-5" />
            <span>Yeni Kullanıcı</span>
          </button>
        </div>
      </div>

      {/* Statistics */}
      <div className="grid grid-cols-1 md:grid-cols-3 lg:grid-cols-6 gap-4">
        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Toplam</p>
              <p className="text-2xl font-bold text-gray-900">{stats.total}</p>
            </div>
            <Users className="h-8 w-8 text-gray-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Aktif</p>
              <p className="text-2xl font-bold text-green-600">{stats.active}</p>
            </div>
            <CheckCircle className="h-8 w-8 text-green-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Pasif</p>
              <p className="text-2xl font-bold text-red-600">{stats.inactive}</p>
            </div>
            <UserX className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Yönetici</p>
              <p className="text-2xl font-bold text-red-600">{stats.admins}</p>
            </div>
            <Shield className="h-8 w-8 text-red-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Analist</p>
              <p className="text-2xl font-bold text-blue-600">{stats.analysts}</p>
            </div>
            <Eye className="h-8 w-8 text-blue-600" />
          </div>
        </div>

        <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
          <div className="flex items-center justify-between">
            <div>
              <p className="text-sm font-medium text-gray-600">Yazılımcı</p>
              <p className="text-2xl font-bold text-green-600">{stats.developers}</p>
            </div>
            <Settings className="h-8 w-8 text-green-600" />
          </div>
        </div>
      </div>

      {/* Filters */}
      <div className="bg-white rounded-lg shadow-sm p-4 border border-gray-200">
        <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-5 w-5 text-gray-400" />
            <input
              type="text"
              placeholder="Kullanıcı ara..."
              value={searchTerm}
              onChange={(e) => setSearchTerm(e.target.value)}
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent"
            />
          </div>
          
          <select
            value={roleFilter}
            onChange={(e) => setRoleFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Roller</option>
            <option value="admin">Yönetici</option>
            <option value="analyst">Analist</option>
            <option value="developer">Yazılımcı</option>
          </select>
          
          <select
            value={statusFilter}
            onChange={(e) => setStatusFilter(e.target.value)}
            className="border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
          >
            <option value="all">Tüm Durumlar</option>
            <option value="active">Aktif</option>
            <option value="inactive">Pasif</option>
          </select>
        </div>
      </div>

      {/* Error Display */}
      {error && (
        <div className="bg-red-50 border border-red-200 rounded-lg p-4">
          <div className="flex items-center space-x-2">
            <AlertTriangle className="h-5 w-5 text-red-600" />
            <p className="text-red-800">{error}</p>
          </div>
        </div>
      )}

      {/* Users Table */}
      <div className="bg-white rounded-lg shadow-sm border border-gray-200 overflow-hidden">
        <div className="px-6 py-4 border-b border-gray-200">
          <h3 className="text-lg font-semibold text-gray-900">Kullanıcı Listesi</h3>
        </div>
        
        {loading ? (
          <div className="flex items-center justify-center py-12">
            <div className="flex items-center space-x-2">
              <RefreshCw className="h-6 w-6 animate-spin text-blue-600" />
              <span className="text-gray-600">Kullanıcılar yükleniyor...</span>
            </div>
          </div>
        ) : filteredUsers.length > 0 ? (
          <div className="overflow-x-auto">
            <table className="w-full">
              <thead className="bg-gray-50 border-b border-gray-200">
                <tr>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Kullanıcı</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Rol</th>
                  <th className="px-6 py-3 text-left text-xs font-medium text-gray-500 uppercase tracking-wider">Atanmış Projeler</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Durum</th>
                  <th className="px-6 py-3 text-center text-xs font-medium text-gray-500 uppercase tracking-wider">Oluşturma</th>
                  <th className="px-6 py-3 text-right text-xs font-medium text-gray-500 uppercase tracking-wider">İşlemler</th>
                </tr>
              </thead>
              <tbody className="bg-white divide-y divide-gray-200">
                {filteredUsers.map((user, index) => (
                  <tr key={user.id} className={`hover:bg-gray-50 transition-colors ${index % 2 === 0 ? 'bg-white' : 'bg-gray-50/30'}`}>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-3">
                        <div className="flex-shrink-0 h-10 w-10 bg-blue-100 rounded-full flex items-center justify-center">
                          <span className="text-sm font-medium text-blue-800">
                            {user.name.split(' ').map(n => n[0]).join('').slice(0, 2)}
                          </span>
                        </div>
                        <div>
                          <p className="text-sm font-medium text-gray-900">{user.name}</p>
                          <p className="text-sm text-gray-500">{user.email}</p>
                        </div>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex items-center space-x-2">
                        {getRoleIcon(user.role)}
                        <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${getRoleBadgeColor(user.role)}`}>
                          {getRoleText(user.role)}
                        </span>
                      </div>
                    </td>
                    <td className="px-6 py-4">
                      <div className="flex flex-wrap gap-1">
                        {user.role === 'admin' ? (
                          <span className="text-xs bg-purple-100 text-purple-800 px-2 py-1 rounded-full">Tüm Projeler</span>
                        ) : user.assignedProjects.length > 0 ? (
                          user.assignedProjects.map(projectKey => {
                            const project = projectOptions.find(p => p.key === projectKey);
                            return (
                              <span key={projectKey} className="text-xs bg-blue-100 text-blue-800 px-2 py-1 rounded-full">
                                {project?.name || projectKey}
                              </span>
                            );
                          })
                        ) : (
                          <span className="text-xs text-gray-500 italic">Proje atanmamış</span>
                        )}
                      </div>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <span className={`inline-flex px-2 py-1 text-xs font-medium rounded-full border ${
                        user.isActive ? 'bg-green-100 text-green-800 border-green-200' : 'bg-red-100 text-red-800 border-red-200'
                      }`}>
                        {user.isActive ? 'Aktif' : 'Pasif'}
                      </span>
                    </td>
                    <td className="px-6 py-4 text-center">
                      <div className="text-sm text-gray-500">
                        <div>{user.createdAt.toLocaleDateString('tr-TR')}</div>
                        <div className="text-xs">{user.createdAt.toLocaleTimeString('tr-TR', { hour: '2-digit', minute: '2-digit' })}</div>
                      </div>
                    </td>
                    <td className="px-6 py-4 text-right">
                      <div className="flex items-center justify-end space-x-2">
                        <button onClick={() => handleEditUser(user)} className="text-gray-400 hover:text-blue-600 transition-colors p-1 rounded hover:bg-blue-50" title="Düzenle">
                          <Edit className="h-4 w-4" />
                        </button>
                        {user.isActive ? (
                          <button onClick={() => handleDeleteUser(user)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50" title="Deaktif Et">
                            <UserX className="h-4 w-4" />
                          </button>
                        ) : (
                          <button onClick={() => handleReactivateUser(user)} className="text-gray-400 hover:text-green-600 transition-colors p-1 rounded hover:bg-green-50" title="Aktifleştir">
                            <CheckCircle className="h-4 w-4" />
                          </button>
                        )}
                        <button onClick={() => handlePermanentDelete(user)} className="text-gray-400 hover:text-red-600 transition-colors p-1 rounded hover:bg-red-50" title="Kalıcı Sil">
                          <Trash2 className="h-4 w-4" />
                        </button>
                      </div>
                    </td>
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        ) : (
          <div className="text-center py-12">
            <Users className="h-12 w-12 text-gray-400 mx-auto mb-4" />
            <p className="text-gray-500 text-lg">Kullanıcı bulunamadı.</p>
            <p className="text-gray-400 text-sm mt-2">Filtreleri değiştirin veya yeni kullanıcı ekleyin.</p>
          </div>
        )}
      </div>

      {/* User Form Modal */}
      {showForm && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg shadow-xl w-full max-w-2xl mx-4 max-h-[90vh] overflow-y-auto">
            <div className="flex justify-between items-center p-6 border-b border-gray-200">
              <h3 className="text-xl font-semibold text-gray-900">
                {editingUser ? 'Kullanıcı Düzenle' : 'Yeni Kullanıcı Ekle'}
              </h3>
              <button onClick={() => setShowForm(false)} className="text-gray-400 hover:text-gray-600 transition-colors">
                <X className="h-6 w-6" />
              </button>
            </div>

            <form onSubmit={handleSubmit} className="p-6 space-y-6">
              {/* Temel Bilgiler */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                  <Users className="h-5 w-5 text-blue-600" />
                  <span>Temel Bilgiler</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Ad Soyad *</label>
                    <input
                      type="text" required value={formData.name}
                      onChange={(e) => setFormData(prev => ({ ...prev, name: e.target.value }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                      placeholder="Kullanıcının tam adı"
                    />
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">E-posta Adresi *</label>
                    <div className="relative">
                      <input
                        type="email" required value={formData.email}
                        onChange={(e) => setFormData(prev => ({ ...prev, email: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="kullanici@acerpro.com.tr"
                        disabled={!!editingUser}
                      />
                      <Mail className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                  </div>
                </div>
                {!editingUser && (
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Şifre *</label>
                    <div className="relative">
                      <input
                        type="password" required={!editingUser} value={formData.password}
                        onChange={(e) => setFormData(prev => ({ ...prev, password: e.target.value }))}
                        className="w-full border border-gray-300 rounded-lg px-3 py-2 pl-10 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                        placeholder="Güvenli şifre girin" minLength={6}
                      />
                      <Key className="absolute left-3 top-2.5 h-4 w-4 text-gray-400" />
                    </div>
                    <p className="text-xs text-gray-500 mt-1">En az 6 karakter olmalıdır</p>
                  </div>
                )}
              </div>

              {/* Rol ve Yetki */}
              <div className="space-y-4">
                <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                  <Shield className="h-5 w-5 text-red-600" />
                  <span>Rol ve Yetki</span>
                </h4>
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Kullanıcı Rolü *</label>
                    <select
                      required value={formData.role}
                      onChange={(e) => setFormData(prev => ({ ...prev, role: e.target.value as any }))}
                      className="w-full border border-gray-300 rounded-lg px-3 py-2 focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                    >
                      <option value="developer">Yazılımcı</option>
                      <option value="analyst">Analist</option>
                      <option value="admin">Yönetici</option>
                    </select>
                    <p className="text-xs text-gray-500 mt-1">
                      {formData.role === 'admin' && 'Tüm projelere ve verilere tam erişim'}
                      {formData.role === 'analyst' && 'Atanmış projelerdeki verileri görüntüleme'}
                      {formData.role === 'developer' && 'Sadece kendi verilerini görüntüleme'}
                    </p>
                  </div>
                  <div>
                    <label className="block text-sm font-medium text-gray-700 mb-1">Durum</label>
                    <div className="flex items-center space-x-4 mt-2">
                      <label className="flex items-center">
                        <input type="radio" name="isActive" checked={formData.isActive} onChange={() => setFormData(prev => ({ ...prev, isActive: true }))} className="mr-2" />
                        <span className="text-sm text-green-700">Aktif</span>
                      </label>
                      <label className="flex items-center">
                        <input type="radio" name="isActive" checked={!formData.isActive} onChange={() => setFormData(prev => ({ ...prev, isActive: false }))} className="mr-2" />
                        <span className="text-sm text-red-700">Pasif</span>
                      </label>
                    </div>
                  </div>
                </div>
              </div>

              {/* Proje Atamaları */}
              {formData.role !== 'admin' && (
                <div className="space-y-4">
                  <h4 className="font-medium text-gray-900 flex items-center space-x-2">
                    <Building className="h-5 w-5 text-purple-600" />
                    <span>Proje Atamaları</span>
                  </h4>
                  <div className="bg-gray-50 rounded-lg p-4">
                    <p className="text-sm text-gray-600 mb-3">
                      Bu kullanıcının erişebileceği projeleri seçin. Analist rolündeki kullanıcılar, aynı projelere atanan yazılımcıların verilerini görebilir.
                    </p>
                    {projectsLoading ? (
                      <div className="flex items-center justify-center py-4">
                        <RefreshCw className="h-5 w-5 animate-spin text-blue-600 mr-2" />
                        <span className="text-sm text-gray-600">Projeler yükleniyor...</span>
                      </div>
                    ) : projectOptions.length === 0 ? (
                      <div className="text-sm text-yellow-600 py-4 text-center">
                        ⚠️ Hiç proje bulunamadı. Lütfen önce Jira Filtreleri sekmesinden proje ekleyin.
                      </div>
                    ) : (
                      <div className="grid grid-cols-2 md:grid-cols-3 gap-3">
                        {projectOptions.map(project => (
                          <label key={project.key} className="flex items-center space-x-2 cursor-pointer">
                            <input
                              type="checkbox"
                              checked={formData.assignedProjects.includes(project.key)}
                              onChange={() => handleProjectToggle(project.key)}
                              className="rounded border-gray-300 text-blue-600 focus:ring-blue-500"
                            />
                            <div className="flex flex-col">
                              <span className="text-sm font-medium text-gray-900">{project.key}</span>
                              <span className="text-xs text-gray-500">{project.name}</span>
                            </div>
                          </label>
                        ))}
                      </div>
                    )}
                    {formData.assignedProjects.length === 0 && (
                      <p className="text-xs text-yellow-600 mt-2">
                        ⚠️ Hiç proje seçilmedi. {formData.role === 'analyst' ? 'Analist hiçbir yazılımcının verisini göremeyecek.' : 'Yazılımcı hiçbir projeye erişemeyecek.'}
                      </p>
                    )}
                    {formData.role === 'analyst' && formData.assignedProjects.length > 0 && (
                      <div className="mt-3 p-3 bg-blue-50 border border-blue-200 rounded">
                        <p className="text-xs text-blue-800">
                          <strong>Analist Yetkisi:</strong> Bu kullanıcı seçilen projelerde çalışan yazılımcıların iş yükü analizi ve günlük süre takibi verilerini görebilecek.
                        </p>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {formData.role === 'admin' && (
                <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                  <div className="flex items-center space-x-2">
                    <Shield className="h-5 w-5 text-purple-600" />
                    <p className="text-sm text-purple-800 font-medium">Yönetici Yetkisi</p>
                  </div>
                  <p className="text-sm text-purple-700 mt-1">Bu kullanıcı tüm projelere ve verilere tam erişim sahibi olacak.</p>
                </div>
              )}

              {/* Form Actions */}
              <div className="flex justify-end space-x-3 pt-4 border-t border-gray-200">
                <button type="button" onClick={() => setShowForm(false)} className="px-4 py-2 text-gray-700 border border-gray-300 rounded-lg hover:bg-gray-50 transition-colors">
                  İptal
                </button>
                <button type="submit" disabled={formLoading} className="px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 transition-colors flex items-center space-x-2">
                  {formLoading ? (
                    <><RefreshCw className="h-4 w-4 animate-spin" /><span>{editingUser ? 'Güncelleniyor...' : 'Ekleniyor...'}</span></>
                  ) : (
                    <><Save className="h-4 w-4" /><span>{editingUser ? 'Güncelle' : 'Kullanıcı Ekle'}</span></>
                  )}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};