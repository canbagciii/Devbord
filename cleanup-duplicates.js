#!/usr/bin/env node

/**
 * Cleanup Duplicate Dark Mode Classes
 * Removes duplicate dark: classes that may have been applied multiple times
 */

import fs from 'fs';
import path from 'path';
import { fileURLToPath } from 'url';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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

function removeDuplicates(className) {
  // Split into individual classes
  const classes = className.split(/\s+/);

  // Remove duplicates while preserving order
  const seen = new Set();
  const unique = [];

  for (const cls of classes) {
    if (!seen.has(cls) && cls) {
      seen.add(cls);
      unique.push(cls);
    }
  }

  return unique.join(' ');
}

function cleanupFile(filePath) {
  console.log(`Processing: ${filePath}`);

  try {
    let content = fs.readFileSync(filePath, 'utf8');
    let changeCount = 0;

    // Find all className attributes and remove duplicates
    content = content.replace(/className="([^"]*)"/g, (match, classes) => {
      const cleaned = removeDuplicates(classes);
      if (cleaned !== classes) {
        changeCount++;
      }
      return `className="${cleaned}"`;
    });

    // Write back to file
    fs.writeFileSync(filePath, content, 'utf8');
    console.log(`✓ Completed: ${filePath} (${changeCount} classNames cleaned)`);

    return { success: true, changes: changeCount };
  } catch (error) {
    console.error(`✗ Error processing ${filePath}:`, error.message);
    return { success: false, error: error.message };
  }
}

// Main execution
console.log('🧹 Duplicate Dark Mode Class Cleanup Tool\n');

const results = files.map(file => {
  const fullPath = path.join(__dirname, file);
  return { file, ...cleanupFile(fullPath) };
});

// Summary
console.log('\n📊 Summary:');
console.log(`Total files: ${results.length}`);
console.log(`Successful: ${results.filter(r => r.success).length}`);
console.log(`Failed: ${results.filter(r => !r.success).length}`);
console.log(`Total classNames cleaned: ${results.reduce((sum, r) => sum + (r.changes || 0), 0)}`);
console.log('\n✅ Duplicate classes removed!');
