import React, { useState, useMemo, useEffect } from 'react';
import { observer } from '@legendapp/state/react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Badge } from '@/components/ui/badge';
import { Tabs, TabsContent, TabsList, TabsTrigger } from '@/components/ui/tabs';
import { Input } from '@/components/ui/input';
import { Textarea } from '@/components/ui/textarea';
import { Separator } from '@/components/ui/separator';
import { 
  BookOpen, 
  Scroll, 
  Plus, 
  Search, 
  Upload, 
  FileText, 
  Star,
  TrendingUp,
  Eye,
  Edit3
} from 'lucide-react';
import { useAuth } from '@/lib/auth';

interface Document {
  id: string;
  title: string;
  content?: string;
  collection_type: 'lore' | 'canon' | 'general';
  parent_entity_type: 'universe' | 'world' | 'project';
  parent_entity_id: string;
  alignment_score?: number;
  purpose_description?: string;
  ai_usage_tracking?: any;
  created_at: string;
  updated_at: string;
  created_by?: string;
  status?: string;
}

interface KnowledgeTabProps {
  entityType: 'universe' | 'world' | 'project';
  entityId: string;
  entityName: string;
  canonCollection?: Collection;
  documents?: Document[];
  onCreateDocument?: (type: 'lore' | 'canon', document: Partial<Document>) => void;
  onEditDocument?: (document: Document) => void;
  onDeleteDocument?: (documentId: string) => void;
}

export const KnowledgeTab = observer(function KnowledgeTab({
  entityType,
  entityId,
  entityName,
  loreCollection,
  canonCollection,
  documents = [],
  onCreateDocument,
  onEditDocument,
  onDeleteDocument
}: KnowledgeTabProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lore' | 'canon'>('lore');
  const [searchQuery, setSearchQuery] = useState('');
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocPurpose, setNewDocPurpose] = useState('');

  // Filter documents by collection type and search
  const filteredDocuments = useMemo(() => {
    return documents.filter(doc => {
      const matchesType = doc.collection_type === activeTab;
      const matchesSearch = !searchQuery || 
        doc.name.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.description?.toLowerCase().includes(searchQuery.toLowerCase()) ||
        doc.content?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesType && matchesSearch;
    });
  }, [documents, activeTab, searchQuery]);

  const activeCollection = activeTab === 'lore' ? loreCollection : canonCollection;

  // Get context-specific content suggestions
  const getContentSuggestions = () => {
    const suggestions = {
      universe: {
        lore: [
          "Core life values and mission",
          "Personal philosophy and beliefs", 
          "Life journey and experiences",
          "Dreams and aspirations",
          "What matters most"
        ],
        canon: [
          "Life standards and boundaries",
          "Non-negotiable principles",
          "Daily practices and routines",
          "Decision-making frameworks",
          "Success metrics"
        ]
      },
      world: {
        lore: [
          "Purpose and culture of this world",
          "Why this world matters",
          "Vision and aspirations",
          "Historical context",
          "Emotional significance"
        ],
        canon: [
          "Rules and processes",
          "How things work here",
          "Operating procedures",
          "Quality standards",
          "Workflow guidelines"
        ]
      },
      project: {
        lore: [
          "Project vision and goals",
          "Definition of success",
          "Stakeholder impact",
          "Why this project exists",
          "Expected outcomes"
        ],
        canon: [
          "Requirements and constraints",
          "Acceptance criteria",
          "Technical specifications", 
          "Process requirements",
          "Quality gates"
        ]
      }
    };
    return suggestions[entityType][activeTab];
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim() || !onCreateDocument) return;

    const newDoc: Partial<Document> = {
      name: newDocTitle.trim(),
      description: newDocPurpose.trim() || undefined,
      collection_type: activeTab,
      content: newDocContent.trim() || undefined,
      purpose_description: newDocPurpose.trim() || undefined,
      alignment_score: 0,
      ai_usage_count: 0
    };

    await onCreateDocument(activeTab, newDoc);
    
    // Reset form
    setNewDocTitle('');
    setNewDocContent('');
    setNewDocPurpose('');
    setIsCreating(false);
  };

  const renderAlignmentScore = (score?: number) => {
    if (typeof score !== 'number') return null;
    
    const color = score >= 80 ? 'text-green-600' : score >= 60 ? 'text-yellow-600' : 'text-red-600';
    const bgColor = score >= 80 ? 'bg-green-50' : score >= 60 ? 'bg-yellow-50' : 'bg-red-50';
    
    return (
      <Badge variant="outline" className={`${color} ${bgColor} border-current`}>
        <Star className="h-3 w-3 mr-1" />
        {score}/100
      </Badge>
    );
  };

  return (
    <div className="space-y-6">
      {/* Header */}
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-2xl font-bold flex items-center gap-2">
            <BookOpen className="h-6 w-6" />
            Knowledge Base
          </h2>
          <p className="text-muted-foreground">
            Organize lore and canon documentation for {entityName}
          </p>
        </div>
        
        <Button onClick={() => setIsCreating(true)} disabled={!activeCollection}>
          <Plus className="h-4 w-4 mr-2" />
          Add Document
        </Button>
      </div>

      {!activeCollection ? (
        <Card>
          <CardContent className="pt-6 text-center py-12">
            <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
            <h3 className="text-lg font-semibold mb-2">Collections Not Available</h3>
            <p className="text-muted-foreground">
              This {entityType} doesn't have lore and canon collections set up yet.
            </p>
          </CardContent>
        </Card>
      ) : (
        <>
          {/* Search */}
          <div className="flex items-center gap-4">
            <div className="flex-1 relative">
              <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
              <Input
                placeholder="Search documents..."
                value={searchQuery}
                onChange={(e) => setSearchQuery(e.target.value)}
                className="pl-10"
              />
            </div>
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lore' | 'canon')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lore" className="flex items-center gap-2">
                <Scroll className="h-4 w-4" />
                Lore ({documents.filter(d => d.collection_type === 'lore').length})
              </TabsTrigger>
              <TabsTrigger value="canon" className="flex items-center gap-2">
                <FileText className="h-4 w-4" />
                Canon ({documents.filter(d => d.collection_type === 'canon').length})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lore" className="space-y-4">
              <div className="bg-purple-50 border border-purple-200 rounded-lg p-4">
                <h4 className="font-medium text-purple-900 mb-2">Lore Collection</h4>
                <p className="text-sm text-purple-700">
                  {loreCollection?.description || "Purpose, culture, and why this matters"}
                </p>
              </div>
              {renderDocuments(filteredDocuments)}
            </TabsContent>

            <TabsContent value="canon" className="space-y-4">
              <div className="bg-blue-50 border border-blue-200 rounded-lg p-4">
                <h4 className="font-medium text-blue-900 mb-2">Canon Collection</h4>
                <p className="text-sm text-blue-700">
                  {canonCollection?.description || "Rules, processes, and how things work"}
                </p>
              </div>
              {renderDocuments(filteredDocuments)}
            </TabsContent>
          </Tabs>
        </>
      )}

      {/* Create Document Modal/Form */}
      {isCreating && (
        <Card>
          <CardHeader>
            <CardTitle>Create {activeTab === 'lore' ? 'Lore' : 'Canon'} Document</CardTitle>
            <CardDescription>
              Add new {activeTab} documentation to {entityName}
            </CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            <div className="space-y-2">
              <label className="text-sm font-medium">Document Title</label>
              <Input
                placeholder={`New ${activeTab} document...`}
                value={newDocTitle}
                onChange={(e) => setNewDocTitle(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Purpose/Description</label>
              <Input
                placeholder="What is this document for?"
                value={newDocPurpose}
                onChange={(e) => setNewDocPurpose(e.target.value)}
              />
            </div>

            <div className="space-y-2">
              <label className="text-sm font-medium">Content</label>
              <Textarea
                placeholder={`Write your ${activeTab} content here...`}
                value={newDocContent}
                onChange={(e) => setNewDocContent(e.target.value)}
                rows={6}
              />
            </div>

            {/* Content Suggestions */}
            <div className="bg-gray-50 rounded-lg p-4">
              <h4 className="text-sm font-medium mb-2">Content Suggestions for {activeTab}:</h4>
              <ul className="text-xs text-muted-foreground space-y-1">
                {getContentSuggestions().map((suggestion, index) => (
                  <li key={index}>• {suggestion}</li>
                ))}
              </ul>
            </div>

            <div className="flex gap-2 pt-2">
              <Button onClick={handleCreateDocument} disabled={!newDocTitle.trim()}>
                Create Document
              </Button>
              <Button variant="outline" onClick={() => setIsCreating(false)}>
                Cancel
              </Button>
            </div>
          </CardContent>
        </Card>
      )}
    </div>
  );

  function renderDocuments(docs: Document[]) {
    if (docs.length === 0) {
      return (
        <Card>
          <CardContent className="pt-6 text-center py-8">
            <FileText className="mx-auto h-8 w-8 text-muted-foreground mb-3" />
            <h3 className="font-semibold mb-2">No {activeTab} documents yet</h3>
            <p className="text-muted-foreground text-sm mb-4">
              Start building your {activeTab} collection by adding your first document.
            </p>
            <Button onClick={() => setIsCreating(true)} size="sm">
              <Plus className="h-4 w-4 mr-2" />
              Add First Document
            </Button>
          </CardContent>
        </Card>
      );
    }

    return (
      <div className="space-y-4">
        {docs.map((doc) => (
          <Card key={doc.id} className="hover:shadow-md transition-shadow">
            <CardHeader className="pb-3">
              <div className="flex items-start justify-between">
                <div className="flex-1">
                  <CardTitle className="text-lg">{doc.name}</CardTitle>
                  {doc.purpose_description && (
                    <CardDescription>{doc.purpose_description}</CardDescription>
                  )}
                </div>
                
                <div className="flex items-center gap-2">
                  {renderAlignmentScore(doc.alignment_score)}
                  
                  <Button 
                    variant="ghost" 
                    size="sm"
                    onClick={() => onEditDocument?.(doc)}
                  >
                    <Edit3 className="h-4 w-4" />
                  </Button>
                </div>
              </div>
            </CardHeader>
            
            {doc.content && (
              <CardContent className="pt-0">
                <div className="text-sm text-muted-foreground line-clamp-3 mb-3">
                  {doc.content}
                </div>
                
                <div className="flex items-center justify-between text-xs text-muted-foreground">
                  <div className="flex items-center gap-4">
                    <span className="flex items-center gap-1">
                      <Eye className="h-3 w-3" />
                      AI used {doc.ai_usage_count || 0} times
                    </span>
                    <span>
                      Updated {new Date(doc.updated_at).toLocaleDateString()}
                    </span>
                  </div>
                  
                  <Button variant="ghost" size="sm">
                    View Full Document
                  </Button>
                </div>
              </CardContent>
            )}
          </Card>
        ))}
      </div>
    );
  }
});