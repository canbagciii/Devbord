export interface ChatbotCategory {
  id: string;
  name: string;
  description: string;
  icon: string;
  color: string;
  created_at: string;
  created_by: string | null;
  is_active: boolean;
}

export interface ChatbotDocument {
  id: string;
  category_id: string;
  title: string;
  description: string;
  file_url: string;
  file_type: string;
  file_size: number;
  keywords: string[];
  content_text: string;
  uploaded_by: string | null;
  uploaded_at: string;
  is_active: boolean;
}

export interface ChatbotConversation {
  id: string;
  user_id: string;
  category_id: string | null;
  created_at: string;
  updated_at: string;
}

export interface ChatbotMessage {
  id: string;
  conversation_id: string;
  role: 'user' | 'assistant';
  content: string;
  document_references: string[];
  created_at: string;
}

export interface ChatbotSearchResult {
  document: ChatbotDocument;
  relevance: number;
  matchedKeywords: string[];
}
