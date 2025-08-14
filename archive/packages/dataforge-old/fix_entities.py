import re

# Read the file
with open('src/__tests__/entities/week6-knowledge-archetypes.test.ts', 'r') as f:
    content = f.read()

# Dictionary of entity types and their archetype values
entity_types = {
    'MeetingNotes': 'record',
    'TechnicalSpecification': 'record', 
    'ProcessDocumentation': 'record',
    'Proposal': 'document',
    'UserManual': 'document',
    'Contract': 'document'
}

# Find all em.create calls and fix those without version
for entity_type, archetype in entity_types.items():
    pattern = r'(const \w+ = em\.create\(' + entity_type + r', \{[^}]*?})(\);)'
    matches = re.finditer(pattern, content, re.DOTALL)
    
    for match in reversed(list(matches)):  # Reverse to avoid offset issues
        full_match = match.group(0)
        if 'version:' not in full_match:  # Only fix if missing version
            obj_content = match.group(1)
            closing = match.group(2)
            
            # Add required properties
            new_obj_content = obj_content + f',\n        version: 1,\n        containerId: \'test-container\',\n        containerType: \'project\',\n        archetype: \'{archetype}\''
            new_full = new_obj_content + closing
            
            content = content[:match.start()] + new_full + content[match.end():]

# Write back
with open('src/__tests__/entities/week6-knowledge-archetypes.test.ts', 'w') as f:
    f.write(content)
    
print("Fixed test file")