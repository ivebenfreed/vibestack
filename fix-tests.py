#!/usr/bin/env python3
"""
Script to fix test entity creation calls by adding required properties
"""

import re

def fix_test_file(file_path):
    with open(file_path, 'r') as f:
        content = f.read()
    
    # Patterns for different entity types that need properties added
    patterns = [
        # MeetingNotes pattern
        (r'(const \w+ = em\.create\(MeetingNotes, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'record\'' + m.group(2)),
        
        # TechnicalSpecification pattern
        (r'(const \w+ = em\.create\(TechnicalSpecification, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'record\'' + m.group(2)),
        
        # ProcessDocumentation pattern  
        (r'(const \w+ = em\.create\(ProcessDocumentation, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'record\'' + m.group(2)),
        
        # Proposal pattern
        (r'(const \w+ = em\.create\(Proposal, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'document\'' + m.group(2)),
        
        # UserManual pattern
        (r'(const \w+ = em\.create\(UserManual, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'document\'' + m.group(2)),
        
        # Contract pattern
        (r'(const \w+ = em\.create\(Contract, \{[^}]*?)(\n\s*}\);)', 
         lambda m: m.group(1) + ',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'document\'' + m.group(2)),
    ]
    
    original_content = content
    
    for pattern, replacement in patterns:
        # Skip if already has required properties
        if 'version: 1' in content and 'archetype:' in content:
            continue
            
        content = re.sub(pattern, replacement, content, flags=re.DOTALL)
    
    # Only write if content changed
    if content != original_content:
        with open(file_path, 'w') as f:
            f.write(content)
        print(f"Fixed {file_path}")
    else:
        print(f"No changes needed for {file_path}")

if __name__ == '__main__':
    fix_test_file('/home/ben-freed/dev/vibestack/packages/dataforge/src/__tests__/entities/week6-knowledge-archetypes.test.ts')