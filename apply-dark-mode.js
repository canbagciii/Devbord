#!/usr/bin/env node

/**
 * Dark Mode Class Application Script
 * Systematically applies dark mode Tailwind classes to React components
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

// Dark mode transformation patterns
const patterns = [
  // Core backgrounds
  { from: /className="([^"]*?)bg-white(\s)/g, to: 'className="$1bg-white dark:bg-gray-800$2' },
  { from: /className="([^"]*?)bg-white([^"]*)"/g, to: 'className="$1bg-white dark:bg-gray-800$2"' },
  { from: /className="([^"]*?)bg-gray-50(\s)/g, to: 'className="$1bg-gray-50 dark:bg-gray-900$2' },
  { from: /className="([^"]*?)bg-gray-50([^"]*)"/g, to: 'className="$1bg-gray-50 dark:bg-gray-900$2"' },
  { from: /className="([^"]*?)bg-gray-100(\s)/g, to: 'className="$1bg-gray-100 dark:bg-gray-700$2' },
  { from: /className="([^"]*?)bg-gray-100([^"]*)"/g, to: 'className="$1bg-gray-100 dark:bg-gray-700$2"' },

  // Text colors
  { from: /className="([^"]*?)text-gray-900(\s)/g, to: 'className="$1text-gray-900 dark:text-gray-100$2' },
  { from: /className="([^"]*?)text-gray-900([^"]*)"/g, to: 'className="$1text-gray-900 dark:text-gray-100$2"' },
  { from: /className="([^"]*?)text-gray-800(\s)/g, to: 'className="$1text-gray-800 dark:text-gray-200$2' },
  { from: /className="([^"]*?)text-gray-800([^"]*)"/g, to: 'className="$1text-gray-800 dark:text-gray-200$2"' },
  { from: /className="([^"]*?)text-gray-700(\s)/g, to: 'className="$1text-gray-700 dark:text-gray-300$2' },
  { from: /className="([^"]*?)text-gray-700([^"]*)"/g, to: 'className="$1text-gray-700 dark:text-gray-300$2"' },
  { from: /className="([^"]*?)text-gray-600(\s)/g, to: 'className="$1text-gray-600 dark:text-gray-400$2' },
  { from: /className="([^"]*?)text-gray-600([^"]*)"/g, to: 'className="$1text-gray-600 dark:text-gray-400$2"' },
  { from: /className="([^"]*?)text-gray-500(\s)/g, to: 'className="$1text-gray-500 dark:text-gray-400$2' },
  { from: /className="([^"]*?)text-gray-500([^"]*)"/g, to: 'className="$1text-gray-500 dark:text-gray-400$2"' },

  // Borders
  { from: /className="([^"]*?)border-gray-200(\s)/g, to: 'className="$1border-gray-200 dark:border-gray-700$2' },
  { from: /className="([^"]*?)border-gray-200([^"]*)"/g, to: 'className="$1border-gray-200 dark:border-gray-700$2"' },
  { from: /className="([^"]*?)border-gray-300(\s)/g, to: 'className="$1border-gray-300 dark:border-gray-600$2' },
  { from: /className="([^"]*?)border-gray-300([^"]*)"/g, to: 'className="$1border-gray-300 dark:border-gray-600$2"' },

  // Hover states
  { from: /className="([^"]*?)hover:bg-gray-50(\s)/g, to: 'className="$1hover:bg-gray-50 dark:hover:bg-gray-700$2' },
  { from: /className="([^"]*?)hover:bg-gray-50([^"]*)"/g, to: 'className="$1hover:bg-gray-50 dark:hover:bg-gray-700$2"' },
  { from: /className="([^"]*?)hover:bg-gray-100(\s)/g, to: 'className="$1hover:bg-gray-100 dark:hover:bg-gray-700$2' },
  { from: /className="([^"]*?)hover:bg-gray-100([^"]*)"/g, to: 'className="$1hover:bg-gray-100 dark:hover:bg-gray-700$2"' },

  // Badge patterns with text
  { from: /className="([^"]*?)bg-green-100\s+text-green-800([^"]*)"/g, to: 'className="$1bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300$2"' },
  { from: /className="([^"]*?)bg-blue-100\s+text-blue-800([^"]*)"/g, to: 'className="$1bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300$2"' },
  { from: /className="([^"]*?)bg-red-100\s+text-red-800([^"]*)"/g, to: 'className="$1bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300$2"' },
  { from: /className="([^"]*?)bg-yellow-100\s+text-yellow-800([^"]*)"/g, to: 'className="$1bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300$2"' },
  { from: /className="([^"]*?)bg-amber-100\s+text-amber-800([^"]*)"/g, to: 'className="$1bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300$2"' },
  { from: /className="([^"]*?)bg-purple-100\s+text-purple-800([^"]*)"/g, to: 'className="$1bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300$2"' },
  { from: /className="([^"]*?)bg-orange-100\s+text-orange-800([^"]*)"/g, to: 'className="$1bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300$2"' },

  // Badge borders
  { from: /className="([^"]*?)border-green-200(\s)/g, to: 'className="$1border-green-200 dark:border-green-700$2' },
  { from: /className="([^"]*?)border-green-200([^"]*)"/g, to: 'className="$1border-green-200 dark:border-green-700$2"' },
  { from: /className="([^"]*?)border-blue-200(\s)/g, to: 'className="$1border-blue-200 dark:border-blue-700$2' },
  { from: /className="([^"]*?)border-blue-200([^"]*)"/g, to: 'className="$1border-blue-200 dark:border-blue-700$2"' },
  { from: /className="([^"]*?)border-red-200(\s)/g, to: 'className="$1border-red-200 dark:border-red-700$2' },
  { from: /className="([^"]*?)border-red-200([^"]*)"/g, to: 'className="$1border-red-200 dark:border-red-700$2"' },
  { from: /className="([^"]*?)border-yellow-200(\s)/g, to: 'className="$1border-yellow-200 dark:border-yellow-700$2' },
  { from: /className="([^"]*?)border-yellow-200([^"]*)"/g, to: 'className="$1border-yellow-200 dark:border-yellow-700$2"' },
  { from: /className="([^"]*?)border-amber-200(\s)/g, to: 'className="$1border-amber-200 dark:border-amber-700$2' },
  { from: /className="([^"]*?)border-amber-200([^"]*)"/g, to: 'className="$1border-amber-200 dark:border-amber-700$2"' },
];

// Files to process
const files = [
  'src/components/TaskList.tsx',
  'src/components/TaskModal.tsx',
  'src/components/Analytics.tsx',
  'src/components/WorkloadAnalytics.tsx',
  'src/components/JiraReport.tsx',
  'src/components/UserManagement.tsx',
  'src/components/ProjectSprintOverview.tsx',
  'src/components/DeveloperWorkloadDashboard.tsx',
  'src/components/SprintEvaluationDashboard.tsx',
  'src/components/ManualTaskAssignment.tsx',
  'src/components/JiraFilterManagement.tsx',
  'src/components/KolayIKEmployees.tsx',
];

function applyDarkMode(filePath) {
  console.log(`Processing: ${filePath}`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changeCount = 0;

    // Apply each pattern
    patterns.forEach(pattern => {
      const before = content;
      content = content.replace(pattern.from, pattern.to);
      if (content !== before) {
        changeCount++;
      }
    });

    // Write back to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Completed: ${filePath} (${changeCount} pattern types applied)`);

    return { success: true, changes: changeCount };
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main execution
console.log('🎨 Dark Mode Class Application Tool\n');

const results = files.map(file => {
  const fullPath = path.join(__dirname, file);
  return { file, ...applyDarkMode(fullPath) };
});

// Summary
console.log('\n📊 Summary:');
console.log(`Total files: ${results.length}`);
console.log(`Successful: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
console.log('\n✅ Dark mode patterns applied!');
