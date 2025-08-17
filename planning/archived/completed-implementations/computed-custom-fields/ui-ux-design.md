# UI/UX Design - Computed Custom Fields

## 🎨 **Design Philosophy**

### **Core Principles**
- **Intuitive Text-Based Interface**: Formula creation using familiar text input with intelligent helpers
- **Smart Auto-Complete**: Dropdown suggestions and type-ahead for fields, functions, and operators
- **Real-time Feedback**: Immediate validation, syntax highlighting, and preview of formula results
- **Error Prevention**: Guide users with suggestions and contextual help as they type
- **Keyboard-Friendly**: Efficient formula editing with keyboard shortcuts and quick access

### **User Personas**

#### **Primary: Business User (80% of use cases)**
- Wants to create simple calculations (totals, percentages, ratios)
- Prefers guided assistance with dropdown lists and suggestions
- Values smart auto-complete for field names and functions
- Needs confidence that formulas are correct with real-time validation

#### **Secondary: Power User (15% of use cases)**
- Comfortable with Excel-like formulas and text-based editing
- Wants advanced features like conditional logic
- Values efficiency with keyboard shortcuts and quick insertion
- Prefers direct text editing with intelligent auto-complete

#### **Tertiary: Admin/Developer (5% of use cases)**
- May need to debug complex formulas with syntax highlighting
- Wants to see dependency relationships and performance metrics
- Needs advanced validation tools and error diagnostics

## 🖥️ **Formula Creation Interface**

### **Main Formula Editor Component**

```tsx
interface FormulaEditorProps {
  organizationId: string;
  entityName: string;
  availableFields: FieldInfo[];
  initialFormula?: string;
  onFormulaChange: (formula: string, isValid: boolean) => void;
  onSave: (formulaDefinition: ComputedFieldDefinition) => void;
}

export function FormulaEditor({ 
  organizationId, 
  entityName, 
  availableFields, 
  initialFormula = '', 
  onFormulaChange,
  onSave 
}: FormulaEditorProps) {
  const [formula, setFormula] = useState(initialFormula);
  const [mode, setMode] = useState<'visual' | 'text'>('visual');
  const [validation, setValidation] = useState<ValidationResult | null>(null);
  const [preview, setPreview] = useState<PreviewResult | null>(null);

  return (
    <div className="formula-editor">
      {/* Mode Toggle */}
      <div className="editor-toolbar">
        <ToggleGroup value={mode} onValueChange={setMode}>
          <ToggleGroupItem value="visual">
            <Calculator className="w-4 h-4 mr-2" />
            Smart Builder
          </ToggleGroupItem>
          <ToggleGroupItem value="text">
            <Code className="w-4 h-4 mr-2" />
            Advanced Editor
          </ToggleGroupItem>
        </ToggleGroup>
        
        <Button variant="outline" onClick={() => setShowHelp(true)}>
          <HelpCircle className="w-4 h-4 mr-2" />
          Help
        </Button>
      </div>

      {/* Editor Content */}
      {mode === 'visual' ? (
        <SmartFormulaBuilder
          formula={formula}
          availableFields={availableFields}
          onChange={setFormula}
        />
      ) : (
        <AdvancedTextEditor
          formula={formula}
          availableFields={availableFields}
          onChange={setFormula}
        />
      )}

      {/* Validation & Preview */}
      <FormulaValidationPanel validation={validation} />
      <FormulaPreviewPanel preview={preview} />
      
      {/* Actions */}
      <div className="editor-actions">
        <Button variant="outline" onClick={onCancel}>
          Cancel
        </Button>
        <Button 
          onClick={handleSave}
          disabled={!validation?.isValid}
        >
          Save Formula
        </Button>
      </div>
    </div>
  );
}
```

### **Smart Formula Builder**

```tsx
function SmartFormulaBuilder({ 
  formula, 
  availableFields, 
  onChange 
}: SmartFormulaBuilderProps) {
  const [cursorPosition, setCursorPosition] = useState(0);
  const [showSuggestions, setShowSuggestions] = useState(false);
  const [suggestions, setSuggestions] = useState<Suggestion[]>([]);

  return (
    <div className="smart-formula-builder">
      {/* Smart Formula Input with Auto-Complete */}
      <div className="formula-input-container">
        <SmartFormulaInput
          value={formula}
          onChange={onChange}
          onCursorChange={setCursorPosition}
          availableFields={availableFields}
          placeholder="Type your formula... (e.g., {unit_price} * {quantity})"
        />
        
        {showSuggestions && (
          <SuggestionDropdown
            suggestions={suggestions}
            onSelect={insertSuggestion}
            position={calculateDropdownPosition(cursorPosition)}
          />
        )}
      </div>

      {/* Quick Insert Helpers */}
      <div className="formula-helpers">
        <FieldDropdownSelector
          fields={availableFields}
          onFieldSelect={insertField}
          searchable={true}
        />
        
        <OperatorDropdownSelector
          operators={[
            { symbol: '+', name: 'Add', example: 'a + b' },
            { symbol: '-', name: 'Subtract', example: 'a - b' },
            { symbol: '*', name: 'Multiply', example: 'a * b' },
            { symbol: '/', name: 'Divide', example: 'a / b' },
            { symbol: '%', name: 'Modulo', example: 'a % b' },
            { symbol: '^', name: 'Power', example: 'a ^ b' }
          ]}
          onOperatorSelect={insertOperator}
        />
        
        <FunctionDropdownSelector
          functions={[
            { name: 'abs', description: 'Absolute value', example: 'abs(-5) = 5' },
            { name: 'round', description: 'Round to nearest integer', example: 'round(3.7) = 4' },
            { name: 'min', description: 'Minimum of two values', example: 'min(5, 10) = 5' },
            { name: 'max', description: 'Maximum of two values', example: 'max(5, 10) = 10' },
            { name: 'sqrt', description: 'Square root', example: 'sqrt(16) = 4' }
          ]}
          onFunctionSelect={insertFunction}
        />
      </div>
    </div>
  );
}

function SmartFormulaInput({ 
  value, 
  onChange, 
  onCursorChange,
  availableFields,
  placeholder 
}: SmartFormulaInputProps) {
  const [textareaRef, setTextareaRef] = useState<HTMLTextAreaElement | null>(null);
  
  const handleInputChange = (e: ChangeEvent<HTMLTextAreaElement>) => {
    const newValue = e.target.value;
    const cursorPos = e.target.selectionStart;
    
    onChange(newValue);
    onCursorChange(cursorPos);
    
    // Trigger smart suggestions based on what user is typing
    const currentContext = getTypingContext(newValue, cursorPos);
    triggerSuggestions(currentContext);
  };

  const handleKeyDown = (e: KeyboardEvent<HTMLTextAreaElement>) => {
    // Handle special keys for formula editing
    if (e.key === '{') {
      // User started typing field reference - show field suggestions
      showFieldSuggestions();
    } else if (e.key === 'Tab' && showingSuggestions) {
      e.preventDefault();
      acceptCurrentSuggestion();
    } else if (e.key === 'Escape') {
      hideSuggestions();
    }
  };

  return (
    <div className="smart-formula-input-container">
      <textarea
        ref={setTextareaRef}
        value={value}
        onChange={handleInputChange}
        onKeyDown={handleKeyDown}
        onSelect={handleCursorMove}
        placeholder={placeholder}
        className="formula-textarea"
        spellCheck={false}
        rows={3}
      />
      
      {/* Real-time Syntax Highlighting Overlay */}
      <SyntaxHighlightOverlay
        formula={value}
        textareaRef={textareaRef}
      />
    </div>
  );
}
```

### **Dropdown Field Selector Component**

```tsx
function FieldDropdownSelector({ 
  fields, 
  onFieldSelect, 
  searchable = true 
}: FieldDropdownSelectorProps) {
  const [searchTerm, setSearchTerm] = useState('');
  const [isOpen, setIsOpen] = useState(false);
  
  const filteredFields = useMemo(() => {
    return fields.filter(field => 
      field.name.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.displayName?.toLowerCase().includes(searchTerm.toLowerCase()) ||
      field.description?.toLowerCase().includes(searchTerm.toLowerCase())
    );
  }, [fields, searchTerm]);

  return (
    <div className="field-dropdown-selector">
      <Button 
        variant="outline" 
        onClick={() => setIsOpen(!isOpen)}
        className="field-selector-trigger"
      >
        <Database className="w-4 h-4 mr-2" />
        Insert Field
        <ChevronDown className="w-4 h-4 ml-2" />
      </Button>

      {isOpen && (
        <div className="field-dropdown">
          {searchable && (
            <div className="field-search">
              <Search className="w-4 h-4" />
              <input
                type="text"
                placeholder="Search fields..."
                value={searchTerm}
                onChange={(e) => setSearchTerm(e.target.value)}
                className="field-search-input"
              />
            </div>
          )}
          
          <div className="field-list">
            {filteredFields.map(field => (
              <FieldDropdownOption
                key={field.name}
                field={field}
                onClick={() => {
                  onFieldSelect(field);
                  setIsOpen(false);
                  setSearchTerm('');
                }}
              />
            ))}
          </div>
        </div>
      )}
    </div>
  );
}

function FieldDropdownOption({ field, onClick }: FieldDropdownOptionProps) {
  return (
    <div 
      className="field-dropdown-option"
      onClick={onClick}
      role="button"
      tabIndex={0}
    >
      <div className="field-main">
        <span className="field-name">{field.displayName || field.name}</span>
        <span className="field-type">{field.type}</span>
      </div>
      
      {field.description && (
        <div className="field-description">{field.description}</div>
      )}
      
      <div className="field-insert-preview">
        Insert: <code>{`{${field.name}}`}</code>
      </div>
    </div>
  );
}

function OperatorDropdownSelector({ 
  operators, 
  onOperatorSelect 
}: OperatorDropdownSelectorProps) {
  const operatorGroups = [
    {
      name: 'Arithmetic',
      operators: operators.filter(op => ['+', '-', '*', '/', '%', '^'].includes(op.symbol))
    },
    {
      name: 'Grouping', 
      operators: operators.filter(op => ['(', ')'].includes(op.symbol))
    }
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Calculator className="w-4 h-4 mr-2" />
          Operators
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="operator-dropdown">
        {operatorGroups.map(group => (
          <div key={group.name} className="operator-group">
            <h4 className="operator-group-title">{group.name}</h4>
            <div className="operator-grid">
              {group.operators.map(op => (
                <button
                  key={op.symbol}
                  className="operator-button"
                  onClick={() => onOperatorSelect(op.symbol)}
                  title={`${op.name}: ${op.example}`}
                >
                  <span className="operator-symbol">{op.symbol}</span>
                  <span className="operator-name">{op.name}</span>
                </button>
              ))}
            </div>
          </div>
        ))}
      </PopoverContent>
    </Popover>
  );
}

function FunctionDropdownSelector({ 
  functions, 
  onFunctionSelect 
}: FunctionDropdownSelectorProps) {
  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Function className="w-4 h-4 mr-2" />
          Functions
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="function-dropdown">
        <div className="function-list">
          {functions.map(func => (
            <div
              key={func.name}
              className="function-item"
              onClick={() => onFunctionSelect(func)}
            >
              <div className="function-header">
                <span className="function-name">{func.name}</span>
                <span className="function-params">(...)</span>
              </div>
              
              <div className="function-description">{func.description}</div>
              
              <div className="function-example">
                <code>{func.example}</code>
              </div>
            </div>
          ))}
        </div>
      </PopoverContent>
    </Popover>
  );
}
```

### **Formula Validation Panel**

```tsx
function FormulaValidationPanel({ validation }: FormulaValidationPanelProps) {
  if (!validation) return null;

  return (
    <div className={`validation-panel ${validation.isValid ? 'valid' : 'invalid'}`}>
      <div className="validation-header">
        {validation.isValid ? (
          <div className="validation-success">
            <CheckCircle className="w-4 h-4 text-green-600" />
            <span>Formula is valid</span>
          </div>
        ) : (
          <div className="validation-error">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>Formula has errors</span>
          </div>
        )}
      </div>

      {validation.errors.length > 0 && (
        <div className="validation-errors">
          {validation.errors.map((error, index) => (
            <div key={index} className="error-item">
              <AlertTriangle className="w-3 h-3 text-red-500" />
              <span>{error.message}</span>
              {error.suggestion && (
                <Button 
                  size="xs" 
                  variant="outline"
                  onClick={() => applySuggestion(error.suggestion)}
                >
                  Fix
                </Button>
              )}
            </div>
          ))}
        </div>
      )}

      {validation.warnings.length > 0 && (
        <div className="validation-warnings">
          {validation.warnings.map((warning, index) => (
            <div key={index} className="warning-item">
              <AlertTriangle className="w-3 h-3 text-yellow-500" />
              <span>{warning}</span>
            </div>
          ))}
        </div>
      )}

      {validation.dependencies.length > 0 && (
        <div className="formula-dependencies">
          <h4>This formula depends on:</h4>
          <div className="dependency-list">
            {validation.dependencies.map(dep => (
              <span key={dep} className="dependency-tag">
                {dep}
              </span>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

### **Formula Preview Panel**

```tsx
function FormulaPreviewPanel({ preview }: FormulaPreviewPanelProps) {
  if (!preview) return null;

  return (
    <div className="preview-panel">
      <div className="preview-header">
        <h4>Live Preview</h4>
        <Button 
          size="xs" 
          variant="outline"
          onClick={refreshPreview}
        >
          <RefreshCw className="w-3 h-3" />
          Refresh
        </Button>
      </div>

      <div className="preview-content">
        {preview.isLoading ? (
          <div className="preview-loading">
            <Loader className="w-4 h-4 animate-spin" />
            <span>Calculating...</span>
          </div>
        ) : preview.error ? (
          <div className="preview-error">
            <AlertCircle className="w-4 h-4 text-red-600" />
            <span>{preview.error}</span>
          </div>
        ) : (
          <div className="preview-result">
            <div className="result-value">
              Result: <span className="font-mono text-lg">{preview.result}</span>
            </div>
            <div className="result-details">
              <span>Computed in {preview.computationTime}ms</span>
              <span>Using {preview.sampleData.length} sample records</span>
            </div>
          </div>
        )}
      </div>

      {preview.sampleCalculations && (
        <div className="sample-calculations">
          <h5>Sample Calculations:</h5>
          <div className="calculation-examples">
            {preview.sampleCalculations.slice(0, 3).map((calc, index) => (
              <div key={index} className="calculation-example">
                <div className="calculation-input">
                  {Object.entries(calc.inputs).map(([field, value]) => (
                    <span key={field}>{field}: {value}</span>
                  ))}
                </div>
                <div className="calculation-arrow">→</div>
                <div className="calculation-output">{calc.result}</div>
              </div>
            ))}
          </div>
        </div>
      )}
    </div>
  );
}
```

## 📱 **Mobile-Responsive Design**

### **Mobile Smart Formula Editor**

```tsx
function MobileSmartFormulaEditor({ ...props }: FormulaEditorProps) {
  const [showHelpers, setShowHelpers] = useState(false);
  const [activeHelper, setActiveHelper] = useState<'fields' | 'operators' | 'functions' | null>(null);

  return (
    <div className="mobile-smart-formula-editor">
      {/* Main Formula Input - Full Width */}
      <div className="mobile-formula-input">
        <SmartFormulaInput
          value={formula}
          onChange={onChange}
          availableFields={availableFields}
          placeholder="Type formula: {field} * {field2}"
          className="mobile-textarea"
        />
      </div>

      {/* Helper Buttons Row */}
      <div className="mobile-helper-buttons">
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => toggleHelper('fields')}
          className={activeHelper === 'fields' ? 'active' : ''}
        >
          <Database className="w-4 h-4 mr-1" />
          Fields
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => toggleHelper('operators')}
          className={activeHelper === 'operators' ? 'active' : ''}
        >
          <Calculator className="w-4 h-4 mr-1" />
          Ops
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => toggleHelper('functions')}
          className={activeHelper === 'functions' ? 'active' : ''}
        >
          <Function className="w-4 h-4 mr-1" />
          Func
        </Button>
        
        <Button 
          variant="outline" 
          size="sm"
          onClick={() => toggleHelper('templates')}
          className={activeHelper === 'templates' ? 'active' : ''}
        >
          <Template className="w-4 h-4 mr-1" />
          Templates
        </Button>
      </div>

      {/* Collapsible Helper Panel */}
      {activeHelper && (
        <div className="mobile-helper-panel">
          {activeHelper === 'fields' && (
            <MobileFieldList 
              fields={availableFields} 
              onSelect={insertField}
            />
          )}
          {activeHelper === 'operators' && (
            <MobileOperatorGrid onSelect={insertOperator} />
          )}
          {activeHelper === 'functions' && (
            <MobileFunctionList onSelect={insertFunction} />
          )}
          {activeHelper === 'templates' && (
            <MobileTemplateList onSelect={insertTemplate} />
          )}
        </div>
      )}

      {/* Compact Validation */}
      <div className="mobile-validation">
        {validation && <CompactValidationDisplay validation={validation} />}
      </div>
    </div>
  );
}

function MobileFieldList({ fields, onSelect }: MobileFieldListProps) {
  const [searchTerm, setSearchTerm] = useState('');
  
  const filteredFields = fields.filter(field =>
    field.name.toLowerCase().includes(searchTerm.toLowerCase())
  );

  return (
    <div className="mobile-field-list">
      <input
        type="text"
        placeholder="Search fields..."
        value={searchTerm}
        onChange={(e) => setSearchTerm(e.target.value)}
        className="mobile-search-input"
      />
      
      <div className="mobile-field-items">
        {filteredFields.map(field => (
          <button
            key={field.name}
            className="mobile-field-item"
            onClick={() => onSelect(field)}
          >
            <span className="field-name">{field.displayName || field.name}</span>
            <span className="field-type">{field.type}</span>
          </button>
        ))}
      </div>
    </div>
  );
}

function MobileOperatorGrid({ onSelect }: MobileOperatorGridProps) {
  const operators = [
    { symbol: '+', name: 'Add' },
    { symbol: '-', name: 'Subtract' },
    { symbol: '*', name: 'Multiply' },
    { symbol: '/', name: 'Divide' },
    { symbol: '%', name: 'Modulo' },
    { symbol: '^', name: 'Power' },
    { symbol: '(', name: 'Open' },
    { symbol: ')', name: 'Close' }
  ];

  return (
    <div className="mobile-operator-grid">
      {operators.map(op => (
        <button
          key={op.symbol}
          className="mobile-operator-button"
          onClick={() => onSelect(op.symbol)}
        >
          <span className="operator-symbol">{op.symbol}</span>
          <span className="operator-name">{op.name}</span>
        </button>
      ))}
    </div>
  );
}
```

## 🎯 **User Experience Flows**

### **Flow 1: Simple Formula with Type-Ahead**

```
1. User clicks "Add Computed Field"
2. Names field: "Total Cost"
3. Smart formula builder opens with text input
4. User types: "{unit" - auto-complete dropdown appears
5. User selects "unit_price" from dropdown or presses Tab
6. User types " * " - operator is recognized and highlighted
7. User types "{qu" - field suggestions appear
8. User selects "quantity" from suggestions
9. Final formula: "{unit_price} * {quantity}"
10. Live preview shows: "Sample result: $150.00"
11. User clicks "Save Formula"
12. Field is created and appears in entity schema
```

### **Flow 2: Complex Business Logic with Dropdown Helpers**

```
1. Power user switches to "Advanced Editor" mode
2. User starts typing: "({rev" - field suggestions appear
3. Selects "revenue" from dropdown, continues typing
4. Uses operator dropdown to insert " - " and " / " operators
5. Final formula: "({revenue} - {costs}) / {revenue} * 100"
6. Real-time syntax highlighting shows field references in blue
7. Validation shows: "✓ Valid formula. Dependencies: revenue, costs"
8. Preview shows: "Sample result: 30% (profit margin)"
9. User adds description: "Calculates profit margin percentage"
10. Sets return type to "decimal" for precision
11. Saves formula
```

### **Flow 3: Error Correction with Smart Suggestions**

```
1. User types formula: "{price} * {quanitty}" (typo)
2. Red underline appears under "quanitty" in real-time
3. Validation panel shows: "❌ Field 'quanitty' not found"
4. Smart suggestion appears: "Did you mean 'quantity'?"
5. User clicks "Fix" button or presses suggested auto-complete
6. Formula auto-corrects to: "{price} * {quantity}"
7. Syntax highlighting turns field references blue
8. Validation shows: "✓ Valid formula"
9. User proceeds to save
```

## 🔧 **Advanced Features**

### **Formula Templates with Quick Insert**

```tsx
function FormulaTemplateDropdown({ 
  entityType, 
  onTemplateSelect 
}: TemplateDropdownProps) {
  const templates = [
    {
      category: 'Basic Math',
      templates: [
        {
          name: 'Total Price',
          formula: '{unit_price} * {quantity}',
          description: 'Calculate total price from unit price and quantity'
        },
        {
          name: 'Percentage',
          formula: '{part} / {whole} * 100',
          description: 'Calculate percentage'
        },
        {
          name: 'Average',
          formula: '({value1} + {value2}) / 2',
          description: 'Calculate average of two values'
        }
      ]
    },
    {
      category: 'Business',
      templates: [
        {
          name: 'Profit Margin',
          formula: '({revenue} - {cost}) / {revenue} * 100',
          description: 'Calculate profit margin percentage'
        },
        {
          name: 'Markup',
          formula: '{cost} * (1 + {markup_rate})',
          description: 'Apply markup to cost'
        },
        {
          name: 'Discount Price',
          formula: '{original_price} * (1 - {discount_rate})',
          description: 'Apply discount to original price'
        }
      ]
    }
  ];

  return (
    <Popover>
      <PopoverTrigger asChild>
        <Button variant="outline">
          <Template className="w-4 h-4 mr-2" />
          Templates
        </Button>
      </PopoverTrigger>
      
      <PopoverContent className="template-dropdown">
        <Accordion type="single" collapsible>
          {templates.map(category => (
            <AccordionItem key={category.category} value={category.category}>
              <AccordionTrigger>{category.category}</AccordionTrigger>
              <AccordionContent>
                <div className="template-list">
                  {category.templates.map(template => (
                    <div
                      key={template.name}
                      className="template-item"
                      onClick={() => onTemplateSelect(template)}
                    >
                      <div className="template-name">{template.name}</div>
                      <div className="template-formula">
                        <code>{template.formula}</code>
                      </div>
                      <div className="template-description">
                        {template.description}
                      </div>
                    </div>
                  ))}
                </div>
              </AccordionContent>
            </AccordionItem>
          ))}
        </Accordion>
      </PopoverContent>
    </Popover>
  );
}
```

### **Dependency Visualization**

```tsx
function DependencyVisualization({ fieldName, dependencies }: DependencyVisualizationProps) {
  return (
    <div className="dependency-visualization">
      <h4>Field Dependencies</h4>
      <div className="dependency-graph">
        <svg width="400" height="300">
          {/* Render dependency graph with D3 or similar */}
          <DependencyGraph
            centerField={fieldName}
            dependencies={dependencies}
            onFieldClick={navigateToField}
          />
        </svg>
      </div>
      
      <div className="dependency-details">
        <h5>Direct Dependencies:</h5>
        <ul>
          {dependencies.direct.map(dep => (
            <li key={dep}>{dep}</li>
          ))}
        </ul>
        
        <h5>Fields that depend on this:</h5>
        <ul>
          {dependencies.dependents.map(dep => (
            <li key={dep}>{dep}</li>
          ))}
        </ul>
      </div>
    </div>
  );
}
```

### **Formula Performance Monitor**

```tsx
function FormulaPerformanceMonitor({ fieldName }: FormulaPerformanceMonitorProps) {
  const [metrics, setMetrics] = useState<PerformanceMetrics | null>(null);

  return (
    <div className="performance-monitor">
      <h4>Performance Metrics</h4>
      
      {metrics && (
        <div className="metrics-grid">
          <div className="metric">
            <span className="metric-label">Average Computation Time</span>
            <span className="metric-value">{metrics.averageTime}ms</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Cache Hit Rate</span>
            <span className="metric-value">{metrics.cacheHitRate}%</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Total Computations</span>
            <span className="metric-value">{metrics.totalComputations}</span>
          </div>
          
          <div className="metric">
            <span className="metric-label">Dependencies</span>
            <span className="metric-value">{metrics.dependencyCount}</span>
          </div>
        </div>
      )}
      
      <div className="performance-recommendations">
        {metrics?.recommendations.map((rec, index) => (
          <div key={index} className="recommendation">
            <LightBulb className="w-4 h-4" />
            <span>{rec}</span>
          </div>
        ))}
      </div>
    </div>
  );
}
```

## 📚 **Help & Documentation**

### **Contextual Help System**

```tsx
function ContextualHelpSystem({ currentContext, formula }: ContextualHelpProps) {
  const [helpVisible, setHelpVisible] = useState(false);
  const [helpContent, setHelpContent] = useState<HelpContent | null>(null);

  const getContextualHelp = (context: string) => {
    switch (context) {
      case 'field_selection':
        return {
          title: 'Selecting Fields',
          content: 'Click on any numeric field to add it to your formula. Only number, decimal, and integer fields can be used in calculations.',
          examples: ['{unitPrice}', '{quantity}', '{discount}']
        };
      
      case 'operators':
        return {
          title: 'Mathematical Operators',
          content: 'Use these operators to perform calculations between fields and numbers.',
          examples: [
            '+ (addition): {a} + {b}',
            '* (multiplication): {price} * {quantity}',
            '/ (division): {total} / {count}'
          ]
        };
      
      case 'functions':
        return {
          title: 'Mathematical Functions',
          content: 'Built-in functions for advanced calculations.',
          examples: [
            'min({a}, {b}) - returns smaller value',
            'max({a}, {b}) - returns larger value',
            'round({value}) - rounds to nearest integer'
          ]
        };
    }
  };

  return (
    <div className="contextual-help">
      <Button
        variant="ghost"
        size="sm"
        onClick={() => setHelpVisible(!helpVisible)}
      >
        <HelpCircle className="w-4 h-4" />
      </Button>

      {helpVisible && helpContent && (
        <div className="help-popover">
          <div className="help-header">
            <h4>{helpContent.title}</h4>
            <Button size="xs" variant="ghost" onClick={() => setHelpVisible(false)}>
              <X className="w-3 h-3" />
            </Button>
          </div>
          
          <div className="help-content">
            <p>{helpContent.content}</p>
            
            {helpContent.examples && (
              <div className="help-examples">
                <h5>Examples:</h5>
                <ul>
                  {helpContent.examples.map((example, index) => (
                    <li key={index} className="example">
                      <code>{example}</code>
                    </li>
                  ))}
                </ul>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
```

---

*This UI/UX design provides an intuitive, progressive formula creation experience that caters to users of all technical levels while maintaining power and flexibility for advanced use cases.*