/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import { 
  Download, 
  Trash2,
  FileText,
  FileImage
} from 'lucide-react';
import * as pdfjsLib from 'pdfjs-dist';

// Set PDF.js worker
pdfjsLib.GlobalWorkerOptions.workerSrc = new URL(
  'pdfjs-dist/build/pdf.worker.mjs',
  import.meta.url
).toString();

export default function PdfToImage() {
  const [pdfFiles, setPdfFiles] = useState<File[]>([]);
  const [pdfImages, setPdfImages] = useState<string[]>([]);
  const [isConvertingPdf, setIsConvertingPdf] = useState(false);
  const pdfInputRef = useRef<HTMLInputElement>(null);

  const handlePdfSelect = async (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    if (files.length === 0) return;
    setPdfFiles(prev => [...prev, ...files]);
    setPdfImages([]);
  };

  const convertPdfToImages = async () => {
    if (pdfFiles.length === 0) return;
    setIsConvertingPdf(true);
    try {
      const allImageUrls: string[] = [];

      for (const file of pdfFiles) {
        const arrayBuffer = await file.arrayBuffer();
        const pdf = await pdfjsLib.getDocument({ data: arrayBuffer }).promise;

        for (let i = 1; i <= pdf.numPages; i++) {
          const page = await pdf.getPage(i);
          const viewport = page.getViewport({ scale: 2 });
          const canvas = document.createElement('canvas');
          const context = canvas.getContext('2d');
          if (!context) continue;

          canvas.height = viewport.height;
          canvas.width = viewport.width;

          const renderContext: any = {
            canvasContext: context,
            viewport: viewport
          };
          await page.render(renderContext).promise;
          allImageUrls.push(canvas.toDataURL('image/png'));
        }
      }
      setPdfImages(allImageUrls);
    } catch (error) {
      console.error("Error converting PDF:", error);
      alert("Failed to convert PDF to images.");
    } finally {
      setIsConvertingPdf(false);
    }
  };

  const downloadAllPdfImages = () => {
    pdfImages.forEach((url, index) => {
      const link = document.createElement('a');
      link.href = url;
      link.download = `page_${index + 1}.png`;
      link.click();
    });
  };

  const clearPdfToImage = () => {
    setPdfFiles([]);
    setPdfImages([]);
    if (pdfInputRef.current) pdfInputRef.current.value = '';
  };

  const removePdfFile = (index: number) => {
    setPdfFiles(prev => prev.filter((_, i) => i !== index));
    setPdfImages([]);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <FileImage className="text-blue-500" /> PDF to Image
        </h2>
        <button onClick={clearPdfToImage} className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1">
          <Trash2 size={16} /> Clear
        </button>
      </div>

      {!pdfFiles.length ? (
        <div 
          className="border-2 border-dashed border-purple-100 rounded-2xl p-12 text-center hover:bg-purple-50/50 transition-all cursor-pointer group"
          onClick={() => pdfInputRef.current?.click()}
        >
          <input type="file" multiple accept=".pdf" className="hidden" ref={pdfInputRef} onChange={handlePdfSelect} />
          <div className="bg-purple-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
            <FileText className="text-purple-600" size={32} />
          </div>
          <p className="text-lg font-semibold text-gray-700">Select PDF Files</p>
          <p className="text-sm text-gray-400 mt-1">Convert PDF pages into high-quality PNG images</p>
        </div>
      ) : (
        <div className="space-y-6">
          <div className="space-y-3">
            {pdfFiles.map((file, idx) => (
              <div key={idx} className="flex items-center justify-between p-4 bg-purple-50 rounded-2xl border border-purple-100">
                <div className="flex items-center gap-3">
                  <FileText className="text-purple-600" />
                  <div>
                    <p className="font-semibold text-gray-900">{file.name}</p>
                    <p className="text-xs text-gray-500">{(file.size / 1024 / 1024).toFixed(2)} MB</p>
                  </div>
                </div>
                <button onClick={() => removePdfFile(idx)} className="text-red-500 hover:text-red-700">
                  <Trash2 size={18} />
                </button>
              </div>
            ))}
          </div>

          <div className="flex gap-4">
            <button 
              onClick={() => pdfInputRef.current?.click()}
              className="flex-1 bg-white border border-purple-200 text-purple-600 font-bold py-3 rounded-xl hover:bg-purple-50 transition-all"
            >
              Add More PDFs
            </button>
            <input type="file" multiple accept=".pdf" className="hidden" ref={pdfInputRef} onChange={handlePdfSelect} />
            
            {pdfImages.length === 0 && (
              <button 
                onClick={convertPdfToImages}
                disabled={isConvertingPdf}
                className="flex-[2] bg-purple-600 hover:bg-purple-700 text-white px-6 py-3 rounded-xl font-bold transition-all disabled:opacity-50"
              >
                {isConvertingPdf ? 'Converting...' : `Convert ${pdfFiles.length} PDF${pdfFiles.length > 1 ? 's' : ''} to Images`}
              </button>
            )}
          </div>

          {pdfImages.length > 0 && (
            <>
              <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 gap-4">
                {pdfImages.map((url, idx) => (
                  <div key={idx} className="relative group rounded-xl overflow-hidden border border-gray-200 shadow-sm">
                    <img src={url} alt={`Page ${idx + 1}`} className="w-full h-auto" />
                    <div className="absolute top-2 left-2 bg-black/50 text-white text-[10px] px-2 py-1 rounded">
                      Page {idx + 1}
                    </div>
                    <a 
                      href={url} 
                      download={`page_${idx + 1}.png`}
                      className="absolute bottom-2 right-2 p-2 bg-white text-purple-600 rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                    >
                      <Download size={16} />
                    </a>
                  </div>
                ))}
              </div>
              <button 
                onClick={downloadAllPdfImages}
                className="w-full bg-purple-600 hover:bg-purple-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-purple-200 flex items-center justify-center gap-2"
              >
                <Download size={20} /> Download All {pdfImages.length} Pages as Images
              </button>
            </>
          )}
        </div>
      )}
    </div>
  );
}
