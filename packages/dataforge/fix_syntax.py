import re

# Read the file
with open('src/__tests__/entities/week6-knowledge-archetypes.test.ts', 'r') as f:
    content = f.read()

# Fix the malformed syntax where properties were added as separate parameters
pattern = r'(em\.create\(\w+, \{[^}]*?\}),\s*version: 1,\s*containerId: \'test-container\',\s*containerType: \'project\',\s*archetype: \'(record|document)\'\);'

def fix_match(match):
    create_call = match.group(1)
    archetype = match.group(2)
    
    # Remove the closing brace and add the properties properly
    create_call = create_call[:-1]  # Remove the closing }
    fixed_call = f"{create_call},\n        version: 1,\n        containerId: 'test-container',\n        containerType: 'project',\n        archetype: '{archetype}'\n      }}); "
    
    return fixed_call

content = re.sub(pattern, fix_match, content, flags=re.DOTALL)

# Write back
with open('src/__tests__/entities/week6-knowledge-archetypes.test.ts', 'w') as f:
    f.write(content)
    
print("Fixed syntax issues")