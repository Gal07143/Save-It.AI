import { useState, useCallback, useRef } from 'react'
import { Upload, File, X, AlertCircle } from 'lucide-react'

interface FileUploadProps {
  onFileSelect: (file: File) => void
  accept?: string
  maxSize?: number
  multiple?: boolean
  label?: string
  description?: string
}

export default function FileUpload({
  onFileSelect,
  accept = '.csv,.xlsx,.xls',
  maxSize = 10 * 1024 * 1024,
  multiple = false,
  label = 'Upload File',
  description = 'Drag and drop or click to select'
}: FileUploadProps) {
  const [isDragging, setIsDragging] = useState(false)
  const [selectedFile, setSelectedFile] = useState<File | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [uploadProgress, setUploadProgress] = useState<number>(0)
  const [_isUploading, _setIsUploading] = useState(false)
  const fileInputRef = useRef<HTMLInputElement>(null)

  const validateFile = (file: File): string | null => {
    if (maxSize && file.size > maxSize) {
      return `File too large. Maximum size is ${Math.round(maxSize / 1024 / 1024)}MB`
    }
    
    if (accept) {
      const allowedTypes = accept.split(',').map(t => t.trim().toLowerCase())
      const fileExt = '.' + file.name.split('.').pop()?.toLowerCase()
      if (!allowedTypes.some(t => t === fileExt || file.type.includes(t.replace('.', '')))) {
        return `Invalid file type. Allowed types: ${accept}`
      }
    }
    
    return null
  }

  const handleFile = useCallback((file: File) => {
    setError(null)
    const validationError = validateFile(file)
    
    if (validationError) {
      setError(validationError)
      return
    }
    
    setSelectedFile(file)
    onFileSelect(file)
  }, [onFileSelect, accept, maxSize])

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(true)
  }, [])

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
  }, [])

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault()
    e.stopPropagation()
    setIsDragging(false)
    
    const files = e.dataTransfer.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }, [handleFile])

  const handleClick = () => {
    fileInputRef.current?.click()
  }

  const handleInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = e.target.files
    if (files && files.length > 0) {
      handleFile(files[0])
    }
  }

  const clearFile = () => {
    setSelectedFile(null)
    setError(null)
    setUploadProgress(0)
    if (fileInputRef.current) {
      fileInputRef.current.value = ''
    }
  }

  const formatFileSize = (bytes: number): string => {
    if (bytes < 1024) return bytes + ' B'
    if (bytes < 1024 * 1024) return (bytes / 1024).toFixed(1) + ' KB'
    return (bytes / 1024 / 1024).toFixed(1) + ' MB'
  }

  return (
    <div style={{ width: '100%' }}>
      <input
        ref={fileInputRef}
        type="file"
        accept={accept}
        multiple={multiple}
        onChange={handleInputChange}
        style={{ display: 'none' }}
      />
      
      {!selectedFile ? (
        <div
          onClick={handleClick}
          onDragOver={handleDragOver}
          onDragLeave={handleDragLeave}
          onDrop={handleDrop}
          style={{
            border: `2px dashed ${isDragging ? '#10b981' : error ? '#ef4444' : '#475569'}`,
            borderRadius: '12px',
            padding: '2rem',
            textAlign: 'center',
            cursor: 'pointer',
            background: isDragging ? 'rgba(16, 185, 129, 0.05)' : 'rgba(51, 65, 85, 0.3)',
            transition: 'all 0.2s'
          }}
        >
          <Upload 
            size={48} 
            color={isDragging ? '#10b981' : '#64748b'} 
            style={{ marginBottom: '1rem' }} 
          />
          <p style={{ fontSize: '1rem', fontWeight: 500, color: '#e2e8f0', marginBottom: '0.5rem' }}>
            {label}
          </p>
          <p style={{ fontSize: '0.875rem', color: '#94a3b8' }}>
            {description}
          </p>
          <p style={{ fontSize: '0.75rem', color: '#64748b', marginTop: '0.5rem' }}>
            Accepted: {accept} (Max: {Math.round(maxSize / 1024 / 1024)}MB)
          </p>
        </div>
      ) : (
        <div style={{
          border: '1px solid #334155',
          borderRadius: '12px',
          padding: '1rem',
          background: 'rgba(51, 65, 85, 0.3)'
        }}>
          <div style={{ display: 'flex', alignItems: 'center', gap: '1rem' }}>
            <div style={{
              width: '48px',
              height: '48px',
              borderRadius: '8px',
              background: '#10b981',
              display: 'flex',
              alignItems: 'center',
              justifyContent: 'center'
            }}>
              <File size={24} color="white" />
            </div>
            
            <div style={{ flex: 1 }}>
              <p style={{ fontSize: '0.875rem', fontWeight: 500, color: '#e2e8f0' }}>
                {selectedFile.name}
              </p>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8' }}>
                {formatFileSize(selectedFile.size)}
              </p>
            </div>
            
            <button
              onClick={clearFile}
              style={{
                padding: '0.5rem',
                background: 'transparent',
                border: 'none',
                cursor: 'pointer',
                color: '#94a3b8'
              }}
            >
              <X size={20} />
            </button>
          </div>
          
          {_isUploading && (
            <div style={{ marginTop: '1rem' }}>
              <div style={{
                height: '4px',
                background: '#334155',
                borderRadius: '2px',
                overflow: 'hidden'
              }}>
                <div style={{
                  height: '100%',
                  width: `${uploadProgress}%`,
                  background: '#10b981',
                  transition: 'width 0.3s'
                }} />
              </div>
              <p style={{ fontSize: '0.75rem', color: '#94a3b8', marginTop: '0.5rem' }}>
                Uploading... {uploadProgress}%
              </p>
            </div>
          )}
        </div>
      )}
      
      {error && (
        <div style={{
          marginTop: '0.5rem',
          padding: '0.5rem 0.75rem',
          background: 'rgba(239, 68, 68, 0.1)',
          borderRadius: '6px',
          display: 'flex',
          alignItems: 'center',
          gap: '0.5rem'
        }}>
          <AlertCircle size={16} color="#ef4444" />
          <span style={{ fontSize: '0.875rem', color: '#ef4444' }}>{error}</span>
        </div>
      )}
    </div>
  )
}
