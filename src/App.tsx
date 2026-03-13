/**
 * @license
 * SPDX-License-Identifier: Apache-2.0
 */

import React, { useState, useRef } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { Upload, FileText, Download, Filter, FileSpreadsheet, Settings } from 'lucide-react';

interface StudentData {
  [key: string]: any;
}

export default function App() {
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
    // Reset data when a new file is selected
    setData([]);
    setFilteredData([]);
    setBranches([]);
    setSelectedBranch('');
  };

  const clearAll = () => {
    setData([]);
    setFilteredData([]);
    setColumns([]);
    setBranches([]);
    setSelectedBranch('');
    setFileName('');
    setSelectedFile(null);
    if (fileInputRef.current) {
      fileInputRef.current.value = '';
    }
  };

  const processFile = () => {
    if (!selectedFile) return;
    setIsUploading(true);

    // Use setTimeout to allow the UI to update to "Processing..." before blocking the thread
    setTimeout(() => {
      const reader = new FileReader();
      reader.onload = (evt) => {
        try {
          const dataBuffer = evt.target?.result;
          const wb = XLSX.read(dataBuffer, { type: 'array' });
          const wsname = wb.SheetNames[0];
          const ws = wb.Sheets[wsname];
          
          // Read as array of arrays to dynamically find the header row
          const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });

          // Find the header row index (look for common column names)
          let headerRowIndex = 0;
          const expectedHeaders = ['sl', 'reg', 'name', 'branch', 'merit', 'gender', 'student'];
          
          for (let i = 0; i < Math.min(20, rawData.length); i++) {
            const row = rawData[i];
            if (!Array.isArray(row)) continue;
            
            const rowString = row.join(' ').toLowerCase();
            const matchCount = expectedHeaders.filter(h => rowString.includes(h)).length;
            
            // If we find at least 3 matching headers, we assume this is the header row
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

          // Filter out completely empty rows
          const validData = formattedData.filter(row => 
            actualHeaders.some(header => row[header] !== '')
          );

          setColumns(actualHeaders);
          setData(validData);
          setFilteredData(validData);

          // Set default filter column
          const defaultFilter = actualHeaders.find(h => h.toLowerCase().includes('branch')) || actualHeaders[0] || '';
          setFilterColumn(defaultFilter);

          // Extract unique branches
          if (defaultFilter) {
            const uniqueBranches = Array.from(new Set(validData.map((row) => row[defaultFilter]).filter(Boolean)));
            setBranches(uniqueBranches.sort() as string[]);
          }
        } catch (error) {
          console.error("Error parsing Excel file:", error);
          alert("Failed to parse the Excel file. Please ensure it's a valid format.");
        } finally {
          setIsUploading(false);
        }
      };
      reader.readAsArrayBuffer(selectedFile);
    }, 50);
  };

  React.useEffect(() => {
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
    const doc = new jsPDF({
      orientation: 'landscape',
      unit: 'in',
      format: 'a4'
    });
    
    const pageWidth = doc.internal.pageSize.getWidth();
    
    // Title
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
    if (rmIndex !== -1) {
      columnStyles[rmIndex] = { cellWidth: 1.2 }; // Increase RM column width (in inches)
    }

    autoTable(doc, {
      head: [columns],
      body: tableRows,
      startY: branchName ? 0.65 : 0.45,
      styles: { 
        fontSize: 9, 
        cellPadding: 0.04,
        halign: 'center',
        valign: 'middle',
        lineWidth: 0.01,
        lineColor: [200, 200, 200]
      },
      headStyles: { 
        fillColor: [66, 139, 202],
        halign: 'center'
      },
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
        // Small delay to prevent browser blocking multiple downloads
        await new Promise(resolve => setTimeout(resolve, 500));
      }
    }
    
    setIsGeneratingBulk(false);
  };

  return (
    <div className="min-h-screen bg-gray-50 p-3 font-sans">
      <div className="w-full space-y-3">
        {/* Header */}
        <div className="bg-white p-3 rounded-l shadow-sm border border-gray-100 flex items-center justify-between">
          <div className="flex items-center space-x-4">
            <div className="p-3 bg-blue-50 text-blue-600 rounded-xl">
              <FileSpreadsheet size={28} />
            </div>
            <div>
              <h1 className="text-2xl font-semibold text-gray-900">Excel to PDF Report</h1>
              <p className="text-sm text-gray-500">Upload, filter, and generate student reports</p>
            </div>
          </div>
          <button 
            onClick={clearAll}
            className="px-6 py-2.5 bg-red-50 text-red-600 hover:bg-red-600 hover:text-white rounded-xl font-semibold transition-all duration-200 border border-red-100 flex items-center gap-2 shadow-sm active:scale-95"
          >
            Clear
          </button>
        </div>

        {/* Controls */}
        <div className="grid grid-cols-1 md:grid-cols-3 gap-3">
          {/* Upload Card */}
          <div className="bg-white p-3 rounded-l shadow-sm border border-gray-100 flex flex-col">
            <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2 mb-4">
              <Upload size={20} className="text-gray-400" />
              1. Upload Data
            </h2>
            <div 
              className="border-2 border-dashed border-gray-200 rounded-xl p-3 text-center hover:bg-gray-50 transition-colors cursor-pointer flex-grow flex flex-col justify-center mb-4"
              onClick={() => fileInputRef.current?.click()}
            >
              <input 
                type="file" 
                accept=".xlsx, .xls" 
                className="hidden" 
                ref={fileInputRef}
                onChange={handleFileSelect}
              />
              <FileText className="mx-auto h-8 w-8 text-gray-400 mb-3" />
              <p className="text-sm font-medium text-gray-700">
                {fileName ? fileName : 'Click to select Excel file'}
              </p>
              <p className="text-xs text-gray-500 mt-1">.xlsx or .xls</p>
            </div>
            <button
              onClick={processFile}
              disabled={!selectedFile || isUploading}
              className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-2.5 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
            >
              <Upload size={18} />
              {isUploading ? 'Processing...' : 'Upload'}
            </button>
          </div>

          {/* Filter Card */}
          <div className="bg-white p-3 rounded-l shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Filter size={20} className="text-gray-400" />
                2. Filter {filterColumn}
              </h2>
              <button 
                onClick={() => setShowFilterSettings(!showFilterSettings)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Customize Filter Column"
              >
                <Settings size={18} />
              </button>
            </div>
            
            {showFilterSettings && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Filter Column</label>
                <select 
                  value={filterColumn} 
                  onChange={(e) => setFilterColumn(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                >
                  {columns.map(col => (
                    <option key={col} value={col}>{col}</option>
                  ))}
                </select>
              </div>
            )}

            <div className="space-y-2 flex-grow">
              <label className="text-sm font-medium text-gray-700">Select {filterColumn}</label>
              <select 
                className="w-full border border-gray-300 rounded-xl p-3 bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all disabled:bg-gray-50 disabled:text-gray-400"
                value={selectedBranch}
                onChange={handleBranchChange}
                disabled={branches.length === 0}
              >
                <option value="">All {filterColumn}s</option>
                {branches.map((branch, idx) => (
                  <option key={idx} value={branch}>{branch}</option>
                ))}
              </select>
              <div className="text-sm text-gray-500 pt-2">
                Showing {filteredData.length} records
              </div>
            </div>
          </div>

          {/* Generate Card */}
          <div className="bg-white p-3 rounded-l shadow-sm border border-gray-100 flex flex-col">
            <div className="flex justify-between items-center mb-4">
              <h2 className="text-lg font-medium text-gray-900 flex items-center gap-2">
                <Download size={20} className="text-gray-400" />
                3. Export Report
              </h2>
              <button 
                onClick={() => setShowExportSettings(!showExportSettings)}
                className="p-1.5 text-gray-400 hover:text-gray-600 rounded-lg hover:bg-gray-100 transition-colors"
                title="Customize Report Name"
              >
                <Settings size={18} />
              </button>
            </div>

            {showExportSettings && (
              <div className="mb-4 p-4 bg-gray-50 rounded-xl border border-gray-200">
                <label className="block text-sm font-medium text-gray-700 mb-2">Report Name</label>
                <input 
                  type="text" 
                  value={reportName} 
                  onChange={(e) => setReportName(e.target.value)}
                  className="w-full border border-gray-300 rounded-lg p-2.5 text-sm bg-white focus:ring-2 focus:ring-blue-500 focus:border-blue-500 outline-none transition-all"
                  placeholder="e.g. Top Student List"
                />
              </div>
            )}

            <div className="flex-grow flex flex-col space-y-4">
              {branches.length > 0 ? (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex-grow overflow-hidden flex flex-col">
                  <h3 className="text-xs font-semibold text-gray-500 uppercase tracking-wider mb-2">
                    Files to generate ({selectedBranch === '' ? branches.length : 1})
                  </h3>
                  <div className="overflow-y-auto max-h-[120px] space-y-2 pr-2">
                    {selectedBranch === '' ? (
                      branches.map((branch, idx) => {
                        const count = data.filter(row => row[filterColumn] === branch).length;
                        return (
                          <div key={idx} className="text-sm text-gray-700 flex items-center justify-between gap-2">
                            <div className="flex items-center gap-2 overflow-hidden">
                              <FileText size={14} className="text-blue-500 flex-shrink-0" />
                              <span className="truncate">{branch}_{reportName.replace(/ /g, '_')}.pdf</span>
                            </div>
                            <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0" title={`${count} records`}>
                              {count}
                            </span>
                          </div>
                        );
                      })
                    ) : (
                      <div className="text-sm text-gray-700 flex items-center justify-between gap-2">
                        <div className="flex items-center gap-2 overflow-hidden">
                          <FileText size={14} className="text-blue-500 flex-shrink-0" />
                          <span className="truncate">{selectedBranch}_{reportName.replace(/ /g, '_')}.pdf</span>
                        </div>
                        <span className="text-xs font-medium bg-gray-200 text-gray-600 px-2 py-0.5 rounded-full flex-shrink-0" title={`${filteredData.length} records`}>
                          {filteredData.length}
                        </span>
                      </div>
                    )}
                  </div>
                </div>
              ) : (
                <div className="bg-gray-50 rounded-xl p-4 border border-gray-100 flex-grow flex items-center justify-center text-sm text-gray-400">
                  No data available to export
                </div>
              )}

              <button 
                onClick={selectedBranch === '' ? generateAllBranchesPDF : generatePDF}
                disabled={filteredData.length === 0 || isGeneratingBulk}
                className="w-full bg-blue-600 hover:bg-blue-700 text-white font-medium py-3 px-4 rounded-xl transition-colors disabled:opacity-50 disabled:cursor-not-allowed flex items-center justify-center gap-2"
              >
                <Download size={18} />
                {isGeneratingBulk ? 'Generating...' : (selectedBranch === '' ? 'Export All Branches' : 'Generate PDF')}
              </button>
            </div>
          </div>
        </div>

        {/* Data Preview */}
        <div className="bg-white rounded-l shadow-sm border border-gray-100 overflow-hidden">
          <div className="p-4 border-b border-gray-100">
            <h2 className="text-lg font-medium text-gray-900">Data Preview</h2>
          </div>
          
          {data.length === 0 ? (
            <div className="p-12 text-center text-gray-500">
              <FileSpreadsheet className="mx-auto h-12 w-12 text-gray-300 mb-4" />
              <p>Upload an Excel file to see the data preview here.</p>
            </div>
          ) : (
            <div className="overflow-x-auto max-h-[500px] overflow-y-auto relative">
              <table className="w-full text-sm text-center text-gray-500">
                <thead className="text-xs text-gray-700 uppercase bg-gray-50 sticky top-0 z-10 shadow-sm">
                  <tr>
                    {columns.map((col, idx) => (
                      <th key={idx} className="px-6 py-3 whitespace-nowrap text-center">{col}</th>
                    ))}
                  </tr>
                </thead>
                <tbody>
                  {filteredData.slice(0, 100).map((row, idx) => (
                    <tr key={idx} className="bg-white border-b hover:bg-gray-50">
                      {columns.map((col, colIdx) => (
                        <td key={colIdx} className="px-3 py-1 whitespace-nowrap text-center">{row[col]}</td>
                      ))}
                    </tr>
                  ))}
                </tbody>
              </table>
              {filteredData.length > 100 && (
                <div className="p-4 text-center text-sm text-gray-500 bg-gray-50 border-t border-gray-100">
                  Showing first 100 of {filteredData.length} records. The exported PDF will contain all {filteredData.length} records.
                </div>
              )}
            </div>
          )}
        </div>
      </div>
    </div>
  );
}
