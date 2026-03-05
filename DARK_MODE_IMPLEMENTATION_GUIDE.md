# Dark Mode Implementation Guide

## Completed Files
✅ **UserProfile.tsx** - Fully updated with dark mode classes

## Files Requiring Dark Mode Updates

The following files need systematic dark mode class additions following these patterns:

### Core Pattern Reference

```typescript
// Backgrounds
bg-white → bg-white dark:bg-gray-800
bg-gray-50 → bg-gray-50 dark:bg-gray-900
bg-gray-100 → bg-gray-100 dark:bg-gray-700

// Text Colors
text-gray-900 → text-gray-900 dark:text-gray-100
text-gray-800 → text-gray-800 dark:text-gray-200
text-gray-700 → text-gray-700 dark:text-gray-300
text-gray-600 → text-gray-600 dark:text-gray-400
text-gray-500 → text-gray-500 dark:text-gray-400
text-gray-400 → text-gray-400 dark:text-gray-500

// Borders
border-gray-200 → border-gray-200 dark:border-gray-700
border-gray-300 → border-gray-300 dark:border-gray-600

// Hover States
hover:bg-gray-50 → hover:bg-gray-50 dark:hover:bg-gray-700
hover:bg-gray-100 → hover:bg-gray-100 dark:hover:bg-gray-700

// Status Badges
bg-green-100 text-green-800 → bg-green-100 dark:bg-green-900/30 text-green-800 dark:text-green-300
bg-blue-100 text-blue-800 → bg-blue-100 dark:bg-blue-900/30 text-blue-800 dark:text-blue-300
bg-red-100 text-red-800 → bg-red-100 dark:bg-red-900/30 text-red-800 dark:text-red-300
bg-yellow-100 text-yellow-800 → bg-yellow-100 dark:bg-yellow-900/30 text-yellow-800 dark:text-yellow-300
bg-amber-100 text-amber-800 → bg-amber-100 dark:bg-amber-900/30 text-amber-800 dark:text-amber-300
bg-purple-100 text-purple-800 → bg-purple-100 dark:bg-purple-900/30 text-purple-800 dark:text-purple-300
bg-orange-100 text-orange-800 → bg-orange-100 dark:bg-orange-900/30 text-orange-800 dark:text-orange-300

// Badge Borders
border-green-200 → border-green-200 dark:border-green-700
border-blue-200 → border-blue-200 dark:border-blue-700
border-red-200 → border-red-200 dark:border-red-700
border-yellow-200 → border-yellow-200 dark:border-yellow-700
border-amber-200 → border-amber-200 dark:border-amber-700

// Form Elements
className="...border border-gray-300..."
→ className="...border border-gray-300 dark:border-gray-600 dark:bg-gray-700 dark:text-gray-100..."
```

## Remaining Files to Update

### 1. TaskList.tsx (304 lines)
**Priority: HIGH**
- Table headers and rows
- Filter dropdowns and search inputs
- Status badges
- Action buttons
- Empty states

### 2. TaskModal.tsx (240 lines)
**Priority: HIGH**
- Modal background and borders
- Form inputs and labels
- Select dropdowns
- Buttons and actions
- Error/success messages

### 3. Analytics.tsx
**Priority: HIGH**
- Dashboard cards
- Statistics displays
- Chart containers
- Metric badges

### 4. WorkloadAnalytics.tsx
**Priority: HIGH**
- Workload cards
- Progress bars
- Developer avatars
- Capacity indicators

### 5. JiraReport.tsx
**Priority: MEDIUM**
- Report cards
- Issue listings
- Status indicators
- Export buttons

### 6. UserManagement.tsx
**Priority: MEDIUM**
- User table
- Role badges
- Action modals
- Form inputs

### 7. ProjectSprintOverview.tsx
**Priority: MEDIUM**
- Sprint cards
- Project headers
- Timeline displays
- Status badges

### 8. DeveloperWorkloadDashboard.tsx
**Priority: MEDIUM**
- Developer cards
- Workload metrics
- Assignment listings
- Capacity bars

### 9. SprintEvaluationDashboard.tsx (641 lines)
**Priority: HIGH**
- Evaluation cards
- Rating displays
- Comment sections
- Project filters
- Detail modal

### 10. ManualTaskAssignment.tsx (712 lines)
**Priority: HIGH**
- Assignment form modal
- Developer capacity table
- Task listings
- Project/sprint selects
- Status indicators

### 11. JiraFilterManagement.tsx (615 lines)
**Priority: HIGH**
- Step indicators
- Project cards
- User selection checkboxes
- Settings forms
- Summary panels

### 12. KolayIKEmployees.tsx (735 lines)
**Priority: HIGH**
- Employee table
- Statistics cards
- Leave detail badges
- Department summaries
- Filter controls

## Implementation Strategy

For each file, apply the patterns to:

1. **Container Elements**
   - Main divs with bg-white
   - Section backgrounds
   - Modal overlays

2. **Cards and Panels**
   - Card backgrounds
   - Card borders
   - Card text colors

3. **Tables**
   - Table headers (bg-gray-50)
   - Table rows (hover states)
   - Table cells (text colors)
   - Alternating row colors

4. **Forms**
   - Input fields (border, bg, text)
   - Labels (text color)
   - Select dropdowns
   - Textareas
   - Error messages

5. **Buttons**
   - Secondary buttons (borders, text)
   - Icon buttons (hover states)

6. **Badges and Pills**
   - Status badges
   - Count indicators
   - Tag elements

7. **Icons**
   - Icon text colors (text-gray-500 → dark:text-gray-400)
   - Icon backgrounds

## Search and Replace Approach

Use your IDE's find/replace with regex to apply patterns:

1. Find: `className="([^"]*?)bg-white([^"]*?)"`
   Replace: `className="$1bg-white dark:bg-gray-800$2"`

2. Find: `className="([^"]*?)bg-gray-50([^"]*?)"`
   Replace: `className="$1bg-gray-50 dark:bg-gray-900$2"`

3. Find: `className="([^"]*?)text-gray-900([^"]*?)"`
   Replace: `className="$1text-gray-900 dark:text-gray-100$2"`

...and so on for each pattern.

## Testing Checklist

After applying changes, test:
- [ ] Toggle dark mode switch
- [ ] Check all tables for readability
- [ ] Verify form inputs are visible
- [ ] Confirm badges have proper contrast
- [ ] Test modals and overlays
- [ ] Check hover states
- [ ] Verify icons are visible
- [ ] Test all interactive elements

## Notes

- Always maintain proper contrast ratios
- Test with actual dark mode enabled
- Check for any hardcoded colors that need updating
- Ensure icons remain visible in both modes
- Verify loading states work in dark mode
