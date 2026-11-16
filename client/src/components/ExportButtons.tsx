import React, { useState } from 'react';
import { FileText, FileSpreadsheet, Loader2 } from 'lucide-react';
import { Button } from '@/components/ui';
import { downloadReport } from '@/lib/dataService';

interface ExportButtonsProps {
  pdfUrl: string;
  excelUrl: string;
  baseFilename: string;
  size?: 'sm' | 'md' | 'default';
  className?: string;
}

export const ExportButtons: React.FC<ExportButtonsProps> = ({
  pdfUrl,
  excelUrl,
  baseFilename,
  size = 'sm',
  className = '',
}) => {
  const [downloading, setDownloading] = useState<'pdf' | 'excel' | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);

  const handleDownload = async (type: 'pdf' | 'excel') => {
    setDownloading(type);
    setErrorMessage(null);
    try {
      const url = type === 'pdf' ? pdfUrl : excelUrl;
      const ext = type === 'pdf' ? 'pdf' : 'xlsx';
      const filename = `${baseFilename}_${new Date().toISOString().split('T')[0]}.${ext}`;
      await downloadReport(url, filename);
    } catch (err: any) {
      setErrorMessage(err.message || 'Hisobotni yuklashda xatolik yuz berdi');
      setTimeout(() => setErrorMessage(null), 5000);
    } finally {
      setDownloading(null);
    }
  };

  return (
    <div className={`relative inline-flex items-center gap-2 ${className}`}>
      {errorMessage && (
        <div className="absolute right-0 top-full mt-1.5 z-50 p-2.5 bg-rose-50 border border-rose-200 text-rose-800 text-xs rounded-lg shadow-lg whitespace-nowrap animate-in fade-in">
          {errorMessage}
        </div>
      )}

      <Button
        variant="outline"
        size={size as any}
        onClick={() => handleDownload('pdf')}
        disabled={downloading !== null}
        className="gap-1.5 border-rose-200 text-rose-700 hover:bg-rose-50 hover:text-rose-800"
      >
        {downloading === 'pdf' ? (
          <Loader2 className="h-4 w-4 animate-spin text-rose-600" />
        ) : (
          <FileText className="h-4 w-4 text-rose-600" />
        )}
        <span>PDF</span>
      </Button>

      <Button
        variant="outline"
        size={size as any}
        onClick={() => handleDownload('excel')}
        disabled={downloading !== null}
        className="gap-1.5 border-emerald-200 text-emerald-700 hover:bg-emerald-50 hover:text-emerald-800"
      >
        {downloading === 'excel' ? (
          <Loader2 className="h-4 w-4 animate-spin text-emerald-600" />
        ) : (
          <FileSpreadsheet className="h-4 w-4 text-emerald-600" />
        )}
        <span>Excel</span>
      </Button>
    </div>
  );
};
