import { useState, useEffect } from 'react';
import { supabase } from '../lib/supabase';
import { useAuth } from '../context/AuthContext';
import { Database } from '../lib/database.types';

type DeveloperCapacityRow = Database['public']['Tables']['developer_capacities']['Row'];
type DeveloperCapacityInsert = Database['public']['Tables']['developer_capacities']['Insert'];
type DeveloperCapacityUpdate = Database['public']['Tables']['developer_capacities']['Update'];

export interface DeveloperCapacity {
  id: string;
  developerName: string;
  developerEmail: string;
  capacityHours: number;
  updatedBy: string;
  createdAt: Date;
  updatedAt: Date;
}

const convertToCapacity = (row: DeveloperCapacityRow): DeveloperCapacity => ({
  id: row.id,
  developerName: row.developer_name,
  developerEmail: row.developer_email,
  capacityHours: Number(row.capacity_hours),
  updatedBy: row.updated_by,
  createdAt: new Date(row.created_at),
  updatedAt: new Date(row.updated_at)
});

export const useDeveloperCapacities = () => {
  const { user, hasRole } = useAuth();
  const [capacities, setCapacities] = useState<Record<string, number>>({});
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  // Fetch capacities from database
  const fetchCapacities = async () => {
    try {
      setLoading(true);
      const { data, error } = await supabase
        .from('developer_capacities')
        .select('*')
        .order('developer_name');

      if (error) throw error;

      const capacityMap: Record<string, number> = {};
      data.forEach(row => {
        capacityMap[row.developer_name] = Number(row.capacity_hours);
      });

      console.log('📊 Veritabanından yüklenen kapasiteler:', capacityMap);
      setCapacities(capacityMap);
    } catch (err) {
      console.error('Error fetching capacities:', err);
      setError(err instanceof Error ? err.message : 'Kapasite verileri yüklenirken hata oluştu');
    } finally {
      setLoading(false);
    }
  };

  // Update capacity in database
  const updateCapacity = async (developerName: string, capacityHours: number): Promise<void> => {
    if (!user || !hasRole('admin')) {
      throw new Error('Sadece yöneticiler kapasite değiştirebilir');
    }

    try {
      // Get developer email
      const developerEmail = getDeveloperEmail(developerName);

      // Try to update existing record first
      const { data: existingData, error: selectError } = await supabase
        .from('developer_capacities')
        .select('id')
        .eq('developer_name', developerName);

      if (selectError && selectError.code !== 'PGRST116') { // PGRST116 = no rows returned
        throw selectError;
      }

      if (existingData && existingData.length > 0) {
        // Update existing record
        const { error: updateError } = await supabase
          .from('developer_capacities')
          .update({
            capacity_hours: capacityHours,
            updated_by: user.email
          })
          .eq('id', existingData[0].id);

        if (updateError) throw updateError;
      } else {
        // Insert new record
        const { error: insertError } = await supabase
          .from('developer_capacities')
          .insert({
            developer_name: developerName,
            developer_email: developerEmail,
            capacity_hours: capacityHours,
            updated_by: user.email
          });

        if (insertError) throw insertError;
      }

      // Update local state
      setCapacities(prev => ({
        ...prev,
        [developerName]: capacityHours
      }));

    } catch (err) {
      console.error('Error updating capacity:', err);
      throw err;
    }
  };

  // Get capacity for a developer (with fallback to default)
  const getCapacity = (developerName: string): number => {
    // Şirket (global) günlük kapasite ayarını her zaman öncelikli kullan
    try {
      if (typeof localStorage !== 'undefined') {
        const stored = localStorage.getItem('dailyHours');
        const daily = stored ? parseFloat(stored) : NaN;
        if (Number.isFinite(daily) && daily > 0) {
          // Yaklaşık 2 haftalık sprint ~ 10 iş günü
          return Math.round(daily * 10);
        }
      }
    } catch (err) {
      console.warn('Kapasite konfigürasyonu okunamadı, 70h varsayılan kullanılacak:', err);
    }

    // Global ayar yoksa geliştiriciye özel kapasiteyi kullan
    if (capacities[developerName] != null) {
      return capacities[developerName];
    }

    // Geriye dönük uyumluluk için 70h default
    return 70;
  };

  // Set up real-time subscription
  useEffect(() => {
    fetchCapacities();

    const channel = supabase
      .channel('developer-capacities-changes')
      .on(
        'postgres_changes',
        {
          event: '*',
          schema: 'public',
          table: 'developer_capacities',
        },
        (payload) => {
          console.log('Real-time capacity update:', payload);
          
          if (payload.eventType === 'INSERT' || payload.eventType === 'UPDATE') {
            const row = payload.new as DeveloperCapacityRow;
            setCapacities(prev => ({
              ...prev,
              [row.developer_name]: Number(row.capacity_hours)
            }));
          } else if (payload.eventType === 'DELETE') {
            const row = payload.old as DeveloperCapacityRow;
            setCapacities(prev => {
              const newCapacities = { ...prev };
              delete newCapacities[row.developer_name];
              return newCapacities;
            });
          }
        }
      )
      .subscribe();

    return () => {
      supabase.removeChannel(channel);
    };
  }, []);

  return {
    capacities,
    loading,
    error,
    updateCapacity,
    getCapacity,
    refetch: fetchCapacities,
    canEdit: hasRole('admin')
  };
};

// Helper function to get developer email
const getDeveloperEmail = (name: string): string => {
  const emailMap: { [name: string]: string } = {
     'Buse Eren': 'buse.eren@acerpro.com.tr',
      'Canberk İsmet DİZDAŞ': 'canberk.dizdas@acerpro.com.tr',
      'Melih Meral': 'melih.meral@acerpro.com.tr',
      'Onur Demir': 'onur.demir@acerpro.com.tr',
      'Sezer SİNANOĞLU': 'sezer.sinanoglu@acerpro.com.tr',
      'Gizem Akay': 'gizem.akay@acerpro.com.tr',
      'Rüstem CIRIK': 'rustem.cirik@acerpro.com.tr',
      'Ahmet Tunç': 'ahmet.tunc@acerpro.com.tr',
      'Soner Canki': 'soner.canki@acerpro.com.tr',
      'Alicem Polat': 'alicem.polat@acerpro.com.tr',
      'Suat Aydoğdu': 'suat.aydogdu@acerpro.com.tr',
      'Oktay MANAVOĞLU': 'oktay.manavoglu@acerpro.com.tr',
      'Fahrettin DEMİRBAŞ': 'fahrettin.demirbas@acerpro.com.tr',
      'Abolfazl Pourmohammad': 'abolfazl.pourmohammad@acerpro.com.tr',
      'Feyza Bilgiç': 'feyza.bilgic@acerpro.com.tr',
      'Hüseyin ORAL': 'huseyin.oral@acerpro.com.tr'
  };
  
  return emailMap[name] || `${name.toLowerCase().replace(/\s+/g, '.')}@acerpro.com.tr`;
};