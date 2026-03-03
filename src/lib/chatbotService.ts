import { supabase } from './supabase';
import type { ChatbotCategory, ChatbotDocument, ChatbotConversation, ChatbotMessage, ChatbotSearchResult } from '../types/chatbot';

export const chatbotService = {
  async getCategories(): Promise<ChatbotCategory[]> {
    const { data, error } = await supabase
      .from('chatbot_categories')
      .select('*')
      .eq('is_active', true)
      .order('name');

    if (error) {
      console.error('Error fetching categories:', error);
      throw error;
    }
    console.log('Categories fetched from DB:', data);
    return data || [];
  },

  async getDocumentsByCategory(categoryId: string): Promise<ChatbotDocument[]> {
    const { data, error } = await supabase
      .from('chatbot_documents')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true)
      .order('uploaded_at', { ascending: false });

    if (error) throw error;
    return data || [];
  },

  async searchDocuments(categoryId: string, searchQuery: string): Promise<ChatbotSearchResult[]> {
    const query = searchQuery.toLowerCase().trim();

    const { data, error } = await supabase
      .from('chatbot_documents')
      .select('*')
      .eq('category_id', categoryId)
      .eq('is_active', true);

    if (error) throw error;
    if (!data) return [];

    const results: ChatbotSearchResult[] = data
      .map(doc => {
        let relevance = 0;
        const matchedKeywords: string[] = [];

        if (doc.title.toLowerCase().includes(query)) {
          relevance += 10;
        }

        if (doc.description.toLowerCase().includes(query)) {
          relevance += 5;
        }

        doc.keywords.forEach((keyword: string) => {
          if (keyword.toLowerCase().includes(query) || query.includes(keyword.toLowerCase())) {
            relevance += 3;
            matchedKeywords.push(keyword);
          }
        });

        if (doc.content_text.toLowerCase().includes(query)) {
          relevance += 2;
        }

        return {
          document: doc,
          relevance,
          matchedKeywords
        };
      })
      .filter(result => result.relevance > 0)
      .sort((a, b) => b.relevance - a.relevance);

    return results;
  },

  async createConversation(categoryId: string | null): Promise<ChatbotConversation> {
    const { data: { user } } = await supabase.auth.getUser();
    if (!user) throw new Error('User not authenticated');

    const { data, error } = await supabase
      .from('chatbot_conversations')
      .insert({
        user_id: user.id,
        category_id: categoryId
      })
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async getConversation(conversationId: string): Promise<ChatbotConversation | null> {
    const { data, error } = await supabase
      .from('chatbot_conversations')
      .select('*')
      .eq('id', conversationId)
      .maybeSingle();

    if (error) throw error;
    return data;
  },

  async getMessages(conversationId: string): Promise<ChatbotMessage[]> {
    const { data, error } = await supabase
      .from('chatbot_messages')
      .select('*')
      .eq('conversation_id', conversationId)
      .order('created_at');

    if (error) throw error;
    return data || [];
  },

  async addMessage(conversationId: string, role: 'user' | 'assistant', content: string, documentReferences: string[] = []): Promise<ChatbotMessage> {
    const { data, error } = await supabase
      .from('chatbot_messages')
      .insert({
        conversation_id: conversationId,
        role,
        content,
        document_references: documentReferences
      })
      .select()
      .single();

    if (error) throw error;

    await supabase
      .from('chatbot_conversations')
      .update({ updated_at: new Date().toISOString() })
      .eq('id', conversationId);

    return data;
  },

  async uploadDocument(
    categoryId: string,
    title: string,
    description: string,
    file: File,
    keywords: string[]
  ): Promise<ChatbotDocument> {
    console.log('uploadDocument called with:', { categoryId, title, description, fileName: file.name, keywords });

    const { data: { user } } = await supabase.auth.getUser();
    console.log('Current user:', user?.id);

    const fileExt = file.name.split('.').pop();
    const fileName = `${Math.random().toString(36).substring(2)}-${Date.now()}.${fileExt}`;
    const filePath = `chatbot-documents/${categoryId}/${fileName}`;

    console.log('Uploading file to storage:', filePath);

    const { error: uploadError } = await supabase.storage
      .from('documents')
      .upload(filePath, file);

    if (uploadError) {
      console.error('Storage upload error:', uploadError);
      throw uploadError;
    }

    console.log('File uploaded successfully, getting public URL');

    const { data: { publicUrl } } = supabase.storage
      .from('documents')
      .getPublicUrl(filePath);

    console.log('Public URL:', publicUrl);

    const documentData: any = {
      category_id: categoryId,
      title,
      description,
      file_url: publicUrl,
      file_type: file.type,
      file_size: file.size,
      keywords,
      uploaded_by: user?.id || null,
      content_extracted: false
    };

    console.log('Inserting document record:', documentData);

    const { data, error } = await supabase
      .from('chatbot_documents')
      .insert(documentData)
      .select()
      .single();

    if (error) {
      console.error('Database insert error:', error);
      throw error;
    }

    console.log('Document record created successfully:', data);

    // Extract content from document in background
    this.extractDocumentContent(data.id, publicUrl, file.type).catch(err => {
      console.error('Error extracting content:', err);
    });

    return data;
  },

  async extractDocumentContent(documentId: string, fileUrl: string, fileType: string): Promise<void> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/extract-document-content`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            documentId,
            fileUrl,
            fileType,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('Extract content error response:', errorText);
        throw new Error('Failed to extract document content');
      }

      const result = await response.json();
      console.log('Content extracted:', result);
    } catch (error) {
      console.error('Error in extractDocumentContent:', error);
      throw error;
    }
  },

  async searchWithAI(categoryId: string, question: string, openaiApiKey?: string): Promise<any> {
    try {
      const { data: { session } } = await supabase.auth.getSession();

      const response = await fetch(
        `${import.meta.env.VITE_SUPABASE_URL}/functions/v1/chatbot-ai-query`,
        {
          method: 'POST',
          headers: {
            'Content-Type': 'application/json',
            'Authorization': `Bearer ${session?.access_token || import.meta.env.VITE_SUPABASE_ANON_KEY}`,
          },
          body: JSON.stringify({
            categoryId,
            question,
            openaiApiKey,
          }),
        }
      );

      if (!response.ok) {
        const errorText = await response.text();
        console.error('AI search error response:', errorText);
        throw new Error('Failed to search with AI');
      }

      const result = await response.json();
      return result;
    } catch (error) {
      console.error('Error in searchWithAI:', error);
      throw error;
    }
  },

  async deleteDocument(documentId: string): Promise<void> {
    const { error } = await supabase
      .from('chatbot_documents')
      .delete()
      .eq('id', documentId);

    if (error) throw error;
  },

  async updateDocument(
    documentId: string,
    updates: Partial<Pick<ChatbotDocument, 'title' | 'description' | 'keywords' | 'is_active'>>
  ): Promise<ChatbotDocument> {
    const { data, error } = await supabase
      .from('chatbot_documents')
      .update(updates)
      .eq('id', documentId)
      .select()
      .single();

    if (error) throw error;
    return data;
  },

  async reprocessDocument(documentId: string): Promise<void> {
    const { data: doc, error } = await supabase
      .from('chatbot_documents')
      .select('file_url, file_type')
      .eq('id', documentId)
      .single();

    if (error) throw error;
    if (!doc) throw new Error('Document not found');

    await this.extractDocumentContent(documentId, doc.file_url, doc.file_type);
  }
};
