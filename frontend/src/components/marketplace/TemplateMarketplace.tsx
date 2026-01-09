'use client';

/**
 * Template Marketplace UI Components
 * Browse, search, and install dashboard templates
 */

import React, { useState, useEffect, useCallback } from 'react';

// Types
interface Template {
  id: string;
  name: string;
  description: string;
  previewImage: string;
  category: string;
  type: 'dashboard' | 'widget' | 'theme' | 'report';
  industry?: string;
  tags: string[];
  author: {
    id: string;
    name: string;
    avatarUrl?: string;
    verified: boolean;
  };
  stats: {
    installs: number;
    rating: number;
    reviews: number;
  };
  price: number;
  isFree: boolean;
  isPremium: boolean;
  isFeatured: boolean;
  createdAt: string;
}

interface TemplateCategory {
  id: string;
  name: string;
  icon: string;
  count: number;
}

interface TemplateFilters {
  search: string;
  category: string;
  type: string;
  industry: string;
  priceRange: 'all' | 'free' | 'paid';
  sortBy: 'popular' | 'rating' | 'newest' | 'name';
}

// ==================== TEMPLATE CARD ====================

export function TemplateCard({
  template,
  onInstall,
  onPreview,
}: {
  template: Template;
  onInstall?: (template: Template) => void;
  onPreview?: (template: Template) => void;
}) {
  const [isHovered, setIsHovered] = useState(false);

  return (
    <div
      className="bg-white dark:bg-gray-800 rounded-xl shadow-sm overflow-hidden transition-all duration-300 hover:shadow-lg"
      onMouseEnter={() => setIsHovered(true)}
      onMouseLeave={() => setIsHovered(false)}
    >
      {/* Preview Image */}
      <div className="relative aspect-video bg-gray-100 dark:bg-gray-700 overflow-hidden">
        <img
          src={template.previewImage || '/placeholder-template.png'}
          alt={template.name}
          className={`w-full h-full object-cover transition-transform duration-300 ${
            isHovered ? 'scale-105' : ''
          }`}
        />
        
        {/* Overlay on hover */}
        <div
          className={`absolute inset-0 bg-black/50 flex items-center justify-center gap-3 transition-opacity duration-300 ${
            isHovered ? 'opacity-100' : 'opacity-0'
          }`}
        >
          <button
            onClick={() => onPreview?.(template)}
            className="px-4 py-2 bg-white text-gray-900 rounded-lg font-medium hover:bg-gray-100 transition-colors"
          >
            Preview
          </button>
          <button
            onClick={() => onInstall?.(template)}
            className="px-4 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
          >
            {template.isFree ? 'Install' : `$${template.price}`}
          </button>
        </div>

        {/* Badges */}
        <div className="absolute top-2 left-2 flex gap-2">
          {template.isFeatured && (
            <span className="px-2 py-1 bg-yellow-500 text-white text-xs font-semibold rounded-full">
              ⭐ Featured
            </span>
          )}
          {template.isPremium && (
            <span className="px-2 py-1 bg-purple-500 text-white text-xs font-semibold rounded-full">
              Premium
            </span>
          )}
        </div>
      </div>

      {/* Content */}
      <div className="p-4">
        <div className="flex items-start justify-between mb-2">
          <h3 className="font-semibold text-gray-900 dark:text-white line-clamp-1">
            {template.name}
          </h3>
          <span className={`text-sm font-medium ${template.isFree ? 'text-green-600' : 'text-gray-900 dark:text-white'}`}>
            {template.isFree ? 'Free' : `$${template.price}`}
          </span>
        </div>

        <p className="text-sm text-gray-500 line-clamp-2 mb-3">
          {template.description}
        </p>

        {/* Tags */}
        <div className="flex flex-wrap gap-1 mb-3">
          {template.tags.slice(0, 3).map((tag) => (
            <span
              key={tag}
              className="px-2 py-0.5 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 text-xs rounded-full"
            >
              {tag}
            </span>
          ))}
          {template.tags.length > 3 && (
            <span className="px-2 py-0.5 text-gray-400 text-xs">
              +{template.tags.length - 3}
            </span>
          )}
        </div>

        {/* Author & Stats */}
        <div className="flex items-center justify-between pt-3 border-t border-gray-100 dark:border-gray-700">
          <div className="flex items-center gap-2">
            <div className="w-6 h-6 rounded-full bg-gray-200 dark:bg-gray-600 overflow-hidden">
              {template.author.avatarUrl ? (
                <img
                  src={template.author.avatarUrl}
                  alt={template.author.name}
                  className="w-full h-full object-cover"
                />
              ) : (
                <div className="w-full h-full flex items-center justify-center text-xs text-gray-500">
                  {template.author.name.charAt(0)}
                </div>
              )}
            </div>
            <span className="text-xs text-gray-500">
              {template.author.name}
              {template.author.verified && (
                <span className="ml-1 text-blue-500">✓</span>
              )}
            </span>
          </div>
          <div className="flex items-center gap-3 text-xs text-gray-500">
            <span className="flex items-center gap-1">
              <svg className="w-4 h-4 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              {template.stats.rating.toFixed(1)}
            </span>
            <span>{template.stats.installs.toLocaleString()} installs</span>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== CATEGORY FILTER ====================

export function CategoryFilter({
  categories,
  selected,
  onChange,
}: {
  categories: TemplateCategory[];
  selected: string;
  onChange: (category: string) => void;
}) {
  return (
    <div className="flex flex-wrap gap-2">
      <button
        onClick={() => onChange('')}
        className={`px-4 py-2 rounded-full text-sm font-medium transition-colors ${
          !selected
            ? 'bg-blue-500 text-white'
            : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
        }`}
      >
        All
      </button>
      {categories.map((category) => (
        <button
          key={category.id}
          onClick={() => onChange(category.id)}
          className={`px-4 py-2 rounded-full text-sm font-medium transition-colors flex items-center gap-2 ${
            selected === category.id
              ? 'bg-blue-500 text-white'
              : 'bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 hover:bg-gray-200 dark:hover:bg-gray-600'
          }`}
        >
          <span>{category.icon}</span>
          <span>{category.name}</span>
          <span className="text-xs opacity-60">({category.count})</span>
        </button>
      ))}
    </div>
  );
}

// ==================== SEARCH BAR ====================

export function TemplateSearch({
  value,
  onChange,
  placeholder = 'Search templates...',
}: {
  value: string;
  onChange: (value: string) => void;
  placeholder?: string;
}) {
  return (
    <div className="relative">
      <svg
        className="absolute left-3 top-1/2 -translate-y-1/2 w-5 h-5 text-gray-400"
        fill="none"
        stroke="currentColor"
        viewBox="0 0 24 24"
      >
        <path
          strokeLinecap="round"
          strokeLinejoin="round"
          strokeWidth={2}
          d="M21 21l-6-6m2-5a7 7 0 11-14 0 7 7 0 0114 0z"
        />
      </svg>
      <input
        type="text"
        value={value}
        onChange={(e) => onChange(e.target.value)}
        placeholder={placeholder}
        className="w-full pl-10 pr-4 py-3 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all"
      />
      {value && (
        <button
          onClick={() => onChange('')}
          className="absolute right-3 top-1/2 -translate-y-1/2 text-gray-400 hover:text-gray-600"
        >
          <svg className="w-5 h-5" fill="currentColor" viewBox="0 0 20 20">
            <path
              fillRule="evenodd"
              d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
              clipRule="evenodd"
            />
          </svg>
        </button>
      )}
    </div>
  );
}

// ==================== TEMPLATE PREVIEW MODAL ====================

export function TemplatePreviewModal({
  template,
  onClose,
  onInstall,
}: {
  template: Template;
  onClose: () => void;
  onInstall: (template: Template) => void;
}) {
  const [activeTab, setActiveTab] = useState<'preview' | 'details' | 'reviews'>('preview');

  return (
    <div className="fixed inset-0 z-50 flex items-center justify-center p-4 bg-black/50">
      <div className="bg-white dark:bg-gray-900 rounded-xl shadow-2xl max-w-4xl w-full max-h-[90vh] overflow-hidden flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between p-4 border-b border-gray-200 dark:border-gray-700">
          <h2 className="text-xl font-semibold text-gray-900 dark:text-white">
            {template.name}
          </h2>
          <button
            onClick={onClose}
            className="p-2 text-gray-400 hover:text-gray-600 dark:hover:text-gray-300 transition-colors"
          >
            <svg className="w-6 h-6" fill="currentColor" viewBox="0 0 20 20">
              <path
                fillRule="evenodd"
                d="M4.293 4.293a1 1 0 011.414 0L10 8.586l4.293-4.293a1 1 0 111.414 1.414L11.414 10l4.293 4.293a1 1 0 01-1.414 1.414L10 11.414l-4.293 4.293a1 1 0 01-1.414-1.414L8.586 10 4.293 5.707a1 1 0 010-1.414z"
                clipRule="evenodd"
              />
            </svg>
          </button>
        </div>

        {/* Tabs */}
        <div className="flex border-b border-gray-200 dark:border-gray-700">
          {(['preview', 'details', 'reviews'] as const).map((tab) => (
            <button
              key={tab}
              onClick={() => setActiveTab(tab)}
              className={`px-6 py-3 text-sm font-medium transition-colors ${
                activeTab === tab
                  ? 'text-blue-500 border-b-2 border-blue-500'
                  : 'text-gray-500 hover:text-gray-700 dark:hover:text-gray-300'
              }`}
            >
              {tab.charAt(0).toUpperCase() + tab.slice(1)}
            </button>
          ))}
        </div>

        {/* Content */}
        <div className="flex-1 overflow-y-auto p-6">
          {activeTab === 'preview' && (
            <div className="space-y-4">
              <img
                src={template.previewImage || '/placeholder-template.png'}
                alt={template.name}
                className="w-full rounded-lg"
              />
            </div>
          )}

          {activeTab === 'details' && (
            <div className="space-y-6">
              <div>
                <h3 className="font-semibold text-gray-900 dark:text-white mb-2">
                  Description
                </h3>
                <p className="text-gray-600 dark:text-gray-400">
                  {template.description}
                </p>
              </div>

              <div className="grid grid-cols-2 gap-4">
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Category</h4>
                  <p className="text-gray-900 dark:text-white">{template.category}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Type</h4>
                  <p className="text-gray-900 dark:text-white capitalize">{template.type}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Industry</h4>
                  <p className="text-gray-900 dark:text-white">{template.industry || 'General'}</p>
                </div>
                <div>
                  <h4 className="text-sm font-medium text-gray-500 mb-1">Installs</h4>
                  <p className="text-gray-900 dark:text-white">{template.stats.installs.toLocaleString()}</p>
                </div>
              </div>

              <div>
                <h4 className="text-sm font-medium text-gray-500 mb-2">Tags</h4>
                <div className="flex flex-wrap gap-2">
                  {template.tags.map((tag) => (
                    <span
                      key={tag}
                      className="px-3 py-1 bg-gray-100 dark:bg-gray-700 text-gray-600 dark:text-gray-300 rounded-full text-sm"
                    >
                      {tag}
                    </span>
                  ))}
                </div>
              </div>

              <div className="flex items-center gap-4 pt-4 border-t border-gray-200 dark:border-gray-700">
                <div className="w-12 h-12 rounded-full bg-gray-200 dark:bg-gray-700 overflow-hidden">
                  {template.author.avatarUrl ? (
                    <img
                      src={template.author.avatarUrl}
                      alt={template.author.name}
                      className="w-full h-full object-cover"
                    />
                  ) : (
                    <div className="w-full h-full flex items-center justify-center text-lg text-gray-500">
                      {template.author.name.charAt(0)}
                    </div>
                  )}
                </div>
                <div>
                  <p className="font-medium text-gray-900 dark:text-white">
                    {template.author.name}
                    {template.author.verified && (
                      <span className="ml-1 text-blue-500">✓</span>
                    )}
                  </p>
                  <p className="text-sm text-gray-500">Template Author</p>
                </div>
              </div>
            </div>
          )}

          {activeTab === 'reviews' && (
            <div className="text-center py-12 text-gray-500">
              <p>Reviews coming soon</p>
            </div>
          )}
        </div>

        {/* Footer */}
        <div className="flex items-center justify-between p-4 border-t border-gray-200 dark:border-gray-700 bg-gray-50 dark:bg-gray-800">
          <div className="flex items-center gap-4">
            <div className="flex items-center gap-1">
              <svg className="w-5 h-5 text-yellow-500" fill="currentColor" viewBox="0 0 20 20">
                <path d="M9.049 2.927c.3-.921 1.603-.921 1.902 0l1.07 3.292a1 1 0 00.95.69h3.462c.969 0 1.371 1.24.588 1.81l-2.8 2.034a1 1 0 00-.364 1.118l1.07 3.292c.3.921-.755 1.688-1.54 1.118l-2.8-2.034a1 1 0 00-1.175 0l-2.8 2.034c-.784.57-1.838-.197-1.539-1.118l1.07-3.292a1 1 0 00-.364-1.118L2.98 8.72c-.783-.57-.38-1.81.588-1.81h3.461a1 1 0 00.951-.69l1.07-3.292z" />
              </svg>
              <span className="font-semibold text-gray-900 dark:text-white">
                {template.stats.rating.toFixed(1)}
              </span>
              <span className="text-gray-500">
                ({template.stats.reviews} reviews)
              </span>
            </div>
          </div>
          <div className="flex items-center gap-3">
            <button
              onClick={onClose}
              className="px-4 py-2 text-gray-600 dark:text-gray-300 hover:text-gray-800 dark:hover:text-white transition-colors"
            >
              Cancel
            </button>
            <button
              onClick={() => onInstall(template)}
              className="px-6 py-2 bg-blue-500 text-white rounded-lg font-medium hover:bg-blue-600 transition-colors"
            >
              {template.isFree ? 'Install Free' : `Install for $${template.price}`}
            </button>
          </div>
        </div>
      </div>
    </div>
  );
}

// ==================== TEMPLATE MARKETPLACE ====================

export function TemplateMarketplace() {
  const [templates, setTemplates] = useState<Template[]>([]);
  const [categories, setCategories] = useState<TemplateCategory[]>([]);
  const [loading, setLoading] = useState(true);
  const [selectedTemplate, setSelectedTemplate] = useState<Template | null>(null);
  const [filters, setFilters] = useState<TemplateFilters>({
    search: '',
    category: '',
    type: '',
    industry: '',
    priceRange: 'all',
    sortBy: 'popular',
  });

  const fetchTemplates = useCallback(async () => {
    try {
      setLoading(true);
      const params = new URLSearchParams();
      if (filters.search) params.set('q', filters.search);
      if (filters.category) params.set('category', filters.category);
      if (filters.type) params.set('type', filters.type);
      if (filters.priceRange !== 'all') params.set('priceRange', filters.priceRange);
      params.set('sortBy', filters.sortBy);

      const response = await fetch(`/api/templates?${params}`);
      if (response.ok) {
        const data = await response.json();
        setTemplates(data.templates || []);
        setCategories(data.categories || []);
      }
    } catch (error) {
      console.error('Failed to fetch templates:', error);
    } finally {
      setLoading(false);
    }
  }, [filters]);

  useEffect(() => {
    fetchTemplates();
  }, [fetchTemplates]);

  const handleInstall = async (template: Template) => {
    try {
      const response = await fetch(`/api/templates/${template.id}/install`, {
        method: 'POST',
      });
      if (response.ok) {
        // Show success message
        setSelectedTemplate(null);
        alert(`Successfully installed "${template.name}"!`);
      }
    } catch (error) {
      console.error('Failed to install template:', error);
    }
  };

  const featuredTemplates = templates.filter((t) => t.isFeatured);
  const regularTemplates = templates.filter((t) => !t.isFeatured);

  return (
    <div className="space-y-8 p-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h1 className="text-2xl font-bold text-gray-900 dark:text-white">
            Template Marketplace
          </h1>
          <p className="text-gray-500 mt-1">
            Discover and install beautiful dashboard templates
          </p>
        </div>
      </div>

      {/* Search & Filters */}
      <div className="space-y-4">
        <TemplateSearch
          value={filters.search}
          onChange={(search) => setFilters((f) => ({ ...f, search }))}
        />

        <CategoryFilter
          categories={categories}
          selected={filters.category}
          onChange={(category) => setFilters((f) => ({ ...f, category }))}
        />

        <div className="flex items-center gap-4">
          <select
            value={filters.priceRange}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                priceRange: e.target.value as TemplateFilters['priceRange'],
              }))
            }
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="all">All Prices</option>
            <option value="free">Free</option>
            <option value="paid">Paid</option>
          </select>

          <select
            value={filters.sortBy}
            onChange={(e) =>
              setFilters((f) => ({
                ...f,
                sortBy: e.target.value as TemplateFilters['sortBy'],
              }))
            }
            className="px-4 py-2 bg-white dark:bg-gray-800 border border-gray-200 dark:border-gray-700 rounded-lg focus:ring-2 focus:ring-blue-500 outline-none"
          >
            <option value="popular">Most Popular</option>
            <option value="rating">Highest Rated</option>
            <option value="newest">Newest</option>
            <option value="name">Name A-Z</option>
          </select>
        </div>
      </div>

      {loading ? (
        <div className="flex items-center justify-center py-12">
          <div className="animate-spin rounded-full h-12 w-12 border-b-2 border-blue-500" />
        </div>
      ) : (
        <>
          {/* Featured Templates */}
          {featuredTemplates.length > 0 && (
            <section>
              <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
                ⭐ Featured Templates
              </h2>
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3">
                {featuredTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={setSelectedTemplate}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            </section>
          )}

          {/* All Templates */}
          <section>
            <h2 className="text-lg font-semibold text-gray-900 dark:text-white mb-4">
              All Templates
            </h2>
            {regularTemplates.length === 0 ? (
              <div className="text-center py-12 text-gray-500">
                <p>No templates found matching your criteria</p>
              </div>
            ) : (
              <div className="grid gap-6 sm:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4">
                {regularTemplates.map((template) => (
                  <TemplateCard
                    key={template.id}
                    template={template}
                    onPreview={setSelectedTemplate}
                    onInstall={handleInstall}
                  />
                ))}
              </div>
            )}
          </section>
        </>
      )}

      {/* Preview Modal */}
      {selectedTemplate && (
        <TemplatePreviewModal
          template={selectedTemplate}
          onClose={() => setSelectedTemplate(null)}
          onInstall={handleInstall}
        />
      )}
    </div>
  );
}
