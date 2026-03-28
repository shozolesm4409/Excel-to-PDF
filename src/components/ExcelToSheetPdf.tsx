import React, { useState, useRef, useMemo } from 'react';
import * as XLSX from 'xlsx';
import jsPDF from 'jspdf';
import autoTable from 'jspdf-autotable';
import { 
  Upload, 
  Download, 
  Filter, 
  FileSpreadsheet, 
  Settings, 
  Trash2,
  Layers
} from 'lucide-react';

interface SheetData {
  sheetName: string;
  data: any[];
  columns: string[];
  titleRow?: any[];
  merges?: XLSX.Range[];
  originalRowIndices?: number[];
  originalColIndices?: number[];
}

export default function ExcelToSheetPdf() {
  const [sheetsData, setSheetsData] = useState<SheetData[]>([]);
  const [selectedSheet, setSelectedSheet] = useState<string>('');
  const [previewSheet, setPreviewSheet] = useState<string>('');
  const [fileName, setFileName] = useState<string>('');
  const [selectedFile, setSelectedFile] = useState<File | null>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isGeneratingBulk, setIsGeneratingBulk] = useState(false);
  const [reportName, setReportName] = useState<string>('');
  const [showExportSettings, setShowExportSettings] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  const handleFileSelect = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;
    setSelectedFile(file);
    setFileName(file.name);
    setSheetsData([]);
    setSelectedSheet('');
    setPreviewSheet('');
  };

  const clearAllExcel = () => {
    setSheetsData([]);
    setSelectedSheet('');
    setPreviewSheet('');
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
          
          const parsedSheets: SheetData[] = [];
          
          wb.SheetNames.forEach(sheetName => {
            const ws = wb.Sheets[sheetName];
            const merges = ws['!merges'] || [];
            const rawData = XLSX.utils.sheet_to_json<any[]>(ws, { header: 1, defval: '' });
            
            if (rawData.length === 0) return;

            // Find header row by looking for the row with the most non-empty cells in the first 20 rows
            let headerRowIndex = 0;
            let maxCells = 0;
            for (let i = 0; i < Math.min(20, rawData.length); i++) {
              const row = rawData[i];
              if (Array.isArray(row)) {
                const nonEmptyCount = row.filter(cell => cell !== undefined && cell !== null && String(cell).trim() !== '').length;
                if (nonEmptyCount > maxCells) {
                  maxCells = nonEmptyCount;
                  headerRowIndex = i;
                }
              }
            }

            const headers = rawData[headerRowIndex] || [];
            const rows = rawData.slice(headerRowIndex + 1);
            
            const actualHeaders: string[] = [];
            const originalColIndices: number[] = [];
            headers.forEach((h, i) => {
              let colName = h ? String(h).trim() : `Column ${i+1}`;
              let counter = 1;
              let originalName = colName;
              while (actualHeaders.includes(colName)) {
                colName = `${originalName} (${counter})`;
                counter++;
              }
              actualHeaders.push(colName);
              originalColIndices.push(i);
            });

            const validData: any[] = [];
            const originalRowIndices: number[] = [];

            rows.forEach((row, idx) => {
              const rowObj: Record<string, any> = {};
              actualHeaders.forEach((header, index) => {
                const origColIdx = originalColIndices[index];
                rowObj[header] = row[origColIdx] !== undefined ? row[origColIdx] : '';
              });
              
              if (actualHeaders.some(header => rowObj[header] !== '')) {
                validData.push(rowObj);
                originalRowIndices.push(headerRowIndex + 1 + idx);
              }
            });

            // Add the original header row as the first data row if needed, 
            // but since we want to show the "heading cell" (which might be above the actual headers),
            // let's include all rows from the very beginning that have data.
            
            // Let's re-process to include everything from row 0 up to the header row as part of the data,
            // or just use the raw data directly for the PDF to preserve everything.
            
            // Actually, the user wants the "heading cell" to show in the PDF.
            // This usually means the title row at the very top (e.g., row 0).
            // Let's capture the title row if it exists.
            let titleRow: any[] = [];
            if (headerRowIndex > 0) {
              for (let i = 0; i < headerRowIndex; i++) {
                 const row = rawData[i];
                 if (Array.isArray(row) && row.some(cell => cell !== undefined && cell !== null && String(cell).trim() !== '')) {
                     titleRow = row;
                     break;
                 }
              }
            }

            if (actualHeaders.length > 0 && validData.length > 0) {
              parsedSheets.push({
                sheetName,
                columns: actualHeaders,
                data: validData,
                titleRow: titleRow.length > 0 ? titleRow : undefined,
                merges: merges,
                originalRowIndices: originalRowIndices,
                originalColIndices: originalColIndices
              });
            }
          });

          if (parsedSheets.length > 0) {
            setPreviewSheet(parsedSheets[0].sheetName);
          }
          setSheetsData(parsedSheets);
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

  const handleSheetChange = (e: React.ChangeEvent<HTMLSelectElement>) => {
    const val = e.target.value;
    setSelectedSheet(val);
    if (val !== '') {
      setPreviewSheet(val);
    }
  };

  const exportPdf = (sheet: SheetData) => {
    const doc = new jsPDF({ orientation: 'landscape', unit: 'in', format: 'a4' });
    const pageWidth = doc.internal.pageSize.getWidth();
    
    let startY = 0.3;

    if (reportName) {
      doc.setFontSize(18);
      doc.text(reportName, pageWidth / 2, startY, { align: 'center' });
      startY += 0.3;
    }
    
    const grid = computeGrid(sheet);

    const tableRows = grid.map(row => row.filter(cell => !cell.skip).map(cell => {
      const cellObj: any = {
        content: cell.content,
        rowSpan: cell.rowSpan,
        colSpan: cell.colSpan,
      };
      if (cell.styles) cellObj.styles = cell.styles;
      return cellObj;
    }));

    // If there's a title row (heading cell), add it as a special header row spanning all columns
    let didDrawPage = (data: any) => {};
    
    if (sheet.titleRow && sheet.titleRow.length > 0) {
       const titleText = sheet.titleRow.find(cell => cell !== undefined && cell !== null && String(cell).trim() !== '') || '';
       if (titleText) {
          doc.setFontSize(14);
          doc.setFont("helvetica", "bold");
          doc.text(String(titleText), pageWidth / 2, startY, { align: 'center' });
          startY += 0.2;
       }
    }

    autoTable(doc, {
      head: [sheet.columns],
      body: tableRows,
      startY: startY,
      theme: 'grid',
      styles: { 
        fontSize: 8, 
        cellPadding: 0.04, 
        halign: 'center', 
        valign: 'middle', 
        lineWidth: 0.01, 
        lineColor: [0, 0, 0],
        textColor: [0, 0, 0]
      },
      headStyles: { 
        fillColor: [66, 139, 202], 
        textColor: [255, 255, 255],
        halign: 'center' 
      },
      bodyStyles: {
        fillColor: [255, 255, 255]
      },
      alternateRowStyles: {
        fillColor: [255, 255, 255]
      },
      margin: { top: 0.2, right: 0.2, bottom: 0.2, left: 0.2 },
    });
    
    const fileNameSuffix = reportName ? `_${reportName.replace(/ /g, '_')}` : '';
    doc.save(`${sheet.sheetName}${fileNameSuffix}.pdf`);
  };

  const generatePDF = () => {
    const sheet = sheetsData.find(s => s.sheetName === selectedSheet);
    if (sheet) {
      exportPdf(sheet);
    }
  };

  const generateAllSheetsPDF = async () => {
    if (sheetsData.length === 0) return;
    setIsGeneratingBulk(true);
    for (let i = 0; i < sheetsData.length; i++) {
      exportPdf(sheetsData[i]);
      await new Promise(resolve => setTimeout(resolve, 500));
    }
    setIsGeneratingBulk(false);
  };

  const activeSheetData = previewSheet 
    ? sheetsData.find(s => s.sheetName === previewSheet) 
    : sheetsData[0];

  const computeGrid = (sheet: SheetData) => {
    const grid: any[][] = sheet.data.map((row, rowIndex) => {
      return sheet.columns.map((col, colIndex) => {
        const colName = col.trim().toUpperCase();
        let content = row[col] || '';
        if (colName === 'SL.' || colName === 'SL' || colName === 'SL NO' || colName === 'SERIAL') {
          content = (rowIndex + 1).toString();
        }
        return {
          content: content,
          rowSpan: 1,
          colSpan: 1,
          skip: false,
          origRow: sheet.originalRowIndices![rowIndex],
          origCol: sheet.originalColIndices![colIndex]
        };
      });
    });

    if (sheet.merges && sheet.merges.length > 0) {
      sheet.merges.forEach(merge => {
        let startR = -1;
        let startC = -1;
        
        for (let r = 0; r < grid.length; r++) {
          if (grid[r][0].origRow >= merge.s.r && grid[r][0].origRow <= merge.e.r) {
            if (startR === -1) startR = r;
          }
        }
        
        for (let c = 0; c < grid[0].length; c++) {
          if (grid[0][c].origCol >= merge.s.c && grid[0][c].origCol <= merge.e.c) {
            if (startC === -1) startC = c;
          }
        }

        if (startR !== -1 && startC !== -1) {
          let rowSpan = 0;
          for (let r = startR; r < grid.length; r++) {
            if (grid[r][0].origRow <= merge.e.r) rowSpan++;
            else break;
          }
          
          let colSpan = 0;
          for (let c = startC; c < grid[0].length; c++) {
            if (grid[0][c].origCol <= merge.e.c) colSpan++;
            else break;
          }

          if (rowSpan > 1 || colSpan > 1) {
            grid[startR][startC].rowSpan = rowSpan;
            grid[startR][startC].colSpan = colSpan;
            grid[startR][startC].styles = { halign: 'center', valign: 'middle' };
            grid[startR][startC].isMerged = true;

            for (let r = startR; r < startR + rowSpan; r++) {
              for (let c = startC; c < startC + colSpan; c++) {
                if (r !== startR || c !== startC) {
                  grid[r][c].skip = true;
                }
              }
            }
          }
        }
      });
    }
    return grid;
  };

  const previewGrid = useMemo(() => {
    if (!activeSheetData) return [];
    return computeGrid(activeSheetData);
  }, [activeSheetData]);

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
              2. Filter Sheet
            </h2>
          </div>
          <div className="space-y-3 flex-grow">
            <label className="text-sm font-medium text-gray-700">Select Sheet</label>
            <select 
              className="w-full border border-gray-200 rounded-xl p-3 bg-white outline-none focus:ring-2 focus:ring-blue-500"
              value={selectedSheet}
              onChange={handleSheetChange}
              disabled={sheetsData.length === 0}
            >
              <option value="">All Sheets</option>
              {sheetsData.map((sheet, idx) => <option key={idx} value={sheet.sheetName}>{sheet.sheetName}</option>)}
            </select>
            <div className="text-sm text-gray-500">
              {selectedSheet 
                ? `Showing ${activeSheetData?.data.length || 0} records` 
                : `Total ${sheetsData.length} sheets loaded`}
            </div>
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
            {sheetsData.length > 0 ? (
              <div className="bg-gray-50 rounded-xl p-3 border border-gray-100 flex-grow overflow-y-auto max-h-[150px] space-y-2">
                {selectedSheet === '' ? sheetsData.map((sheet, idx) => (
                  <div key={idx} className="text-xs text-gray-600 flex items-center justify-between border-b border-gray-200 pb-1">
                    <span className="truncate flex-grow mr-2">
                      <span className="font-medium">{sheet.sheetName}</span>
                      {reportName && <span className="text-gray-400">_{reportName.replace(/ /g, '_')}</span>}
                    </span>
                    <span className="bg-blue-100 text-blue-600 px-2 rounded-full shrink-0">{sheet.data.length}</span>
                  </div>
                )) : (
                  <div className="text-xs text-gray-600 flex items-center justify-between">
                    <span className="truncate flex-grow mr-2">
                      <span className="font-medium">{selectedSheet}</span>
                      {reportName && <span className="text-gray-400">_{reportName.replace(/ /g, '_')}</span>}
                    </span>
                    <span className="bg-blue-100 text-blue-600 px-2 rounded-full shrink-0">{activeSheetData?.data.length || 0}</span>
                  </div>
                )}
              </div>
            ) : <div className="bg-gray-50 rounded-xl p-4 text-center text-sm text-gray-400 flex-grow flex items-center justify-center">No data to export</div>}
            <button 
              onClick={selectedSheet === '' ? generateAllSheetsPDF : generatePDF}
              disabled={sheetsData.length === 0 || isGeneratingBulk}
              className="w-full bg-emerald-600 hover:bg-emerald-700 text-white font-bold py-3 rounded-xl transition-all disabled:opacity-50 shadow-lg shadow-emerald-100 flex items-center justify-center gap-2"
            >
              <Download size={18} />
              {isGeneratingBulk ? 'Generating...' : (selectedSheet === '' ? 'Export All Sheets' : 'Download PDF')}
            </button>
          </div>
        </div>
      </div>

      {/* Preview Table */}
      <div className="bg-white rounded-2xl shadow-sm border border-gray-100 overflow-hidden">
        <div className="p-4 border-b border-gray-100 bg-gray-50/50 flex flex-col sm:flex-row justify-between items-start sm:items-center gap-4">
          <h2 className="text-lg font-semibold text-gray-900">
            Data Preview {selectedSheet ? `- ${activeSheetData?.sheetName}` : ''}
          </h2>
          {selectedSheet === '' && sheetsData.length > 0 && (
            <div className="flex items-center gap-2 w-full sm:w-auto">
              <label className="text-sm font-medium text-gray-700 whitespace-nowrap">Preview Sheet:</label>
              <select 
                className="w-full sm:w-auto border border-gray-200 rounded-xl p-2 text-sm bg-white outline-none focus:ring-2 focus:ring-blue-500"
                value={previewSheet}
                onChange={(e) => setPreviewSheet(e.target.value)}
              >
                {sheetsData.map((sheet, idx) => (
                  <option key={idx} value={sheet.sheetName}>{sheet.sheetName}</option>
                ))}
              </select>
            </div>
          )}
        </div>
        {sheetsData.length === 0 ? (
          <div className="p-16 text-center text-gray-400">
            <Layers className="mx-auto h-16 w-16 mb-4 opacity-20" />
            <p>Upload an Excel file to see the sheet preview</p>
          </div>
        ) : (
          <div className="overflow-x-auto max-h-[500px]">
            <table className="w-full text-sm text-left">
              <thead className="text-xs text-gray-500 uppercase bg-gray-50 sticky top-0 z-10">
                <tr>
                  {activeSheetData?.columns.map((col, idx) => <th key={idx} className="px-6 py-4 font-semibold">{col}</th>)}
                </tr>
              </thead>
              <tbody className="divide-y divide-gray-100">
                {previewGrid.slice(0, 50).map((row, idx) => (
                  <tr key={idx} className="hover:bg-blue-50/30 transition-colors">
                    {row.map((cell, colIdx) => {
                      if (cell.skip) return null;
                      return (
                        <td 
                          key={colIdx} 
                          rowSpan={cell.rowSpan} 
                          colSpan={cell.colSpan} 
                          className={`px-3 py-1 text-gray-600 border border-gray-100 ${cell.isMerged ? 'text-center align-middle bg-gray-50/50 font-medium' : ''}`}
                        >
                          {cell.content}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
            {(activeSheetData?.data.length || 0) > 50 && <div className="p-4 text-center text-xs text-gray-400 bg-gray-50">Showing first 50 of {activeSheetData?.data.length} records</div>}
          </div>
        )}
      </div>
    </div>
  );
}
