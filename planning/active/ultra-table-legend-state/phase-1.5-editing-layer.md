# Phase 1.5: Advanced Editing Layer (React Portal + Shadcn)

## Overview

Comprehensive in-cell editing system using React Portals and full Shadcn component library. Zero impact on table performance through portal-based rendering outside the React tree.

## Features to Implement

### 1.1 Portal-Based Editor Architecture

**Current**: Basic input overlay
**Target**: Professional editing experience with all Shadcn components

```typescript
// Enhanced editing state
const editingState$ = observable({
  // Active editor
  activeEditor: null as {
    rowIndex: number
    columnIndex: number
    field: string
    type: 'string' | 'number' | 'date' | 'boolean' | 'select' | 'multiselect' | 'rich-text'
    value: any
    originalValue: any
    position: { top: number; left: number; width: number; height: number }
    options?: any[] // For select/multiselect
  } | null,
  
  // Editor behavior
  behavior: {
    autoFocus: true,
    selectAllOnFocus: true,
    submitOnEnter: true,
    submitOnTab: true,
    submitOnClickOutside: true,
    allowMultiline: false
  },
  
  // Validation state
  validation: {
    isValid: true,
    errors: [] as string[],
    warnings: [] as string[]
  },
  
  // Editor history for this session
  history: [] as Array<{
    rowIndex: number
    columnIndex: number
    field: string
    oldValue: any
    newValue: any
    timestamp: number
  }>
})

// Enhanced editor component with full Shadcn support
function UltraTableAdvancedEditor() {
  const editor = editingState$.activeEditor.use()
  
  if (!editor) return null
  
  return createPortal(
    <EditorPortalContainer
      position={editor.position}
      onComplete={(value) => completeEdit(value)}
      onCancel={() => cancelEdit()}
    >
      <EditorByType {...editor} />
    </EditorPortalContainer>,
    document.body
  )
}

function EditorPortalContainer({ 
  position, 
  children, 
  onComplete, 
  onCancel 
}: {
  position: { top: number; left: number; width: number; height: number }
  children: React.ReactNode
  onComplete: (value: any) => void
  onCancel: () => void
}) {
  const containerRef = useRef<HTMLDivElement>(null)
  
  // Handle click outside
  useEffect(() => {
    const handleClickOutside = (e: MouseEvent) => {
      if (containerRef.current && !containerRef.current.contains(e.target as Node)) {
        const behavior = editingState$.behavior.get()
        if (behavior.submitOnClickOutside) {
          onComplete(editingState$.activeEditor.value.get())
        } else {
          onCancel()
        }
      }
    }
    
    document.addEventListener('mousedown', handleClickOutside)
    return () => document.removeEventListener('mousedown', handleClickOutside)
  }, [onComplete, onCancel])
  
  // Global keyboard handling
  useEffect(() => {
    const handleKeyDown = (e: KeyboardEvent) => {
      const behavior = editingState$.behavior.get()
      
      switch (e.key) {
        case 'Escape':
          e.preventDefault()
          onCancel()
          break
          
        case 'Enter':
          if (!e.shiftKey || !behavior.allowMultiline) {
            e.preventDefault()
            onComplete(editingState$.activeEditor.value.get())
          }
          break
          
        case 'Tab':
          if (behavior.submitOnTab) {
            e.preventDefault()
            onComplete(editingState$.activeEditor.value.get())
          }
          break
      }
    }
    
    document.addEventListener('keydown', handleKeyDown)
    return () => document.removeEventListener('keydown', handleKeyDown)
  }, [onComplete, onCancel])
  
  return (
    <div
      ref={containerRef}
      className="absolute z-[9999] bg-background shadow-lg border-2 border-primary rounded-md"
      style={{
        top: position.top,
        left: position.left,
        minWidth: Math.max(position.width, 200),
        minHeight: position.height
      }}
    >
      {children}
    </div>
  )
}
```

### 1.2 Comprehensive Editor Types

**Current**: Basic text input
**Target**: Full Shadcn component suite for every data type

```typescript
// Editor component router
function EditorByType(editor: NonNullable<typeof editingState$.activeEditor>) {
  const { type, value, field, options } = editor
  
  switch (type) {
    case 'string':
      return <StringEditor value={value} field={field} />
      
    case 'number':
      return <NumberEditor value={value} field={field} />
      
    case 'date':
      return <DateEditor value={value} field={field} />
      
    case 'boolean':
      return <BooleanEditor value={value} field={field} />
      
    case 'select':
      return <SelectEditor value={value} field={field} options={options} />
      
    case 'multiselect':
      return <MultiSelectEditor value={value} field={field} options={options} />
      
    case 'rich-text':
      return <RichTextEditor value={value} field={field} />
      
    default:
      return <StringEditor value={value} field={field} />
  }
}

// String editor with enhanced Input
function StringEditor({ value, field }: { value: any; field: string }) {
  const [editValue, setEditValue] = useState(String(value || ''))
  const inputRef = useRef<HTMLInputElement>(null)
  
  // Auto-focus and select
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      
      const behavior = editingState$.behavior.get()
      if (behavior.selectAllOnFocus) {
        inputRef.current.select()
      }
    }
  }, [])
  
  // Update editing state
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-2">
      <Input
        ref={inputRef}
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        placeholder={`Enter ${field}...`}
        className="border-0 shadow-none focus-visible:ring-0 p-0"
      />
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}

// Number editor with enhanced numeric input
function NumberEditor({ value, field }: { value: any; field: string }) {
  const [editValue, setEditValue] = useState(value || 0)
  const inputRef = useRef<HTMLInputElement>(null)
  
  useEffect(() => {
    if (inputRef.current) {
      inputRef.current.focus()
      inputRef.current.select()
    }
  }, [])
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-2">
      <Input
        ref={inputRef}
        type="number"
        value={editValue}
        onChange={(e) => setEditValue(parseFloat(e.target.value) || 0)}
        placeholder={`Enter ${field}...`}
        className="border-0 shadow-none focus-visible:ring-0 p-0"
        step="any"
      />
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}

// Date editor with DatePicker
function DateEditor({ value, field }: { value: any; field: string }) {
  const [editValue, setEditValue] = useState<Date | undefined>(
    value instanceof Date ? value : value ? new Date(value) : undefined
  )
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-2">
      <Popover open={true}>
        <PopoverContent className="w-auto p-0" align="start">
          <Calendar
            mode="single"
            selected={editValue}
            onSelect={setEditValue}
            autoFocus
            initialFocus
          />
          <div className="p-3 border-t">
            <Input
              type="time"
              value={editValue ? editValue.toTimeString().slice(0, 5) : ''}
              onChange={(e) => {
                if (editValue && e.target.value) {
                  const [hours, minutes] = e.target.value.split(':')
                  const newDate = new Date(editValue)
                  newDate.setHours(parseInt(hours), parseInt(minutes))
                  setEditValue(newDate)
                }
              }}
              className="text-sm"
            />
          </div>
        </PopoverContent>
      </Popover>
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}

// Boolean editor with enhanced Checkbox/Switch
function BooleanEditor({ value, field }: { value: any; field: string }) {
  const [editValue, setEditValue] = useState(Boolean(value))
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-3 flex items-center justify-center space-x-3">
      <Switch
        checked={editValue}
        onCheckedChange={setEditValue}
        autoFocus
      />
      <Label className="text-sm font-medium">
        {editValue ? 'Yes' : 'No'}
      </Label>
    </div>
  )
}

// Select editor with Combobox
function SelectEditor({ 
  value, 
  field, 
  options = [] 
}: { 
  value: any
  field: string
  options: Array<{ label: string; value: any }> 
}) {
  const [editValue, setEditValue] = useState(value)
  const [open, setOpen] = useState(true)
  const [search, setSearch] = useState('')
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-2">
      <Popover open={open} onOpenChange={setOpen}>
        <PopoverTrigger asChild>
          <Button
            variant="outline"
            role="combobox"
            aria-expanded={open}
            className="w-full justify-between border-0 shadow-none"
            autoFocus
          >
            {editValue ? 
              options.find(opt => opt.value === editValue)?.label : 
              `Select ${field}...`
            }
            <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
          </Button>
        </PopoverTrigger>
        <PopoverContent className="w-full p-0">
          <Command>
            <CommandInput 
              placeholder={`Search ${field}...`}
              value={search}
              onValueChange={setSearch}
            />
            <CommandEmpty>No {field} found.</CommandEmpty>
            <CommandGroup className="max-h-60 overflow-auto">
              {filteredOptions.map((option) => (
                <CommandItem
                  key={option.value}
                  value={option.value}
                  onSelect={() => {
                    setEditValue(option.value)
                    setOpen(false)
                  }}
                >
                  <Check
                    className={cn(
                      "mr-2 h-4 w-4",
                      editValue === option.value ? "opacity-100" : "opacity-0"
                    )}
                  />
                  {option.label}
                </CommandItem>
              ))}
            </CommandGroup>
          </Command>
        </PopoverContent>
      </Popover>
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}

// Multi-select editor with enhanced selection
function MultiSelectEditor({ 
  value = [], 
  field, 
  options = [] 
}: { 
  value: any[]
  field: string
  options: Array<{ label: string; value: any }> 
}) {
  const [editValue, setEditValue] = useState<any[]>(Array.isArray(value) ? value : [])
  const [search, setSearch] = useState('')
  
  const filteredOptions = options.filter(option =>
    option.label.toLowerCase().includes(search.toLowerCase())
  )
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  const toggleOption = (optionValue: any) => {
    setEditValue(prev => 
      prev.includes(optionValue) 
        ? prev.filter(v => v !== optionValue)
        : [...prev, optionValue]
    )
  }
  
  return (
    <div className="p-2 min-w-80">
      {/* Selected items display */}
      <div className="mb-3">
        <div className="flex flex-wrap gap-1 mb-2">
          {editValue.map(selectedValue => {
            const option = options.find(opt => opt.value === selectedValue)
            return option ? (
              <Badge key={selectedValue} variant="secondary" className="text-xs">
                {option.label}
                <button
                  onClick={() => toggleOption(selectedValue)}
                  className="ml-1 hover:text-destructive"
                >
                  ×
                </button>
              </Badge>
            ) : null
          })}
        </div>
      </div>
      
      {/* Search and options */}
      <div className="space-y-2">
        <Input
          placeholder={`Search ${field}...`}
          value={search}
          onChange={(e) => setSearch(e.target.value)}
          autoFocus
        />
        
        <div className="max-h-40 overflow-auto border rounded">
          {filteredOptions.map(option => (
            <div
              key={option.value}
              className="flex items-center space-x-2 p-2 hover:bg-muted cursor-pointer"
              onClick={() => toggleOption(option.value)}
            >
              <Checkbox
                checked={editValue.includes(option.value)}
                onChange={() => toggleOption(option.value)}
              />
              <span className="text-sm">{option.label}</span>
            </div>
          ))}
        </div>
      </div>
      
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}

// Rich text editor with advanced formatting
function RichTextEditor({ value, field }: { value: any; field: string }) {
  const [editValue, setEditValue] = useState(String(value || ''))
  const [isFormatting, setIsFormatting] = useState(false)
  
  useEffect(() => {
    editingState$.activeEditor.value.set(editValue)
  }, [editValue])
  
  return (
    <div className="p-2 min-w-96">
      {/* Formatting toolbar */}
      <div className="flex items-center gap-1 mb-2 pb-2 border-b">
        <ToggleGroup type="multiple" size="sm">
          <ToggleGroupItem value="bold" aria-label="Bold">
            <Bold className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="italic" aria-label="Italic">
            <Italic className="h-4 w-4" />
          </ToggleGroupItem>
          <ToggleGroupItem value="underline" aria-label="Underline">
            <Underline className="h-4 w-4" />
          </ToggleGroupItem>
        </ToggleGroup>
        
        <Separator orientation="vertical" className="h-6" />
        
        <Select defaultValue="paragraph">
          <SelectTrigger className="w-32 h-8">
            <SelectValue />
          </SelectTrigger>
          <SelectContent>
            <SelectItem value="paragraph">Paragraph</SelectItem>
            <SelectItem value="h1">Heading 1</SelectItem>
            <SelectItem value="h2">Heading 2</SelectItem>
            <SelectItem value="h3">Heading 3</SelectItem>
          </SelectContent>
        </Select>
      </div>
      
      {/* Rich text area */}
      <Textarea
        value={editValue}
        onChange={(e) => setEditValue(e.target.value)}
        placeholder={`Enter ${field}...`}
        className="min-h-32 resize-none border-0 shadow-none focus-visible:ring-0"
        autoFocus
      />
      
      {/* Character count */}
      <div className="flex justify-between items-center mt-2 text-xs text-muted-foreground">
        <span>{editValue.length} characters</span>
        <div className="space-x-2">
          <Button size="sm" variant="ghost" onClick={() => setEditValue('')}>
            Clear
          </Button>
        </div>
      </div>
      
      <ValidationMessages field={field} value={editValue} />
    </div>
  )
}
```

### 1.3 Advanced Form Components Integration

**Current**: No form validation
**Target**: Full form component integration with validation

```typescript
// Form-based editor for complex data types
function FormBasedEditor({ 
  rowIndex, 
  columnIndex, 
  rowData 
}: { 
  rowIndex: number
  columnIndex: number
  rowData: any 
}) {
  const columns = tableColumns$.use()
  const [formData, setFormData] = useState(rowData)
  const [errors, setErrors] = useState<Record<string, string>>({})
  
  // Form validation with Zod integration
  const validateForm = () => {
    const newErrors: Record<string, string> = {}
    
    columns.forEach(column => {
      const value = formData[column.field]
      
      // Type validation
      switch (column.type) {
        case 'number':
          if (isNaN(Number(value))) {
            newErrors[column.field] = 'Must be a valid number'
          }
          break
          
        case 'email':
          if (value && !/\S+@\S+\.\S+/.test(value)) {
            newErrors[column.field] = 'Must be a valid email'
          }
          break
          
        case 'url':
          if (value && !/^https?:\/\/.+/.test(value)) {
            newErrors[column.field] = 'Must be a valid URL'
          }
          break
      }
      
      // Required field validation
      if (column.required && (!value || value === '')) {
        newErrors[column.field] = 'This field is required'
      }
    })
    
    setErrors(newErrors)
    return Object.keys(newErrors).length === 0
  }
  
  const handleSubmit = () => {
    if (validateForm()) {
      // Update entire row with batch
      batch(() => {
        Object.entries(formData).forEach(([field, value]) => {
          ultraTableState$.data[rowIndex][field].set(value)
        })
      })
      
      cancelEdit()
    }
  }
  
  return (
    <div className="p-4 min-w-96 max-w-2xl">
      <div className="mb-4">
        <h3 className="font-semibold">Edit Row {rowIndex + 1}</h3>
        <p className="text-sm text-muted-foreground">
          Edit multiple fields for this row
        </p>
      </div>
      
      <div className="space-y-4 max-h-96 overflow-auto">
        {columns.map(column => (
          <div key={column.field} className="space-y-2">
            <Label htmlFor={column.field} className="text-sm font-medium">
              {column.header}
              {column.required && <span className="text-destructive ml-1">*</span>}
            </Label>
            
            <FormFieldByType
              column={column}
              value={formData[column.field]}
              onChange={(value) => setFormData(prev => ({ ...prev, [column.field]: value }))}
              error={errors[column.field]}
            />
          </div>
        ))}
      </div>
      
      {/* Form actions */}
      <div className="flex justify-end gap-2 mt-6 pt-4 border-t">
        <Button variant="outline" onClick={cancelEdit}>
          Cancel
        </Button>
        <Button onClick={handleSubmit} disabled={Object.keys(errors).length > 0}>
          Update Row
        </Button>
      </div>
    </div>
  )
}

// Dynamic form field component
function FormFieldByType({ 
  column, 
  value, 
  onChange, 
  error 
}: {
  column: any
  value: any
  onChange: (value: any) => void
  error?: string
}) {
  switch (column.type) {
    case 'select':
      return (
        <Select value={value} onValueChange={onChange}>
          <SelectTrigger className={cn(error && 'border-destructive')}>
            <SelectValue placeholder={`Select ${column.header.toLowerCase()}...`} />
          </SelectTrigger>
          <SelectContent>
            {column.options?.map((option: any) => (
              <SelectItem key={option.value} value={option.value}>
                {option.label}
              </SelectItem>
            ))}
          </SelectContent>
        </Select>
      )
      
    case 'multiselect':
      return (
        <MultiSelectField
          value={value}
          onChange={onChange}
          options={column.options || []}
          placeholder={`Select ${column.header.toLowerCase()}...`}
          error={error}
        />
      )
      
    case 'textarea':
      return (
        <Textarea
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${column.header.toLowerCase()}...`}
          className={cn(error && 'border-destructive')}
          rows={3}
        />
      )
      
    case 'number':
      return (
        <Input
          type="number"
          value={value}
          onChange={(e) => onChange(parseFloat(e.target.value))}
          placeholder={`Enter ${column.header.toLowerCase()}...`}
          className={cn(error && 'border-destructive')}
        />
      )
      
    case 'date':
      return (
        <DatePickerField
          value={value}
          onChange={onChange}
          error={error}
        />
      )
      
    case 'boolean':
      return (
        <div className="flex items-center space-x-2">
          <Checkbox
            checked={Boolean(value)}
            onCheckedChange={onChange}
          />
          <Label className="text-sm">{column.header}</Label>
        </div>
      )
      
    default:
      return (
        <Input
          value={value}
          onChange={(e) => onChange(e.target.value)}
          placeholder={`Enter ${column.header.toLowerCase()}...`}
          className={cn(error && 'border-destructive')}
        />
      )
  }
}
```

### 1.4 Context Menu Integration

**Current**: No context menu
**Target**: Right-click context menu with Shadcn components

```typescript
// Context menu state
const contextMenu$ = observable({
  isOpen: false,
  position: { x: 0, y: 0 },
  target: null as {
    type: 'cell' | 'row' | 'column' | 'selection'
    rowIndex?: number
    columnIndex?: number
    field?: string
  } | null,
  items: [] as ContextMenuItem[]
})

interface ContextMenuItem {
  id: string
  label: string
  icon?: React.ComponentType<{ className?: string }>
  action: () => void
  disabled?: boolean
  separator?: boolean
  submenu?: ContextMenuItem[]
}

// Context menu component
function TableContextMenu() {
  const menu = contextMenu$.use()
  
  if (!menu.isOpen || !menu.target) return null
  
  return createPortal(
    <ContextMenu open={menu.isOpen}>
      <ContextMenuContent 
        className="w-64"
        style={{
          position: 'fixed',
          left: menu.position.x,
          top: menu.position.y
        }}
      >
        {menu.items.map((item, index) => (
          <React.Fragment key={item.id}>
            {item.separator && <ContextMenuSeparator />}
            
            {item.submenu ? (
              <ContextMenuSub>
                <ContextMenuSubTrigger>
                  {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                  {item.label}
                </ContextMenuSubTrigger>
                <ContextMenuSubContent>
                  {item.submenu.map(subItem => (
                    <ContextMenuItem
                      key={subItem.id}
                      onClick={subItem.action}
                      disabled={subItem.disabled}
                    >
                      {subItem.icon && <subItem.icon className="mr-2 h-4 w-4" />}
                      {subItem.label}
                    </ContextMenuItem>
                  ))}
                </ContextMenuSubContent>
              </ContextMenuSub>
            ) : (
              <ContextMenuItem
                onClick={() => {
                  item.action()
                  contextMenu$.isOpen.set(false)
                }}
                disabled={item.disabled}
              >
                {item.icon && <item.icon className="mr-2 h-4 w-4" />}
                {item.label}
                {item.id === 'copy' && <ContextMenuShortcut>Ctrl+C</ContextMenuShortcut>}
                {item.id === 'paste' && <ContextMenuShortcut>Ctrl+V</ContextMenuShortcut>}
                {item.id === 'delete' && <ContextMenuShortcut>Del</ContextMenuShortcut>}
              </ContextMenuItem>
            )}
          </React.Fragment>
        ))}
      </ContextMenuContent>
    </ContextMenu>,
    document.body
  )
}

// Context menu items generator
function generateContextMenuItems(target: any): ContextMenuItem[] {
  const items: ContextMenuItem[] = []
  
  switch (target.type) {
    case 'cell':
      items.push(
        {
          id: 'edit',
          label: 'Edit Cell',
          icon: Edit,
          action: () => startCellEdit(target.rowIndex!, target.columnIndex!)
        },
        {
          id: 'copy',
          label: 'Copy',
          icon: Copy,
          action: () => copyCell(target.rowIndex!, target.columnIndex!)
        },
        {
          id: 'paste',
          label: 'Paste',
          icon: Clipboard,
          action: () => pasteToCell(target.rowIndex!, target.columnIndex!),
          disabled: !clipboard$.data.get().length
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'insert',
          label: 'Insert',
          icon: Plus,
          submenu: [
            {
              id: 'insert_row_above',
              label: 'Row Above',
              action: () => insertRow(target.rowIndex!, 'above')
            },
            {
              id: 'insert_row_below', 
              label: 'Row Below',
              action: () => insertRow(target.rowIndex!, 'below')
            },
            {
              id: 'insert_column_left',
              label: 'Column Left',
              action: () => insertColumn(target.columnIndex!, 'left')
            },
            {
              id: 'insert_column_right',
              label: 'Column Right', 
              action: () => insertColumn(target.columnIndex!, 'right')
            }
          ]
        },
        {
          id: 'delete',
          label: 'Delete',
          icon: Trash,
          submenu: [
            {
              id: 'delete_cell',
              label: 'Clear Cell',
              action: () => clearCell(target.rowIndex!, target.columnIndex!)
            },
            {
              id: 'delete_row',
              label: 'Delete Row',
              action: () => deleteRow(target.rowIndex!)
            },
            {
              id: 'delete_column',
              label: 'Delete Column',
              action: () => deleteColumn(target.columnIndex!)
            }
          ]
        },
        { id: 'sep2', label: '', separator: true },
        {
          id: 'format',
          label: 'Format Cell',
          icon: Palette,
          submenu: [
            {
              id: 'format_number',
              label: 'Number',
              action: () => formatCell(target, 'number')
            },
            {
              id: 'format_currency',
              label: 'Currency', 
              action: () => formatCell(target, 'currency')
            },
            {
              id: 'format_percentage',
              label: 'Percentage',
              action: () => formatCell(target, 'percentage')
            },
            {
              id: 'format_date',
              label: 'Date',
              action: () => formatCell(target, 'date')
            }
          ]
        }
      )
      break
      
    case 'selection':
      const selectedCount = selectedCells$.get().size
      items.push(
        {
          id: 'copy_selection',
          label: `Copy ${selectedCount} cells`,
          icon: Copy,
          action: () => copySelectedCells()
        },
        {
          id: 'fill_down',
          label: 'Fill Down',
          icon: ArrowDown,
          action: () => fillDown()
        },
        {
          id: 'fill_right',
          label: 'Fill Right', 
          icon: ArrowRight,
          action: () => fillRight()
        },
        { id: 'sep1', label: '', separator: true },
        {
          id: 'bulk_edit',
          label: 'Bulk Edit',
          icon: Edit,
          action: () => startBulkEdit()
        },
        {
          id: 'clear_selection',
          label: 'Clear Selection',
          icon: X,
          action: () => clearSelectedCells()
        }
      )
      break
  }
  
  return items
}
```

### 1.5 Validation & Error Handling

**Current**: No validation
**Target**: Real-time validation with Shadcn error display

```typescript
// Validation engine with Legend State
const validationEngine$ = observable({
  rules: {} as Record<string, ValidationRule[]>,
  errors: {} as Record<string, string[]>,
  warnings: {} as Record<string, string[]>,
  isValidating: false
})

interface ValidationRule {
  type: 'required' | 'type' | 'range' | 'pattern' | 'custom'
  message: string
  params?: any
  validator?: (value: any) => boolean
}

// Validation component
function ValidationMessages({ 
  field, 
  value 
}: { 
  field: string
  value: any 
}) {
  const errors = validationEngine$.errors[field].use() || []
  const warnings = validationEngine$.warnings[field].use() || []
  
  if (errors.length === 0 && warnings.length === 0) return null
  
  return (
    <div className="mt-2 space-y-1">
      {errors.map((error, index) => (
        <Alert key={`error-${index}`} variant="destructive" className="py-2">
          <AlertCircle className="h-3 w-3" />
          <AlertDescription className="text-xs">{error}</AlertDescription>
        </Alert>
      ))}
      
      {warnings.map((warning, index) => (
        <Alert key={`warning-${index}`} className="py-2 border-yellow-200 bg-yellow-50">
          <AlertTriangle className="h-3 w-3 text-yellow-600" />
          <AlertDescription className="text-xs text-yellow-700">{warning}</AlertDescription>
        </Alert>
      ))}
    </div>
  )
}

// Real-time validation
function validateCellValue(field: string, value: any): { errors: string[]; warnings: string[] } {
  const rules = validationEngine$.rules[field].get() || []
  const errors: string[] = []
  const warnings: string[] = []
  
  rules.forEach(rule => {
    switch (rule.type) {
      case 'required':
        if (!value || value === '') {
          errors.push(rule.message)
        }
        break
        
      case 'type':
        if (!validateType(value, rule.params.type)) {
          errors.push(rule.message)
        }
        break
        
      case 'range':
        if (typeof value === 'number') {
          const { min, max } = rule.params
          if (value < min || value > max) {
            errors.push(rule.message)
          } else if (value < min + (max - min) * 0.1) {
            warnings.push(`Value is close to minimum (${min})`)
          }
        }
        break
        
      case 'pattern':
        if (typeof value === 'string' && !new RegExp(rule.params.pattern).test(value)) {
          errors.push(rule.message)
        }
        break
        
      case 'custom':
        if (rule.validator && !rule.validator(value)) {
          errors.push(rule.message)
        }
        break
    }
  })
  
  return { errors, warnings }
}

// Auto-validation on value change
when(() => editingState$.activeEditor.get(), (editor) => {
  if (editor) {
    // Validate as user types
    const validation = validateCellValue(editor.field, editor.value)
    
    validationEngine$.assign({
      errors: { [editor.field]: validation.errors },
      warnings: { [editor.field]: validation.warnings }
    })
  }
})
```

## Implementation Priority

### High Priority (Week 2)
1. ✅ React Portal editor architecture
2. ✅ All Shadcn input components (Input, Textarea, Select, etc.)
3. ✅ Context menu with comprehensive actions
4. ✅ Form-based multi-field editing

### Medium Priority (Week 3)
1. Rich text editor with formatting toolbar
2. Advanced validation engine
3. Custom editor types and extensions
4. Keyboard shortcut integration

### Lower Priority (Week 4)
1. Editor theming and customization
2. Advanced form layouts
3. Conditional field visibility
4. Integration with external form libraries

## Performance Considerations

### Portal Optimization
- Render editors outside table DOM tree
- No impact on virtualization performance
- Automatic cleanup on editor close
- Position calculation only when needed

### Memory Management
- Destroy editor components immediately on close
- Clear validation state after edit completion
- Reuse editor instances for same field types
- Lazy load complex editors (rich text, etc.)

This editing layer provides a complete professional editing experience using the full Shadcn component library while maintaining optimal table performance through React Portal architecture.