import React from 'react';
import { FileText } from 'lucide-react';

const Header: React.FC = () => {
  return (
    <header className="bg-white border-b border-gray-200 sticky top-0 z-10 no-print">
      <div className="max-w-7xl mx-auto px-4 sm:px-6 lg:px-8 h-16 flex items-center justify-between">
        <div className="flex items-center gap-3">
          <div className="bg-blue-600 p-2 rounded-lg">
            <FileText className="h-6 w-6 text-white" />
          </div>
          <div>
            <h1 className="text-xl font-semibold text-gray-900 tracking-tight">
              PDF į Docs
            </h1>
            <p className="text-xs text-gray-500">
              Powered by Gemini 2.5
            </p>
          </div>
        </div>
        <div className="flex items-center gap-4">
           <a 
             href="#" 
             className="text-sm text-gray-500 hover:text-gray-900 transition-colors"
             onClick={(e) => e.preventDefault()}
           >
             Pagalba
           </a>
        </div>
      </div>
    </header>
  );
};

export default Header;