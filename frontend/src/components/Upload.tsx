import { useCallback, useState } from 'react';
import { uploadCsv } from '../lib/api';
import type { UploadResponse } from '../lib/api';

export function Upload({ onUploaded }: { onUploaded: (info: UploadResponse) => void }) {
    const [dragOver, setDragOver] = useState(false);
    const [loading, setLoading] = useState(false);
    const [error, setError] = useState<string | null>(null);

    const handleFiles = useCallback(async (files: FileList | null) => {
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
    }, [onUploaded]);

    return (
        <div className="w-full">
            <label
                className={`upload-zone ${dragOver ? 'drag-over' : ''}`}
                onDragOver={(e) => { e.preventDefault(); setDragOver(true); }}
                onDragLeave={() => setDragOver(false)}
                onDrop={(e) => { e.preventDefault(); setDragOver(false); handleFiles(e.dataTransfer.files); }}
            >
                <input type="file" accept=".csv" className="hidden" onChange={(e) => handleFiles(e.target.files)} />
                <div className="upload-zone-icon">📁</div>
                <div className="upload-zone-text">
                    {loading ? 'Uploading...' : 'Drag & drop your CSV file here'}
                </div>
                <div className="upload-zone-subtext">
                    or click to browse your files
                </div>
                {loading && (
                    <div className="flex items-center justify-center mt-4">
                        <div className="loading-spinner"></div>
                    </div>
                )}
            </label>

            {error && (
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
