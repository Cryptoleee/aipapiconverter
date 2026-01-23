import React, { useState, useEffect } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { CropEditor } from './components/CropEditor';
import { Button } from './components/Button';
import { CropState, GeneratedFile, BatchResult, ExportOptions } from './types';
import { processExports, generateZip } from './services/pdfService';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Printer, Pencil, Layers, Archive, Settings2, CheckSquare, Square, ChevronLeft, ChevronRight, Check, Copy } from 'lucide-react';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [thumbnails, setThumbnails] = useState<string[]>([]);
  
  // State for batch management
  const [currentFileIndex, setCurrentFileIndex] = useState(0);
  const [crops, setCrops] = useState<CropState[]>([]);
  const [currentImgDims, setCurrentImgDims] = useState<{width: number, height: number} | null>(null);

  const [editorLayoutWidth, setEditorLayoutWidth] = useState<number>(0);
  
  // Output Configuration State - Now an Array for per-file settings
  const [fileSettings, setFileSettings] = useState<ExportOptions[]>([]);

  const [fileNames, setFileNames] = useState<string[]>([]);
  const [batchNameInput, setBatchNameInput] = useState("");
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);

  // Helper to get current options safely
  const currentOptions = fileSettings[currentFileIndex] || {
      includePdf: false,
      includeWebpFixed: false,
      includeResize: true,
      resizeScale: 50
  };

  // Helper to determine if we are in "Resize Only" mode for the current image
  const onlyResize = currentOptions.includeResize && !currentOptions.includePdf && !currentOptions.includeWebpFixed;

  // Helper to load image for preview and get dimensions
  const loadMainPreview = (file: File) => {
    const reader = new FileReader();
    reader.onload = (e) => {
      const src = e.target?.result as string;
      setPreviewSrc(src);
      
      // Get dimensions for resize calculator
      const img = new Image();
      img.onload = () => {
        setCurrentImgDims({ width: img.naturalWidth, height: img.naturalHeight });
      };
      img.src = src;
    };
    reader.readAsDataURL(file);
  };

  const handleImageSelect = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    
    // Initialize file names
    const initialNames = selectedFiles.map(f => 
      f.name.substring(0, f.name.lastIndexOf('.')) || f.name
    );
    setFileNames(initialNames);

    // Initialize crops for all files
    const initialCrops = selectedFiles.map(() => ({ x: 0, y: 0, scale: 1 }));
    setCrops(initialCrops);

    // Initialize settings for all files (Default: Resize 50% only)
    const initialSettings = selectedFiles.map(() => ({
        includePdf: false,
        includeWebpFixed: false,
        includeResize: true,
        resizeScale: 50
    }));
    setFileSettings(initialSettings);

    // Generate thumbnails
    const newThumbnails = selectedFiles.map(file => URL.createObjectURL(file));
    setThumbnails(newThumbnails);

    // Set first file active
    setCurrentFileIndex(0);
    loadMainPreview(selectedFiles[0]);
    
    setResults(null);
  };

  const switchFile = (index: number) => {
      if (index >= 0 && index < files.length) {
          setCurrentFileIndex(index);
          loadMainPreview(files[index]);
      }
  }

  const handleNextImage = () => switchFile(currentFileIndex + 1);
  const handlePrevImage = () => switchFile(currentFileIndex - 1);

  // Update crop for the CURRENT file index
  const handleCropChange = (newCrop: CropState) => {
    setCrops(prev => {
      const newCrops = [...prev];
      newCrops[currentFileIndex] = newCrop;
      return newCrops;
    });
  };

  const handleNameChange = (index: number, newName: string) => {
    const updatedNames = [...fileNames];
    updatedNames[index] = newName;
    setFileNames(updatedNames);
  };
  
  const applyBatchRename = () => {
      if (!batchNameInput.trim()) return;
      const newNames = files.map((_, idx) => `${batchNameInput.trim()}_${idx + 1}`);
      setFileNames(newNames);
  };

  const applyCropToAll = () => {
      const current = crops[currentFileIndex];
      setCrops(files.map(() => ({ ...current })));
      alert("Current position and scale applied to all images.");
  };

  const applySettingsToAll = () => {
      const current = fileSettings[currentFileIndex];
      setFileSettings(files.map(() => ({ ...current })));
      alert("Export settings applied to all images.");
  };

  const handleGenerate = async () => {
    // Check if any file has any output selected
    const hasAnyOutput = fileSettings.some(s => s.includePdf || s.includeWebpFixed || s.includeResize);

    if (!previewSrc || files.length === 0) return;
    
    if (!hasAnyOutput) {
        alert("Please select at least one output format for at least one image.");
        return;
    }

    setIsProcessing(true);
    
    setTimeout(async () => {
      try {
        const batchResults: BatchResult[] = [];

        // Iterate through all files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            const settings = fileSettings[i];

            // Skip if no output selected for this file
            if (!settings.includePdf && !settings.includeWebpFixed && !settings.includeResize) {
                continue;
            }
            
            let baseName = fileNames[i]?.trim();
            if (!baseName) {
                baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            }

            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(e);
                img.src = objectUrl;
            });

            try {
                // Use the SPECIFIC crop and settings for this file index
                const fileCrop = crops[i];
                
                // For layout width, we might need a fallback if the user never viewed this specific image
                // in non-resize mode. However, since logic passes editorLayoutWidth, 
                // and that is updated by the CropEditor component, we assume reasonable defaults or
                // that the user has previewed it. 
                // To be safe, we use the current editorLayoutWidth or a safe fallback (e.g. 500)
                // if it wasn't captured yet. Ideally, the service handles the ratio purely.
                const layoutW = editorLayoutWidth || 500; 

                const generatedFiles = await processExports(
                    img, 
                    fileCrop, 
                    layoutW, 
                    baseName, 
                    settings, 
                    file.size
                );
                
                batchResults.push({
                    originalName: baseName,
                    files: generatedFiles
                });
            } finally {
                URL.revokeObjectURL(objectUrl);
            }
        }
        
        setResults(batchResults);
      } catch (error) {
        console.error("Processing failed", error);
        alert("An error occurred while generating the files.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleReset = () => {
    // Revoke thumbnails
    thumbnails.forEach(url => URL.revokeObjectURL(url));
    setThumbnails([]);
    
    setFiles([]);
    setPreviewSrc(null);
    setResults(null);
    setCrops([]);
    setFileSettings([]);
    setCurrentFileIndex(0);
    setEditorLayoutWidth(0);
    setFileNames([]);
    setCurrentImgDims(null);
    setBatchNameInput("");
  };

  const downloadFile = (file: GeneratedFile) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const downloadZip = async () => {
    if (!results) return;
    const blob = await generateZip(results);
    const url = URL.createObjectURL(blob);
    const a = document.createElement('a');
    a.href = url;
    a.download = results.length > 1 ? "converted_batch.zip" : `${results[0].originalName}_bundle.zip`;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
  };

  const isBatch = files.length > 1;

  const toggleOption = (key: keyof ExportOptions) => {
      setFileSettings(prev => {
          const newSettings = [...prev];
          newSettings[currentFileIndex] = {
              ...newSettings[currentFileIndex],
              [key]: !newSettings[currentFileIndex][key]
          };
          return newSettings;
      });
  };

  const updateResizeScale = (val: number) => {
    setFileSettings(prev => {
        const newSettings = [...prev];
        newSettings[currentFileIndex] = {
            ...newSettings[currentFileIndex],
            resizeScale: val
        };
        return newSettings;
    });
  };

  // Calculate dynamic resize dimensions
  const getResizeDimensions = () => {
    if (!currentImgDims) return '';
    const scale = currentOptions.resizeScale / 100;
    const w = Math.round(currentImgDims.width * scale);
    const h = Math.round(currentImgDims.height * scale);
    return `${w} x ${h} px`;
  };

  return (
    <div className="min-h-screen bg-neutral-950 text-neutral-100 pb-20 selection:bg-brand-500 selection:text-white">
      {/* Header */}
      <header className="bg-neutral-900/80 backdrop-blur-md border-b border-neutral-800 sticky top-0 z-50">
        <div className="max-w-5xl mx-auto px-6 h-16 flex items-center justify-between">
          <div className="flex items-center gap-3">
            <div className="w-8 h-8 bg-gradient-orange rounded-lg flex items-center justify-center text-white font-bold shadow-lg shadow-orange-500/20">
              A
            </div>
            <h1 className="text-xl font-bold tracking-tight text-white">
              Ai Papi <span className="text-transparent bg-clip-text bg-gradient-orange">Converter</span>
            </h1>
          </div>
          {previewSrc && (
            <button 
              onClick={handleReset} 
              className="text-sm font-medium text-neutral-400 hover:text-red-400 transition-colors flex items-center gap-1"
            >
              <ArrowLeft className="w-4 h-4" /> Start Over
            </button>
          )}
        </div>
      </header>

      <main className="max-w-5xl mx-auto px-6 py-8">
        
        {!previewSrc ? (
          // STEP 1: UPLOAD
          <div className="max-w-2xl mx-auto mt-12 animate-in fade-in slide-in-from-bottom-4 duration-500">
            <div className="text-center mb-10">
              <h2 className="text-3xl font-bold text-white mb-3">Upload your artwork</h2>
              <p className="text-neutral-400 text-lg">We'll convert it to A1 & A2 PDFs (300dpi) and web formats automatically.</p>
            </div>
            <ImageUploader onImageSelected={handleImageSelect} />
            
            <div className="mt-12 grid grid-cols-1 md:grid-cols-3 gap-6">
              <FeatureCard 
                icon={<Printer className="w-6 h-6 text-brand-500" />}
                title="Print Ready"
                desc="A1 & A2 formats with 3mm bleed included."
              />
               <FeatureCard 
                icon={<Layers className="w-6 h-6 text-brand-500" />}
                title="Batch Support"
                desc="Upload multiple images and convert them all at once."
              />
               <FeatureCard 
                icon={<FileText className="w-6 h-6 text-brand-500" />}
                title="Web Optimized"
                desc="Includes a 912x1296px WebP version."
              />
            </div>
          </div>
        ) : !results ? (
          // STEP 2: EDIT
          <div className="grid grid-cols-1 lg:grid-cols-3 gap-8 h-[calc(100vh-140px)] min-h-[600px] animate-in fade-in zoom-in-95 duration-300">
            <div className="lg:col-span-2 flex flex-col h-full gap-4">
               {/* Top Bar */}
               <div className="flex items-center justify-between">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-neutral-200">
                    <ImageIcon className="w-5 h-5 text-neutral-500" />
                    {onlyResize ? "Image Preview" : "Adjust Position & Scale"}
                  </h3>
                  
                  {isBatch && !onlyResize && (
                    <Button variant="secondary" size="sm" onClick={applyCropToAll} className="h-8 text-xs gap-1.5 px-3">
                        <Copy className="w-3.5 h-3.5" /> Apply Position to All
                    </Button>
                  )}
                  
                  {!onlyResize && !isBatch && (
                    <span className="text-xs font-medium px-2 py-1 bg-neutral-900 rounded text-neutral-400 border border-neutral-800 ml-auto">
                        Previewing A1 (Full Bleed)
                    </span>
                  )}
               </div>
               
               {/* Main Editor Area */}
               <div className={`flex-1 min-h-0 ${onlyResize ? 'bg-neutral-900 rounded-xl overflow-hidden border border-neutral-800 flex items-center justify-center p-8' : ''}`}>
                  {onlyResize ? (
                      <div className="relative w-full h-full flex items-center justify-center">
                          <img 
                            src={previewSrc} 
                            alt="Preview" 
                            className="max-w-full max-h-full object-contain shadow-2xl rounded-lg"
                          />
                          <div className="absolute bottom-4 bg-neutral-900/90 backdrop-blur px-4 py-2 rounded-full border border-neutral-700 text-neutral-400 text-sm">
                             Resizing Only - No cropping required
                          </div>
                      </div>
                  ) : (
                      <CropEditor 
                        key={currentFileIndex}
                        imageSrc={previewSrc} 
                        onCropChange={handleCropChange}
                        onLayoutChange={setEditorLayoutWidth}
                        initialCrop={crops[currentFileIndex]}
                      />
                  )}
               </div>

               {/* Mini Gallery Strip */}
               {isBatch && (
                   <div className="h-24 bg-neutral-900 rounded-xl border border-neutral-800 flex flex-col p-3">
                       <div className="flex items-center justify-between mb-2 px-1">
                           <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                               Batch Gallery ({currentFileIndex + 1}/{files.length})
                           </span>
                       </div>
                       <div className="flex-1 overflow-x-auto overflow-y-hidden flex items-center gap-3 custom-scrollbar pb-1">
                           {thumbnails.map((thumb, idx) => (
                               <button 
                                key={idx}
                                onClick={() => switchFile(idx)}
                                className={`relative group flex-shrink-0 h-12 w-12 rounded-lg overflow-hidden border-2 transition-all ${
                                    currentFileIndex === idx 
                                    ? 'border-brand-500 ring-2 ring-brand-500/20' 
                                    : 'border-neutral-700 hover:border-neutral-500 opacity-60 hover:opacity-100'
                                }`}
                               >
                                   <img src={thumb} alt="" className="w-full h-full object-cover" />
                                   
                                   {/* Status Indicator Dot */}
                                   <div className={`absolute top-0.5 right-0.5 w-2 h-2 rounded-full ${
                                       fileSettings[idx].includePdf || fileSettings[idx].includeWebpFixed || fileSettings[idx].includeResize 
                                       ? 'bg-emerald-500' 
                                       : 'bg-neutral-600'
                                   }`}></div>
                               </button>
                           ))}
                       </div>
                   </div>
               )}
            </div>

            {/* Sidebar Controls */}
            <div className="bg-neutral-900 rounded-2xl p-6 shadow-xl border border-neutral-800 h-fit lg:mt-11 flex flex-col">
              <h3 className="text-lg font-bold mb-6 text-white flex items-center justify-between">
                  <span>Export Settings</span>
                  {isBatch && (
                      <button 
                        onClick={applySettingsToAll}
                        title="Apply current settings to all files"
                        className="text-[10px] bg-neutral-800 hover:bg-neutral-700 text-neutral-300 px-2 py-1 rounded transition-colors border border-neutral-700"
                      >
                          Apply to All
                      </button>
                  )}
              </h3>
              
              <div className="mb-6 flex-1 min-h-0 flex flex-col overflow-y-auto pr-1 custom-scrollbar">
                
                {/* --- File Naming Section --- */}
                <div className="mb-6">
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider mb-2">
                        Filename
                    </label>

                    {/* Batch Rename Input */}
                    {isBatch && (
                         <div className="mb-3 p-3 bg-neutral-800/50 rounded-lg border border-neutral-800">
                             <label className="block text-[10px] font-medium text-neutral-400 mb-1.5 uppercase tracking-wide">
                                Batch Rename
                             </label>
                             <div className="flex gap-2">
                                <input
                                    type="text"
                                    value={batchNameInput}
                                    onChange={(e) => setBatchNameInput(e.target.value)}
                                    className="flex-1 bg-neutral-950 border border-neutral-700 text-neutral-100 text-xs rounded px-2 py-1.5 focus:border-brand-500 outline-none"
                                    placeholder="e.g. Summer_Collection"
                                />
                                <button 
                                    onClick={applyBatchRename}
                                    disabled={!batchNameInput}
                                    className="px-3 py-1 bg-neutral-700 hover:bg-neutral-600 text-white text-xs font-medium rounded disabled:opacity-50 transition-colors"
                                >
                                    Apply
                                </button>
                             </div>
                             <p className="text-[10px] text-neutral-500 mt-1.5">
                                 Will become: {batchNameInput ? batchNameInput : "name"}_1, {batchNameInput ? batchNameInput : "name"}_2...
                             </p>
                         </div>
                    )}

                    <div className="relative group">
                        <input
                            type="text"
                            value={fileNames[currentFileIndex] || ""}
                            onChange={(e) => handleNameChange(currentFileIndex, e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-700 text-neutral-100 font-medium text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent block w-full pl-3 pr-10 py-2.5 placeholder-neutral-600 outline-none transition-all"
                            placeholder="Enter file name"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                            <Pencil className="w-4 h-4 opacity-50" />
                        </div>
                    </div>
                </div>
                
                <div className="h-px bg-neutral-800 mb-6"></div>

                {/* --- Output Options Section --- */}
                <div className="mb-2 flex items-center gap-2">
                    <Settings2 className="w-4 h-4 text-neutral-400" />
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                        Output Formats
                    </label>
                </div>

                <div className="space-y-3 mb-6">
                    {/* Option 1: PDF */}
                    <div 
                        className="flex items-start gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 cursor-pointer transition-colors"
                        onClick={() => toggleOption('includePdf')}
                    >
                        <div className={`mt-0.5 ${currentOptions.includePdf ? 'text-brand-500' : 'text-neutral-600'}`}>
                            {currentOptions.includePdf ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-neutral-200">Print Ready PDFs</p>
                            <p className="text-xs text-neutral-500">A1 (60x84.7cm) & A2 (42.6x60cm) with 3mm bleed.</p>
                        </div>
                    </div>

                    {/* Option 2: Fixed WebP */}
                    <div 
                        className="flex items-start gap-3 p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 hover:bg-neutral-800 cursor-pointer transition-colors"
                        onClick={() => toggleOption('includeWebpFixed')}
                    >
                         <div className={`mt-0.5 ${currentOptions.includeWebpFixed ? 'text-brand-500' : 'text-neutral-600'}`}>
                            {currentOptions.includeWebpFixed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-neutral-200">WebP Thumbnail</p>
                            <p className="text-xs text-neutral-500">Fixed 912x1296px crop. Optimized for web.</p>
                        </div>
                    </div>

                    {/* Option 3: Resize */}
                    <div 
                        className={`flex flex-col p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 transition-all ${currentOptions.includeResize ? 'ring-1 ring-brand-500/50 bg-brand-500/5' : 'hover:bg-neutral-800'}`}
                    >
                        <div 
                            className="flex items-start gap-3 cursor-pointer"
                            onClick={() => toggleOption('includeResize')}
                        >
                            <div className={`mt-0.5 ${currentOptions.includeResize ? 'text-brand-500' : 'text-neutral-600'}`}>
                                {currentOptions.includeResize ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </div>
                            <div className="flex-1">
                                <p className="text-sm font-medium text-neutral-200">Resize Original</p>
                                <p className="text-xs text-neutral-500">Scale the original image. Ignores crop.</p>
                            </div>
                        </div>
                        
                        {/* Expandable Slider Area */}
                        {currentOptions.includeResize && (
                            <div className="mt-4 pl-8 pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-neutral-400">Scale Percentage</span>
                                    <div className="flex items-center gap-2">
                                      <span className="text-[10px] text-neutral-500 font-mono">{getResizeDimensions()}</span>
                                      <span className="text-xs font-mono font-medium text-brand-400">{currentOptions.resizeScale}%</span>
                                    </div>
                                </div>
                                <div className="flex items-center gap-2">
                                    <input 
                                        type="range" 
                                        min="1" 
                                        max="100" 
                                        value={currentOptions.resizeScale}
                                        onChange={(e) => updateResizeScale(parseInt(e.target.value))}
                                        className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                    />
                                </div>
                                
                                {isBatch && (
                                    <button 
                                        onClick={() => {
                                            const scale = currentOptions.resizeScale;
                                            setFileSettings(prev => prev.map(s => ({...s, resizeScale: scale})));
                                            alert(`Applied ${scale}% resize scale to all images.`);
                                        }}
                                        className="text-[10px] text-brand-400 mt-2 hover:text-brand-300 flex items-center gap-1"
                                    >
                                        <Copy className="w-3 h-3" /> Apply {currentOptions.resizeScale}% scale to all
                                    </button>
                                )}
                                
                                <div className="mt-1 text-[10px] text-neutral-500">
                                    Output: WebP (Lossy 85)
                                </div>
                            </div>
                        )}
                    </div>
                </div>

              </div>
              
              <Button 
                onClick={handleGenerate} 
                className="w-full shadow-brand-500/10 shadow-lg" 
                size="lg"
                isLoading={isProcessing}
              >
                {isBatch ? `Generate Batch` : 'Generate Files'}
              </Button>
            </div>
          </div>
        ) : (
          // STEP 3: RESULTS
          <div className="max-w-2xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Archive className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white">Conversion Complete!</h2>
              <p className="text-neutral-400 mt-2">
                  Processed files successfully.
              </p>
            </div>

            {/* Primary Action: ZIP Download */}
            <div className="flex justify-center mb-8">
                 <Button onClick={downloadZip} size="lg" className="w-full md:w-auto min-w-[250px] shadow-xl">
                    <Download className="w-5 h-5 mr-2" />
                    Download All as ZIP
                 </Button>
            </div>

            {/* List of Files */}
            <div className="bg-neutral-900 rounded-2xl shadow-xl border border-neutral-800 overflow-hidden divide-y divide-neutral-800">
              {results.map((batch, idx) => (
                <div key={idx} className="p-0">
                    {/* Header for Batch Item */}
                    <div className="px-6 py-4 bg-neutral-800/30 flex items-center justify-between">
                         <h4 className="font-semibold text-neutral-200 flex items-center gap-2">
                             <span className="text-neutral-500 text-xs font-mono">#{idx + 1}</span>
                             {batch.originalName}
                         </h4>
                    </div>
                    {/* Individual Files */}
                    <div className="divide-y divide-neutral-800/50">
                        {batch.files.length > 0 ? (
                            batch.files.map((file, fIdx) => (
                                <div key={fIdx} className="px-6 py-3 flex items-center justify-between hover:bg-neutral-800/50 transition-colors group">
                                    <div className="flex items-center gap-3">
                                        <div className={
                                        `w-8 h-8 rounded flex items-center justify-center text-xs font-bold
                                        ${file.type === 'pdf' 
                                            ? 'bg-rose-500/10 text-rose-400' 
                                            : 'bg-sky-500/10 text-sky-400'}`
                                        }>
                                        {file.type === 'pdf' ? 'PDF' : 'IMG'}
                                        </div>
                                        <div className="flex flex-col">
                                            <span className="text-sm text-neutral-300 font-medium">
                                                {/* Pretty display name from filename logic */}
                                                {file.name.replace(batch.originalName + '_', '')}
                                            </span>
                                            <span className="text-xs text-neutral-500">{file.dimensions}</span>
                                            {file.sizeDisplay && (
                                                <span className="text-[10px] text-emerald-400 font-medium mt-0.5">{file.sizeDisplay}</span>
                                            )}
                                        </div>
                                    </div>
                                    <Button variant="ghost" size="sm" onClick={() => downloadFile(file)} className="h-8 w-8 p-0">
                                        <Download className="w-4 h-4" />
                                    </Button>
                                </div>
                            ))
                        ) : (
                            <div className="px-6 py-3 text-xs text-neutral-600 italic">No outputs generated for this file.</div>
                        )}
                    </div>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center pb-12">
              <Button variant="ghost" onClick={handleReset}>
                Process More Images
              </Button>
            </div>
          </div>
        )}
      </main>
    </div>
  );
}

const FeatureCard = ({ icon, title, desc }: { icon: React.ReactNode, title: string, desc: string }) => (
  <div className="bg-neutral-900 p-6 rounded-xl border border-neutral-800 shadow-sm hover:border-brand-500/30 transition-colors">
    <div className="mb-3">{icon}</div>
    <h3 className="font-semibold text-white mb-1">{title}</h3>
    <p className="text-sm text-neutral-400">{desc}</p>
  </div>
);

const SpecItem = ({ label, value, sub }: { label: string, value: string, sub?: string }) => (
  <div>
    <span className="text-xs font-semibold text-neutral-500 uppercase tracking-wider">{label}</span>
    <p className="font-medium text-neutral-200">{value}</p>
    {sub && <p className="text-xs text-neutral-500 mt-0.5">{sub}</p>}
  </div>
);

export default App;