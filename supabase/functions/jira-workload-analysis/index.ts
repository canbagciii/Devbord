import { serve } from "https://deno.land/std@0.168.0/http/server.ts"
import { createClient } from "npm:@supabase/supabase-js@2.52.0"

const corsHeaders = {
  'Access-Control-Allow-Origin': '*',
  'Access-Control-Allow-Headers': 'authorization, x-client-info, apikey, content-type, x-company-id',
  'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
}

interface JiraConfig {
  baseUrl: string
  email: string
  token: string
}

interface JiraTask {
  id: string
  key: string
  summary: string
  description?: string
  status: string
  assignee: string
  project: string
  sprint: string
  estimatedHours: number
  actualHours: number
  priority: string
  created: string
  updated: string
  parentKey?: string | null
  isSubtask?: boolean
  issueType?: string
  worklogs?: Array<{
    author: { accountId: string; displayName: string; emailAddress?: string }
    timeSpentSeconds: number
    started?: string
    comment?: any
    isSubtask?: boolean
    parentKey?: string
    taskKey?: string
    taskSummary?: string
    project?: string
    sprint?: string
  }>
}

interface ProjectSprintDetail {
  project: string
  sprint: string
  taskCount: number
  hours: number
  actualHours: number
  tasks?: JiraTask[]
}

interface DeveloperWorkload {
  developer: string
  email: string
  totalTasks: number
  totalHours: number
  totalActualHours: number
  status: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük'
  details: ProjectSprintDetail[]
}

const getJiraConfig = async (companyId: string): Promise<JiraConfig> => {
  const supabaseUrl = Deno.env.get('SUPABASE_URL')!
  const supabaseKey = Deno.env.get('SUPABASE_SERVICE_ROLE_KEY')!
  const supabase = createClient(supabaseUrl, supabaseKey)

  console.log('🔍 Fetching Jira config for company (workload-analysis):', companyId)

  const { data: company, error } = await supabase
    .from('companies')
    .select('jira_base_url, jira_email, jira_api_token')
    .eq('id', companyId)
    .single()

  if (error) {
    console.error('❌ Error fetching company:', error)
    throw new Error(`Failed to fetch company data: ${error.message}`)
  }

  if (!company) {
    throw new Error('Company not found')
  }

  const { jira_base_url, jira_email, jira_api_token } = company

  console.log('🔍 Jira config check (workload-analysis):', {
    baseUrl: jira_base_url,
    emailExists: !!jira_email,
    tokenExists: !!jira_api_token,
    emailLength: jira_email?.length || 0,
    tokenLength: jira_api_token?.length || 0
  })

  if (!jira_email || !jira_api_token) {
    const missingVars: string[] = []
    if (!jira_email) missingVars.push('jira_email')
    if (!jira_api_token) missingVars.push('jira_api_token')

    console.error('❌ Missing Jira credentials for company:', missingVars)
    throw new Error(`Missing Jira credentials for company: ${missingVars.join(', ')}`)
  }

  return {
    baseUrl: jira_base_url || 'https://acerpro.atlassian.net',
    email: jira_email,
    token: jira_api_token
  }
}

const makeJiraRequest = async (endpoint: string, config: JiraConfig, options: RequestInit = {}) => {
  const authHeader = btoa(`${config.email}:${config.token}`)
  
  const finalUrl = `${config.baseUrl}${endpoint}`
  console.log(`🌐 Making request to: ${finalUrl}`)
  
  try {
    const response = await fetch(finalUrl, {
      ...options,
      headers: {
        'Authorization': `Basic ${authHeader}`,
        'Accept': 'application/json',
        'Content-Type': 'application/json',
        ...options.headers,
      },
    })
    
    console.log(`📡 Response status: ${response.status} ${response.statusText}`)
    
    if (!response.ok) {
      const errorText = await response.text()
      console.error(`❌ Jira API Error: ${response.status} - ${errorText}`)
      throw new Error(`Jira API Error (${response.status}): ${errorText}`)
    }
    
    const data = await response.json()
    console.log('✅ Request successful, data received')
    return data
  } catch (error) {
    console.error('🚨 Request failed:', error)
    throw error
  }
}

const getAllSprints = async (config: JiraConfig, sprintType: 'active' | 'closed' | 'both' = 'active') => {
  console.log(`🔄 Fetching ${sprintType} sprints...`)
  
  const boardsResponse = await makeJiraRequest('/rest/agile/1.0/board?maxResults=100', config)
  const boards = boardsResponse.values || []
  
  console.log(`📋 Found ${boards.length} total boards`)
  
  const simpleBoards = boards.filter((board: any) => board.type === 'simple')
  console.log(`📋 Found ${simpleBoards.length} simple boards that support sprints`)
  
  const allSprints = []
  
  for (const board of simpleBoards) {
    try {
      console.log(`🔍 Fetching sprints for board: ${board.name} (${board.id})`)
      
      let sprintsResponse
      
      if (sprintType === 'active') {
        sprintsResponse = await makeJiraRequest(`/rest/agile/1.0/board/${board.id}/sprint?state=active&maxResults=50`, config)
      } else if (sprintType === 'closed') {
        const projectKey = extractProjectKeyFromBoard(board.name)
        console.log(`📊 Board ${board.name} (${projectKey}): Fetching last 1 closed sprint`)
        sprintsResponse = await makeJiraRequest(`/rest/agile/1.0/board/${board.id}/sprint?state=closed&maxResults=1&orderBy=-completeDate`, config)
      } else {
        const [activeResponse, closedResponse] = await Promise.all([
          makeJiraRequest(`/rest/agile/1.0/board/${board.id}/sprint?state=active&maxResults=50`, config),
          makeJiraRequest(`/rest/agile/1.0/board/${board.id}/sprint?state=closed&maxResults=1&orderBy=-completeDate`, config)
        ])
        sprintsResponse = {
          values: [...(activeResponse.values || []), ...(closedResponse.values || [])]
        }
      }
      
      const sprints = sprintsResponse.values || []
      const projectKey = extractProjectKeyFromBoard(board.name)
      console.log(`📊 Board ${board.name} (${projectKey}): Found ${sprints.length} ${sprintType} sprints`)
      
      for (const sprint of sprints) {
        allSprints.push({
          sprint: {
            ...sprint,
            boardId: board.id,
            projectKey: extractProjectKeyFromBoard(board.name)
          },
          boardName: board.name,
          projectKey: extractProjectKeyFromBoard(board.name)
        })
      }
    } catch (error) {
      console.warn(`❌ Could not fetch sprints for board ${board.id} (${board.name}):`, error)
    }
  }
  
  console.log(`✅ Total ${sprintType} sprints found: ${allSprints.length}`)
  return allSprints
}

const getSprintIssuesWithSubtasks = async (config: JiraConfig, sprintId: string): Promise<JiraTask[]> => {
  try {
    console.log(`🔄 Fetching ALL issues for sprint ${sprintId}...`)
    
    const jql = `sprint = ${sprintId} ORDER BY key ASC`
    console.log(`🔍 Using JQL: ${jql}`)

    const fieldsParam = 'summary,description,status,assignee,project,priority,created,updated,timeoriginalestimate,issuetype,parent'
    const searchUrl = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&maxResults=1000&fields=${encodeURIComponent(fieldsParam)}`
    const response = await makeJiraRequest(searchUrl, config, { method: 'GET' })
    
    if (!response.issues || !Array.isArray(response.issues)) {
      console.warn(`⚠️ No issues found for sprint ${sprintId}`)
      return []
    }
    
    console.log(`📊 Sprint ${sprintId}: Found ${response.issues.length} total issues`)
    
    const allTasks: JiraTask[] = []
    
    for (const issue of response.issues) {
      const assigneeName = issue.fields.assignee?.displayName || 'Unassigned'
      const isSubtask = issue.fields.issuetype?.subtask === true || 
                       issue.fields.issuetype?.name === 'Sub-task' ||
                       issue.fields.issuetype?.name === 'Subtask' ||
                       !!issue.fields.parent
      const issueType = issue.fields.issuetype?.name || 'Task'
      const parentKey = issue.fields.parent?.key || null
      
      const task: JiraTask = {
        id: issue.id,
        key: issue.key,
        summary: issue.fields.summary,
        description: issue.fields.description,
        status: issue.fields.status.name,
        assignee: assigneeName,
        project: issue.fields.project.name,
        sprint: sprintId,
        estimatedHours: issue.fields.timeoriginalestimate ? parseFloat((issue.fields.timeoriginalestimate / 3600).toFixed(2)) : 0,
        actualHours: 0, // Bu değer sprint tarih aralığındaki worklog'lardan hesaplanacak
        priority: issue.fields.priority?.name || 'Medium',
        created: issue.fields.created,
        updated: issue.fields.updated,
        parentKey: parentKey,
        isSubtask: isSubtask,
        issueType: issueType
      }
      
      allTasks.push(task)
    }
    
    console.log(`✅ Sprint ${sprintId}: Processed ${allTasks.length} tasks`)
    return allTasks
  } catch (error) {
    console.warn(`❌ Could not fetch issues for sprint ${sprintId}:`, error)
    return []
  }
}

const extractProjectKeyFromBoard = (boardName: string): string => {
  const boardNameNormalized = boardName.toLowerCase().trim()
  
  // VK ve ZK için daha spesifik kontrol
  if (boardNameNormalized === 'vk board' || 
      boardNameNormalized === 'vk' || 
      (boardNameNormalized.includes('vakıf') && boardNameNormalized.includes('katılım')) ||
      (boardNameNormalized.includes('vakif') && boardNameNormalized.includes('katilim'))) {
    return 'VK'
  }
  
  if (boardNameNormalized === 'zk board' || 
      boardNameNormalized === 'zk' || 
      (boardNameNormalized.includes('ziraat') && boardNameNormalized.includes('katılım')) ||
      (boardNameNormalized.includes('ziraat') && boardNameNormalized.includes('katilim'))) {
    return 'ZK'
  }
  
  if (boardNameNormalized.includes('odea') || 
      boardNameNormalized.includes('ob panosu') || 
      boardNameNormalized.includes('ob board') ||
      boardNameNormalized.includes('odeabank') ||
      boardNameNormalized === 'ob') {
    return 'OB'
  }
  
  if (boardNameNormalized.includes('an board') || (boardNameNormalized.includes('an') && boardNameNormalized.includes('board'))) {
    return 'AN'
  } else if (boardNameNormalized.includes('tfkb')) {
    return 'TFKB'
  } else if (boardNameNormalized.includes('qnb')) {
    return 'QNB'
  } else if (boardNameNormalized.includes('atk')) {
    return 'ATK'
  } else if (boardNameNormalized.includes('alb')) {
    return 'ALB'
  } else if (boardNameNormalized.includes('bb')) {
    return 'BB'
  } else if (boardNameNormalized.includes('ek')) {
    return 'EK'
  } else if (boardNameNormalized.includes('dk')) {
    return 'DK'
  } else if (boardNameNormalized.includes('hf') || boardNameNormalized.includes('hayat')) {
    return 'HF'
  }
  
  console.warn(`⚠️ Unknown board name pattern: "${boardName}" (normalized: "${boardNameNormalized}")`)
  return 'UNKNOWN'
}

const getProjectNameFromKey = (key: string): string => {
  const projectNames: { [key: string]: string } = {
    'ATK': 'Albaraka Türk Katılım Bankası',
    'ALB': 'Alternatif Bank',
    'AN': 'Anadolubank',
    'BB': 'Burgan Bank',
    'EK': 'Emlak Katılım',
    'OB': 'OdeaBank',
    'QNB': 'QNB Bank',
    'TFKB': 'Türkiye Finans Katılım Bankası',
    'VK': 'Vakıf Katılım',
    'ZK': 'Ziraat Katılım Bankası',
    'DK': 'Dünya Katılım',
    'HF': 'Hayat Finans'
  }
  return projectNames[key] || key
}

const getDeveloperEmail = (name: string): string => {
  const emailMap: { [name: string]: string } = {
      'Buse Eren': 'buse.eren@acerpro.com.tr',
      'Canberk İsmet DİZDAŞ': 'canberk.dizdas@acerpro.com.tr',
      'Melih Meral': 'melih.meral@acerpro.com.tr',
      'Onur Demir': 'onur.demir@acerpro.com.tr',
      'Sezer SİNANOĞLU': 'sezer.sinanoglu@acerpro.com.tr',
      'Gizem Akay': 'gizem.akay@acerpro.com.tr',
      'Rüstem CIRIK': 'rustem.cirik@acerpro.com.tr',
      'Soner Canki': 'soner.canki@acerpro.com.tr',
      'Alicem Polat': 'alicem.polat@acerpro.com.tr',
      'Suat Aydoğdu': 'suat.aydogdu@acerpro.com.tr',
      'Oktay MANAVOĞLU': 'oktay.manavoglu@acerpro.com.tr',
      'Fahrettin DEMİRBAŞ': 'fahrettin.demirbas@acerpro.com.tr',
      'Abolfazl Pourmohammad': 'abolfazl.pourmohammad@acerpro.com.tr',
      'Feyza Bilgiç': 'feyza.bilgic@acerpro.com.tr',
      'Hüseyin ORAL': 'huseyin.oral@acerpro.com.tr'
  }
  
  return emailMap[name] || `${name.toLowerCase().replace(/\s+/g, '.')}@company.com`
}

const normalizeName = (name: string): string => {
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
    .replace(/[^a-zA-Z0-9\s]/g, '')
    .trim()
}

// GÜNLÜK SÜRE TAKİBİ MANTIGI - BİREBİR KOPYALANDI
const getWorklogDataForDeveloper = async (config: JiraConfig, developerName: string, startDate: string, endDate: string): Promise<Array<{
  author: { displayName: string; accountId: string }
  timeSpentSeconds: number
  started: string
  projectKey: string
  projectName: string
  issueKey: string
  issueSummary: string
  comment?: string
  isSubtask?: boolean
  parentKey?: string
  issueTypeName?: string
}>> => {
  console.log(`🔄 Fetching ALL worklogs for ${developerName} between ${startDate} and ${endDate}`)
  
  try {
    // GÜNLÜK SÜRE TAKİBİ ile AYNI JQL sorgusu
    const jqlStartDate = startDate.replace(/-/g, '/')
    const jqlEndDate = endDate.replace(/-/g, '/')
    const jql = `worklogAuthor = "${developerName}" AND worklogDate >= "${jqlStartDate}" AND worklogDate <= "${jqlEndDate}" ORDER BY updated DESC`
    
    console.log(`🔍 JQL for ${developerName}: ${jql}`)

    const pageSize = 100
    let startAt = 0
    let total = Infinity
    const developerIssues: any[] = []
    
    // Sayfalı issue çekme - GET kullan (POST /search/jql 400 Invalid request payload dönüyor)
    while (startAt < total) {
      const fieldsParam = 'worklog,summary,project,issuetype,parent,updated,created'
      const searchUrl = `/rest/api/3/search/jql?jql=${encodeURIComponent(jql)}&startAt=${startAt}&maxResults=${pageSize}&fields=${encodeURIComponent(fieldsParam)}`
      const page = await makeJiraRequest(searchUrl, config, { method: 'GET' })
      const issues: any[] = page.issues || []
      const pageTotal = typeof page.total === 'number' ? page.total : (startAt + issues.length)
      total = pageTotal
      developerIssues.push(...issues)
      console.log(`📄 ${developerName} issues page: startAt=${startAt}, got=${issues.length}, total=${total}`)
      if (issues.length === 0) break
      startAt += issues.length
    }
    
    console.log(`📊 ${developerName}: Found ${developerIssues.length} issues with worklogs in date range`)
    
    const allWorklogs: any[] = []
    
    // Her issue için TÜM worklog'ları sayfalı çek - GÜNLÜK SÜRE TAKİBİ ile AYNI
    for (const issue of developerIssues) {
      console.log(`🔍 Processing issue: ${issue.key} for ${developerName}`)
      
      let worklogs: any[] = []
      
      // Issue fields'dan worklog bilgisini kontrol et
      if (issue.fields.worklog) {
        const wl = issue.fields.worklog
        worklogs = Array.isArray(wl.worklogs) ? wl.worklogs : []
        const total: number = typeof wl.total === 'number' ? wl.total : worklogs.length
        const returned: number = worklogs.length
        
        console.log(`📝 Issue ${issue.key}: ${returned}/${total} worklogs in fields`)
        
        // Eğer tüm worklog'lar gelmemişse, sayfalama ile TÜM worklog'ları çek
        if (total > returned) {
          console.log(`🔄 Fetching remaining worklogs for ${issue.key}: need ${total - returned} more`)
          let start = returned
          while (start < total) {
            try {
              const pageResp = await makeJiraRequest(`/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=100`, config)
              const pageLogs = pageResp.worklogs || []
              console.log(`📄 Fetched worklog page for ${issue.key}: startAt=${start}, got=${pageLogs.length} worklogs`)
              worklogs.push(...pageLogs)
              start += pageLogs.length
              if (pageLogs.length === 0) break
            } catch (err) {
              console.warn(`Could not fetch paged worklogs for issue ${issue.key} at startAt=${start}:`, err)
              break
            }
          }
          console.log(`✅ Total worklogs collected for ${issue.key}: ${worklogs.length}/${total}`)
        }
      } else {
        // Fields'da worklog yoksa, direkt endpoint'ten TÜM worklog'ları sayfalı çek
        console.log(`🔄 No worklog in fields for ${issue.key}, fetching all worklogs via endpoint`)
        let start = 0
        let totalFromEndpoint = Infinity
        
        while (true) {
          const pageResp = await makeJiraRequest(`/rest/api/3/issue/${issue.id}/worklog?startAt=${start}&maxResults=100`, config)
          const pageLogs = pageResp.worklogs || []
          if (start === 0 && typeof pageResp.total === 'number') {
            totalFromEndpoint = pageResp.total
            console.log(`📊 Issue ${issue.key}: Total worklogs available via endpoint: ${totalFromEndpoint}`)
          }
          
          console.log(`📄 Fetched worklog page for ${issue.key}: startAt=${start}, got=${pageLogs.length} worklogs`)
          worklogs.push(...pageLogs)
          if (pageLogs.length === 0) break
          start += pageLogs.length
          
          if (start >= totalFromEndpoint) break
        }
        console.log(`✅ Total worklogs collected for ${issue.key}: ${worklogs.length}`)
      }
      
      console.log(`📝 Issue ${issue.key}: Found ${worklogs.length} total worklogs (before date filtering)`)
      
      // Tarih aralığındaki worklog'ları filtrele - GÜNLÜK SÜRE TAKİBİ ile AYNI
      const filteredWorklogs = worklogs.filter(worklog => {
        if (!worklog.started) return false
        
        // Timezone'dan bağımsız lokal tarih hesaplama - GÜNLÜK SÜRE TAKİBİ ile AYNI
        const worklogDateObj = new Date(worklog.started)
        const worklogDate = worklogDateObj.getFullYear() + '-' + 
                           String(worklogDateObj.getMonth() + 1).padStart(2, '0') + '-' + 
                           String(worklogDateObj.getDate()).padStart(2, '0')
        
        const isInRange = worklogDate >= startDate && worklogDate <= endDate
        
        // Sadece bu yazılımcının worklog'larını al - GÜNLÜK SÜRE TAKİBİ ile AYNI
        const isThisDeveloper = worklog.author && 
                              worklog.author.displayName && 
                              normalizeName(worklog.author.displayName) === normalizeName(developerName)
        
        if (isInRange && isThisDeveloper) {
          console.log(`✅ INCLUDED: ${worklog.author.displayName} - ${worklogDate} - ${issue.key} - ${Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100}h`)
        }
        
        return isInRange && isThisDeveloper
      })

      console.log(`📝 Issue ${issue.key}: ${filteredWorklogs.length}/${worklogs.length} worklogs for ${developerName} in date range`)
      
      // Bu yazılımcının worklog'larını ana listeye ekle - GÜNLÜK SÜRE TAKİBİ ile AYNI
      for (const worklog of filteredWorklogs) {
        const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100
        
        console.log(`✅ FINAL ADD: ${worklog.author.displayName} - ${issue.key} - ${timeSpentHours}h - ${worklog.started.split('T')[0]}`)
        
        allWorklogs.push({
          author: {
            displayName: worklog.author.displayName,
            accountId: worklog.author.accountId
          },
          timeSpentSeconds: worklog.timeSpentSeconds || 0,
          started: worklog.started,
          projectKey: issue.fields.project.key,
          projectName: issue.fields.project.name,
          issueKey: issue.key,
          issueSummary: issue.fields.summary,
          comment: worklog.comment,
          isSubtask: issue.fields.issuetype?.name === 'Sub-task',
          parentKey: issue.fields.parent?.key,
          issueTypeName: issue.fields.issuetype?.name
        })
      }
    }
    
    console.log(`✅ ${developerName}: Collected ${allWorklogs.length} worklogs from ${developerIssues.length} issues`)
    return allWorklogs
    
  } catch (error) {
    console.error(`❌ Error fetching worklogs for ${developerName}:`, error)
    return []
  }
}

const getDeveloperWorkloadAnalysis = async (config: JiraConfig, sprintType: 'active' | 'closed' | 'both' = 'active'): Promise<DeveloperWorkload[]> => {
  console.log(`🚀 Starting CORRECTED workload analysis for ${sprintType} sprints using DAILY TRACKING LOGIC...`)
  
  const allowedDevelopers = [
    'Abolfazl Pourmohammad',
    'Ahmet Tunç',
    'Alicem Polat',
    'Buse Eren',
    'Canberk İsmet DİZDAŞ',
    'Gizem Akay',
    'Melih Meral',
    'Oktay MANAVOĞLU',
    'Onur Demir',
    'Rüstem CIRIK',
    'Soner Canki',
    'Suat Aydoğdu',
    'Fahrettin DEMİRBAŞ',
    'Sezer SİNANOĞLU',
    'Hüseyin ORAL',
    'Feyza Bilgiç',
  ]

  // ADIM 1: Sprint'leri ve görevleri al (tahmini süre için)
  console.log(`🔄 Step 1: Getting sprints and tasks for estimated hours...`)
  const sprints = await getAllSprints(config, sprintType)
  console.log(`📊 Found ${sprints.length} ${sprintType} sprints`)
  
  // GÜNLÜK SÜRE TAKİBİ ile AYNI TARİH ARALIĞI MANTIGI
  // Son 30 gün için worklog'ları al (günlük süre takibi genelde haftalık çalışır)
  const today = new Date()
  const thirtyDaysAgo = new Date(today)
  thirtyDaysAgo.setDate(today.getDate() - 30)
  
  const startDateStr = thirtyDaysAgo.toISOString().split('T')[0]
  const endDateStr = today.toISOString().split('T')[0]
  
  console.log(`📅 Using FIXED date range for worklog analysis (like daily tracking): ${startDateStr} to ${endDateStr}`)
  console.log(`📅 This matches the date range logic used in daily tracking screen`)

  // Yazılımcı veri haritası
  const developerDataMap = new Map<string, {
    displayName: string
    email: string
    totalEstimatedHours: number
    totalActualHours: number
    projectSprintMap: Map<string, Map<string, {
      estimatedHours: number
      actualHours: number
      taskCount: number
      tasks: JiraTask[]
    }>>
  }>()

  // ADIM 2: Sprint görevlerinden tahmini süreleri al
  console.log(`🔄 Step 2: Getting estimated hours from sprint tasks...`)
  for (const { sprint, projectKey } of sprints) {
    console.log(`📊 Processing sprint: ${sprint.name} (${getProjectNameFromKey(projectKey)})`)
    
    const sprintTasks = await getSprintIssuesWithSubtasks(config, sprint.id)
    const projectName = getProjectNameFromKey(projectKey)
    const sprintName = sprint.name
    
    // Her görev için yazılımcıya tahmini süre ata
    for (const task of sprintTasks) {
      const assignee = task.assignee
      if (
        assignee &&
        assignee !== 'Unassigned' &&
        allowedDevelopers.map(name => normalizeName(name)).includes(normalizeName(assignee))
      ) {
        if (!developerDataMap.has(assignee)) {
          developerDataMap.set(assignee, {
            displayName: assignee,
            email: getDeveloperEmail(assignee),
            totalEstimatedHours: 0,
            totalActualHours: 0,
            projectSprintMap: new Map()
          })
        }
        
        const developerData = developerDataMap.get(assignee)!
        
        if (!developerData.projectSprintMap.has(projectName)) {
          developerData.projectSprintMap.set(projectName, new Map())
        }
        
        const sprintMap = developerData.projectSprintMap.get(projectName)!
        if (!sprintMap.has(sprintName)) {
          sprintMap.set(sprintName, {
            estimatedHours: 0,
            actualHours: 0,
            taskCount: 0,
            tasks: []
          })
        }
        
        const sprintData = sprintMap.get(sprintName)!
        
        // Tahmini süreyi ekle
        const estimatedHours = task.estimatedHours || 0
        developerData.totalEstimatedHours += estimatedHours
        sprintData.estimatedHours += estimatedHours
        sprintData.taskCount++
        sprintData.tasks.push(task)
        
        console.log(`  ✅ Added task ${task.key} to ${assignee}: ${estimatedHours}h estimated`)
      }
    }
  }

  // ADIM 3: Her yazılımcı için TÜM worklog'ları çek - GÜNLÜK SÜRE TAKİBİ MANTIGI
  console.log(`🔄 Step 3: Getting ALL worklogs for each developer using DAILY TRACKING LOGIC...`)
  
  for (const developerName of allowedDevelopers) {
    console.log(`👤 Processing worklogs for: ${developerName}`)
    
    try {
      // GÜNLÜK SÜRE TAKİBİ fonksiyonunu kullan
      const developerWorklogs = await getWorklogDataForDeveloper(config, developerName, startDateStr, endDateStr)
      
      console.log(`📊 ${developerName}: Found ${developerWorklogs.length} worklogs in date range`)
      
      if (!developerDataMap.has(developerName)) {
        developerDataMap.set(developerName, {
          displayName: developerName,
          email: getDeveloperEmail(developerName),
          totalEstimatedHours: 0,
          totalActualHours: 0,
          projectSprintMap: new Map()
        })
      }
      
      const developerData = developerDataMap.get(developerName)!
      
      // Her worklog'u proje-sprint kategorisine dağıt
      for (const worklog of developerWorklogs) {
        const timeSpentHours = Math.round((worklog.timeSpentSeconds / 3600) * 100) / 100
        const projectName = worklog.projectName
        
        // Bu worklog hangi sprint'e ait?
        let matchedSprintName = 'Diğer Görevler'
        
        // Sprint'lerde bu issue'yu ara
        for (const { sprint, projectKey } of sprints) {
          if (getProjectNameFromKey(projectKey) === projectName) {
            // Bu sprint'in tarih aralığında mı?
            if (sprint.startDate && sprint.endDate) {
              const worklogDate = new Date(worklog.started)
              const sprintStart = new Date(sprint.startDate)
              const sprintEnd = new Date(sprint.endDate)
              
              if (worklogDate >= sprintStart && worklogDate <= sprintEnd) {
                matchedSprintName = sprint.name
                break
              }
            }
          }
        }
        
        console.log(`  📝 Worklog ${worklog.issueKey}: ${timeSpentHours}h → ${projectName} / ${matchedSprintName}`)
        
        // Proje-sprint kategorisine ekle
        if (!developerData.projectSprintMap.has(projectName)) {
          developerData.projectSprintMap.set(projectName, new Map())
        }
        
        const sprintMap = developerData.projectSprintMap.get(projectName)!
        if (!sprintMap.has(matchedSprintName)) {
          sprintMap.set(matchedSprintName, {
            estimatedHours: 0,
            actualHours: 0,
            taskCount: 0,
            tasks: []
          })
        }
        
        const sprintData = sprintMap.get(matchedSprintName)!
        
        // Actual hours'ı ekle
        developerData.totalActualHours += timeSpentHours
        sprintData.actualHours += timeSpentHours
      }
      
      console.log(`✅ ${developerName}: Total actual hours = ${Math.round(developerData.totalActualHours * 100) / 100}h`)
      
    } catch (error) {
      console.error(`❌ Error processing worklogs for ${developerName}:`, error)
    }
  }

  // ADIM 4: Sonuçları hazırla
  console.log(`🔄 Step 4: Preparing final results...`)
  
  const results: DeveloperWorkload[] = []
  
  for (const [developerName, developerData] of developerDataMap) {
    const details: ProjectSprintDetail[] = []
    
    for (const [projectName, sprintMap] of developerData.projectSprintMap) {
      for (const [sprintName, sprintData] of sprintMap) {
        if (sprintData.estimatedHours > 0 || sprintData.actualHours > 0) {
          details.push({
            project: projectName,
            sprint: sprintName,
            taskCount: sprintData.taskCount,
            hours: sprintData.estimatedHours,
            actualHours: sprintData.actualHours,
            tasks: sprintData.tasks // Bu görevlerin actualHours değerleri artık doğru
          })
        }
      }
    }
    
    // Detayların toplamı ile genel toplam doğrulaması
    const detailsActualTotal = Math.round(details.reduce((sum, detail) => sum + detail.actualHours, 0) * 100) / 100
    const generalActualTotal = Math.round(developerData.totalActualHours * 100) / 100
    
    console.log(`🔍 ${developerName} FINAL VERIFICATION:`)
    console.log(`  📊 Details actual total: ${detailsActualTotal}h`)
    console.log(`  📊 General actual total: ${generalActualTotal}h`)
    console.log(`  ✅ Match: ${detailsActualTotal === generalActualTotal ? 'YES' : 'NO'}`)
    
    if (Math.abs(detailsActualTotal - generalActualTotal) > 0.01) {
      console.warn(`⚠️ MISMATCH for ${developerName}: Using details total (${detailsActualTotal}h) instead of general total (${generalActualTotal}h)`)
      developerData.totalActualHours = detailsActualTotal
    }
    
    // Status belirleme (tahmini süreye göre)
    let status: 'Eksik Yük' | 'Yeterli' | 'Aşırı Yük' = 'Yeterli'
    if (developerData.totalEstimatedHours < 70) {
      status = 'Eksik Yük'
    } else if (developerData.totalEstimatedHours > 90) {
      status = 'Aşırı Yük'
    }
    
    if (details.length > 0 || developerData.totalActualHours > 0) {
      results.push({
        developer: developerData.displayName,
        email: developerData.email,
        totalTasks: details.reduce((sum, detail) => sum + detail.taskCount, 0),
        totalHours: Math.round(developerData.totalEstimatedHours * 100) / 100,
        totalActualHours: Math.round(developerData.totalActualHours * 100) / 100,
        status,
        details: details.sort((a, b) => b.actualHours - a.actualHours)
      })
      
      console.log(`  📋 Task details verification:`)
      details.forEach(detail => {
        const taskActualSum = detail.tasks?.reduce((sum, task) => sum + (task.actualHours || 0), 0) || 0
        console.log(`    🔍 ${detail.project}/${detail.sprint}: detail.actualHours=${detail.actualHours}h, tasks.sum=${Math.round(taskActualSum * 100) / 100}h`)
      })
    }
  }
  
  // Sonuçları sırala
  results.sort((a, b) => b.totalActualHours - a.totalActualHours)
  
  console.log(`✅ FINAL WORKLOAD ANALYSIS COMPLETE:`)
  for (const result of results) {
    console.log(`  👤 ${result.developer}: ${result.totalActualHours}h actual (${result.details.length} project-sprint combinations)`)
  }
  
  return results
}

serve(async (req) => {
  // Handle CORS preflight requests
  if (req.method === 'OPTIONS') {
    return new Response(null, { headers: corsHeaders })
  }

  try {
    const url = new URL(req.url)
    const sprintType = url.searchParams.get('sprintType') as 'active' | 'closed' | 'both' || 'active'
    
    console.log(`🚀 Starting developer workload analysis for ${sprintType} sprints...`)

    // Get company ID from header
    const companyId = req.headers.get('x-company-id')
    if (!companyId) {
      console.error('❌ No company ID provided for workload analysis')
      return new Response(
        JSON.stringify({
          error: 'Company ID required',
          details: 'Please provide x-company-id header'
        }),
        {
          status: 400,
          headers: { ...corsHeaders, 'Content-Type': 'application/json' },
        }
      )
    }

    const config = await getJiraConfig(companyId)
    
    const workloadData = await getDeveloperWorkloadAnalysis(config, sprintType)
    
    return new Response(JSON.stringify(workloadData), {
      headers: { ...corsHeaders, 'Content-Type': 'application/json' },
    })
  } catch (error) {
    console.error('❌ Error in developer workload analysis:', error)
    return new Response(
      JSON.stringify({ 
        error: 'Failed to analyze developer workload', 
        details: error instanceof Error ? error.message : 'Unknown error' 
      }),
      { 
        status: 500, 
        headers: { ...corsHeaders, 'Content-Type': 'application/json' } 
      }
    )
  }
})