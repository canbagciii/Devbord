// Utility functions for worklog calculations

export function normalizeName(name: string): string {
  return name
    .toLocaleLowerCase('tr')
    .replace(/ı/g, 'i')
    .replace(/ş/g, 's')
    .replace(/ç/g, 'c')
    .replace(/ğ/g, 'g')
    .replace(/ü/g, 'u')
    .replace(/ö/g, 'o')
    .replace(/İ/g, 'i')
    .replace(/Ş/g, 's')
    .replace(/Ç/g, 'c')
    .replace(/Ğ/g, 'g')
    .replace(/Ü/g, 'u')
    .replace(/Ö/g, 'o')
    .replace(/[^a-z0-9\s]/gi, '')
    .trim();
}

// Yazılımcı ismi eşleştirme - esnek eşleştirme
export function isDeveloperMatch(jiraName: string, targetName: string): boolean {
  const jiraNorm = normalizeName(jiraName);
  const targetNorm = normalizeName(targetName);
  
  // Tam eşleşme
  if (jiraNorm === targetNorm) return true;
  
  // İlk ve son isim eşleşmesi
  const jiraTokens = jiraNorm.split(' ').filter(Boolean);
  const targetTokens = targetNorm.split(' ').filter(Boolean);
  
  if (jiraTokens.length >= 2 && targetTokens.length >= 2) {
    const jiraFirst = jiraTokens[0];
    const jiraLast = jiraTokens[jiraTokens.length - 1];
    const targetFirst = targetTokens[0];
    const targetLast = targetTokens[targetTokens.length - 1];
    
    if (jiraFirst === targetFirst && jiraLast === targetLast) return true;
  }
  
  return false;
}

