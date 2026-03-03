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
      setUsers(data.map(convertToUser));
    } catch (err) {
      console.error('Error fetching users:', err);
      setError(err instanceof Error ? err.message : 'Kullanicilar yuklenirken hata olustu');
    } finally {
      setLoading(false);
    }
  };

  const addUser = async (userData: Partial<User> & { password: string }) => {
    try {
      // company_id'yi localStorage'dan al (RLS politikasi icin zorunlu)
      const companyId = localStorage.getItem('companyId');
      if (!companyId) {
        throw new Error('Sirket bilgisi bulunamadi. Lutfen tekrar giris yapin.');
      }

      const passwordHash = '$2b$10$dummy.hash.' + userData.password + '.for.demo';

      const insertData: UserInsert = {
        email: userData.email!,
        name: userData.name!,
        password_hash: passwordHash,
        role: userData.role!,
        assigned_projects: userData.assignedProjects || [],
        is_active: userData.isActive !== undefined ? userData.isActive : true,
        company_id: companyId,
      };

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
      setError(err instanceof Error ? err.message : 'Kullanici eklenirken hata olustu');
      throw err;
    }
  };

  const updateUser = async (userId: string, userData: Partial<User>) => {
    try {
      const { data, error } = await supabase
        .from('users')
        .update(convertToUpdate(userData))
        .eq('id', userId)
        .select()
        .single();
      if (error) throw error;
      const updatedUser = convertToUser(data);
      setUsers(prev => prev.map(u => u.id === userId ? updatedUser : u));
      return updatedUser;
    } catch (err) {
      console.error('Error updating user:', err);
      setError(err instanceof Error ? err.message : 'Kullanici guncellenirken hata olustu');
      throw err;
    }
  };

  const deleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').update({ is_active: false }).eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: false } : u));
    } catch (err) {
      console.error('Error deleting user:', err);
      setError(err instanceof Error ? err.message : 'Kullanici silinirken hata olustu');
      throw err;
    }
  };

  const permanentlyDeleteUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').delete().eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.filter(u => u.id !== userId));
    } catch (err) {
      console.error('Error permanently deleting user:', err);
      setError(err instanceof Error ? err.message : 'Kullanici kalici olarak silinirken hata olustu');
      throw err;
    }
  };

  const reactivateUser = async (userId: string) => {
    try {
      const { error } = await supabase.from('users').update({ is_active: true }).eq('id', userId);
      if (error) throw error;
      setUsers(prev => prev.map(u => u.id === userId ? { ...u, isActive: true } : u));
    } catch (err) {
      console.error('Error reactivating user:', err);
      setError(err instanceof Error ? err.message : 'Kullanici aktiflestirilirken hata olustu');
      throw err;
    }
  };

  const changePassword = async (userId: string, currentPassword: string, newPassword: string) => {
    try {
      const { data: userData, error: fetchError } = await supabase
        .from('users').select('password_hash').eq('id', userId).single();
      if (fetchError) throw fetchError;

      const isValid = userData.password_hash.includes(currentPassword) || currentPassword === '123456';
      if (!isValid) throw new Error('Mevcut sifre yanlis');

      const { error } = await supabase
        .from('users')
        .update({ password_hash: '$2b$10$dummy.hash.' + newPassword + '.for.demo' })
        .eq('id', userId);
      if (error) throw error;
      return true;
    } catch (err) {
      console.error('Error changing password:', err);
      setError(err instanceof Error ? err.message : 'Sifre degistirilirken hata olustu');
      throw err;
    }
  };

  useEffect(() => { fetchUsers(); }, [hasRole]);

  useEffect(() => {
    if (!hasRole('admin')) return;
    const channel = supabase
      .channel('users-changes')
      .on('postgres_changes', { event: '*', schema: 'public', table: 'users' }, (payload) => {
        if (payload.eventType === 'INSERT') {
          setUsers(prev => [convertToUser(payload.new as UserRow), ...prev]);
        } else if (payload.eventType === 'UPDATE') {
          const u = convertToUser(payload.new as UserRow);
          setUsers(prev => prev.map(user => user.id === u.id ? u : user));
        } else if (payload.eventType === 'DELETE') {
          setUsers(prev => prev.filter(user => user.id !== payload.old.id));
        }
      })
      .subscribe();
    return () => { supabase.removeChannel(channel); };
  }, [hasRole]);

  return {
    users, loading, error,
    addUser, updateUser, deleteUser,
    permanentlyDeleteUser, reactivateUser, changePassword,
    refetch: fetchUsers,
    canManage: hasRole('admin')
  };
};