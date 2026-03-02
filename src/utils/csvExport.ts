export const exportToCSV = (data: any[], filename: string, headers?: string[]) => {
  if (!data || data.length === 0) {
    alert('İndirilecek veri bulunamadı.');
    return;
  }

  // Eğer headers belirtilmemişse, ilk objenin key'lerini kullan
  const csvHeaders = headers || Object.keys(data[0]);
  
  // CSV içeriğini oluştur
  const csvContent = [
    // Header satırı
    csvHeaders.join(','),
    // Data satırları
    ...data.map(row => 
      csvHeaders.map(header => {
        let value = row[header];
        
        // Tarih objelerini string'e çevir
        if (value instanceof Date) {
          value = value.toLocaleString('tr-TR');
        }
        
        // Null/undefined değerleri boş string yap
        if (value === null || value === undefined) {
          value = '';
        }
        
        // String değerleri quote'la ve virgülleri escape et
        if (typeof value === 'string') {
          value = `"${value.replace(/"/g, '""')}"`;
        }
        
        return value;
      }).join(',')
    )
  ].join('\n');

  // BOM ekle (Türkçe karakterler için)
  const BOM = '\uFEFF';
  const blob = new Blob([BOM + csvContent], { type: 'text/csv;charset=utf-8;' });
  
  // Download link oluştur
  const link = document.createElement('a');
  const url = URL.createObjectURL(blob);
  link.setAttribute('href', url);
  link.setAttribute('download', `${filename}_${new Date().toISOString().split('T')[0]}.csv`);
  link.style.visibility = 'hidden';
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
};

// Yazılımcı iş yükü verilerini CSV'ye çevir
export const exportDeveloperWorkloadToCSV = (workload: any[]) => {
  const csvData = workload.map(dev => ({
    'Yazılımcı': dev.developer,
    'Email': dev.email,
    'Toplam Görev': dev.totalTasks,
    'Toplam Süre (saat)': dev.totalHours,
    'Harcanan Süre (saat)': dev.totalActualHours,
    'Durum': dev.status,
    'Proje Sayısı': Array.from(new Set(dev.details.map((d: any) => d.project))).length,
    'Sprint Sayısı': Array.from(new Set(dev.details.map((d: any) => d.sprint))).length
  }));

  exportToCSV(csvData, 'yazilimci_is_yuku_analizi');
};

// Proje sprint verilerini CSV'ye çevir
export const exportProjectSprintToCSV = (sprints: any[], sprintTasks: any) => {
  const csvData = sprints.map(sprint => {
    const tasks = sprintTasks[sprint.id] || [];
    const assignedDevelopers = Array.from(new Set(
      tasks.filter((task: any) => task.assignee !== 'Unassigned').map((task: any) => task.assignee)
    ));
    
    return {
      'Sprint Adı': sprint.name,
      'Proje': sprint.projectKey || 'Bilinmiyor',
      'Durum': sprint.state === 'active' ? 'Aktif' : sprint.state,
      'Görev Sayısı': tasks.length,
      'Toplam Süre (saat)': tasks.reduce((sum: number, task: any) => sum + task.estimatedHours, 0),
      'Harcanan Süre (saat)': tasks.reduce((sum: number, task: any) => sum + task.actualHours, 0),
      'Yazılımcı Sayısı': assignedDevelopers.length,
      'Başlangıç Tarihi': sprint.startDate ? new Date(sprint.startDate).toLocaleDateString('tr-TR') : '',
      'Bitiş Tarihi': sprint.endDate ? new Date(sprint.endDate).toLocaleDateString('tr-TR') : ''
    };
  });

  exportToCSV(csvData, 'proje_sprint_genel_bakis');
};

// Manuel görev atamalarını CSV'ye çevir
export const exportManualAssignmentsToCSV = (assignments: any[]) => {
  const csvData = assignments.map(assignment => ({
    'Görev Başlığı': assignment.title,
    'Açıklama': assignment.description || '',
    'Atanan Kişi': assignment.assignee,
    'Proje': assignment.project,
    'Sprint': assignment.sprint || '',
    'Tahmini Süre (saat)': assignment.estimatedHours,
    'Öncelik': assignment.priority,
    'Teslim Tarihi': assignment.dueDate ? new Date(assignment.dueDate).toLocaleDateString('tr-TR') : '',
    'Atayan': assignment.createdBy,
    'Oluşturma Tarihi': new Date(assignment.createdAt).toLocaleDateString('tr-TR')
  }));

  exportToCSV(csvData, 'manuel_gorev_atamalari');
};

// İş yükü analitik verilerini CSV'ye çevir
export const exportWorkloadAnalyticsToCSV = (workload: any[], analytics: any) => {
  // Genel istatistikler
  const generalStats = [{
    'Metrik': 'Toplam Yazılımcı',
    'Değer': analytics.totalDevelopers
  }, {
    'Metrik': 'Toplam Görev',
    'Değer': analytics.totalTasks
  }, {
    'Metrik': 'Toplam Süre (saat)',
    'Değer': analytics.totalHours
  }, {
    'Metrik': 'Toplam Harcanan Süre (saat)',
    'Değer': analytics.totalActualHours
  }, {
    'Metrik': 'Ortalama İş Yükü (saat)',
    'Değer': analytics.averageWorkload
  }, {
    'Metrik': 'Ortalama Harcanan Süre (saat)',
    'Değer': analytics.averageActualWorkload
  }, {
    'Metrik': 'Eksik Yük Sayısı',
    'Değer': analytics.underloadedCount
  }, {
    'Metrik': 'Yeterli Yük Sayısı',
    'Değer': analytics.adequateCount
  }, {
    'Metrik': 'Aşırı Yük Sayısı',
    'Değer': analytics.overloadedCount
  }];

  exportToCSV(generalStats, 'is_yuku_analitikleri_genel');

  // Yazılımcı performans tablosu
  const performanceData = workload.map(developer => {
    const uniqueProjects = Array.from(new Set(developer.details.map((d: any) => d.project))).length;
    const efficiency = developer.totalTasks > 0 ? Math.round(developer.totalHours / developer.totalTasks) : 0;
    
    return {
      'Yazılımcı': developer.developer,
      'Görev Sayısı': developer.totalTasks,
      'Toplam Süre (saat)': developer.totalHours,
      'Harcanan Süre (saat)': developer.totalActualHours,
      'Proje Sayısı': uniqueProjects,
      'Verimlilik (saat/görev)': efficiency,
      'Durum': developer.status
    };
  });

  exportToCSV(performanceData, 'yazilimci_performans_tablosu');
};