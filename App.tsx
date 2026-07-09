import React, { useState, useCallback } from 'react';
import Header from './components/Header';
import FileUploader from './components/FileUploader';
import DocumentPreview from './components/DocumentPreview';
import { convertPdfToHtml } from './services/geminiService';
import { ConversionStatus, AlertMessage, OcrAccuracy } from './types';
import { Sparkles } from 'lucide-react';

const App: React.FC = () => {
  const [status, setStatus] = useState<ConversionStatus>(ConversionStatus.IDLE);
  const [htmlContent, setHtmlContent] = useState<string>("");
  const [summary, setSummary] = useState<string>("");
  const [language, setLanguage] = useState<string>("");
  const [fileName, setFileName] = useState<string>("dokumentas");
  const [alert, setAlert] = useState<AlertMessage | null>(null);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  const [processingMessage, setProcessingMessage] = useState<string>("");
  const [progressValue, setProgressValue] = useState<number>(0);

  const showAlert = (type: AlertMessage['type'], text: string) => {
    setAlert({ type, text });
    setTimeout(() => setAlert(null), 3000);
  };

  const handleConvert = useCallback(async (file: File, name: string, ocrAccuracy: OcrAccuracy = OcrAccuracy.BALANCED) => {
    setStatus(ConversionStatus.PROCESSING);
    setProcessingMessage("Inicijuojama...");
    setProgressValue(0);
    setHtmlContent("");
    setSummary("");
    setLanguage("");
    setFileName(name);
    setAlert(null);
    setErrorMessage(null);

    try {
      // Call Gemini API with progress callback
      const result = await convertPdfToHtml(file, ocrAccuracy, (msg, progress) => {
        setProcessingMessage(msg);
        if (progress !== undefined) setProgressValue(progress);
      });
      setHtmlContent(result.htmlContent);
      setSummary(result.summary);
      setLanguage(result.language);
      setStatus(ConversionStatus.SUCCESS);
      showAlert('success', 'Dokumentas sėkmingai konvertuotas!');
    } catch (error) {
      console.error(error);
      setStatus(ConversionStatus.ERROR);
      const msg = error instanceof Error ? error.message : 'Įvyko nenumatyta klaida';
      setErrorMessage(msg);
    }
  }, []);

  const handleCopyContent = useCallback(async () => {
    if (!htmlContent) return;
    
    try {
      const blob = new Blob([htmlContent], { type: 'text/html' });
      const data = [new ClipboardItem({ 'text/html': blob })];
      await navigator.clipboard.write(data);
      showAlert('success', 'Turinys nukopijuotas į iškarpinę!');
    } catch (err) {
        try {
            const tempEl = document.createElement('div');
            tempEl.innerHTML = htmlContent;
            await navigator.clipboard.writeText(tempEl.innerText);
            showAlert('info', 'Nukopijuotas tik tekstas.');
        } catch (e) {
            showAlert('error', 'Nepavyko nukopijuoti.');
        }
    }
  }, [htmlContent]);

  return (
    <div className="min-h-screen bg-gray-50 flex flex-col font-sans text-gray-900">
      <Header />

      <main className="flex-grow px-4 sm:px-6 lg:px-8 py-8">
        <div className="max-w-5xl mx-auto">
          
          {/* Hero Section */}
          <div className="text-center mb-10 space-y-4">
            <h2 className="text-3xl font-bold text-gray-900 sm:text-4xl">
              Paverskite PDF į <span className="text-blue-600">Tekstą</span>
            </h2>
            <p className="text-lg text-gray-600 max-w-2xl mx-auto">
              Naudojant dirbtinį intelektą, nuskaitome tekstą, išlaikome formatavimą ir aprašome paveikslėlius lietuvių kalba.
            </p>
          </div>

          {/* Input Section */}
          <div className="space-y-4">
            <FileUploader 
              onConvert={handleConvert} 
              status={status} 
              errorMessage={errorMessage}
              processingMessage={processingMessage}
              progress={progressValue}
            />
          </div>

          {/* Initial Instructions if Idle */}
          {status === ConversionStatus.IDLE && (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-6 mt-12">
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                 <div className="bg-blue-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-blue-600 font-bold">1</div>
                 <h3 className="font-semibold mb-2">Įkelkite PDF</h3>
                 <p className="text-gray-500 text-sm">Vilkite failą į langą arba pasirinkite iš kompiuterio.</p>
              </div>
              <div className="bg-white p-6 rounded-xl shadow-sm border border-gray-100 text-center">
                 <div className="bg-purple-50 w-12 h-12 rounded-full flex items-center justify-center mx-auto mb-4 text-purple-600 font-bold">
                    <Sparkles className="w-6 h-6" />
                 </div>
                 <h3 className="font-semibold mb-2">Gemini analizė</h3>
                 <p className="text-gray-500 text-sm">AI atpažįsta antraštes, sąrašus, lenteles ir aprašo vaizdus.</p>
              </div>
            </div>
          )}

          {/* Preview Section */}
          {(status === ConversionStatus.SUCCESS || htmlContent) && (
            <div className="mt-8 border-t border-gray-200 pt-8">
              <DocumentPreview 
                htmlContent={htmlContent} 
                summary={summary}
                language={language}
                onCopy={handleCopyContent}
                alert={alert}
                fileName={fileName}
              />
            </div>
          )}
        </div>
      </main>
      
      <footer className="bg-white border-t border-gray-200 py-6 mt-auto no-print">
         <div className="max-w-7xl mx-auto px-4 text-center text-sm text-gray-500">
            &copy; {new Date().getFullYear()} PDF Lituanizer. Sukurta naudojant Google Gemini API.
         </div>
      </footer>
    </div>
  );
};

export default App;