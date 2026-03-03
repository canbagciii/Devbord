import React, { useState, useEffect, useRef } from 'react';
import {
  MessageCircle,
  X,
  Send,
  Folder,
  Search,
  FileText,
  Video,
  File,
  ChevronLeft,
  Loader,
  Key,
  Check
} from 'lucide-react';
import { chatbotService } from '../lib/chatbotService';
import type { ChatbotCategory, ChatbotMessage, ChatbotSearchResult } from '../types/chatbot';

type ChatbotView = 'categories' | 'search' | 'chat' | 'settings';

export const Chatbot: React.FC = () => {
  const [isOpen, setIsOpen] = useState(false);
  const [view, setView] = useState<ChatbotView>('categories');
  const [categories, setCategories] = useState<ChatbotCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ChatbotCategory | null>(null);
  const [searchQuery, setSearchQuery] = useState('');
  const [searchResults, setSearchResults] = useState<ChatbotSearchResult[]>([]);
  const [conversationId, setConversationId] = useState<string | null>(null);
  const [messages, setMessages] = useState<ChatbotMessage[]>([]);
  const [inputMessage, setInputMessage] = useState('');
  const [isLoading, setIsLoading] = useState(false);
  const [openaiApiKey, setOpenaiApiKey] = useState('');
  const [showApiKeyInput, setShowApiKeyInput] = useState(false);
  const [searchMode, setSearchMode] = useState<'keyword' | 'ai'>('keyword');
  const [aiAnswer, setAiAnswer] = useState<string>('');
  const messagesEndRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    loadCategories();
    const savedKey = localStorage.getItem('openai_api_key');
    if (savedKey) {
      setOpenaiApiKey(savedKey);
    }
  }, []);

  useEffect(() => {
    if (isOpen && categories.length === 0) {
      loadCategories();
    }
  }, [isOpen]);

  useEffect(() => {
    messagesEndRef.current?.scrollIntoView({ behavior: 'smooth' });
  }, [messages]);

  const loadCategories = async () => {
    try {
      const data = await chatbotService.getCategories();
      console.log('Categories loaded:', data);
      setCategories(data);
    } catch (error) {
      console.error('Error loading categories:', error);
    }
  };

  const handleCategorySelect = async (category: ChatbotCategory) => {
    setSelectedCategory(category);
    setView('search');
    setSearchQuery('');
    setSearchResults([]);
    setAiAnswer('');
  };

  const handleSearch = async (query?: string) => {
    const searchText = query ?? searchQuery;
    if (!selectedCategory || !searchText.trim()) return;

    setIsLoading(true);
    setAiAnswer('');
    try {
      const openaiApiKey = localStorage.getItem('openai_api_key');
      console.log('Search mode:', searchMode);
      console.log('OpenAI API Key exists:', !!openaiApiKey);
      console.log('Selected category:', selectedCategory.id);
      console.log('Search text:', searchText);

      if (searchMode === 'ai' && openaiApiKey) {
        console.log('Calling AI search...');
        const aiResult = await chatbotService.searchWithAI(
          selectedCategory.id,
          searchText,
          openaiApiKey
        );
        console.log('AI search result:', aiResult);

        if (aiResult.success && aiResult.method === 'ai') {
          const results = aiResult.documents.map((doc: any) => ({
            document: doc,
            matchedKeywords: [],
            relevance: doc.similarity || 0
          }));

          setSearchResults(results);
          setAiAnswer(aiResult.answer);

          if (!conversationId) {
            const conversation = await chatbotService.createConversation(selectedCategory.id);
            setConversationId(conversation.id);
          }

          if (conversationId) {
            await chatbotService.addMessage(conversationId, 'user', searchText);
            const documentIds = results.map((r: any) => r.document.id);
            await chatbotService.addMessage(conversationId, 'assistant', aiResult.answer, documentIds);
          }

          return;
        }
      }

      const results = await chatbotService.searchDocuments(selectedCategory.id, searchText);
      setSearchResults(results);

      if (!conversationId) {
        const conversation = await chatbotService.createConversation(selectedCategory.id);
        setConversationId(conversation.id);
      }

      if (conversationId) {
        await chatbotService.addMessage(conversationId, 'user', searchText);

        const responseMessage = results.length > 0
          ? `${results.length} döküman bulundu. İlgili dökümanları aşağıda görebilirsiniz.`
          : 'Aramanızla eşleşen döküman bulunamadı. Lütfen farklı anahtar kelimeler deneyin.';

        const documentIds = results.map(r => r.document.id);
        await chatbotService.addMessage(conversationId, 'assistant', responseMessage, documentIds);
      }
    } catch (error) {
      console.error('Error searching documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  useEffect(() => {
    if (!selectedCategory || !searchQuery.trim()) {
      setSearchResults([]);
      setAiAnswer('');
      return;
    }

    if (searchMode === 'keyword') {
      const delayDebounceFn = setTimeout(() => {
        handleSearch(searchQuery);
      }, 500);

      return () => clearTimeout(delayDebounceFn);
    }
  }, [searchQuery, selectedCategory, searchMode]);

  const handleBack = () => {
    if (view === 'chat') {
      setView('search');
    } else if (view === 'search') {
      setView('categories');
      setSelectedCategory(null);
      setSearchQuery('');
      setSearchResults([]);
    }
  };

  const getFileIcon = (fileType: string) => {
    if (fileType.startsWith('video/')) return Video;
    if (fileType.includes('pdf')) return FileText;
    return File;
  };

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes';
    const k = 1024;
    const sizes = ['Bytes', 'KB', 'MB', 'GB'];
    const i = Math.floor(Math.log(bytes) / Math.log(k));
    return Math.round(bytes / Math.pow(k, i) * 100) / 100 + ' ' + sizes[i];
  };

  const handleSaveApiKey = () => {
    if (openaiApiKey.trim()) {
      localStorage.setItem('openai_api_key', openaiApiKey.trim());
      setShowApiKeyInput(false);
      alert('OpenAI API anahtarı kaydedildi!');
    }
  };

  const handleRemoveApiKey = () => {
    localStorage.removeItem('openai_api_key');
    setOpenaiApiKey('');
    alert('OpenAI API anahtarı kaldırıldı!');
  };

  const renderCategories = () => (
    <div className="p-4 space-y-3">
      <div className="flex items-center justify-between mb-4">
        <h3 className="text-lg font-semibold text-gray-900">Kategori Seçin</h3>
        <button
          onClick={() => setShowApiKeyInput(!showApiKeyInput)}
          className="p-2 hover:bg-gray-100 rounded-lg transition-colors"
          title="OpenAI API Ayarları"
        >
          <Key className="w-5 h-5 text-gray-600" />
        </button>
      </div>

      {showApiKeyInput && (
        <div className="mb-4 p-3 bg-blue-50 rounded-lg border border-blue-200">
          <label className="block text-sm font-medium text-gray-700 mb-2">
            OpenAI API Anahtarı {openaiApiKey && <span className="text-green-600">(Kayıtlı)</span>}
          </label>
          <div className="flex gap-2">
            <input
              type="password"
              value={openaiApiKey}
              onChange={(e) => setOpenaiApiKey(e.target.value)}
              placeholder="sk-..."
              className="flex-1 px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm"
            />
            <button
              onClick={handleSaveApiKey}
              className="px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700"
            >
              <Check className="w-4 h-4" />
            </button>
          </div>
          <p className="text-xs text-gray-600 mt-2">
            AI ile döküman içeriğinden cevap almak için OpenAI API anahtarı gereklidir.
          </p>
          {openaiApiKey && (
            <button
              onClick={handleRemoveApiKey}
              className="text-xs text-red-600 hover:text-red-700 mt-2"
            >
              API Anahtarını Kaldır
            </button>
          )}
        </div>
      )}

      {categories.length === 0 && (
        <div className="text-center py-8 text-gray-500">
          <Loader className="w-8 h-8 animate-spin mx-auto mb-2" />
          <p>Kategoriler yükleniyor...</p>
        </div>
      )}
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => handleCategorySelect(category)}
          className="w-full flex items-center gap-3 p-4 rounded-lg border-2 border-gray-200 hover:border-gray-300 transition-all hover:shadow-md"
          style={{ borderLeftColor: category.color, borderLeftWidth: '4px' }}
        >
          <div
            className="p-2 rounded-lg"
            style={{ backgroundColor: category.color + '20' }}
          >
            <Folder className="w-5 h-5" style={{ color: category.color }} />
          </div>
          <div className="flex-1 text-left">
            <div className="font-medium text-gray-900">{category.name}</div>
            <div className="text-sm text-gray-500">{category.description}</div>
          </div>
        </button>
      ))}
    </div>
  );

  const renderSearch = () => (
    <div className="flex flex-col h-full">
      <div className="p-4 border-b border-gray-200">
        <div className="flex items-center justify-between gap-2 mb-3">
          <div className="flex items-center gap-2">
            <button
              onClick={handleBack}
              className="p-1 hover:bg-gray-100 rounded"
            >
              <ChevronLeft className="w-5 h-5 text-gray-600" />
            </button>
            <div
              className="px-3 py-1 rounded-full text-sm font-medium"
              style={{ backgroundColor: selectedCategory?.color + '20', color: selectedCategory?.color }}
            >
              {selectedCategory?.name}
            </div>
          </div>
          {openaiApiKey && (
            <div className="flex items-center gap-1 text-xs text-green-600 bg-green-50 px-2 py-1 rounded-full">
              <Check className="w-3 h-3" />
              AI Aktif
            </div>
          )}
        </div>

        <div className="space-y-2 mb-3">
          {searchMode === 'ai' && !openaiApiKey && (
            <div className="p-3 bg-yellow-50 border border-yellow-200 rounded-lg">
              <div className="flex items-start gap-2">
                <Key className="w-5 h-5 text-yellow-600 flex-shrink-0 mt-0.5" />
                <div className="flex-1">
                  <p className="text-sm text-yellow-800 font-medium mb-2">OpenAI API anahtarı gerekli</p>
                  <input
                    type="password"
                    value={openaiApiKey}
                    onChange={(e) => setOpenaiApiKey(e.target.value)}
                    placeholder="sk-..."
                    className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500 text-sm mb-2"
                  />
                  <button
                    onClick={handleSaveApiKey}
                    className="w-full px-3 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 text-sm"
                  >
                    Anahtarı Kaydet
                  </button>
                </div>
              </div>
            </div>
          )}

          <div className="flex gap-2">
            <button
              onClick={() => setSearchMode('keyword')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchMode === 'keyword'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              Anahtar Kelime
            </button>
            <button
              onClick={() => setSearchMode('ai')}
              className={`flex-1 px-3 py-2 rounded-lg text-sm font-medium transition-colors ${
                searchMode === 'ai'
                  ? 'bg-blue-600 text-white'
                  : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
              }`}
            >
              AI Soru Sor
            </button>
          </div>
        </div>

        <div className="relative">
          <input
            type="text"
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            onKeyPress={(e) => e.key === 'Enter' && handleSearch()}
            placeholder={searchMode === 'ai' ? 'Sorunuzu yazın...' : 'Anahtar kelime ile ara...'}
            className="w-full px-4 py-2 pr-10 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
          />
          <div className="absolute right-3 top-1/2 -translate-y-1/2">
            {isLoading ? (
              <Loader className="w-5 h-5 animate-spin text-blue-600" />
            ) : (
              <Search className="w-5 h-5 text-gray-400" />
            )}
          </div>
        </div>
      </div>

      <div className="flex-1 overflow-y-auto p-4 space-y-3">
        {aiAnswer && (
          <div className="p-4 bg-gradient-to-br from-blue-50 to-blue-100 border-2 border-blue-200 rounded-lg mb-4">
            <div className="flex items-start gap-2 mb-2">
              <div className="p-1.5 bg-blue-600 rounded-full">
                <MessageCircle className="w-4 h-4 text-white" />
              </div>
              <h4 className="font-semibold text-blue-900">AI Cevabı</h4>
            </div>
            <p className="text-gray-800 leading-relaxed whitespace-pre-wrap">{aiAnswer}</p>
          </div>
        )}

        {searchResults.length === 0 && searchQuery && !isLoading && !aiAnswer && (
          <div className="text-center py-8 text-gray-500">
            <Search className="w-12 h-12 mx-auto mb-2 opacity-50" />
            <p>Döküman bulunamadı</p>
          </div>
        )}

        {searchResults.length > 0 && (
          <div className="mb-2">
            <h4 className="text-sm font-semibold text-gray-700 mb-2">
              {aiAnswer ? 'İlgili Dökümanlar' : `${searchResults.length} Döküman Bulundu`}
            </h4>
          </div>
        )}

        {searchResults.map((result) => {
          const FileIcon = getFileIcon(result.document.file_type);
          return (
            <div
              key={result.document.id}
              className="p-4 border border-gray-200 rounded-lg hover:border-blue-300 hover:shadow-md transition-all cursor-pointer"
              onClick={() => window.open(result.document.file_url, '_blank')}
            >
              <div className="flex items-start gap-3">
                <div className="p-2 bg-blue-50 rounded-lg">
                  <FileIcon className="w-5 h-5 text-blue-600" />
                </div>
                <div className="flex-1 min-w-0">
                  <h4 className="font-medium text-gray-900 mb-1">{result.document.title}</h4>
                  <p className="text-sm text-gray-600 mb-2">{result.document.description}</p>
                  {result.matchedKeywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-2">
                      {result.matchedKeywords.map((keyword, idx) => (
                        <span key={idx} className="px-2 py-0.5 bg-green-100 text-green-700 text-xs rounded-full">
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}
                  <div className="text-xs text-gray-400">
                    {formatFileSize(result.document.file_size)}
                  </div>
                </div>
              </div>
            </div>
          );
        })}
      </div>
    </div>
  );

  return null;

  {/*
  return (
    <>
      <div className={`fixed bottom-6 left-6 flex items-center gap-4 transition-all z-[9999] ${
        isOpen ? 'scale-0 opacity-0' : 'scale-100 opacity-100'
      }`}>
        <button
          onClick={() => setIsOpen(true)}
          className="p-4 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-full shadow-lg hover:shadow-xl transition-all"
        >
          <MessageCircle className="w-6 h-6" />
        </button>

        <div className="bg-gradient-to-r from-blue-50 to-blue-100 rounded-xl shadow-lg p-4 max-w-xs border border-blue-200">
          <p className="text-sm font-semibold text-blue-900 mb-1">
            Öğrenmek istediklerin burada!
          </p>
          <p className="text-xs text-blue-700">
            Sadece merak ettiğin konuyu yaz, gerisini bana bırak.
          </p>
        </div>
      </div>

      <div
        className={`fixed bottom-6 left-6 w-96 h-[600px] bg-white rounded-2xl shadow-2xl transition-all z-[9999] flex flex-col ${
          isOpen ? 'scale-100 opacity-100' : 'scale-0 opacity-0'
        }`}
      >
        <div className="flex items-center justify-between p-4 border-b border-gray-200 bg-gradient-to-r from-blue-600 to-blue-700 text-white rounded-t-2xl">
          <div className="flex items-center gap-2">
            <MessageCircle className="w-5 h-5" />
            <span className="font-semibold">AcerPro Asistan</span>
          </div>
          <button
            onClick={() => {
              setIsOpen(false);
              setTimeout(() => {
                setView('categories');
                setSelectedCategory(null);
                setSearchQuery('');
                setSearchResults([]);
              }, 300);
            }}
            className="p-1 hover:bg-white/20 rounded transition-colors"
          >
            <X className="w-5 h-5" />
          </button>
        </div>

        <div className="flex-1 overflow-hidden">
          {view === 'categories' && renderCategories()}
          {view === 'search' && renderSearch()}
        </div>
      </div>
    </>
  );
  */}
};
