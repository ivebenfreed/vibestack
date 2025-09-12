-- Migration 015: Create Lore and Canon System Entities
-- These are system entities (like User) that provide semantic clarity for AI extensions

-- Lore Entity: Purpose, meaning, culture, "why this matters"
CREATE TABLE lore (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  
  -- Parent relationship (what this lore describes)
  parent_entity_type TEXT NOT NULL CHECK (parent_entity_type IN ('universe', 'world', 'project', 'task')),
  parent_entity_id TEXT NOT NULL,
  
  -- Lore-specific semantic fields
  cultural_significance INTEGER CHECK (cultural_significance >= 0 AND cultural_significance <= 100) DEFAULT 50,
  emotional_resonance TEXT CHECK (emotional_resonance IN ('inspiring', 'grounding', 'motivating', 'cautionary', 'celebratory')) DEFAULT 'grounding',
  purpose_clarity INTEGER CHECK (purpose_clarity >= 0 AND purpose_clarity <= 100) DEFAULT 50,
  
  -- Common fields
  alignment_score INTEGER CHECK (alignment_score >= 0 AND alignment_score <= 100) DEFAULT 50,
  ai_usage_count INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  
  -- Indexes
  CONSTRAINT lore_parent_entity UNIQUE (organization_id, parent_entity_type, parent_entity_id, title)
);

-- Canon Entity: Rules, standards, processes, "how things work"
CREATE TABLE canon (
  id UUID PRIMARY KEY DEFAULT gen_random_uuid(),
  organization_id TEXT NOT NULL,
  title TEXT NOT NULL,
  content TEXT,
  
  -- Parent relationship (what this canon governs)
  parent_entity_type TEXT NOT NULL CHECK (parent_entity_type IN ('universe', 'world', 'project', 'task')),
  parent_entity_id TEXT NOT NULL,
  
  -- Canon-specific semantic fields
  rule_type TEXT CHECK (rule_type IN ('process', 'standard', 'requirement', 'boundary', 'guideline')) DEFAULT 'guideline',
  enforcement_level TEXT CHECK (enforcement_level IN ('must', 'should', 'may', 'must_not')) DEFAULT 'should',
  violation_consequence TEXT,
  compliance_level INTEGER CHECK (compliance_level >= 0 AND compliance_level <= 100) DEFAULT 80,
  
  -- Common fields
  alignment_score INTEGER CHECK (alignment_score >= 0 AND alignment_score <= 100) DEFAULT 50,
  ai_usage_count INTEGER DEFAULT 0,
  
  -- Audit fields
  created_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  updated_at TIMESTAMP WITH TIME ZONE DEFAULT NOW(),
  created_by TEXT,
  
  -- Indexes
  CONSTRAINT canon_parent_entity UNIQUE (organization_id, parent_entity_type, parent_entity_id, title)
);

-- Indexes for performance
CREATE INDEX idx_lore_organization_parent ON lore(organization_id, parent_entity_type, parent_entity_id);
CREATE INDEX idx_lore_created_at ON lore(created_at DESC);
CREATE INDEX idx_lore_alignment ON lore(alignment_score DESC);

CREATE INDEX idx_canon_organization_parent ON canon(organization_id, parent_entity_type, parent_entity_id);
CREATE INDEX idx_canon_created_at ON canon(created_at DESC);
CREATE INDEX idx_canon_rule_type ON canon(rule_type);
CREATE INDEX idx_canon_enforcement ON canon(enforcement_level);

-- Update triggers for updated_at
CREATE OR REPLACE FUNCTION update_updated_at_column()
RETURNS TRIGGER AS $$
BEGIN
  NEW.updated_at = NOW();
  RETURN NEW;
END;
$$ language 'plpgsql';

CREATE TRIGGER update_lore_updated_at BEFORE UPDATE ON lore
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();

CREATE TRIGGER update_canon_updated_at BEFORE UPDATE ON canon
  FOR EACH ROW EXECUTE FUNCTION update_updated_at_column();