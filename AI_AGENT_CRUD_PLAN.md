# AI Agent Control for CRUD Operations - Architectural Plan

## Executive Summary

This plan outlines the architecture for integrating AI agent control into VibeStack's CRUD operations through a chat interface. The AI agent will be able to understand natural language commands and execute database operations while maintaining full sync capabilities and type safety.

## Current Architecture Analysis

### 1. Domain Services Layer
- **Location**: `/apps/web/src/domain/`
- **Pattern**: Each entity has a dedicated service extending `BaseDomainService`
- **Key Services**: task, project, user, comment, statusDefinition, tag, tagSet, statusSet
- **Features**:
  - Type-safe operations with DataForge entities
  - Automatic sync tracking for UI operations
  - Validation and business logic hooks
  - Batch operations support

### 2. CRUD Operations Flow
```typescript
// Current pattern for UI operations
await domainServices.task.createUI({
  title: 'New Task',
  priority: TaskPriority.HIGH
});

// Updates with validation and sync
await domainServices.task.updateUI(taskId, {
  status: TaskStatus.COMPLETED
});
```

### 3. WebSocket Sync Architecture
- Real-time bidirectional sync via WebSocket
- Change tracking with Dexie
- LSN-based synchronization
- Automatic conflict resolution

## Proposed AI Agent Architecture

### 1. Natural Language Processing Layer

#### A. Intent Recognition Service
```typescript
interface CrudIntent {
  action: 'create' | 'read' | 'update' | 'delete' | 'batch';
  entityType: string;
  filters?: Record<string, any>;
  updates?: Record<string, any>;
  createData?: Record<string, any>;
  batchOperations?: BatchOperation[];
}

class IntentRecognitionService {
  async parseUserMessage(message: string): Promise<CrudIntent> {
    // Use LLM to extract structured intent from natural language
    // Examples:
    // "Create a new task called 'Review PR' with high priority"
    // "Update all tasks in project X to completed"
    // "Delete the comment from yesterday"
  }
}
```

#### B. Entity Context Resolution
```typescript
class EntityContextResolver {
  // Resolve ambiguous references
  async resolveEntityReferences(intent: CrudIntent): Promise<ResolvedIntent> {
    // "the task I created yesterday" -> specific task ID
    // "John's projects" -> project IDs where John is a member
    // "overdue tasks" -> tasks with dueDate < now
  }
}
```

### 2. AI Agent Execution Layer

#### A. Command Validation and Authorization
```typescript
interface AgentCommand {
  id: string;
  userId: string;
  intent: ResolvedIntent;
  timestamp: string;
  status: 'pending' | 'executing' | 'completed' | 'failed';
  result?: any;
  error?: string;
}

class CommandValidator {
  async validateCommand(command: AgentCommand): Promise<ValidationResult> {
    // Check user permissions
    // Validate data constraints
    // Ensure business rules compliance
  }
}
```

#### B. Safe Execution Engine
```typescript
class AgentExecutor {
  async executeCommand(command: ValidatedCommand): Promise<ExecutionResult> {
    const service = domainServices[command.entityType];
    
    switch (command.action) {
      case 'create':
        return await this.executeCreate(service, command);
      case 'update':
        return await this.executeBatchUpdate(service, command);
      case 'delete':
        return await this.executeDelete(service, command);
    }
  }
  
  private async executeCreate(service: any, command: ValidatedCommand) {
    // Add AI tracking metadata
    const enrichedData = {
      ...command.createData,
      __ai_metadata: {
        createdBy: 'ai_agent',
        commandId: command.id,
        naturalLanguageRequest: command.originalMessage
      }
    };
    
    return await service.createUI(enrichedData);
  }
}
```

### 3. Chat Interface Integration

#### A. React Chat Component
```typescript
interface ChatMessage {
  id: string;
  type: 'user' | 'agent' | 'system';
  content: string;
  timestamp: string;
  commandResult?: CommandResult;
  suggestedActions?: SuggestedAction[];
}

function AIChatInterface() {
  const [messages, setMessages] = useState<ChatMessage[]>([]);
  const agentService = useAIAgentService();
  
  const handleUserMessage = async (message: string) => {
    // Add user message
    const userMsg = createUserMessage(message);
    setMessages(prev => [...prev, userMsg]);
    
    // Process with AI agent
    const result = await agentService.processMessage(message);
    
    // Add agent response with results
    const agentMsg = createAgentMessage(result);
    setMessages(prev => [...prev, agentMsg]);
  };
  
  return (
    <ChatContainer>
      <MessageList messages={messages} />
      <ChatInput onSubmit={handleUserMessage} />
      <QuickActions suggestions={currentSuggestions} />
    </ChatContainer>
  );
}
```

#### B. Real-time Feedback and Confirmation
```typescript
class InteractiveAgentService {
  async processMessage(message: string): Promise<AgentResponse> {
    const intent = await this.parseIntent(message);
    
    // For dangerous operations, request confirmation
    if (this.requiresConfirmation(intent)) {
      return {
        type: 'confirmation_required',
        message: `I'm about to ${intent.action} ${intent.affectedCount} ${intent.entityType}s. Proceed?`,
        pendingCommand: intent
      };
    }
    
    // Execute and stream results
    const results = await this.executeWithProgress(intent);
    return this.formatResults(results);
  }
}
```

### 4. Advanced Features

#### A. Contextual Understanding
```typescript
class ConversationContext {
  private history: ChatMessage[] = [];
  private entityContext: Map<string, string[]> = new Map();
  
  async enrichIntent(intent: CrudIntent): Promise<EnrichedIntent> {
    // Use conversation history for context
    // "Update it to completed" -> knows "it" refers to last mentioned task
    // "Create another one" -> creates similar entity to previous
  }
}
```

#### B. Bulk Operations and Workflows
```typescript
interface WorkflowStep {
  action: CrudIntent;
  condition?: (previousResult: any) => boolean;
  onSuccess?: CrudIntent;
  onFailure?: CrudIntent;
}

class WorkflowExecutor {
  async executeWorkflow(steps: WorkflowStep[]): Promise<WorkflowResult> {
    // Execute complex multi-step operations
    // "Move all completed tasks to archive project and notify assignees"
  }
}
```

#### C. Natural Language Queries
```typescript
class QueryBuilder {
  async buildDexieQuery(nlQuery: string): Promise<DexieQuery> {
    // "Show me all high priority tasks assigned to me this week"
    // "Find comments mentioning deployment issues"
    // "List projects I haven't updated in 30 days"
  }
}
```

### 5. Safety and Audit Features

#### A. Command History and Undo
```typescript
interface CommandHistory {
  id: string;
  command: AgentCommand;
  result: ExecutionResult;
  reverseCommand?: AgentCommand;
  timestamp: string;
}

class UndoService {
  async generateReverseCommand(command: AgentCommand): Promise<AgentCommand> {
    // Generate opposite operation for undo functionality
  }
  
  async undoLastCommand(userId: string): Promise<UndoResult> {
    const lastCommand = await this.getLastCommand(userId);
    return await this.executeUndo(lastCommand);
  }
}
```

#### B. Permission-Aware Operations
```typescript
class PermissionAwareExecutor {
  async checkPermissions(user: User, intent: CrudIntent): Promise<boolean> {
    // Integrate with existing permission system
    // Respect project membership, role-based access
    // Handle field-level permissions
  }
}
```

### 6. Integration Points

#### A. WebSocket Integration
```typescript
// Extend WebSocket messages for AI commands
interface AIAgentMessage {
  type: 'ai_command';
  command: AgentCommand;
  userId: string;
  sessionId: string;
}

// Real-time command broadcasting
class AICommandBroadcaster {
  async broadcastCommand(command: AgentCommand) {
    // Share AI actions with other users
    // Enable collaborative AI interactions
  }
}
```

#### B. UI Component Integration
```typescript
// Add AI assist to existing components
function VibeGridDexWithAI(props: VibeGridDexProps) {
  const [showAIAssist, setShowAIAssist] = useState(false);
  
  return (
    <>
      <VibeGridDex {...props} />
      <AIAssistPanel
        isOpen={showAIAssist}
        entityType={props.entityType}
        onCommand={handleAICommand}
      />
    </>
  );
}
```

## Implementation Roadmap

### Phase 1: Foundation (Week 1-2)
1. Create IntentRecognitionService with basic CRUD understanding
2. Implement CommandValidator and safety checks
3. Build basic chat interface component
4. Add execution engine for simple operations

### Phase 2: Enhanced Understanding (Week 3-4)
1. Add contextual reference resolution
2. Implement conversation memory
3. Build query builder for complex filters
4. Add batch operation support

### Phase 3: Advanced Features (Week 5-6)
1. Implement workflow execution
2. Add undo/redo functionality
3. Build permission integration
4. Create audit logging system

### Phase 4: UI Integration (Week 7-8)
1. Integrate with existing VibeGridDex
2. Add AI assist panels to major views
3. Implement real-time collaboration features
4. Add voice input support (optional)

## Technical Considerations

### 1. LLM Integration Options
- **OpenAI GPT-4**: Best understanding, higher latency
- **Claude API**: Good balance of performance and understanding
- **Local LLM**: Lower latency, privacy-friendly, less capable
- **Hybrid**: Local for simple intents, cloud for complex

### 2. Performance Optimization
- Cache common intent patterns
- Pre-process entity metadata for faster resolution
- Stream responses for better UX
- Batch similar operations

### 3. Error Handling
- Graceful degradation when LLM unavailable
- Clear error messages in natural language
- Rollback capabilities for failed operations
- Retry logic with exponential backoff

### 4. Security Considerations
- Never expose raw SQL or database structure
- Validate all operations server-side
- Rate limiting for AI commands
- Audit trail for compliance

## Example Interactions

```
User: "Create a new task for the frontend project to implement dark mode"
Agent: "I've created a new task 'Implement dark mode' in the Frontend project with medium priority. Would you like to assign it to someone?"

User: "Assign it to Sarah and set the due date to next Friday"
Agent: "Task updated! I've assigned 'Implement dark mode' to Sarah with a due date of March 15, 2024."

User: "Show me all my overdue tasks"
Agent: "You have 3 overdue tasks:
1. 'Code review for auth module' - Due 2 days ago
2. 'Update documentation' - Due 5 days ago  
3. 'Fix responsive layout' - Due 1 week ago
Would you like to update any of these?"

User: "Mark the documentation one as completed"
Agent: "✓ 'Update documentation' has been marked as completed."

User: "Create 5 test tasks for load testing"
Agent: "I'll create 5 test tasks for you. Here's what I'll create:
- Test Task 1: Load Testing
- Test Task 2: Load Testing
- Test Task 3: Load Testing
- Test Task 4: Load Testing
- Test Task 5: Load Testing
Proceed with creation?"
```

## Success Metrics

1. **Accuracy**: 95%+ correct intent recognition
2. **Performance**: <500ms for simple operations
3. **User Adoption**: 50%+ of CRUD operations via AI
4. **Error Rate**: <1% failed commands
5. **User Satisfaction**: 4.5+ star rating

## Conclusion

This AI agent architecture leverages VibeStack's robust domain service layer while adding natural language understanding. By maintaining the existing sync mechanisms and type safety, we ensure reliability while dramatically improving user experience through conversational interactions.