import React, { useRef } from 'react';
import { Copy, Download, Check, FileText, Languages, Target } from 'lucide-react';
import { AlertMessage } from '../types';

interface DocumentPreviewProps {
  htmlContent: string;
  summary?: string;
  language?: string;
  onCopy: () => void;
  alert: AlertMessage | null;
  fileName: string;
}

const DocumentPreview: React.FC<DocumentPreviewProps> = ({ 
  htmlContent, 
  summary,
  language,
  onCopy, 
  alert,
  fileName
}) => {
  const contentRef = useRef<HTMLDivElement>(null);

  const handleDownloadHtml = () => {
    const element = document.createElement("a");
    const file = new Blob([htmlContent], {type: 'text/html'});
    element.href = URL.createObjectURL(file);
    element.download = `${fileName}.html`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
  };

  const handleDownloadDoc = () => {
    // Word-compatible HTML wrapper
    const header = `
      <html xmlns:o='urn:schemas-microsoft-com:office:office' 
            xmlns:w='urn:schemas-microsoft-com:office:word' 
            xmlns='http://www.w3.org/TR/REC-html40'>
      <head>
        <meta charset='utf-8'>
        <title>${fileName}</title>
        <!--[if gte mso 9]>
        <xml>
          <w:WordDocument>
            <w:View>Print</w:View>
            <w:Zoom>100</w:Zoom>
            <w:DoNotOptimizeForBrowser/>
          </w:WordDocument>
        </xml>
        <![endif]-->
        <style>
          body { font-family: 'Arial', sans-serif; line-height: 1.5; font-size: 11pt; }
          table { border-collapse: collapse; width: 100%; border: 1px solid #000; margin: 10px 0; }
          th, td { border: 1px solid #000; padding: 5px; vertical-align: top; }
          h1 { font-size: 18pt; margin-bottom: 15pt; }
          h2 { font-size: 14pt; margin-top: 15pt; margin-bottom: 10pt; }
          h3 { font-size: 12pt; margin-top: 10pt; }
          p { margin-bottom: 10pt; }
        </style>
      </head>
      <body>
        ${htmlContent}
      </body>
      </html>
    `;

    const blob = new Blob([header], { type: 'application/msword' });
    const url = URL.createObjectURL(blob);
    const element = document.createElement("a");
    element.href = url;
    element.download = `${fileName}.docx`;
    document.body.appendChild(element);
    element.click();
    document.body.removeChild(element);
    URL.revokeObjectURL(url);
  };

  const handleDownloadPdf = async () => {
    if (!contentRef.current) return;
    try {
      // @ts-ignore
      const html2pdf = (await import('html2pdf.js')).default;
      const element = contentRef.current;
      const opt = {
        margin:       10,
        filename:     `${fileName}.pdf`,
        image:        { type: 'jpeg', quality: 0.98 },
        html2canvas:  { scale: 2, useCORS: true },
        jsPDF:        { unit: 'mm', format: 'a4', orientation: 'portrait' }
      };
      
      // We pass the A4 container itself, so we might want to temporarily override styles 
      // or simply rely on it.
      html2pdf().set(opt).from(element).save();
    } catch (e) {
      console.error("PDF generation failed", e);
    }
  };

  if (!htmlContent) return null;

  return (
    <div className="flex flex-col items-center w-full animate-in fade-in slide-in-from-bottom-4 duration-500">
      {/* Toolbar */}
      <div className="w-full max-w-[210mm] flex flex-wrap items-center justify-between mb-4 bg-white p-2 rounded-lg border border-gray-200 shadow-sm sticky top-20 z-20 no-print gap-2">
        <span className="text-sm font-medium text-gray-700 px-2 hidden sm:block">Rezultato peržiūra</span>
        <div className="flex gap-2 flex-wrap w-full sm:w-auto justify-end">
           <button
            onClick={onCopy}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-gray-50 border border-gray-300 rounded hover:bg-gray-100 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
          >
            {alert?.type === 'success' && alert.text.includes('nukopijuotas') ? <Check className="w-4 h-4 text-green-600" /> : <Copy className="w-4 h-4" />}
            <span className="hidden sm:inline">Kopijuoti</span>
          </button>
          
          <div className="h-8 w-px bg-gray-300 hidden sm:block mx-1"></div>

          <button
            onClick={handleDownloadHtml}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-gray-700 bg-white border border-gray-300 rounded hover:bg-gray-50 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            title="Atsisiųsti kaip internetinį puslapį"
          >
            <Download className="w-4 h-4" />
            <span className="hidden sm:inline">HTML</span>
          </button>
          <button
            onClick={handleDownloadDoc}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-blue-700 bg-blue-50 border border-blue-200 rounded hover:bg-blue-100 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none"
            title="Atsisiųsti formatu tinkančiu Word/Google Docs"
          >
            <FileText className="w-4 h-4" />
            <span className="hidden sm:inline">.DOCX</span>
          </button>
          
          <button
            onClick={handleDownloadPdf}
            className="flex items-center gap-2 px-3 py-1.5 text-sm font-medium text-white bg-blue-600 rounded hover:bg-blue-700 transition-colors focus:ring-2 focus:ring-blue-500 focus:outline-none shadow-sm"
            title="Atsisiųsti kaip PDF failą"
          >
            <Download className="w-4 h-4" />
            Atsisiųsti PDF
          </button>
        </div>
      </div>

      {/* Alert Message */}
      {alert && (
        <div className={`fixed bottom-8 right-8 px-4 py-3 rounded-lg shadow-lg z-50 flex items-center gap-3 transition-all transform ${alert.type === 'success' ? 'bg-green-50 text-green-800 border border-green-200' : alert.type === 'error' ? 'bg-red-50 text-red-800 border border-red-200' : 'bg-blue-50 text-blue-800 border border-blue-200'}`}>
           {alert.type === 'success' ? <Check className="w-5 h-5" /> : null}
           <span className="font-medium">{alert.text}</span>
        </div>
      )}
      
      {/* Overview/Analysis Summary */}
      {(summary || language) && (
        <div className="w-full max-w-[210mm] mb-6 flex flex-col gap-4 no-print">
          {language && (
            <div className="flex items-center gap-2 px-4 py-2 bg-blue-50 text-blue-700 rounded-lg border border-blue-100 self-start w-auto">
              <Languages className="w-4 h-4" />
              <span className="text-sm font-medium">Aptikta kalba: <strong>{language}</strong></span>
            </div>
          )}
          {summary && (
            <div className="bg-white p-5 rounded-lg border border-gray-200 shadow-sm">
              <div className="flex items-center gap-2 mb-2 text-gray-800">
                <Target className="w-5 h-5 text-indigo-500" />
                <h3 className="font-semibold">Dokumento santrauka</h3>
              </div>
              <p className="text-gray-600 text-sm leading-relaxed">{summary}</p>
            </div>
          )}
        </div>
      )}

      {/* The Paper Document */}
      <div className="w-full overflow-x-auto bg-gray-200/50 py-8 px-2 md:px-8 rounded-xl">
        <div 
            ref={contentRef}
            className="A4-paper prose prose-slate max-w-none lg:prose-lg bg-white"
            dangerouslySetInnerHTML={{ __html: htmlContent }}
        />
      </div>
    </div>
  );
};

export default DocumentPreview;