import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { Task } from '../types';
import { Database } from '../lib/database.types';

type TaskRow = Database['public']['Tables']['tasks']['Row'];
type TaskInsert = Database['public']['Tables']['tasks']['Insert'];
type TaskUpdate = Database['public']['Tables']['tasks']['Update'];

// Convert database row to Task type
const convertToTask = (row: TaskRow): Task => ({
  id: row.id,
  title: row.title,
  description: row.description || undefined,
  assignedTo: row.assigned_to,
  bank: row.bank,
  status: row.status,
  estimatedHours: row.estimated_hours || undefined,
  actualHours: row.actual_hours || undefined,
  assignedBy: row.assigned_by || undefined,
  sprintId: row.sprint_id,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at),
});

// Convert Task to database insert format
const convertToInsert = (task: Partial<Task>): TaskInsert => ({
  title: task.title!,
  description: task.description || null,
  assigned_to: task.assignedTo!,
  bank: task.bank!,
  status: task.status || 'todo',
  estimated_hours: task.estimatedHours || null,
  actual_hours: task.actualHours || null,
  assigned_by: task.assignedBy || null,
  sprint_id: task.sprintId || 'sprint-2024-02',
});

// Convert Task to database update format
const convertToUpdate = (task: Partial<Task>): TaskUpdate => ({
  ...(task.title && { title: task.title }),
  ...(task.description !== undefined && { description: task.description || null }),
  ...(task.assignedTo && { assigned_to: task.assignedTo }),
  ...(task.bank && { bank: task.bank }),
  ...(task.status && { status: task.status }),
  ...(task.estimatedHours !== undefined && { estimated_hours: task.estimatedHours || null }),
  ...(task.actualHours !== undefined && { actual_hours: task.actualHours || null }),
  ...(task.assignedBy !== undefined && { assigned_by: task.assignedBy || null }),
  updated_at: new Date().toISOString(),
});

export const useTasks = () => {
  const [tasks, setTasks] = useState<Task[]>([]);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch initial tasks
  useEffect(() => {
    fetchTasks();
  }, []);

  // Set up real-time subscription
  useEffect(() => {
    const channel = supabase
      .channel('tasks-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'tasks',
        },
        (payload) => {
          console.log('Real-time update:', payload);
          
          if (payload.eventType === 'INSERT') {
            const newTask = convertToTask(payload.new as TaskRow);
            setTasks(prev => [...prev, newTask]);
          } else if (payload.eventType === 'UPDATE') {
            const updatedTask = convertToTask(payload.new as TaskRow);
            setTasks(prev => prev.map(task => 
              task.id === updatedTask.id ? updatedTask : task
            ));
          } else if (payload.eventType === 'DELETE') {
            setTasks(prev => prev.filter(task => task.id !== payload.old.id));
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  const fetchTasks = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('tasks')
        .select('*')
        .order('updated_at', { ascending: false });

      if (error) throw error;

      const convertedTasks = data.map(convertToTask);
      setTasks(convertedTasks);
    } catch (err) {
      console.error('Error fetching tasks:', err);
      setError(err instanceof Error ? err.message : 'Görevler yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  const addTask = async (taskData: Partial<Task>) => {
    try {
      const insertData = convertToInsert(taskData);
      const { data, error } = await supabase
        .from('tasks')
        .insert([insertData])
        .select()
        .single();

      if (error) throw error;

      // Task will be added via real-time subscription
      return convertToTask(data);
    } catch (err) {
      console.error('Error adding task:', err);
      setError(err instanceof Error ? err.message : 'Görev eklenirken hata oluştu');
      throw err;
    }
  };

  const updateTask = async (taskId: string, taskData: Partial<Task>) => {
    try {
      const updateData = convertToUpdate(taskData);
      const { data, error } = await supabase
        .from('tasks')
        .update(updateData)
        .eq('id', taskId)
        .select()
        .single();

      if (error) throw error;

      // Task will be updated via real-time subscription
      return convertToTask(data);
    } catch (err) {
      console.error('Error updating task:', err);
      setError(err instanceof Error ? err.message : 'Görev güncellenirken hata oluştu');
      throw err;
    }
  };

  const deleteTask = async (taskId: string) => {
    try {
      const { error } = await supabase
        .from('tasks')
        .delete()
        .eq('id', taskId);

      if (error) throw error;

      // Task will be removed via real-time subscription
    } catch (err) {
      console.error('Error deleting task:', err);
      setError(err instanceof Error ? err.message : 'Görev silinirken hata oluştu');
      throw err;
    }
  };

  return {
    tasks,
    loading,
    error,
    addTask,
    updateTask,
    deleteTask,
    refetch: fetchTasks,
  };
};