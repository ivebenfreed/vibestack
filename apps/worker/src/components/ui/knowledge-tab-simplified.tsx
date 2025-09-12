import React, { useState, useEffect, useMemo } from 'react';
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

interface LoreEntity {
  id: string;
  organization_id: string;
  title: string;
  content?: string;
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  cultural_significance: number;
  emotional_resonance: 'inspiring' | 'grounding' | 'motivating' | 'cautionary' | 'celebratory';
  purpose_clarity: number;
  alignment_score: number;
  ai_usage_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface CanonEntity {
  id: string;
  organization_id: string;
  title: string;
  content?: string;
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  rule_type: 'process' | 'standard' | 'requirement' | 'boundary' | 'guideline';
  enforcement_level: 'must' | 'should' | 'may' | 'must_not';
  violation_consequence?: string;
  compliance_level: number;
  alignment_score: number;
  ai_usage_count: number;
  created_at: string;
  updated_at: string;
  created_by?: string;
}

interface KnowledgeTabProps {
  entityType: 'universe' | 'world' | 'project';
  entityId: string;
  entityName: string;
  organizationId: string;
}

export const KnowledgeTab = observer(function KnowledgeTab({
  entityType,
  entityId, 
  entityName,
  organizationId
}: KnowledgeTabProps) {
  const { user } = useAuth();
  const [activeTab, setActiveTab] = useState<'lore' | 'canon'>('lore');
  const [searchQuery, setSearchQuery] = useState('');
  const [loreEntities, setLoreEntities] = useState<LoreEntity[]>([]);
  const [canonEntities, setCanonEntities] = useState<CanonEntity[]>([]);
  const [loading, setLoading] = useState(true);
  const [isCreating, setIsCreating] = useState(false);
  const [newDocTitle, setNewDocTitle] = useState('');
  const [newDocContent, setNewDocContent] = useState('');
  const [newDocPurpose, setNewDocPurpose] = useState('');

  // Fetch knowledge for this entity using dedicated API
  useEffect(() => {
    const fetchKnowledge = async () => {
      try {
        setLoading(true);
        const response = await fetch(
          `/api/orgs/${organizationId}/knowledge?parent_entity_type=${entityType}&parent_entity_id=${entityId}`,
          {
            credentials: 'include'
          }
        );
        
        if (response.ok) {
          const result = await response.json();
          setLoreEntities(result.data?.lore || []);
          setCanonEntities(result.data?.canon || []);
        }
      } catch (error) {
        console.error('Failed to fetch knowledge:', error);
      } finally {
        setLoading(false);
      }
    };

    fetchKnowledge();
  }, [organizationId, entityId, entityType]);

  // Filter entities by active tab and search query
  const filteredEntities = useMemo(() => {
    const entities = activeTab === 'lore' ? loreEntities : canonEntities;
    return entities.filter(entity => {
      const matchesSearch = !searchQuery || 
        entity.title.toLowerCase().includes(searchQuery.toLowerCase()) ||
        entity.content?.toLowerCase().includes(searchQuery.toLowerCase());
      return matchesSearch;
    });
  }, [loreEntities, canonEntities, activeTab, searchQuery]);

  // Get context-specific content suggestions
  const getContentSuggestions = () => {
    const suggestions = {
      universe: {
        lore: [
          "Core life values and mission",
          "Personal philosophy and beliefs", 
          "Life journey and experiences"
        ],
        canon: [
          "Life standards and boundaries",
          "Non-negotiable principles",
          "Decision-making frameworks"
        ]
      },
      world: {
        lore: [
          "Purpose and culture of this world",
          "Why this world matters",
          "Vision and aspirations"
        ],
        canon: [
          "Rules and processes",
          "How things work here", 
          "Operating procedures"
        ]
      },
      project: {
        lore: [
          "Project vision and goals",
          "Definition of success",
          "Why this project exists"
        ],
        canon: [
          "Requirements and constraints",
          "Acceptance criteria",
          "Technical specifications"
        ]
      }
    };
    return suggestions[entityType]?.[activeTab] || [];
  };

  const handleCreateDocument = async () => {
    if (!newDocTitle.trim()) return;

    try {
      const apiEndpoint = activeTab === 'lore' 
        ? `/api/orgs/${organizationId}/lore`
        : `/api/orgs/${organizationId}/canon`;

      const requestBody = {
        title: newDocTitle.trim(),
        content: newDocContent.trim() || undefined,
        parent_entity_type: entityType,
        parent_entity_id: entityId,
        alignment_score: 75,
        ...(activeTab === 'lore' ? {
          cultural_significance: 75,
          emotional_resonance: 'grounding' as const,
          purpose_clarity: 75
        } : {
          rule_type: 'guideline' as const,
          enforcement_level: 'should' as const,
          compliance_level: 80,
          violation_consequence: newDocPurpose.trim() || undefined
        })
      };

      const response = await fetch(apiEndpoint, {
        method: 'POST',
        headers: {
          'Content-Type': 'application/json',
        },
        credentials: 'include',
        body: JSON.stringify(requestBody)
      });

      if (response.ok) {
        const result = await response.json();
        // Add new entity to local state
        if (activeTab === 'lore') {
          setLoreEntities(prev => [...prev, result.data]);
        } else {
          setCanonEntities(prev => [...prev, result.data]);
        }
        
        // Reset form
        setNewDocTitle('');
        setNewDocContent('');
        setNewDocPurpose('');
        setIsCreating(false);
      }
    } catch (error) {
      console.error('Failed to create document:', error);
    }
  };

  if (loading) {
    return (
      <div className="flex items-center justify-center p-8">
        <div className="text-muted-foreground">Loading knowledge base...</div>
      </div>
    );
  }

  const loreCount = loreEntities.length;
  const canonCount = canonEntities.length;

  return (
    <div className="space-y-6">
      {/* Knowledge Overview */}
      <div className="grid grid-cols-2 gap-4">
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <BookOpen className="h-5 w-5 text-purple-600" />
              <div>
                <div className="text-2xl font-bold">{loreCount}</div>
                <div className="text-sm text-muted-foreground">Lore Documents</div>
              </div>
            </div>
          </CardContent>
        </Card>
        
        <Card>
          <CardContent className="pt-6">
            <div className="flex items-center gap-2">
              <Scroll className="h-5 w-5 text-blue-600" />
              <div>
                <div className="text-2xl font-bold">{canonCount}</div>
                <div className="text-sm text-muted-foreground">Canon Documents</div>
              </div>
            </div>
          </CardContent>
        </Card>
      </div>

      {/* Knowledge Management */}
      <Card>
        <CardHeader>
          <div className="flex items-center justify-between">
            <div>
              <CardTitle className="flex items-center gap-2">
                <BookOpen className="h-5 w-5" />
                Knowledge Base
              </CardTitle>
              <CardDescription>
                Manage lore and canon for {entityName}
              </CardDescription>
            </div>
            <Button onClick={() => setIsCreating(true)}>
              <Plus className="h-4 w-4 mr-2" />
              Add Document
            </Button>
          </div>
        </CardHeader>

        <CardContent className="space-y-4">
          {/* Search */}
          <div className="relative">
            <Search className="absolute left-3 top-1/2 transform -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search documents..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-10"
            />
          </div>

          {/* Tabs */}
          <Tabs value={activeTab} onValueChange={(value) => setActiveTab(value as 'lore' | 'canon')}>
            <TabsList className="grid w-full grid-cols-2">
              <TabsTrigger value="lore" className="flex items-center gap-2">
                <BookOpen className="h-4 w-4" />
                Lore ({loreCount})
              </TabsTrigger>
              <TabsTrigger value="canon" className="flex items-center gap-2">
                <Scroll className="h-4 w-4" />
                Canon ({canonCount})
              </TabsTrigger>
            </TabsList>

            <TabsContent value="lore" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground bg-purple-50 p-3 rounded-lg border">
                <strong>Lore</strong> captures the purpose, story, and meaning behind {entityName}. 
                Why does this {entityType} matter? What's its cultural significance?
              </div>

              {filteredEntities.length > 0 ? (
                <div className="space-y-3">
                  {filteredEntities.map((entity) => (
                    <Card key={entity.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              <FileText className="h-4 w-4" />
                              {entity.title}
                            </CardTitle>
                            {'cultural_significance' in entity && (
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <span>Cultural: {entity.cultural_significance}%</span>
                                <span className="capitalize">{entity.emotional_resonance}</span>
                                <span>Purpose: {entity.purpose_clarity}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {entity.alignment_score}%
                            </Badge>
                            {'ai_usage_count' in entity && entity.ai_usage_count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                {entity.ai_usage_count}
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {entity.content && (
                        <CardContent className="pt-0">
                          <div className="text-sm text-muted-foreground line-clamp-3">
                            {entity.content.substring(0, 200)}...
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center py-12">
                    <BookOpen className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Lore Documents Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Start documenting the purpose and meaning of {entityName}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Suggestions:</strong> {getContentSuggestions().join(', ')}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>

            <TabsContent value="canon" className="space-y-4 mt-4">
              <div className="text-sm text-muted-foreground bg-blue-50 p-3 rounded-lg border">
                <strong>Canon</strong> defines the rules, standards, and processes for {entityName}. 
                How do things work here? What are the non-negotiable requirements?
              </div>

              {filteredEntities.length > 0 ? (
                <div className="space-y-3">
                  {filteredEntities.map((entity) => (
                    <Card key={entity.id} className="hover:shadow-md transition-shadow">
                      <CardHeader className="pb-3">
                        <div className="flex items-start justify-between">
                          <div className="flex-1">
                            <CardTitle className="text-base flex items-center gap-2">
                              <Scroll className="h-4 w-4" />
                              {entity.title}
                            </CardTitle>
                            {'rule_type' in entity && (
                              <div className="mt-2 flex items-center gap-4 text-xs text-muted-foreground">
                                <span className="capitalize">{entity.rule_type}</span>
                                <span className="capitalize font-medium">{entity.enforcement_level}</span>
                                <span>Compliance: {entity.compliance_level}%</span>
                              </div>
                            )}
                          </div>
                          <div className="flex items-center gap-2">
                            <Badge variant="outline" className="text-xs">
                              <Star className="h-3 w-3 mr-1" />
                              {entity.alignment_score}%
                            </Badge>
                            {'ai_usage_count' in entity && entity.ai_usage_count > 0 && (
                              <Badge variant="outline" className="text-xs">
                                <Eye className="h-3 w-3 mr-1" />
                                {entity.ai_usage_count}
                              </Badge>
                            )}
                            <Button variant="ghost" size="sm">
                              <Edit3 className="h-4 w-4" />
                            </Button>
                          </div>
                        </div>
                      </CardHeader>
                      {entity.content && (
                        <CardContent className="pt-0">
                          <div className="text-sm text-muted-foreground line-clamp-3">
                            {entity.content.substring(0, 200)}...
                          </div>
                        </CardContent>
                      )}
                    </Card>
                  ))}
                </div>
              ) : (
                <Card className="border-dashed">
                  <CardContent className="pt-6 text-center py-12">
                    <Scroll className="mx-auto h-12 w-12 text-muted-foreground mb-4" />
                    <h3 className="text-lg font-semibold mb-2">No Canon Documents Yet</h3>
                    <p className="text-muted-foreground mb-4">
                      Document the rules and standards for {entityName}
                    </p>
                    <div className="text-xs text-muted-foreground">
                      <strong>Suggestions:</strong> {getContentSuggestions().join(', ')}
                    </div>
                  </CardContent>
                </Card>
              )}
            </TabsContent>
          </Tabs>
        </CardContent>
      </Card>

      {/* Create Document Modal */}
      {isCreating && (
        <div className="fixed inset-0 bg-black/50 flex items-center justify-center z-50">
          <div className="bg-white rounded-lg p-6 w-full max-w-2xl mx-4">
            <h2 className="text-xl font-semibold mb-4">
              Create {activeTab === 'lore' ? 'Lore' : 'Canon'} Document
            </h2>
            
            <div className="space-y-4">
              <div>
                <label className="block text-sm font-medium mb-1">Title</label>
                <Input
                  value={newDocTitle}
                  onChange={(e) => setNewDocTitle(e.target.value)}
                  placeholder={`${activeTab === 'lore' ? 'Mission Statement' : 'Operating Procedures'}`}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">
                  {activeTab === 'canon' ? 'Violation Consequence' : 'Purpose'}
                </label>
                <Input
                  value={newDocPurpose}
                  onChange={(e) => setNewDocPurpose(e.target.value)}
                  placeholder={activeTab === 'canon' 
                    ? "What happens if this rule is violated?" 
                    : "Brief description of this document's purpose"}
                />
              </div>
              
              <div>
                <label className="block text-sm font-medium mb-1">Content</label>
                <Textarea
                  value={newDocContent}
                  onChange={(e) => setNewDocContent(e.target.value)}
                  placeholder="Document content (Markdown supported)"
                  rows={8}
                />
              </div>
              
              <div className="flex justify-end gap-2 pt-4">
                <Button
                  variant="outline"
                  onClick={() => {
                    setIsCreating(false);
                    setNewDocTitle('');
                    setNewDocContent('');
                    setNewDocPurpose('');
                  }}
                >
                  Cancel
                </Button>
                <Button
                  onClick={handleCreateDocument}
                  disabled={!newDocTitle.trim()}
                >
                  Create Document
                </Button>
              </div>
            </div>
          </div>
        </div>
      )}
    </div>
  );
});