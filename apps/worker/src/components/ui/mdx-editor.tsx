import React from 'react';
import { 
  MDXEditor, 
  headingsPlugin,
  listsPlugin,
  quotePlugin,
  thematicBreakPlugin,
  markdownShortcutPlugin,
  linkPlugin,
  linkDialogPlugin,
  imagePlugin,
  tablePlugin,
  codeBlockPlugin,
  toolbarPlugin,
  UndoRedo,
  BoldItalicUnderlineToggles,
  BlockTypeSelect,
  CreateLink,
  InsertImage,
  InsertTable,
  InsertThematicBreak,
  ListsToggle,
  Separator,
  CodeToggle,
  InsertCodeBlock
} from '@mdxeditor/editor';

// Import the CSS
import '@mdxeditor/editor/style.css';

interface MarkdownEditorProps {
  markdown: string;
  onChange: (markdown: string) => void;
  placeholder?: string;
  className?: string;
  readOnly?: boolean;
}

export function MarkdownEditor({ 
  markdown, 
  onChange, 
  placeholder = "Start writing...",
  className = "",
  readOnly = false 
}: MarkdownEditorProps) {
  return (
    <div className={`border rounded-md overflow-hidden ${className}`}>
      <MDXEditor
        markdown={markdown}
        onChange={onChange}
        readOnly={readOnly}
        placeholder={placeholder}
        plugins={[
          headingsPlugin(),
          listsPlugin(),
          quotePlugin(),
          thematicBreakPlugin(),
          markdownShortcutPlugin(),
          linkPlugin(),
          linkDialogPlugin(),
          imagePlugin(),
          tablePlugin(),
          codeBlockPlugin({
            defaultCodeBlockLanguage: 'javascript'
          }),
          toolbarPlugin({
            toolbarContents: () => (
              <>
                <UndoRedo />
                <Separator />
                <BoldItalicUnderlineToggles />
                <CodeToggle />
                <Separator />
                <BlockTypeSelect />
                <Separator />
                <CreateLink />
                <InsertImage />
                <Separator />
                <ListsToggle />
                <Separator />
                <InsertTable />
                <InsertThematicBreak />
                <Separator />
                <InsertCodeBlock />
              </>
            )
          })
        ]}
        className="prose dark:prose-invert max-w-none"
      />
    </div>
  );
}