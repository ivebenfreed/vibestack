/**
 * System Entity Types for Lore and Canon
 * 
 * These are system entities (like User) that provide semantic clarity
 * for AI extensions and knowledge management.
 */

export interface LoreEntity {
  id: string;
  organization_id: string;
  title: string;
  content?: string;
  
  // Parent relationship
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  
  // Lore-specific semantic fields
  cultural_significance: number; // 0-100: How culturally important is this?
  emotional_resonance: 'inspiring' | 'grounding' | 'motivating' | 'cautionary' | 'celebratory';
  purpose_clarity: number; // 0-100: How clear is the purpose/meaning?
  
  // Common fields
  alignment_score: number; // 0-100: How well aligned with parent entity?
  ai_usage_count: number;
  
  // Audit fields
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

export interface CanonEntity {
  id: string;
  organization_id: string;
  title: string;
  content?: string;
  
  // Parent relationship
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  
  // Canon-specific semantic fields
  rule_type: 'process' | 'standard' | 'requirement' | 'boundary' | 'guideline';
  enforcement_level: 'must' | 'should' | 'may' | 'must_not';
  violation_consequence?: string;
  compliance_level: number; // 0-100: Expected compliance rate
  
  // Common fields
  alignment_score: number; // 0-100: How well aligned with parent entity?
  ai_usage_count: number;
  
  // Audit fields
  created_at: Date;
  updated_at: Date;
  created_by?: string;
}

// Create DTOs for API requests
export interface CreateLoreRequest {
  title: string;
  content?: string;
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  cultural_significance?: number;
  emotional_resonance?: 'inspiring' | 'grounding' | 'motivating' | 'cautionary' | 'celebratory';
  purpose_clarity?: number;
  alignment_score?: number;
}

export interface CreateCanonRequest {
  title: string;
  content?: string;
  parent_entity_type: 'universe' | 'world' | 'project' | 'task';
  parent_entity_id: string;
  rule_type?: 'process' | 'standard' | 'requirement' | 'boundary' | 'guideline';
  enforcement_level?: 'must' | 'should' | 'may' | 'must_not';
  violation_consequence?: string;
  compliance_level?: number;
  alignment_score?: number;
}

export interface UpdateLoreRequest extends Partial<CreateLoreRequest> {
  id: string;
}

export interface UpdateCanonRequest extends Partial<CreateCanonRequest> {
  id: string;
}

// Query interfaces
export interface LoreCanonQuery {
  parent_entity_type?: string;
  parent_entity_id?: string;
  limit?: number;
  offset?: number;
  order_by?: 'created_at' | 'updated_at' | 'alignment_score' | 'title';
  order_direction?: 'asc' | 'desc';
}

// AI Extension Context
export interface LoreCanonContext {
  entity_type: 'lore' | 'canon';
  parent_context: {
    type: string;
    id: string;
    name: string;
  };
  semantic_purpose: string;
  key_insights: string[];
  related_entities: Array<{
    type: 'lore' | 'canon';
    id: string;
    title: string;
    relevance_score: number;
  }>;
}