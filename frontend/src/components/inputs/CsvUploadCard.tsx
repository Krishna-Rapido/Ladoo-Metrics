import { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, File, X } from 'lucide-react';
import { uploadCsv } from '@/lib/api';
import type { UploadResponse, UploadProgress } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CsvUploadCardProps {
  onUploaded: (info: UploadResponse | null) => void;
  uploadedFile?: UploadResponse | null;
}

function formatBytes(bytes: number): string {
  if (bytes === 0) return '0 B';
  const k = 1024;
  const sizes = ['B', 'KB', 'MB', 'GB'];
  const i = Math.floor(Math.log(bytes) / Math.log(k));
  return parseFloat((bytes / Math.pow(k, i)).toFixed(1)) + ' ' + sizes[i];
}

function getStatusText(progress: UploadProgress): string {
  switch (progress.status) {
    case 'initializing':
      return 'Initializing...';
    case 'uploading':
      return `Uploading ${formatBytes(progress.bytesUploaded)} / ${formatBytes(progress.totalBytes)}`;
    case 'processing':
      return 'Processing CSV...';
    case 'completed':
      return 'Complete!';
    case 'error':
      return (progress as any).error ?? (progress as any).errorMessage ?? 'Error uploading';
    default:
      return 'Uploading...';
  }
}

export function CsvUploadCard({ onUploaded, uploadedFile }: CsvUploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);
  const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      
      // Check file size (5GB limit)
      const MAX_SIZE = 5 * 1024 * 1024 * 1024;
      if (file.size > MAX_SIZE) {
        setError(`File too large. Maximum size is 5GB. Your file: ${formatBytes(file.size)}`);
        return;
      }
      
      setLoading(true);
      setError(null);
      setUploadProgress({
        status: 'initializing',
        bytesUploaded: 0,
        totalBytes: file.size,
        progress: 0,
      });
      
      try {
        const res = await uploadCsv(file, (progress) => {
          setUploadProgress(progress);
          if (progress.status === 'error') {
            setError(progress.error || 'Upload failed');
          }
        });
        onUploaded(res);
      } catch (e: any) {
        setError(e.message ?? 'Upload failed');
      } finally {
        setLoading(false);
      }
    },
    [onUploaded]
  );

  return (
    <Card>
      <CardHeader>
        <CardTitle>Upload CSV</CardTitle>
        <CardDescription>
          Accepted format: CSV files up to 5GB
        </CardDescription>
      </CardHeader>
      <CardContent>
        {uploadedFile ? (
          <div className="space-y-4">
            <div className="flex items-center gap-3 p-4 bg-muted rounded-lg">
              <File className="h-5 w-5 text-muted-foreground" />
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  CSV File Uploaded
                </p>
                <p className="text-xs text-muted-foreground">
                  {uploadedFile.num_rows?.toLocaleString()} rows, {uploadedFile.columns?.length || 0} columns
                </p>
              </div>
              <Button
                variant="ghost"
                size="icon"
                onClick={() => {
                  setError(null);
                  onUploaded(null);
                }}
                className="shrink-0"
              >
                <X className="h-4 w-4" />
              </Button>
            </div>
          </div>
        ) : (
          <div
            className={cn(
              'border-2 border-dashed rounded-lg p-8 text-center transition-colors',
              dragOver
                ? 'border-primary bg-primary/5'
                : 'border-muted-foreground/25 hover:border-muted-foreground/50',
              loading && 'pointer-events-none opacity-75'
            )}
            onDragOver={(e) => {
              e.preventDefault();
              setDragOver(true);
            }}
            onDragLeave={() => setDragOver(false)}
            onDrop={(e) => {
              e.preventDefault();
              setDragOver(false);
              handleFiles(e.dataTransfer.files);
            }}
          >
            <input
              type="file"
              accept=".csv"
              className="hidden"
              id="csv-upload"
              onChange={(e) => handleFiles(e.target.files)}
              disabled={loading}
            />
            <Upload className="h-10 w-10 mx-auto mb-4 text-muted-foreground" />
            <p className="text-sm font-medium mb-1">
              {loading && uploadProgress 
                ? getStatusText(uploadProgress)
                : 'Drag & drop your CSV file'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              {loading ? 'Please wait...' : 'Supports files up to 5GB'}
            </p>
            
            {/* Progress bar */}
            {loading && uploadProgress && (
              <div className="w-full mb-4">
                <div className="w-full bg-gray-200 rounded-full h-2 overflow-hidden">
                  <div 
                    className="h-full rounded-full transition-all duration-300 ease-out bg-primary"
                    style={{ width: `${Math.min(uploadProgress.progress, 100)}%` }}
                  />
                </div>
                <p className="text-xs text-muted-foreground mt-1">
                  {Math.round(uploadProgress.progress)}%
                </p>
              </div>
            )}
            
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-upload')?.click()}
              disabled={loading}
            >
              {loading ? 'Uploading...' : 'Browse Files'}
            </Button>
          </div>
        )}

        {error && !loading && (
          <div className="mt-4 p-4 bg-destructive/10 border border-destructive/20 rounded-lg">
            <div className="flex items-center gap-2">
              <span className="text-destructive text-sm font-medium">Error</span>
            </div>
            <p className="text-destructive/80 text-sm mt-1">{error}</p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

