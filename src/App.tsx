/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState } from 'react';
import { ArrowRightLeft } from 'lucide-react';
import ExcelToPdf from './components/ExcelToPdf';
import ImageToPdf from './components/ImageToPdf';
import PdfToImage from './components/PdfToImage';

type TabType = 'excel-to-pdf' | 'image-to-pdf' | 'pdf-to-image';

export default function App() {
  const [activeTab, setActiveTab] = useState<TabType>('excel-to-pdf');

  return (
    <div className="min-h-screen bg-gray-50 p-3 font-sans">
      <div className="w-full max-w-7xl mx-auto space-y-4">
        {/* Header */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col md:flex-row items-center justify-between gap-4">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-2xl">
              <ArrowRightLeft size={32} />
            </div>
            <div>
              <h1 className="text-2xl font-bold text-gray-900">Document Converter</h1>
              <p className="text-sm text-gray-500">Professional File Conversion Suite</p>
            </div>
          </div>
          <div className="flex items-center gap-2 bg-gray-100 p-1 rounded-2xl">
            <button 
              onClick={() => setActiveTab('excel-to-pdf')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'excel-to-pdf' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Excel to PDF
            </button>
            <button 
              onClick={() => setActiveTab('image-to-pdf')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'image-to-pdf' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              Image to PDF
            </button>
            <button 
              onClick={() => setActiveTab('pdf-to-image')}
              className={`px-4 py-2 rounded-xl text-sm font-medium transition-all ${activeTab === 'pdf-to-image' ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              PDF to Image
            </button>
          </div>
        </div>

        {/* Tab Content */}
        <div className="transition-all duration-300">
          {activeTab === 'excel-to-pdf' && <ExcelToPdf />}
          {activeTab === 'image-to-pdf' && <ImageToPdf />}
          {activeTab === 'pdf-to-image' && <PdfToImage />}
        </div>
      </div>
    </div>
  );
}
