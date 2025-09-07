import ContentSection from '../components/content-section'
import FileImportForm from './file-import-form'

export default function FileImportSettings() {
  return (
    <div className="space-y-6">
      <ContentSection
        title="File Import"
        desc="Import data from CSV, JSON, and Excel files into your organization."
      >
        <FileImportForm />
      </ContentSection>
    </div>
  )
}