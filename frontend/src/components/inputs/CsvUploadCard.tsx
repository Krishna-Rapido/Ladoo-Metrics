import { useCallback, useState } from 'react';
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from '@/components/ui/card';
import { Button } from '@/components/ui/button';
import { Upload, File, X } from 'lucide-react';
import { uploadCsv } from '@/lib/api';
import type { UploadResponse } from '@/lib/api';
import { cn } from '@/lib/utils';

interface CsvUploadCardProps {
  onUploaded: (info: UploadResponse | null) => void;
  uploadedFile?: UploadResponse | null;
}

export function CsvUploadCard({ onUploaded, uploadedFile }: CsvUploadCardProps) {
  const [dragOver, setDragOver] = useState(false);
  const [loading, setLoading] = useState(false);
  const [error, setError] = useState<string | null>(null);

  const handleFiles = useCallback(
    async (files: FileList | null) => {
      if (!files || files.length === 0) return;
      const file = files[0];
      setLoading(true);
      setError(null);
      try {
        const res = await uploadCsv(file);
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
          Accepted format: CSV files up to 10MB
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
                : 'border-muted-foreground/25 hover:border-muted-foreground/50'
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
              {loading ? 'Uploading...' : 'Drag & drop your CSV file'}
            </p>
            <p className="text-xs text-muted-foreground mb-4">
              or click to browse your files
            </p>
            <Button
              variant="outline"
              onClick={() => document.getElementById('csv-upload')?.click()}
              disabled={loading}
            >
              Browse Files
            </Button>
            {loading && (
              <div className="flex items-center justify-center mt-4">
                <div className="h-4 w-4 border-2 border-primary border-t-transparent rounded-full animate-spin" />
              </div>
            )}
          </div>
        )}

        {error && (
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

