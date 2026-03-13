/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef, useEffect } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Upload, 
  FileText, 
  Download, 
  Filter, 
  FileSpreadsheet, 
  Settings, 
  Trash2
} from 'lucide-react';

interface StudentData {
  [key: string]: any;
}

export default function ExcelToPdf() {
  const [data, setData] = useState<StudentData[]>([]);
  const [filteredData, setFilteredData] = useState<StudentData[]>([]);
  const [columns, setColumns] = useState<string[]>([]);
  const [branches, setBranches] = useState<string[]>([]);
  const [selectedBranch, setSelectedBranch] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [filterColumn, setFilterColumn] = useState<string>('Branch');
  const [reportName, setReportName] = useState<string>('Top Student List');
  const [showFilterSettings, setShowFilterSettings] = useState(false);
  const [showExportSettings, setShowExportSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
    setData([]);
    setFilteredData([]);
    setBranches([]);
    setSelectedBranch('');
  };

  const clearAllExcel = () => {
    setData([]);
    setFilteredData([]);
    setColumns([]);
    setBranches([]);
    setSelectedBranch('');
    setFileName('');
    setSelectedFile(null);
    if (fileInputRef.current) fileInputRef.current.value = '';
  };

  const processFile = () => {
    if (!selectedFile) return;
    setIsUploading(true);
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataBuffer = evt.target?.result;
          const wb = XLSX.read(dataBuffer, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

          let headerRowIndex = 0;
          const expectedHeaders = ['sl', 'reg', 'name', 'branch', 'merit', 'gender', 'student'];
          for (let i = 0; i < Math.min(20, rawData.length); i++) {
            const row = rawData[i];
            if (!Array.isArray(row)) continue;
            const rowString = row.join(' ').toLowerCase();
            const matchCount = expectedHeaders.filter(h => rowString.includes(h)).length;
            if (matchCount >= 3) {
              headerRowIndex = i;
              break;
            }
          }

          const headers = rawData[headerRowIndex] || [];
          const rows = rawData.slice(headerRowIndex + 1);
          const actualHeaders: string[] = [];
          headers.forEach((h, i) => {
            let colName = h ? String(h).trim() : `Column ${i+1}`;
            let counter = 1;
            let originalName = colName;
            while (actualHeaders.includes(colName)) {
              colName = `${originalName} (${counter})`;
              counter++;
            }
            actualHeaders.push(colName);
          });

          const formattedData: StudentData[] = rows.map(row => {
            const rowObj: Record<string, any> = {};
            actualHeaders.forEach((header, index) => {
              rowObj[header] = row[index] !== undefined ? row[index] : '';
            });
            return rowObj;
          });

          const validData = formattedData.filter(row => 
            actualHeaders.some(header => row[header] !== '')
          );

          setColumns(actualHeaders);
          setData(validData);
          setFilteredData(validData);
          const defaultFilter = actualHeaders.find(h => h.toLowerCase().includes('branch')) || actualHeaders[0] || '';
          setFilterColumn(defaultFilter);
          if (defaultFilter) {
            const uniqueBranches = Array.from(new Set(validData.map((row) => row[defaultFilter]).filter(Boolean)));
            setBranches(uniqueBranches.sort() as string[]);
          }
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Failed to parse the Excel file.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }, 50);
  };

  useEffect(() => {
    if (data.length > 0) {
      const uniqueValues = Array.from(new Set(data.map((row) => row[filterColumn as keyof StudentData]).filter(Boolean)));
      setBranches(uniqueValues.sort() as string[]);
      setSelectedBranch('');
      setFilteredData(data);
    }
  }, [filterColumn, data]);

  const handleBranchChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const branch = e.target.value;
    setSelectedBranch(branch);
    if (branch === '') {
      setFilteredData(data);
    } else {
      setFilteredData(data.filter((row) => row[filterColumn as keyof StudentData] === branch));
    }
  };

  const exportPdf = (pdfData: StudentData[], branchName: string) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    doc.setFontSize(18);
    doc.text(reportName, pageWidth / 2, 0.3, { align: 'center' });
    if (branchName) {
      doc.setFontSize(12);
      doc.text(`${filterColumn}: ${branchName}`, pageWidth / 2, 0.5, { align: 'center' });
    }
    const tableRows = pdfData.map((row, rowIndex) => columns.map(col => {
      const colName = col.trim().toUpperCase();
      if (colName === 'SL.' || colName === 'SL' || colName === 'SL NO' || colName === 'SERIAL') {
        return (rowIndex + 1).toString();
      }
      return row[col] || '';
    }));
    const rmIndex = columns.findIndex(col => col.trim().toUpperCase() === 'RM');
    const columnStyles: any = {};
    if (rmIndex !== -1) columnStyles[rmIndex] = { cellWidth: 1.2 };

    autoTable(doc, {
      head: [columns],
      body: tableRows,
      startY: branchName ? 0.65 : 0.45,
      styles: { fontSize: 9, cellPadding: 0.04, halign: 'center', valign: 'middle', lineWidth: 0.01, lineColor: [200, 200, 200] },
      headStyles: { fillColor: [66, 139, 202], halign: 'center' },
      columnStyles: columnStyles,
      margin: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 }
    });
    doc.save(`${branchName ? branchName + '_' : ''}${reportName.replace(/ /g, '_')}.pdf`);
  };

  const generatePDF = () => {
    exportPdf(filteredData, selectedBranch);
  };

  const generateAllBranchesPDF = async () => {
    if (branches.length === 0) return;
    setIsGeneratingBulk(true);
    for (let i = 0; i < branches.length; i++) {
      const branch = branches[i];
      const branchData = data.filter(row => row[filterColumn as keyof StudentData] === branch);
      if (branchData.length > 0) {
        exportPdf(branchData, branch);
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    setIsGeneratingBulk(false);
  };

  return (
    <div className="space-y-4">
            <div className="grid grid-cols-1 md:grid-cols-3 gap-4">
        {/* Upload Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2 mb-4">
            <Upload size={20} className="text-blue-500" />
            1. Upload Excel
          </h2>
          <div 
            className="border-2 border-dashed border-gray-200 rounded-2xl p-4 text-center hover:bg-gray-50 transition-colors cursor-pointer flex-grow flex flex-col justify-center mb-4"
            onClick={() => fileInputRef.current?.click()}
          >
            <input type="file" accept=".xlsx, .xls" className="hidden" ref={fileInputRef} onChange={handleFileSelect} />
            <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-300 mb-3" />
            <p className="text-sm font-medium text-gray-700">{fileName ? fileName : 'Select Excel file'}</p>
            <p className="text-xs text-gray-400 mt-1">.xlsx, .xls</p>
          </div>
          <button
            onClick={processFile}
            disabled={!selectedFile || isUploading}
            className="w-full bg-blue-600 hover:bg-blue-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 flex items-center justify-center gap-2 shadow-lg shadow-blue-200"
          >
            {isUploading ? 'Uploading...' : 'Upload Data'}
          </button>
        </div>

        {/* Filter Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Filter size={20} className="text-blue-500" />
              2. Filter Data
            </h2>
            <button onClick={() => setShowFilterSettings(!showFilterSettings)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors">
              <Settings size={18} />
            </button>
          </div>
          {showFilterSettings && (
            <div className="mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Filter Column</label>
              <select value={filterColumn} onChange={(e) => setFilterColumn(e.target.value)} className="w-full border border-gray-200 rounded-xl p-2 text-sm bg-white outline-none">
                {columns.map(col => <option key={col} value={col}>{col}</option>)}
              </select>
            </div>
          )}
          <div className="space-y-3 flex-grow">
            <label className="text-sm font-medium text-gray-700">Select {filterColumn}</label>
            <select 
              className="w-full border border-gray-200 rounded-xl p-3 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedBranch}
              onChange={handleBranchChange}
              disabled={branches.length === 0}
            >
              <option value="">All {filterColumn}s</option>
              {branches.map((branch, idx) => <option key={idx} value={branch}>{branch}</option>)}
            </select>
            <div className="text-sm text-gray-500">Showing {filteredData.length} records</div>
            <button 
              onClick={clearAllExcel}
              className="w-full mt-2 px-4 py-2 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl text-xs font-semibold transition-all duration-200 border border-red-100 flex items-center justify-center gap-2"
            >
              <Trash2 size={14} /> Clear All Data
            </button>
          </div>
        </div>

        {/* Export Card */}
        <div className="bg-white p-4 rounded-2xl shadow-sm border border-gray-100 flex flex-col">
          <div className="flex justify-between items-center mb-4">
            <h2 className="text-lg font-semibold text-gray-900 flex items-center gap-2">
              <Download size={20} className="text-blue-500" />
              3. Export PDF
            </h2>
            <button onClick={() => setShowExportSettings(!showExportSettings)} className="p-1.5 text-gray-400 hover:text-blue-600 rounded-xl hover:bg-blue-50 transition-colors">
              <Settings size={18} />
            </button>
          </div>
          {showExportSettings && (
            <div className="mb-4 p-3 bg-gray-50 rounded-2xl border border-gray-100">
              <label className="block text-xs font-bold text-gray-500 uppercase mb-2">Report Name</label>
              <input type="text" value={reportName} onChange={(e) => setReportName(e.target.value)} className="w-full border border-gray-200 rounded-xl p-2 text-sm bg-white outline-none" />
            </div>
          )}
          <div className="flex-grow flex flex-col space-y-4">
            {branches.length > 0 ? (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex-grow overflow-y-auto max-h-[150px] space-y-2">
                {selectedBranch === '' ? branches.map((branch, idx) => (
                  <div key={idx} className="text-xs text-gray-600 flex items-center justify-between border-b border-gray-200">
                    <span className="truncate flex-grow mr-2">
                      <span className="font-medium">{branch}</span>
                      <span className="text-gray-400">_{reportName.replace(/ /g, '_')}</span>
                    </span>
                    <span className="bg-blue-100 text-blue-600 px-2 rounded-full shrink-0">{data.filter(r => r[filterColumn] === branch).length}</span>
                  </div>
                )) : (
                  <div className="text-xs text-gray-600 flex items-center justify-between">
                    <span className="truncate flex-grow mr-2">
                      <span className="font-medium">{selectedBranch}</span>
                      <span className="text-gray-400">_{reportName.replace(/ /g, '_')}</span>
                    </span>
                    <span className="bg-blue-100 text-blue-600 px-2 rounded-full shrink-0">{filteredData.length}</span>
                  </div>
                )}
              </div>
            ) : <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-400 flex-grow flex items-center justify-center">No data to export</div>}
            <button 
              onClick={selectedBranch === '' ? generateAllBranchesPDF : generatePDF}
              disabled={filteredData.length === 0 || isGeneratingBulk}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {isGeneratingBulk ? 'Generating...' : (selectedBranch === '' ? 'Export All' : 'Download PDF')}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50">
          <h2 className="text-lg font-semibold text-gray-900">Data Preview</h2>
        </div>
        {data.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <FileSpreadsheet className="mx-auto h-16 w-16 mb-4 opacity-20" />
            <p>Upload an Excel file to see the preview</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                <tr>
                  {columns.map((col, idx) => <th key={idx} className="px-6 py-4 font-semibold">{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {filteredData.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    {columns.map((col, colIdx) => <td key={colIdx} className="px-3 py-1 text-gray-600">{row[col]}</td>)}
                  </tr>
                ))}
              </tbody>
            </table>
            {filteredData.length > 50 && <div className="p-4 text-center text-xs text-gray-400 bg-gray-50">Showing first 50 of {filteredData.length} records</div>}
          </div>
        )}
      </div>
    </div>
  );
}
