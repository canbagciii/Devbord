// import React, { useState, useEffect, useMemo, useCallback } from 'react';
// import { SprintEvaluationSummary } from '../types/evaluation';
// import { supabaseEvaluationService } from '../lib/supabaseEvaluationService';
// import { supabaseJiraService } from '../lib/supabaseJiraService';
// import { useJiraData } from '../context/JiraDataContext';
// import { useAuth } from '../context/AuthContext';
// import { BarChart3, Star, Users, MessageSquare, Download, Eye, Calendar, TrendingUp, Trash2 } from 'lucide-react';
// import type { JiraTask } from '../types';

// export const SprintEvaluationDashboard: React.FC = () => {
//   const { sprints, sprintTasks, loading } = useJiraData();
//   const { hasRole, canAccessProject } = useAuth();
//   const [evaluationSummaries, setEvaluationSummaries] = useState<SprintEvaluationSummary[]>([]);
//   const [evaluationsLoading, setEvaluationsLoading] = useState(true);
//   const [selectedSummary, setSelectedSummary] = useState<SprintEvaluationSummary | null>(null);
//   const [selectedProject, setSelectedProject] = useState<string>('all');
//   const [allProjectEvaluations, setAllProjectEvaluations] = useState<SprintEvaluationSummary[]>([]);
//   const [deletingEvaluationId, setDeletingEvaluationId] = useState<string | null>(null);

//   const projectNames: Record<string, string> = useMemo(() => ({
//     'ATK': 'Albaraka Türk Katılım Bankası',
//     'ALB': 'Alternatif Bank',
//     'AN': 'Anadolubank',
//     'BB': 'Burgan Bank',
//     'EK': 'Emlak Katılım',
//     'OB': 'OdeaBank',
//     'QNB': 'QNB Bank',
//     'TFKB': 'Türkiye Finans',
//     'VK': 'Vakıf Katılım',
//     'ZK': 'Ziraat Katılım Bankası',
//     'DK': 'Dünya Katılım'
//   }), []);

//   useEffect(() => {
//     const loadEvaluationSummaries = async () => {

//       if (!hasRole('admin')) {
//         setEvaluationsLoading(false);
//         return;
//       }

//       setEvaluationsLoading(true);

//       try {

//         const evaluatedSprints = await supabaseEvaluationService.getAllEvaluatedSprints();

//         if (evaluatedSprints.length === 0) {
//           setEvaluationSummaries([]);
//           setAllProjectEvaluations([]);
//           setEvaluationsLoading(false);
//           return;
//         }

//         const evaluatedSprintIds = evaluatedSprints.map(s => s.sprint_id);

//         const jiraSprintsMap = new Map(sprints?.map(s => [s.id, s]) || []);

//         const sprintsToProcess = evaluatedSprints.map(evalSprint => {
//           const jiraSprint = jiraSprintsMap.get(evalSprint.sprint_id);

//           if (jiraSprint) {
//             return jiraSprint;
//           } else {
//             return {
//               id: evalSprint.sprint_id,
//               name: evalSprint.sprint_name,
//               state: 'closed',
//               projectKey: evalSprint.project_key
//             } as any;
//           }
//         });

//         const missingSprintIds = sprintsToProcess
//           .filter(sprint => !sprintTasks || !sprintTasks[sprint.id])
//           .map(sprint => sprint.id);

//         const additionalSprintTasks: Record<string, JiraTask[]> = {};

//         for (const sprintId of missingSprintIds) {
//           try {
//             const tasks = await supabaseJiraService.getSprintIssues(sprintId);
//             additionalSprintTasks[sprintId] = tasks;
//           } catch (error) {
//             additionalSprintTasks[sprintId] = [];
//           }
//         }

//         const mergedSprintTasks = {
//           ...(sprintTasks || {}),
//           ...additionalSprintTasks
//         };

//         const allClosedSummaries = await supabaseEvaluationService.getAllEvaluationSummaries(
//           sprintsToProcess,
//           mergedSprintTasks,
//           projectNames
//         );

//         const allEvaluatedSummaries = allClosedSummaries.filter(summary =>
//           summary.totalEvaluations > 0 &&
//           canAccessProject(summary.projectKey)
//         );

//         setAllProjectEvaluations(allEvaluatedSummaries);

//         const latestSprintPerProject = new Map<string, SprintEvaluationSummary>();

//         allEvaluatedSummaries.forEach(summary => {
//           const existing = latestSprintPerProject.get(summary.projectKey);
//           if (!existing || (summary.endDate && existing.endDate && summary.endDate > existing.endDate)) {
//             latestSprintPerProject.set(summary.projectKey, summary);
//           }
//         });

//         const latestSprintSummaries = Array.from(latestSprintPerProject.values());

//         setEvaluationSummaries(latestSprintSummaries);

//       } catch (error) {
//         setEvaluationSummaries([]);
//         setAllProjectEvaluations([]);
//       } finally {
//         setEvaluationsLoading(false);
//       }
//     };

//     loadEvaluationSummaries();

//   }, [sprints, sprintTasks, hasRole, canAccessProject, projectNames]);

//   return (
//     <div className="space-y-6">
//       <h2 className="text-2xl font-bold text-gray-900">
//         Sprint Değerlendirmeleri
//       </h2>
//     </div>
//   );
// };