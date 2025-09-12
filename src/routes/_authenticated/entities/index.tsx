import React, { useState, useMemo, useEffect } from 'react';
import { createFileRoute } from '@tanstack/react-router';
import { observer } from '@legendapp/state/react';
import { use$ } from '@legendapp/state/react';
import { computed } from '@legendapp/state';
import { ContentContainer } from '@/components/layout/content-container';
import { Button } from '@/components/ui/button';
import { Input } from '@/components/ui/input';
import {
  Select,
  SelectContent,
  SelectItem,
  SelectTrigger,
  SelectValue,
} from '@/components/ui/select';
import {
  Table,
  TableBody,
  TableCell,
  TableHead,
  TableHeader,
  TableRow,
} from '@/components/ui/table';
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuLabel,
  DropdownMenuSeparator,
  DropdownMenuTrigger,
} from '@/components/ui/dropdown-menu';
import { Badge } from '@/components/ui/badge';
import { toast } from 'sonner';
import { 
  Search, 
  Filter, 
  Grid3x3, 
  List, 
  MoreHorizontal,
  Edit,
  Trash2,
  Eye,
  Plus,
  FolderOpen,
  CheckSquare,
  FileText,
  File as FileIcon,
  Zap,
  MessageCircle,
  Library,
  Save
} from 'lucide-react';
import { universeSchema$, universeOrgId$, getEntity$ } from '@/legend-state';
import { useAuth } from '@/lib/auth';
import { QuickEntityCreate } from '@/features/dashboard/QuickEntityCreate';
import { Link } from '@tanstack/react-router';

// Archetype configuration
const ARCHETYPE_CONFIG = {
  project: { icon: FolderOpen, color: 'bg-blue-500/10 text-blue-600', label: 'Project' },
  task: { icon: CheckSquare, color: 'bg-green-500/10 text-green-600', label: 'Task' },
  record: { icon: Save, color: 'bg-purple-500/10 text-purple-600', label: 'Record' },
  document: { icon: FileText, color: 'bg-yellow-500/10 text-yellow-600', label: 'Document' },
  file: { icon: FileIcon, color: 'bg-orange-500/10 text-orange-600', label: 'File' },
  activity: { icon: Zap, color: 'bg-red-500/10 text-red-600', label: 'Activity' },
  discussion: { icon: MessageCircle, color: 'bg-pink-500/10 text-pink-600', label: 'Discussion' },
  collection: { icon: Library, color: 'bg-indigo-500/10 text-indigo-600', label: 'Collection' },
};

export const Route = createFileRoute('/_authenticated/entities/')({
  component: EntitiesListPage,
});

const EntitiesListPage = observer(function EntitiesListPage() {
  const [viewMode, setViewMode] = useState<'list' | 'grid'>('list');
  const [searchQuery, setSearchQuery] = useState('');
  const [selectedArchetype, setSelectedArchetype] = useState<string>('all');
  const [selectedEntity, setSelectedEntity] = useState<string>('all');
  
  const { currentOrganization, user } = useAuth();
  const schema = use$(universeSchema$);
  const orgId = use$(universeOrgId$);
  
  // Components should only consume observables, not trigger loads
  // Loading is handled by auth state machines
  
  // Create a computed observable that aggregates all entity data
  const entitiesData$ = useMemo(() => {
    return computed(() => {
      const currentSchema = universeSchema$.get();
      if (!currentSchema?.entities) return [];
      
      const allData: any[] = [];
      
      Object.entries(currentSchema.entities).forEach(([entityName, entitySchema]: [string, any]) => {
        const store = getEntity$(entityName);
        const data = store.get();
        
        if (data && typeof data === 'object') {
          Object.entries(data).forEach(([id, record]: [string, any]) => {
            if (record && typeof record === 'object' && !record.deleted) {
              allData.push({
                ...record,
                _id: id,
                _entityName: entityName,
                _archetype: entitySchema.archetype || 'record',
              });
            }
          });
        }
      });
      
      return allData;
    });
  }, []);
  
  // Use the computed observable
  const entitiesData = use$(entitiesData$);
  
  // Filter data
  const filteredData = useMemo(() => {
    let filtered = entitiesData;
    
    // Filter by archetype
    if (selectedArchetype !== 'all') {
      filtered = filtered.filter(item => item._archetype === selectedArchetype);
    }
    
    // Filter by entity type
    if (selectedEntity !== 'all') {
      filtered = filtered.filter(item => item._entityName === selectedEntity);
    }
    
    // Filter by search query
    if (searchQuery) {
      const query = searchQuery.toLowerCase();
      filtered = filtered.filter(item => 
        item.name?.toLowerCase().includes(query) ||
        item.title?.toLowerCase().includes(query) ||
        item.description?.toLowerCase().includes(query) ||
        item._entityName.toLowerCase().includes(query)
      );
    }
    
    // Sort by updated_at or created_at
    filtered.sort((a, b) => {
      const dateA = new Date(a.updated_at || a.created_at || 0).getTime();
      const dateB = new Date(b.updated_at || b.created_at || 0).getTime();
      return dateB - dateA;
    });
    
    return filtered;
  }, [entitiesData, selectedArchetype, selectedEntity, searchQuery]);
  
  const handleDelete = async (item: any) => {
    if (!confirm(`Are you sure you want to delete "${item.name || item.title || 'this item'}"?`)) {
      return;
    }
    
    try {
      const entityStore = getEntity$(item._entityName);
      // Remove from store (this will sync deletion to backend)
      entityStore[item._id].delete();
      
      toast.success('Item deleted successfully');
    } catch (error) {
      console.error('Failed to delete:', error);
      toast.error('Failed to delete item');
    }
  };
  
  const getArchetypeIcon = (archetype: string) => {
    const config = ARCHETYPE_CONFIG[archetype as keyof typeof ARCHETYPE_CONFIG];
    const Icon = config?.icon || Save;
    return <Icon className="h-4 w-4" />;
  };
  
  const getArchetypeBadge = (archetype: string) => {
    const config = ARCHETYPE_CONFIG[archetype as keyof typeof ARCHETYPE_CONFIG];
    return (
      <Badge variant="secondary" className={config?.color || ''}>
        {config?.label || archetype}
      </Badge>
    );
  };
  
  return (
    <ContentContainer>
      {/* Header */}
      <div className="mb-6">
        <div className="flex items-center justify-between mb-4">
          <div>
            <h1 className="text-2xl font-bold tracking-tight">All Entities</h1>
            <p className="text-muted-foreground">
              Manage all your data entities in one place
            </p>
          </div>
          <QuickEntityCreate />
        </div>
        
        {/* Filters and Search */}
        <div className="flex items-center gap-4">
          <div className="relative flex-1 max-w-md">
            <Search className="absolute left-3 top-1/2 -translate-y-1/2 h-4 w-4 text-muted-foreground" />
            <Input
              placeholder="Search entities..."
              value={searchQuery}
              onChange={(e) => setSearchQuery(e.target.value)}
              className="pl-9"
            />
          </div>
          
          <Select value={selectedArchetype} onValueChange={setSelectedArchetype}>
            <SelectTrigger className="w-[180px]">
              <Filter className="mr-2 h-4 w-4" />
              <SelectValue placeholder="All Archetypes" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Archetypes</SelectItem>
              {Object.entries(ARCHETYPE_CONFIG).map(([key, config]) => (
                <SelectItem key={key} value={key}>
                  {config.label}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <Select value={selectedEntity} onValueChange={setSelectedEntity}>
            <SelectTrigger className="w-[180px]">
              <SelectValue placeholder="All Entities" />
            </SelectTrigger>
            <SelectContent>
              <SelectItem value="all">All Entity Types</SelectItem>
              {schema?.entities && Object.keys(schema.entities).map(entityName => (
                <SelectItem key={entityName} value={entityName}>
                  {entityName}
                </SelectItem>
              ))}
            </SelectContent>
          </Select>
          
          <div className="flex items-center gap-1 border rounded-md">
            <Button
              variant={viewMode === 'list' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('list')}
            >
              <List className="h-4 w-4" />
            </Button>
            <Button
              variant={viewMode === 'grid' ? 'secondary' : 'ghost'}
              size="sm"
              onClick={() => setViewMode('grid')}
            >
              <Grid3x3 className="h-4 w-4" />
            </Button>
          </div>
        </div>
      </div>
      
      {/* Results Count */}
      <div className="mb-4 text-sm text-muted-foreground">
        Showing {filteredData.length} of {entitiesData.length} entities
      </div>
      
      {/* List View */}
      {viewMode === 'list' && (
        <div className="border rounded-lg">
          <Table>
            <TableHeader>
              <TableRow>
                <TableHead>Name</TableHead>
                <TableHead>Type</TableHead>
                <TableHead>Archetype</TableHead>
                <TableHead>Status</TableHead>
                <TableHead>Updated</TableHead>
                <TableHead className="w-[100px]">Actions</TableHead>
              </TableRow>
            </TableHeader>
            <TableBody>
              {filteredData.length === 0 ? (
                <TableRow>
                  <TableCell colSpan={6} className="text-center py-8">
                    <div className="text-muted-foreground">
                      {searchQuery || selectedArchetype !== 'all' || selectedEntity !== 'all'
                        ? 'No entities found matching your filters'
                        : 'No entities created yet'}
                    </div>
                  </TableCell>
                </TableRow>
              ) : (
                filteredData.map((item) => (
                  <TableRow key={`${item._entityName}-${item._id}`}>
                    <TableCell className="font-medium">
                      <Link
                        to="/org/$orgId/entities/$entityName"
                        params={{ 
                          orgId: item._entityName.includes('_') ? item._entityName.split('_')[0] : 'unknown',
                          entityName: item._entityName.includes('_') ? item._entityName.split('_')[1] : item._entityName
                        }}
                        className="hover:underline"
                      >
                        {item.name || item.title || 'Untitled'}
                      </Link>
                    </TableCell>
                    <TableCell>{item._entityName}</TableCell>
                    <TableCell>{getArchetypeBadge(item._archetype)}</TableCell>
                    <TableCell>
                      <Badge variant="outline">
                        {item.status || 'active'}
                      </Badge>
                    </TableCell>
                    <TableCell className="text-muted-foreground">
                      {item.updated_at 
                        ? new Date(item.updated_at).toLocaleDateString()
                        : '-'}
                    </TableCell>
                    <TableCell>
                      <DropdownMenu>
                        <DropdownMenuTrigger asChild>
                          <Button variant="ghost" size="sm">
                            <MoreHorizontal className="h-4 w-4" />
                          </Button>
                        </DropdownMenuTrigger>
                        <DropdownMenuContent align="end">
                          <DropdownMenuLabel>Actions</DropdownMenuLabel>
                          <DropdownMenuSeparator />
                          <DropdownMenuItem asChild>
                            <Link
                              to="/org/$orgId/entities/$entityName"
                              params={{ 
                                orgId: item._entityName.includes('_') ? item._entityName.split('_')[0] : 'unknown',
                                entityName: item._entityName.includes('_') ? item._entityName.split('_')[1] : item._entityName
                              }}
                            >
                              <Eye className="mr-2 h-4 w-4" />
                              View
                            </Link>
                          </DropdownMenuItem>
                          <DropdownMenuItem>
                            <Edit className="mr-2 h-4 w-4" />
                            Edit
                          </DropdownMenuItem>
                          <DropdownMenuItem
                            className="text-destructive"
                            onClick={() => handleDelete(item)}
                          >
                            <Trash2 className="mr-2 h-4 w-4" />
                            Delete
                          </DropdownMenuItem>
                        </DropdownMenuContent>
                      </DropdownMenu>
                    </TableCell>
                  </TableRow>
                ))
              )}
            </TableBody>
          </Table>
        </div>
      )}
      
      {/* Grid View */}
      {viewMode === 'grid' && (
        <div className="grid grid-cols-1 md:grid-cols-2 lg:grid-cols-3 xl:grid-cols-4 gap-4">
          {filteredData.length === 0 ? (
            <div className="col-span-full text-center py-12">
              <div className="text-muted-foreground">
                {searchQuery || selectedArchetype !== 'all' || selectedEntity !== 'all'
                  ? 'No entities found matching your filters'
                  : 'No entities created yet'}
              </div>
            </div>
          ) : (
            filteredData.map((item) => (
              <div
                key={`${item._entityName}-${item._id}`}
                className="border rounded-lg p-4 hover:shadow-md transition-shadow"
              >
                <div className="flex items-start justify-between mb-2">
                  <div className="flex items-center gap-2">
                    {getArchetypeIcon(item._archetype)}
                    <span className="text-sm text-muted-foreground">
                      {item._entityName}
                    </span>
                  </div>
                  <DropdownMenu>
                    <DropdownMenuTrigger asChild>
                      <Button variant="ghost" size="sm">
                        <MoreHorizontal className="h-4 w-4" />
                      </Button>
                    </DropdownMenuTrigger>
                    <DropdownMenuContent align="end">
                      <DropdownMenuItem asChild>
                        <Link
                          to="/org/$orgId/entities/$entityName"
                          params={{ 
                            orgId: item._entityName.includes('_') ? item._entityName.split('_')[0] : 'unknown',
                            entityName: item._entityName.includes('_') ? item._entityName.split('_')[1] : item._entityName
                          }}
                        >
                          <Eye className="mr-2 h-4 w-4" />
                          View
                        </Link>
                      </DropdownMenuItem>
                      <DropdownMenuItem>
                        <Edit className="mr-2 h-4 w-4" />
                        Edit
                      </DropdownMenuItem>
                      <DropdownMenuItem
                        className="text-destructive"
                        onClick={() => handleDelete(item)}
                      >
                        <Trash2 className="mr-2 h-4 w-4" />
                        Delete
                      </DropdownMenuItem>
                    </DropdownMenuContent>
                  </DropdownMenu>
                </div>
                
                <h3 className="font-semibold mb-1">
                  {item.name || item.title || 'Untitled'}
                </h3>
                
                {item.description && (
                  <p className="text-sm text-muted-foreground line-clamp-2 mb-2">
                    {item.description}
                  </p>
                )}
                
                <div className="flex items-center justify-between mt-3">
                  {getArchetypeBadge(item._archetype)}
                  <Badge variant="outline" className="text-xs">
                    {item.status || 'active'}
                  </Badge>
                </div>
              </div>
            ))
          )}
        </div>
      )}
    </ContentContainer>
  );
});