/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import jsPDF from 'jspdf';
import { 
  Download, 
  Trash2,
  Plus,
  Image as ImageIcon
} from 'lucide-react';

export default function ImageToPdf() {
  const [images, setImages] = useState<{file: File, preview: string}[]>([]);
  const [fileName, setFileName] = useState('images_report');
  const imageInputRef = useRef<HTMLInputElement>(null);

  const handleImageSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const files = Array.from(e.target.files || []) as File[];
    const newImages = files.map(file => ({
      file,
      preview: URL.createObjectURL(file)
    }));
    setImages(prev => [...prev, ...newImages]);
  };

  const removeImage = (index: number) => {
    setImages(prev => {
      const updated = [...prev];
      URL.revokeObjectURL(updated[index].preview);
      updated.splice(index, 1);
      return updated;
    });
  };

  const clearImages = () => {
    images.forEach(img => URL.revokeObjectURL(img.preview));
    setImages([]);
    if (imageInputRef.current) imageInputRef.current.value = '';
  };

  const generateImagePdf = () => {
    if (images.length === 0) return;
    
    // Get properties of the first image to initialize the PDF
    const tempDoc = new jsPDF();
    const firstImgProps = tempDoc.getImageProperties(images[0].preview as any);
    
    const doc = new jsPDF({
      orientation: firstImgProps.width > firstImgProps.height ? 'l' : 'p',
      unit: 'px',
      format: [firstImgProps.width, firstImgProps.height]
    });

    images.forEach((img, index) => {
      const imgProps = doc.getImageProperties(img.preview as any);
      
      if (index > 0) {
        doc.addPage([imgProps.width, imgProps.height], imgProps.width > imgProps.height ? 'l' : 'p');
      }
      
      // Add image covering the full page size
      doc.addImage(img.preview, 'JPEG', 0, 0, imgProps.width, imgProps.height);
    });
    
    doc.save(`${fileName || 'images_report'}.pdf`);
  };

  return (
    <div className="bg-white p-6 rounded-2xl shadow-sm border border-gray-100 space-y-6">
      <div className="flex justify-between items-center">
        <h2 className="text-xl font-bold text-gray-900 flex items-center gap-2">
          <ImageIcon className="text-blue-500" /> Image to PDF
        </h2>
        <button onClick={clearImages} className="text-red-500 hover:text-red-700 text-sm font-medium flex items-center gap-1">
          <Trash2 size={16} /> Clear All
        </button>
      </div>

      <div 
        className="border-2 border-dashed border-blue-100 rounded-2xl p-12 text-center hover:bg-blue-50/50 transition-all cursor-pointer group"
        onClick={() => imageInputRef.current?.click()}
      >
        <input type="file" multiple accept="image/*" className="hidden" ref={imageInputRef} onChange={handleImageSelect} />
        <div className="bg-blue-50 w-16 h-16 rounded-full flex items-center justify-center mx-auto mb-4 group-hover:scale-110 transition-transform">
          <Plus className="text-blue-600" size={32} />
        </div>
        <p className="text-lg font-semibold text-gray-700">Add Images</p>
        <p className="text-sm text-gray-400 mt-1">Select multiple images to combine into one PDF</p>
      </div>

      {images.length > 0 && (
        <>
          <div className="space-y-4">
            <div className="flex flex-col gap-2">
              <label htmlFor="filename" className="text-sm font-medium text-gray-700">PDF File Name</label>
              <div className="relative">
                <input 
                  id="filename"
                  type="text" 
                  value={fileName}
                  onChange={(e) => setFileName(e.target.value)}
                  placeholder="Enter file name"
                  className="w-full px-4 py-3 rounded-xl border border-gray-200 focus:ring-2 focus:ring-blue-500 focus:border-transparent outline-none transition-all pr-12"
                />
                <span className="absolute right-4 top-1/2 -translate-y-1/2 text-gray-400 font-medium">.pdf</span>
              </div>
            </div>

            <div className="grid grid-cols-2 sm:grid-cols-3 md:grid-cols-4 lg:grid-cols-6 gap-4">
            {images.map((img, idx) => (
              <div key={idx} className="relative group aspect-square rounded-xl overflow-hidden border border-gray-200">
                <img src={img.preview} alt="Preview" className="w-full h-full object-cover" />
                <button 
                  onClick={(e) => { e.stopPropagation(); removeImage(idx); }}
                  className="absolute top-2 right-2 p-1.5 bg-red-500 text-white rounded-xl opacity-0 group-hover:opacity-100 transition-opacity shadow-lg"
                >
                  <Trash2 size={14} />
                </button>
                <div className="absolute bottom-0 left-0 right-0 bg-black/50 text-white text-[10px] p-1 truncate">
                  {img.file.name}
                </div>
              </div>
            ))}
          </div>
        </div>
        <button 
          onClick={generateImagePdf}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-4 rounded-xl transition-all shadow-lg shadow-blue-200 flex items-center justify-center gap-2"
          >
            <Download size={20} /> Convert {images.length} Images to PDF
          </button>
        </>
      )}
    </div>
  );
}
