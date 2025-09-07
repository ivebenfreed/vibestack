import React, { useState, useCallback } from 'react'
import { useAuth } from '@/state-machines'
import { Button } from '@/components/ui/button'
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card'
import { Badge } from '@/components/ui/badge'
import { Progress } from '@/components/ui/progress'
import { Separator } from '@/components/ui/separator'
import { Alert, AlertDescription } from '@/components/ui/alert'
import { 
  Upload, 
  FileText, 
  Database, 
  CheckCircle, 
  XCircle, 
  Clock, 
  AlertCircle,
  RefreshCw
} from 'lucide-react'
import { cn } from '@/lib/utils'

interface ImportJob {
  id: string
  file_name: string
  file_type: string
  file_size: number
  status: 'uploaded' | 'analyzing' | 'mapped' | 'importing' | 'completed' | 'failed'
  records_processed: number
  records_imported: number
  records_failed: number
  created_at: string
}

export default function FileImportForm() {
  const { currentOrganization } = useAuth()
  const [isDragging, setIsDragging] = useState(false)
  const [uploadingFiles, setUploadingFiles] = useState<File[]>([])
  const [importJobs, setImportJobs] = useState<ImportJob[]>([])
  const [isLoading, setIsLoading] = useState(false)
  const [error, setError] = useState<string | null>(null)

  // Load existing import jobs
  const loadImportJobs = useCallback(async () => {
    if (!currentOrganization?.id) return
    
    try {
      setIsLoading(true)
      const response = await fetch(`/api/file-import?org_id=${currentOrganization.id}`)
      const data = await response.json()
      
      if (data.success) {
        setImportJobs(data.jobs)
      } else {
        setError('Failed to load import jobs')
      }
    } catch (err) {
      setError('Failed to load import jobs')
    } finally {
      setIsLoading(false)
    }
  }, [currentOrganization?.id])

  // Load jobs on component mount
  React.useEffect(() => {
    loadImportJobs()
  }, [loadImportJobs])

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(true)
  }

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
  }

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault()
    setIsDragging(false)
    
    const files = Array.from(e.dataTransfer.files)
    handleFiles(files)
  }

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || [])
    handleFiles(files)
  }

  const handleFiles = async (files: File[]) => {
    if (!currentOrganization?.id) {
      setError('No organization selected')
      return
    }

    const validFiles = files.filter(file => {
      const extension = file.name.split('.').pop()?.toLowerCase()
      return ['csv', 'json', 'xlsx', 'xls', 'tsv'].includes(extension || '')
    })

    if (validFiles.length === 0) {
      setError('Please select valid CSV, JSON, or Excel files')
      return
    }

    setUploadingFiles(validFiles)
    setError(null)

    for (const file of validFiles) {
      try {
        const formData = new FormData()
        formData.append('file', file)
        formData.append('org_id', currentOrganization.id)

        const response = await fetch('/api/file-import/upload', {
          method: 'POST',
          body: formData
        })

        const result = await response.json()
        if (!result.success) {
          throw new Error(result.error || 'Upload failed')
        }

        // Refresh the jobs list
        await loadImportJobs()
        
      } catch (err) {
        setError(`Failed to upload ${file.name}: ${err instanceof Error ? err.message : 'Unknown error'}`)
      }
    }

    setUploadingFiles([])
  }

  const getStatusIcon = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed':
        return <CheckCircle className="w-4 h-4 text-green-500" />
      case 'failed':
        return <XCircle className="w-4 h-4 text-red-500" />
      case 'importing':
      case 'analyzing':
      case 'mapped':
        return <RefreshCw className="w-4 h-4 text-blue-500 animate-spin" />
      default:
        return <Clock className="w-4 h-4 text-yellow-500" />
    }
  }

  const getStatusColor = (status: ImportJob['status']) => {
    switch (status) {
      case 'completed':
        return 'bg-green-100 text-green-800'
      case 'failed':
        return 'bg-red-100 text-red-800'
      case 'importing':
      case 'analyzing':
      case 'mapped':
        return 'bg-blue-100 text-blue-800'
      default:
        return 'bg-yellow-100 text-yellow-800'
    }
  }

  const formatFileSize = (bytes: number) => {
    if (bytes === 0) return '0 Bytes'
    const k = 1024
    const sizes = ['Bytes', 'KB', 'MB', 'GB']
    const i = Math.floor(Math.log(bytes) / Math.log(k))
    return parseFloat((bytes / Math.pow(k, i)).toFixed(2)) + ' ' + sizes[i]
  }

  const formatDate = (dateString: string) => {
    return new Date(dateString).toLocaleDateString('en-US', {
      year: 'numeric',
      month: 'short',
      day: 'numeric',
      hour: '2-digit',
      minute: '2-digit'
    })
  }

  if (!currentOrganization) {
    return (
      <Alert>
        <AlertCircle className="w-4 h-4" />
        <AlertDescription>
          Please select an organization to manage file imports.
        </AlertDescription>
      </Alert>
    )
  }

  return (
    <div className="space-y-6">
      {/* File Upload Area */}
      <Card>
        <CardHeader>
          <CardTitle>Upload Files</CardTitle>
          <CardDescription>
            Drag and drop files here, or click to select. Supports CSV, JSON, TSV, and Excel files.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className={cn(
              "border-2 border-dashed border-muted-foreground/25 rounded-lg p-8 text-center transition-colors",
              isDragging && "border-primary bg-primary/5",
              uploadingFiles.length > 0 && "border-blue-500 bg-blue-50"
            )}
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
          >
            <Upload className="w-8 h-8 mx-auto mb-4 text-muted-foreground" />
            <div className="space-y-2">
              <p className="text-sm font-medium">
                Drop files here or click to browse
              </p>
              <p className="text-xs text-muted-foreground">
                CSV, JSON, TSV, Excel (.xlsx, .xls) up to 10MB each
              </p>
            </div>
            <input
              type="file"
              multiple
              accept=".csv,.json,.xlsx,.xls,.tsv"
              onChange={handleFileSelect}
              className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            />
            {uploadingFiles.length > 0 && (
              <div className="mt-4 space-y-2">
                {uploadingFiles.map((file, index) => (
                  <div key={index} className="flex items-center justify-between text-sm">
                    <span>{file.name}</span>
                    <span className="text-muted-foreground">{formatFileSize(file.size)}</span>
                  </div>
                ))}
                <Progress value={undefined} className="mt-2" />
              </div>
            )}
          </div>
          
          {error && (
            <Alert className="mt-4" variant="destructive">
              <AlertCircle className="w-4 h-4" />
              <AlertDescription>{error}</AlertDescription>
            </Alert>
          )}
        </CardContent>
      </Card>

      {/* Import Jobs List */}
      <Card>
        <CardHeader className="flex flex-row items-center justify-between">
          <div>
            <CardTitle>Import History</CardTitle>
            <CardDescription>
              Recent file imports for {currentOrganization.name}
            </CardDescription>
          </div>
          <Button 
            variant="outline" 
            size="sm" 
            onClick={loadImportJobs}
            disabled={isLoading}
          >
            <RefreshCw className={cn("w-4 h-4 mr-2", isLoading && "animate-spin")} />
            Refresh
          </Button>
        </CardHeader>
        <CardContent>
          {isLoading ? (
            <div className="flex items-center justify-center py-8">
              <RefreshCw className="w-6 h-6 animate-spin mr-2" />
              Loading import history...
            </div>
          ) : importJobs.length === 0 ? (
            <div className="text-center py-8 text-muted-foreground">
              <Database className="w-8 h-8 mx-auto mb-2" />
              <p>No imports yet</p>
              <p className="text-sm">Upload a file to get started</p>
            </div>
          ) : (
            <div className="space-y-4">
              {importJobs.map((job) => (
                <div key={job.id} className="flex items-center justify-between p-4 border rounded-lg">
                  <div className="flex items-center space-x-4">
                    <FileText className="w-8 h-8 text-muted-foreground" />
                    <div>
                      <div className="flex items-center space-x-2">
                        <h4 className="font-medium">{job.file_name}</h4>
                        <Badge className={getStatusColor(job.status)}>
                          {job.status.charAt(0).toUpperCase() + job.status.slice(1)}
                        </Badge>
                      </div>
                      <div className="flex items-center space-x-4 mt-1 text-sm text-muted-foreground">
                        <span>{job.file_type.toUpperCase()}</span>
                        <span>{formatFileSize(job.file_size)}</span>
                        <span>{formatDate(job.created_at)}</span>
                      </div>
                      {(job.records_processed > 0 || job.records_imported > 0) && (
                        <div className="mt-2 text-sm">
                          <span className="text-green-600">{job.records_imported} imported</span>
                          {job.records_failed > 0 && (
                            <span className="text-red-600 ml-2">{job.records_failed} failed</span>
                          )}
                        </div>
                      )}
                    </div>
                  </div>
                  <div className="flex items-center space-x-2">
                    {getStatusIcon(job.status)}
                  </div>
                </div>
              ))}
            </div>
          )}
        </CardContent>
      </Card>
    </div>
  )
}