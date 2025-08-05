import { IconDownload, IconPlus } from '@tabler/icons-react'
import { Button } from '@/components/ui/button'
import { domainServices } from '@/domain'
import { TaskStatus, TaskPriority } from '@repo/dataforge/client-entities'

export function TasksPrimaryButtons() {
  const handleCreate = async () => {
    // TODO: Replace with proper dialog/form
    const title = prompt('Enter task title:')
    if (title) {
      try {
        await domainServices.task.createUI({
          title,
          status: TaskStatus.OPEN,
          priority: TaskPriority.MEDIUM
        })
      } catch (error) {
        console.error('Failed to create task:', error)
      }
    }
  }

  const handleImport = () => {
    // TODO: Replace with proper import dialog
    alert('Import functionality - Coming soon!')
  }

  return (
    <div className='flex gap-2'>
      <Button
        variant='outline'
        className='space-x-1'
        onClick={handleImport}
      >
        <span>Import</span> <IconDownload size={18} />
      </Button>
      <Button className='space-x-1' onClick={handleCreate}>
        <span>Create</span> <IconPlus size={18} />
      </Button>
    </div>
  )
}
