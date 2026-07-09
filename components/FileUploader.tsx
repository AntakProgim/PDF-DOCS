import React, { useCallback, useState, useEffect } from 'react';
import { UploadCloud, File as FileIcon, X, Loader2, AlertCircle, Eye, EyeOff, Play } from 'lucide-react';
import { ConversionStatus, OcrAccuracy } from '../types';

interface FileUploaderProps {
  onConvert: (file: File, name: string, ocrAccuracy: OcrAccuracy) => void;
  status: ConversionStatus;
  errorMessage?: string | null;
  processingMessage?: string;
  progress?: number;
}

const FileUploader: React.FC<FileUploaderProps> = ({ onConvert, status, errorMessage, processingMessage, progress = 0 }) => {
  const [dragActive, setDragActive] = useState(false);
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [fileName, setFileName] = useState("");
  const [showPreview, setShowPreview] = useState(false);
  const [previewUrl, setPreviewUrl] = useState<string | null>(null);
  const [ocrAccuracy, setOcrAccuracy] = useState<OcrAccuracy>(OcrAccuracy.BALANCED);

  useEffect(() => {
    if (selectedFile) {
      const url = URL.createObjectURL(selectedFile);
      setPreviewUrl(url);
      return () => URL.revokeObjectURL(url);
    } else {
      setPreviewUrl(null);
    }
  }, [selectedFile]);

  const handleDrag = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.type === "dragenter" || e.type === "dragover") {
      setDragActive(true);
    } else if (e.type === "dragleave") {
      setDragActive(false);
    }
  }, []);

  const handleFile = (file: File) => {
    if (file.type === "application/pdf") {
      setSelectedFile(file);
      setFileName(file.name.replace(/\.pdf$/i, ''));
    } else {
      alert("Prašome įkelti tik PDF failus.");
    }
  };

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setDragActive(false);
    if (e.dataTransfer.files && e.dataTransfer.files[0]) {
      handleFile(e.dataTransfer.files[0]);
    }
  }, []);

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    e.preventDefault();
    if (e.target.files && e.target.files[0]) {
      handleFile(e.target.files[0]);
    }
  };

  const clearFile = () => {
    setSelectedFile(null);
    setFileName("");
    setShowPreview(false);
  };

  const handleConvertClick = () => {
    if (selectedFile && fileName) {
      onConvert(selectedFile, fileName, ocrAccuracy);
    }
  };

  const isProcessing = status === ConversionStatus.PROCESSING;
  const isError = status === ConversionStatus.ERROR;

  return (
    <div className="w-full max-w-3xl mx-auto mb-8 no-print">
      {!selectedFile ? (
        <div
          className={`relative flex flex-col items-center justify-center w-full h-64 border-2 border-dashed rounded-xl transition-colors duration-200 ease-in-out cursor-pointer
            ${dragActive ? "border-blue-500 bg-blue-50" : "border-gray-300 bg-white hover:bg-gray-50"}`}
          onDragEnter={handleDrag}
          onDragLeave={handleDrag}
          onDragOver={handleDrag}
          onDrop={handleDrop}
        >
          <input
            type="file"
            className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
            accept="application/pdf"
            onChange={handleChange}
            disabled={isProcessing}
          />
          <div className="flex flex-col items-center justify-center pt-5 pb-6 text-center p-4">
            <div className="bg-blue-100 p-4 rounded-full mb-4">
                <UploadCloud className="w-10 h-10 text-blue-600" />
            </div>
            <p className="mb-2 text-lg font-medium text-gray-900">
              Spauskite arba nuvilkite PDF failą čia
            </p>
            <p className="text-sm text-gray-500">
              Palaikomi .PDF failai (maks. 20MB)
            </p>
          </div>
        </div>
      ) : (
        <div className={`bg-white rounded-xl border ${isError ? 'border-red-200' : 'border-gray-200'} p-6 shadow-sm transition-all`}>
          <div className="flex flex-col gap-6">
            {/* File Info Header */}
            <div className="flex items-center justify-between">
              <div className="flex items-center gap-4">
                <div className="p-3 rounded-lg bg-red-100">
                  <FileIcon className="w-6 h-6 text-red-600" />
                </div>
                <div>
                  <p className="font-medium text-gray-900 truncate max-w-[200px] sm:max-w-md">
                    {selectedFile.name}
                  </p>
                  <p className="text-sm text-gray-500">{(selectedFile.size / 1024 / 1024).toFixed(2)} MB</p>
                </div>
              </div>
              
              {!isProcessing && (
                <button
                  onClick={clearFile}
                  className="p-2 hover:bg-gray-100 rounded-full transition-colors text-gray-400 hover:text-gray-600"
                >
                  <X className="w-5 h-5" />
                </button>
              )}
            </div>

            {/* Name Suggestion & Preview Toggle */}
            <div className="space-y-4">
              <div>
                <label htmlFor="fileName" className="block text-sm font-medium text-gray-700 mb-1">
                  Dokumento pavadinimas
                </label>
                <input
                  type="text"
                  id="fileName"
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  disabled={isProcessing}
                  placeholder="Įveskite pavadinimą..."
                  className="w-full px-4 py-2 border border-gray-300 rounded-lg focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-500"
                />
              </div>

              <div>
                <label className="block text-sm font-medium text-gray-700 mb-2">
                  OCR atpažinimo tikslumas (jei dokumentas nuskenuotas)
                </label>
                <div className="grid grid-cols-3 gap-2">
                  <button
                    onClick={() => setOcrAccuracy(OcrAccuracy.FAST)}
                    disabled={isProcessing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border flex flex-col items-center justify-center transition-all ${
                      ocrAccuracy === OcrAccuracy.FAST
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                    }`}
                  >
                    <span>Greitas</span>
                    <span className="text-[10px] font-normal opacity-70">Mažesnė raiška</span>
                  </button>
                  <button
                    onClick={() => setOcrAccuracy(OcrAccuracy.BALANCED)}
                    disabled={isProcessing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border flex flex-col items-center justify-center transition-all ${
                      ocrAccuracy === OcrAccuracy.BALANCED
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                    }`}
                  >
                    <span>Subalansuotas</span>
                    <span className="text-[10px] font-normal opacity-70">Standartinė raiška</span>
                  </button>
                  <button
                    onClick={() => setOcrAccuracy(OcrAccuracy.HIGH)}
                    disabled={isProcessing}
                    className={`px-3 py-2 text-sm font-medium rounded-lg border flex flex-col items-center justify-center transition-all ${
                      ocrAccuracy === OcrAccuracy.HIGH
                        ? 'bg-blue-50 border-blue-500 text-blue-700 ring-1 ring-blue-500'
                        : 'bg-white border-gray-200 text-gray-600 hover:bg-gray-50 disabled:opacity-50'
                    }`}
                  >
                    <span>Aukštas</span>
                    <span className="text-[10px] font-normal opacity-70">Geresnė kokybė, lėčiau</span>
                  </button>
                </div>
              </div>

              <div className="flex items-center justify-between mt-2">
                <button
                  onClick={() => setShowPreview(!showPreview)}
                  className={`flex items-center gap-2 px-3 py-1.5 rounded-lg text-sm font-medium transition-all ${
                    showPreview 
                      ? 'bg-blue-50 text-blue-600 hover:bg-blue-100' 
                      : 'bg-gray-50 text-gray-600 hover:bg-gray-100'
                  }`}
                >
                  {showPreview ? <EyeOff className="w-4 h-4" /> : <Eye className="w-4 h-4" />}
                  {showPreview ? 'Slėpti peržiūrą' : 'Peržiūrėti PDF'}
                </button>
                
                {showPreview && (
                  <span className="text-xs text-gray-400 italic">
                    Peržiūra gali skirtis nuo galutinio rezultato
                  </span>
                )}
              </div>
            </div>

            {/* PDF Preview */}
            {showPreview && previewUrl && (
              <div className="w-full h-[500px] border border-gray-200 rounded-xl overflow-hidden bg-gray-50 shadow-inner animate-in fade-in zoom-in-95 duration-300">
                <iframe
                  src={`${previewUrl}#toolbar=0&navpanes=0&scrollbar=1`}
                  className="w-full h-full border-none"
                  title="PDF Preview"
                />
              </div>
            )}

            {/* Action Button & Progress */}
            <div className="flex flex-col gap-4 pt-2 border-t border-gray-100">
              {isProcessing ? (
                <div className="space-y-4">
                  {/* Progress Bar Container */}
                  <div className="w-full">
                    <div className="flex justify-between items-end mb-2">
                      <div className="flex flex-col">
                        <span className="text-sm font-semibold text-blue-700">Apdorojama...</span>
                        {processingMessage && (
                          <span className="text-xs text-blue-500 font-medium animate-pulse">
                            {processingMessage}
                          </span>
                        )}
                      </div>
                      <span className="text-sm font-bold text-blue-700">{progress}%</span>
                    </div>
                    <div className="w-full h-3 bg-blue-50 rounded-full overflow-hidden border border-blue-100 shadow-inner">
                      <div 
                        className="h-full bg-gradient-to-r from-blue-400 to-blue-600 transition-all duration-500 ease-out relative"
                        style={{ width: `${progress}%` }}
                      >
                        {/* Shimmer Effect */}
                        <div className="absolute inset-0 w-full h-full bg-[linear-gradient(45deg,transparent_25%,rgba(255,255,255,0.2)_50%,transparent_75%)] bg-[length:200%_100%] animate-shimmer"></div>
                      </div>
                    </div>
                  </div>
                  
                  <div className="flex justify-center">
                    <div className="flex items-center gap-2 text-blue-600 bg-blue-50 px-4 py-2 rounded-full text-sm font-medium border border-blue-100">
                      <Loader2 className="w-4 h-4 animate-spin" />
                      <span>Gemini AI analizuoja dokumentą...</span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="flex justify-end">
                  <button
                    onClick={handleConvertClick}
                    disabled={!fileName}
                    className="flex items-center gap-2 bg-blue-600 hover:bg-blue-700 text-white px-8 py-2.5 rounded-lg font-semibold transition-all shadow-sm hover:shadow-md disabled:opacity-50 disabled:cursor-not-allowed w-full sm:w-auto justify-center"
                  >
                    <Play className="w-4 h-4 fill-current" />
                    Pradėti konvertavimą
                  </button>
                </div>
              )}
            </div>
          </div>

          {isError && errorMessage && (
            <div className="mt-4 p-3 bg-red-50 border border-red-100 rounded-lg flex items-start gap-3 text-red-700 animate-in slide-in-from-top-2">
                <AlertCircle className="w-5 h-5 flex-shrink-0 mt-0.5" />
                <div className="text-sm font-medium">
                    {errorMessage}
                </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
};

export default FileUploader;
