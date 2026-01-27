import { useState } from 'react';
import { FunnelAnalysis } from '../components/FunnelAnalysis';
import type { UploadResponse } from '../lib/api';

export function FunnelPage() {
  const [uploaded, setUploaded] = useState<UploadResponse | null>(null);

  return (
    <div className="app-container p-4 md:p-6">
      <FunnelAnalysis onDataReady={(res) => setUploaded(res)} />
    </div>
  );
}


