import { useCallback, useState } from 'react';
import { uploadCsv } from '../lib/api';
import type { UploadResponse, UploadProgress } from '../lib/api';

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
            return 'Initializing upload...';
        case 'uploading':
            return `Uploading... ${formatBytes(progress.bytesUploaded)} / ${formatBytes(progress.totalBytes)}`;
        case 'processing':
            return 'Processing CSV file...';
        case 'completed':
            return 'Upload complete!';
        case 'error':
            return progress.error || 'Upload failed';
        default:
            return 'Uploading...';
    }
}

export function Upload({ onUploaded }: { onUploaded: (info: UploadResponse) => void }) {
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);
    const [uploadProgress, setUploadProgress] = useState<UploadProgress | null>(null);

    const handleFiles = useCallback(async (files: FileList | null) => {
        if (!files || files.length === 0) return;
        const file = files[0];
        
        // Check file size warning (5GB limit)
        const MAX_SIZE = 5 * 1024 * 1024 * 1024; // 5GB
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
    }, [onUploaded]);

    return (
        <div className="w-full">
            <label
                className={`upload-zone ${dragOver ? 'drag-over' : ''} ${loading ? 'pointer-events-none opacity-75' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
                <input 
                    type="file" 
                    accept=".csv" 
                    className="hidden" 
                    onChange={(e) => handleFiles(e.target.files)} 
                    disabled={loading}
                />
                <div className="upload-zone-icon">📁</div>
                <div className="upload-zone-text">
                    {loading && uploadProgress 
                        ? getStatusText(uploadProgress)
                        : 'Drag & drop your CSV file here'}
                </div>
                <div className="upload-zone-subtext">
                    {loading 
                        ? 'Please wait while we process your file...'
                        : 'Supports files up to 5GB • Click to browse'}
                </div>
                
                {/* Progress bar */}
                {loading && uploadProgress && (
                    <div className="w-full mt-4 px-4">
                        <div className="w-full bg-gray-200 rounded-full h-3 overflow-hidden">
                            <div 
                                className="h-full rounded-full transition-all duration-300 ease-out"
                                style={{ 
                                    width: `${Math.min(uploadProgress.progress, 100)}%`,
                                    backgroundColor: uploadProgress.status === 'error' 
                                        ? '#ef4444' 
                                        : uploadProgress.status === 'processing' 
                                            ? '#f59e0b' 
                                            : '#3b82f6'
                                }}
                            />
                        </div>
                        <div className="flex justify-between mt-2 text-sm text-gray-600">
                            <span>{Math.round(uploadProgress.progress)}%</span>
                            {uploadProgress.status === 'uploading' && (
                                <span>{formatBytes(uploadProgress.bytesUploaded)} / {formatBytes(uploadProgress.totalBytes)}</span>
                            )}
                        </div>
                    </div>
                )}
            </label>

            {error && !loading && (
                <div className="mt-4 p-4 rounded-lg" style={{ backgroundColor: 'rgba(254, 226, 226, 0.9)', border: '1px solid #fecaca' }}>
                    <div className="flex items-center gap-2">
                        <span className="text-red-500">⚠️</span>
                        <span className="text-red-700 font-medium">Upload Error</span>
                    </div>
                    <p className="text-red-600 text-sm mt-1">{error}</p>
                </div>
            )}
        </div>
    );
}
