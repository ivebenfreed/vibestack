# Plan: Refactor Editable Components in `project-detail-page.tsx`

**Objective**:
To refactor the project detail page ([`apps/web/src/features/projects/components/project-detail-page.tsx`](apps/web/src/features/projects/components/project-detail-page.tsx)) by:
1.  Replacing the custom `EditableSelectField` for "Project Status" with the Shadcn/ui `Combobox` pattern (using `Popover`, `Command`, and `Button`).
2.  Reviewing and refining the existing custom `EditableField.tsx` component for "Project Name" and "Project Description" to ensure it optimally uses Shadcn/ui primitives (`Input`, `Textarea`, `Label`) and adheres to best practices for an "in-place" editing experience.

**Rationale**:
*   Aligns with the user's preference for an "in-place" editing feel for text/textarea fields.
*   Utilizes a standard and rich Shadcn/ui pattern (`Combobox`) for selection fields.
*   Ensures custom wrapper components (`EditableField.tsx`) are well-implemented using Shadcn/ui's building blocks, adhering to the library's philosophy.
*   Improves maintainability and consistency with the project's UI system.

**Detailed Steps**:

## Part 1: Refactor Project Status (using Shadcn Combobox)

1.  **Modify `apps/web/src/features/projects/components/project-detail-page.tsx`**:
    *   **Remove `EditableSelectField`**: Delete the existing `EditableSelectField` instance used for `project.status`.
    *   **Add State**:
        ```typescript
        const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);
        ```
    *   **Implement Combobox**:
        *   Use `Label` for "Status".
        *   Use `Popover`, `PopoverTrigger` (with a `Button` styled appropriately), and `PopoverContent`.
        *   Inside `PopoverContent`, use `Command`, `CommandInput`, `CommandList`, `CommandEmpty`, `CommandGroup`, and `CommandItem` to list `projectStatusOptions`.
        *   Display a `Check` icon next to the currently selected status in the list.
        *   The `Button` in `PopoverTrigger` should display the selected status label or placeholder, and a `ChevronsUpDown` icon.
        *   **Save Logic**: On `onSelect` of a `CommandItem`:
            *   Call `handleUpdateProjectField('status', selectedValueAsProjectStatus)`.
            *   Close the popover: `setStatusPopoverOpen(false)`.
    *   **Imports**: Add necessary imports for `Popover`, `Command` components, and icons from `lucide-react`. Remove import for `EditableSelectField`.

    *   **Sketch for Combobox Implementation**:
        ```tsx
        // In project-detail-page.tsx

        // ... (projectStatusOptions and handleUpdateProjectField remain as is) ...
        // const [statusPopoverOpen, setStatusPopoverOpen] = useState(false);

        // ... inside the return statement, where EditableSelectField was ...
        <div className="space-y-1"> {/* Maintain similar spacing if needed */}
          <Label htmlFor="project-status-combobox">Status</Label>
          <Popover open={statusPopoverOpen} onOpenChange={setStatusPopoverOpen}>
            <PopoverTrigger asChild>
              <Button
                id="project-status-combobox"
                variant="outline"
                role="combobox"
                aria-expanded={statusPopoverOpen}
                className={cn(
                  "w-full sm:w-[200px] justify-between", // Adjust width as needed
                  !project.status && "text-muted-foreground",
                  "text-sm" // from original EditableSelectField textClassName
                )}
              >
                {project.status
                  ? projectStatusOptions.find((opt) => opt.value === project.status)?.label
                  : "Select project status"} {/* from original placeholder */}
                <ChevronsUpDown className="ml-2 h-4 w-4 shrink-0 opacity-50" />
              </Button>
            </PopoverTrigger>
            <PopoverContent className="w-full sm:w-[200px] p-0"> {/* Match trigger width */}
              <Command>
                <CommandInput placeholder="Search status..." />
                <CommandList>
                  <CommandEmpty>No status found.</CommandEmpty>
                  <CommandGroup>
                    {projectStatusOptions.map((option) => (
                      <CommandItem
                        key={option.value}
                        value={option.value}
                        onSelect={async (currentValue) => {
                          if (project.status !== currentValue) {
                            // Ensure currentValue is correctly typed if necessary before passing
                            await handleUpdateProjectField('status', currentValue as ProjectStatus);
                          }
                          setStatusPopoverOpen(false);
                        }}
                      >
                        <Check
                          className={cn(
                            "mr-2 h-4 w-4",
                            project.status === option.value ? "opacity-100" : "opacity-0"
                          )}
                        />
                        {option.label}
                      </CommandItem>
                    ))}
                  </CommandGroup>
                </CommandList>
              </Command>
            </PopoverContent>
          </Popover>
        </div>
        ```

## Part 2: Review and Refine `EditableField.tsx` (for Project Name & Description)

1.  **Location**: [`apps/web/src/components/custom/EditableField.tsx`](apps/web/src/components/custom/EditableField.tsx)
2.  **No Replacement of Core UX**: The "click text to edit in-place" behavior will be retained and optimized.
3.  **Review Areas**:
    *   **Props**: Ensure props like `labelSrOnly`, `inputProps`, `textareaProps`, `textClassName` are handled effectively and allow sufficient customization for contexts like mimicking `CardTitle` styling.
    *   **Shadcn Primitives**:
        *   Confirm `Input`, `Textarea`, `Label`, `Select` (and its parts) are imported from `@/components/ui/` and used correctly.
        *   Ensure `cn` utility is used for merging classes.
    *   **State Management**: Review `isEditing`, `currentValue`, `isLoading`, `error` state logic for clarity and correctness.
    *   **Event Handling**:
        *   `onClick` to enter edit mode.
        *   `onBlur`: The `setTimeout` trick is a common way to handle blurs that might conflict with clicks on save/cancel buttons. Verify this is working reliably.
        *   `onKeyDown` (Enter for save, Escape for cancel): Ensure this is intuitive for both single-line (`Input`) and multi-line (`Textarea`). The current code for `Textarea` (save on Enter without Shift) should be confirmed if it's the desired UX, or changed (e.g., to Ctrl+Enter).
    *   **Focus Management**: `useEffect` to focus the input when `isEditing` becomes true. For `Textarea`, ensure cursor placement (e.g., at the end) is desirable.
    *   **Accessibility**:
        *   Ensure `Label` is correctly associated with its input field using `htmlFor` and `id`. The `labelSrOnly` prop is good.
        *   The display mode `div` has `role="button"` and `tabIndex={0}`. This is good for keyboard accessibility.
    *   **Error Display**: Ensure errors are clearly shown.
    *   **Loading State**: Visual indication (`Loader2`) during save is good.
    *   **Styling**:
        *   The `group-hover:border-dashed` provides good affordance.
        *   Ensure `textClassName` and specific `inputProps.className` / `textareaProps.className` are applied correctly.
4.  **Refinement of `EditableField.tsx`'s internal `select` type**:
    *   While not used by `project-detail-page.tsx` after Part 1, if `EditableField` with `fieldType="select"` is used elsewhere, its internal `Select` implementation should be robust, especially concerning focus/blur behavior. This is a secondary priority for *this specific task* if it's not impacting the project detail page.

## Part 3: Testing and Verification

*   Thoroughly test the `project-detail-page.tsx` after changes:
    *   Editing and saving Project Name.
    *   Editing and saving Project Description.
    *   Selecting and saving Project Status using the new Combobox.
    *   Verify loading states, error handling, and toast notifications.
    *   Check keyboard navigation and accessibility for all editable fields.
    *   Test responsiveness and styling.

## Mermaid Diagram: Overall Flow for `project-detail-page.tsx`

```mermaid
graph TD
    A[ProjectDetailPage] --> B_Name["Display Name (EditableField - In-Place)"];
    A --> C_Desc["Display Description (EditableField - In-Place)"];
    A --> D_Status["Display Status (Combobox Trigger Button)"];

    B_Name -- Click --> B_Edit["EditableField: Input Mode"];
    B_Edit -- Save/Blur --> B_Save["handleUpdateProjectField('name', ...)"];
    B_Save --> A;

    C_Desc -- Click --> C_Edit["EditableField: Textarea Mode"];
    C_Edit -- Save/Blur --> C_Save["handleUpdateProjectField('description', ...)"];
    C_Save --> A;

    D_Status -- Click --> D_Popover["Status Combobox Popover"];
    D_Popover --> D_Command["Command List (Statuses)"];
    D_Command -- Select Item --> D_Save["handleUpdateProjectField('status', ...)"];
    D_Save --> A;
    D_Save --> D_ClosePopover["Close Popover"];