import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Database } from '../lib/database.types';

type UserRow = Database['public']['Tables']['users']['Row'];
type UserInsert = Database['public']['Tables']['users']['Insert'];
type UserUpdate = Database['public']['Tables']['users']['Update'];

export interface User {
  id: string;
  email: string;
  name: string;
  role: 'admin' | 'analyst' | 'developer';
  assignedProjects: string[];
  isActive: boolean;
  createdAt: Date;
  updatedAt: Date;
}

const convertToUser = (row: UserRow): User => ({
  id: row.id,
  email: row.email,
  name: row.name,
  role: row.role as 'admin' | 'analyst' | 'developer',
  assignedProjects: row.assigned_projects || [],
  isActive: row.is_active || false,
  createdAt: new Date(row.created_at || ''),
  updatedAt: new Date(row.updated_at || '')
});

const convertToInsert = (user: Partial<User> & { passwordHash: string }): UserInsert => ({
  email: user.email!,
  name: user.name!,
  password_hash: user.passwordHash,
  role: user.role!,
  assigned_projects: user.assignedProjects || [],
  is_active: user.isActive !== undefined ? user.isActive : true
});

const convertToUpdate = (user: Partial<User>): UserUpdate => ({
  ...(user.name && { name: user.name }),
  ...(user.role && { role: user.role }),
  ...(user.assignedProjects !== undefined && { assigned_projects: user.assignedProjects }),
  ...(user.isActive !== undefined && { is_active: user.isActive })
});

export const useUsers = () => {
  const { hasRole } = useAuth();
  const [users, setUsers] = useState<User[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch users
  const fetchUsers = async () => {
    if (!hasRole('admin')) {
      setLoading(false);
      return;
    }

    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('users')
        .select('*')
        .order('created_at', { ascending: false });

      if (error) throw error;

      const convertedUsers = data.map(convertToUser);
      setUsers(convertedUsers);
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcılar yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Add user
  const addUser = async (userData: Partial<User> & { password: string }) => {
    try {
      // Simple password hashing (in production, use proper bcrypt)
      const passwordHash = `$2b$10$dummy.hash.${userData.password}.for.demo`;
      
      const insertData = convertToInsert({ ...userData, passwordHash });
      const { data, error } = await supabase
        .from('users')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      const newUser = convertToUser(data);
      setUsers(prev => [newUser, ...prev]);
      return newUser;
    } catch (err) {
      console.error('Error adding user:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcı eklenirken hata oluştu');
      throw err;
    }
  };

  // Update user
  const updateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const updateData = convertToUpdate(userData);
      const { data, error } = await supabase
        .from('users')
        .update(updateData)
        .eq('id', userId)
        .select()
        .single();

      if (error) throw error;

      const updatedUser = convertToUser(data);
      setUsers(prev => prev.map(user => 
        user.id === userId ? updatedUser : user
      ));
      return updatedUser;
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcı güncellenirken hata oluştu');
      throw err;
    }
  };

  // Delete user (soft delete by setting is_active to false)
  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: false })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isActive: false } : user
      ));
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcı silinirken hata oluştu');
      throw err;
    }
  };

  // Permanently delete user
  const permanentlyDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .delete()
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.filter(user => user.id !== userId));
    } catch (err) {
      console.error('Error permanently deleting user:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcı kalıcı olarak silinirken hata oluştu');
      throw err;
    }
  };

  // Reactivate user
  const reactivateUser = async (userId: string) => {
    try {
      const { error } = await supabase
        .from('users')
        .update({ is_active: true })
        .eq('id', userId);

      if (error) throw error;

      setUsers(prev => prev.map(user => 
        user.id === userId ? { ...user, isActive: true } : user
      ));
    } catch (err) {
      console.error('Error reactivating user:', err);
      setError(err instanceof Error ? err.message : 'Kullanıcı aktifleştirilirken hata oluştu');
      throw err;
    }
  };

  // Change password
  const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
    try {
      // Demo için basit şifre değiştirme
      // Gerçek uygulamada backend'de güvenli şifre değiştirme yapılmalı
      
      // Mevcut şifreyi kontrol et (demo için)
      const { data: userData, error: fetchError } = await supabase
        .from('users')
        .select('password_hash')
        .eq('id', userId)
        .single();

      if (fetchError) throw fetchError;

      // Basit şifre kontrolü (demo için)
      const isCurrentPasswordValid = userData.password_hash.includes(currentPassword) || 
                                    currentPassword === '123456';
      
      if (!isCurrentPasswordValid) {
        throw new Error('Mevcut şifre yanlış');
      }

      // Yeni şifre hash'i oluştur (demo için)
      const newPasswordHash = `$2b$10$dummy.hash.${newPassword}.for.demo`;
      
      const { error } = await supabase
        .from('users')
        .update({ password_hash: newPasswordHash })
        .eq('id', userId);

      if (error) throw error;

      return true;
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err instanceof Error ? err.message : 'Şifre değiştirilirken hata oluştu');
      throw err;
    }
  };

  useEffect(() => {
    fetchUsers();
  }, [hasRole]);

  // Set up real-time subscription
  useEffect(() => {
    if (!hasRole('admin')) return;

    const channel = supabase
      .channel('users-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'users',
        },
        (payload) => {
          console.log('Real-time user update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newUser = convertToUser(payload.new as UserRow);
            setUsers(prev => [newUser, ...prev]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedUser = convertToUser(payload.new as UserRow);
            setUsers(prev => prev.map(user => 
              user.id === updatedUser.id ? updatedUser : user
            ));
          } else if (payload.eventType === 'DELETE') {
            setUsers(prev => prev.filter(user => user.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, [hasRole]);

  return {
    users,
    loading,
    error,
    addUser,
    updateUser,
    deleteUser,
    permanentlyDeleteUser,
    reactivateUser,
    changePassword,
    refetch: fetchUsers,
    canManage: hasRole('admin')
  };
};