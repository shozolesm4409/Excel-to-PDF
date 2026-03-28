/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React from 'react';
import { BrowserRouter as Router, Routes, Route, NavLink, Navigate } from 'react-router-dom';
import { ArrowRightLeft } from 'lucide-react';
import ExcelToPdf from './components/ExcelToPdf';
import ExcelToSheetPdf from './components/ExcelToSheetPdf';
import ImageToPdf from './components/ImageToPdf';
import PdfToImage from './components/PdfToImage';

export default function App() {
  return (
    <Router>
      <div className="min-h-screen bg-gray-50 p-3 font-sans">
        <div className="w-full space-y-4">
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
            <div className="flex flex-wrap items-center gap-2 bg-gray-100 p-1 rounded-2xl">
              <NavLink 
                to="/excel-to-pdf"
                className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Excel to PDF
              </NavLink>
              <NavLink 
                to="/excel-to-sheetpdf"
                className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Excel to SheetPDF
              </NavLink>
              <NavLink 
                to="/image-to-pdf"
                className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                Image to PDF
              </NavLink>
              <NavLink 
                to="/pdf-to-image"
                className={({ isActive }) => `px-4 py-2 rounded-xl text-sm font-medium transition-all ${isActive ? 'bg-white text-blue-600 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
              >
                PDF to Image
              </NavLink>
            </div>
          </div>

          {/* Tab Content */}
          <div className="transition-all duration-300">
            <Routes>
              <Route path="/" element={<Navigate to="/excel-to-pdf" replace />} />
              <Route path="/excel-to-pdf" element={<ExcelToPdf />} />
              <Route path="/excel-to-sheetpdf" element={<ExcelToSheetPdf />} />
              <Route path="/image-to-pdf" element={<ImageToPdf />} />
              <Route path="/pdf-to-image" element={<PdfToImage />} />
            </Routes>
          </div>
        </div>
      </div>
    </Router>
  );
}
