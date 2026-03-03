import React, { useState, useEffect } from 'react';
import {
  Upload,
  FileText,
  Video,
  File,
  Trash2,
  Edit,
  X,
  Plus,
  Folder,
  Search,
  Loader,
  RefreshCw
} from 'lucide-react';
import { chatbotService } from '../lib/chatbotService';
import type { ChatbotCategory, ChatbotDocument } from '../types/chatbot';

export const DocumentManagement: React.FC = () => {
  const [categories, setCategories] = useState<ChatbotCategory[]>([]);
  const [selectedCategory, setSelectedCategory] = useState<ChatbotCategory | null>(null);
  const [documents, setDocuments] = useState<ChatbotDocument[]>([]);
  const [isLoading, setIsLoading] = useState(false);
  const [showUploadModal, setShowUploadModal] = useState(false);
  const [searchQuery, setSearchQuery] = useState('');
  const fileInputRef = React.useRef<HTMLInputElement>(null);

  const [uploadForm, setUploadForm] = useState({
    title: '',
    description: '',
    keywords: '',
    file: null as File | null
  });

  const resetForm = () => {
    setUploadForm({ title: '', description: '', keywords: '', file: null });
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  useEffect(() => {
    loadCategories();
  }, []);

  useEffect(() => {
    if (selectedCategory) {
      loadDocuments(selectedCategory.id);
    }
  }, [selectedCategory]);

  const loadCategories = async () => {
    try {
      console.log('Loading categories...');
      const data = await chatbotService.getCategories();
      console.log('Categories loaded:', data);
      setCategories(data);
      if (data.length > 0) {
        setSelectedCategory(data[0]);
        console.log('Selected first category:', data[0]);
      } else {
        console.warn('No categories found');
      }
    } catch (error) {
      console.error('Error loading categories:', error);
      alert('Kategoriler yüklenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    }
  };

  const loadDocuments = async (categoryId: string) => {
    setIsLoading(true);
    try {
      const data = await chatbotService.getDocumentsByCategory(categoryId);
      setDocuments(data);
    } catch (error) {
      console.error('Error loading documents:', error);
    } finally {
      setIsLoading(false);
    }
  };

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files[0]) {
      const file = e.target.files[0];
      console.log('File selected:', file.name, file.size, file.type);
      setUploadForm(prev => ({ ...prev, file }));
    }
  };

  const handleUpload = async (e: React.FormEvent) => {
    e.preventDefault();
    console.log('Upload button clicked');
    console.log('Selected category:', selectedCategory);
    console.log('Upload form:', uploadForm);

    if (!selectedCategory) {
      console.error('No category selected');
      alert('Lütfen bir kategori seçin');
      return;
    }

    if (!uploadForm.title || !uploadForm.title.trim()) {
      console.error('Title is empty');
      alert('Lütfen başlık girin');
      return;
    }

    if (!uploadForm.file) {
      console.error('No file selected');
      alert('Lütfen bir dosya seçin');
      return;
    }

    setIsLoading(true);
    try {
      console.log('Starting upload process...');
      const keywords = uploadForm.keywords
        .split(',')
        .map(k => k.trim())
        .filter(k => k.length > 0);

      console.log('Parsed keywords:', keywords);

      await chatbotService.uploadDocument(
        selectedCategory.id,
        uploadForm.title,
        uploadForm.description,
        uploadForm.file,
        keywords
      );

      console.log('Upload successful!');
      setShowUploadModal(false);
      resetForm();
      loadDocuments(selectedCategory.id);
      alert('Döküman başarıyla yüklendi!');
    } catch (error) {
      console.error('Error uploading document:', error);
      const errorMessage = error instanceof Error ? error.message : 'Döküman yüklenirken hata oluştu';
      alert(errorMessage);
    } finally {
      setIsLoading(false);
    }
  };

  const handleDelete = async (documentId: string) => {
    if (!confirm('Bu dökümanı silmek istediğinize emin misiniz?')) return;

    setIsLoading(true);
    try {
      await chatbotService.deleteDocument(documentId);
      if (selectedCategory) {
        loadDocuments(selectedCategory.id);
      }
    } catch (error) {
      console.error('Error deleting document:', error);
      alert('Döküman silinirken hata oluştu');
    } finally {
      setIsLoading(false);
    }
  };

  const handleReprocess = async (documentId: string) => {
    setIsLoading(true);
    try {
      await chatbotService.reprocessDocument(documentId);
      alert('Döküman içeriği başarıyla işlendi!');
      if (selectedCategory) {
        loadDocuments(selectedCategory.id);
      }
    } catch (error) {
      console.error('Error reprocessing document:', error);
      alert('Döküman işlenirken hata oluştu: ' + (error instanceof Error ? error.message : 'Bilinmeyen hata'));
    } finally {
      setIsLoading(false);
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

  const filteredDocuments = documents.filter(doc =>
    doc.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.description.toLowerCase().includes(searchQuery.toLowerCase()) ||
    doc.keywords.some(k => k.toLowerCase().includes(searchQuery.toLowerCase()))
  );

  return (
    <div className="min-h-screen bg-gray-50">
      <div className="max-w-7xl mx-auto p-6">
        <div className="bg-white rounded-lg shadow-sm p-6 mb-6">
          <div className="flex items-center justify-between mb-6">
            <h1 className="text-2xl font-bold text-gray-900">Döküman Yönetimi</h1>
            <button
              onClick={() => setShowUploadModal(true)}
              className="flex items-center gap-2 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 transition-colors"
            >
              <Plus className="w-4 h-4" />
              Yeni Döküman
            </button>
          </div>

          <div className="flex gap-2 mb-6">
            {categories.map(category => (
              <button
                key={category.id}
                onClick={() => setSelectedCategory(category)}
                className={`flex items-center gap-2 px-4 py-2 rounded-lg transition-colors ${
                  selectedCategory?.id === category.id
                    ? 'text-white'
                    : 'bg-gray-100 text-gray-700 hover:bg-gray-200'
                }`}
                style={{
                  backgroundColor: selectedCategory?.id === category.id ? category.color : undefined
                }}
              >
                <Folder className="w-4 h-4" />
                {category.name}
              </button>
            ))}
          </div>

          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 w-5 h-5 text-gray-400" />
            <input
              type="text"
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              placeholder="Döküman ara..."
              className="w-full pl-10 pr-4 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
            />
          </div>
        </div>

        {isLoading ? (
          <div className="flex items-center justify-center py-12">
            <Loader className="w-8 h-8 animate-spin text-blue-600" />
          </div>
        ) : (
          <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 gap-4">
            {filteredDocuments.map(doc => {
              const FileIcon = getFileIcon(doc.file_type);
              return (
                <div
                  key={doc.id}
                  className="bg-white rounded-lg shadow-sm p-4 hover:shadow-md transition-shadow"
                >
                  <div className="flex items-start gap-3 mb-3">
                    <div className="p-2 bg-blue-50 rounded-lg">
                      <FileIcon className="w-6 h-6 text-blue-600" />
                    </div>
                    <div className="flex-1 min-w-0">
                      <h3 className="font-medium text-gray-900 mb-1 truncate">{doc.title}</h3>
                      <p className="text-sm text-gray-600 line-clamp-2">{doc.description}</p>
                    </div>
                  </div>

                  {doc.keywords.length > 0 && (
                    <div className="flex flex-wrap gap-1 mb-3">
                      {doc.keywords.map((keyword, idx) => (
                        <span
                          key={idx}
                          className="px-2 py-0.5 bg-gray-100 text-gray-700 text-xs rounded-full"
                        >
                          {keyword}
                        </span>
                      ))}
                    </div>
                  )}

                  <div className="flex items-center justify-between text-xs text-gray-500 mb-3">
                    <span>{formatFileSize(doc.file_size)}</span>
                    <span>{new Date(doc.uploaded_at).toLocaleDateString('tr-TR')}</span>
                  </div>

                  <div className="flex gap-2">
                    <button
                      onClick={() => window.open(doc.file_url, '_blank')}
                      className="flex-1 px-3 py-1.5 bg-blue-50 text-blue-600 rounded hover:bg-blue-100 transition-colors text-sm"
                    >
                      Görüntüle
                    </button>
                    {!doc.content_extracted && (
                      <button
                        onClick={() => handleReprocess(doc.id)}
                        className="px-3 py-1.5 bg-green-50 text-green-600 rounded hover:bg-green-100 transition-colors"
                        title="İçeriği Çıkar"
                      >
                        <RefreshCw className="w-4 h-4" />
                      </button>
                    )}
                    <button
                      onClick={() => handleDelete(doc.id)}
                      className="px-3 py-1.5 bg-red-50 text-red-600 rounded hover:bg-red-100 transition-colors"
                    >
                      <Trash2 className="w-4 h-4" />
                    </button>
                  </div>
                </div>
              );
            })}
          </div>
        )}

        {filteredDocuments.length === 0 && !isLoading && (
          <div className="text-center py-12 text-gray-500">
            <FileText className="w-16 h-16 mx-auto mb-4 opacity-50" />
            <p>Henüz döküman yüklenmemiş</p>
          </div>
        )}
      </div>

      {showUploadModal && (
        <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
          <div className="bg-white rounded-lg max-w-md w-full p-6">
            <div className="flex items-center justify-between mb-4">
              <h2 className="text-xl font-bold text-gray-900">Yeni Döküman Yükle</h2>
              <button
                onClick={() => {
                  setShowUploadModal(false);
                  resetForm();
                }}
                className="p-1 hover:bg-gray-100 rounded"
              >
                <X className="w-5 h-5" />
              </button>
            </div>

            <form onSubmit={handleUpload} className="space-y-4">
              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Kategori
                </label>
                <div
                  className="px-4 py-2 rounded-lg"
                  style={{ backgroundColor: selectedCategory?.color + '20', color: selectedCategory?.color }}
                >
                  {selectedCategory?.name}
                </div>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Başlık *
                </label>
                <input
                  type="text"
                  required
                  value={uploadForm.title}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, title: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="Döküman başlığı"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Açıklama
                </label>
                <textarea
                  value={uploadForm.description}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, description: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  rows={3}
                  placeholder="Döküman açıklaması"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Anahtar Kelimeler
                </label>
                <input
                  type="text"
                  value={uploadForm.keywords}
                  onChange={(e) => setUploadForm(prev => ({ ...prev, keywords: e.target.value }))}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  placeholder="kelime1, kelime2, kelime3"
                />
                <p className="text-xs text-gray-500 mt-1">Virgülle ayırarak yazın</p>
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-1">
                  Dosya *
                </label>
                <input
                  type="file"
                  ref={fileInputRef}
                  required
                  onChange={handleFileChange}
                  className="w-full px-3 py-2 border border-gray-300 rounded-lg focus:outline-none focus:ring-2 focus:ring-blue-500"
                  accept=".pdf,.doc,.docx,.xls,.xlsx,.ppt,.pptx,.mp4,.avi,.mov"
                />
              </div>

              <div className="flex gap-3">
                <button
                  type="button"
                  onClick={() => {
                    setShowUploadModal(false);
                    resetForm();
                  }}
                  className="flex-1 px-4 py-2 border border-gray-300 text-gray-700 rounded-lg hover:bg-gray-50 transition-colors"
                >
                  İptal
                </button>
                <button
                  type="submit"
                  disabled={isLoading}
                  className="flex-1 px-4 py-2 bg-blue-600 text-white rounded-lg hover:bg-blue-700 disabled:opacity-50 disabled:cursor-not-allowed transition-colors"
                >
                  {isLoading ? <Loader className="w-5 h-5 animate-spin mx-auto" /> : 'Yükle'}
                </button>
              </div>
            </form>
          </div>
        </div>
      )}
    </div>
  );
};
