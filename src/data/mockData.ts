import { Sprint, Developer, Bank } from '../types';

export const developers: Developer[] = [
  { id: '1', name: 'Abolfazl Pourmohammad', email: 'abolfazl.pourmohammad@company.com', role: 'Developer' },
  { id: '2', name: 'Ahmet Tunç', email: 'ahmet.tunc@company.com', role: 'Developer' },
  { id: '3', name: 'Alicem Polat', email: 'alicem.polat@company.com', role: 'Developer' },
  { id: '4', name: 'Buse Eren', email: 'buse.eren@company.com', role: 'Developer' },
  { id: '5', name: 'Canberk İsmet DİZDAŞ', email: 'canberk.dizdas@company.com', role: 'Developer' },
  { id: '6', name: 'Gizem Akay', email: 'gizem.akay@company.com', role: 'Developer' },
  { id: '7', name: 'Melih Meral', email: 'melih.meral@company.com', role: 'Developer' },
  { id: '8', name: 'Oktay MANAVOĞLU', email: 'oktay.manavoglu@company.com', role: 'Developer' },
  { id: '9', name: 'Onur Demir', email: 'onur.demir@company.com', role: 'Developer' },
  { id: '10', name: 'Rüstem CIRIK', email: 'rustem.cirik@company.com', role: 'Developer' },
  { id: '11', name: 'Soner Canki', email: 'soner.canki@company.com', role: 'Developer' },
  { id: '12', name: 'Suat Aydoğdu', email: 'suat.aydogdu@company.com', role: 'Developer' },
  { id: '13', name: 'Fahrettin Demirbaş', email: 'fahrettin.demirbas@company.com', role: 'Developer' },
  { id: '14', name: 'Sezer Sinanoğlu', email: 'sezer.sinanoglu@company.com', role: 'Developer' },
  { id: '15', name: 'Hüseyin Oral', email: 'huseyin.oral@company.com', role: 'Developer' },
];

export const assigners: { id: string; name: string }[] = [
  { id: '1', name: 'Aytül Peker' },
  { id: '2', name: 'Esin Özer Aydın' },
];

export const banks: Bank[] = [
  { id: '1', name: 'Albaraka Türk', code: 'ALBARAKA', color: '#1e40af' },
  { id: '2', name: 'Alternatif Bank', code: 'ALTERNATIF', color: '#059669' },
  { id: '3', name: 'Burgan Bank', code: 'BURGAN', color: '#dc2626' },
  { id: '4', name: 'Anadolubank', code: 'ANADOLU', color: '#7c3aed' },
  { id: '5', name: 'Emlak Katılım', code: 'EMLAK', color: '#ea580c' },
  { id: '6', name: 'Qnb Bank', code: 'QNB', color: '#0891b2' },
  { id: '7', name: 'Türkiye Finans', code: 'TURKIYE', color: '#be123c' },
  { id: '8', name: 'Vakıf Katılım', code: 'VAKIF', color: '#16a34a' },
  { id: '9', name: 'Ziraat Katılım', code: 'ZIRAAT', color: '#ca8a04' },
  { id: '10', name: 'Dünya Katılım', code: 'DUNYA', color: '#9333ea' },
  { id: '11', name: 'OdeaBank', code: 'ODEA', color: '#e11d48' },
  { id: '12', name: 'Hayat Finans', code: 'HAYAT', color: '#0d9488' },
];

export const sprints: Sprint[] = [
  {
    id: '1',
    name: 'Sprint 2024-01',
    startDate: new Date('2024-01-01'),
    endDate: new Date('2024-01-14'),
    status: 'completed',
    tasks: []
  },
  {
    id: '2',
    name: 'Sprint 2024-02',
    startDate: new Date('2024-01-15'),
    endDate: new Date('2024-01-28'),
    status: 'active',
    tasks: []
  }
];