import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { CropEditor } from './components/CropEditor';
import { Button } from './components/Button';
import { CropState, GeneratedFile, BatchResult, ExportOptions } from './types';
import { processExports, generateZip } from './services/pdfService';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Printer, Pencil, Layers, Archive, Settings2, CheckSquare, Square } from 'lucide-react';

function App() {
  const [files, setFiles] = useState<File[]>([]);
  const [previewSrc, setPreviewSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, scale: 1 });
  const [editorLayoutWidth, setEditorLayoutWidth] = useState<number>(0);
  
  // Output Configuration State
  const [exportOptions, setExportOptions] = useState<ExportOptions>({
      includePdf: false,
      includeWebpFixed: false,
      includeResize: true,
      resizeScale: 50
  });

  // Changed from single string to array of strings for individual naming
  const [fileNames, setFileNames] = useState<string[]>([]);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<BatchResult[] | null>(null);

  // Helper to determine if we are in "Resize Only" mode
  const onlyResize = exportOptions.includeResize && !exportOptions.includePdf && !exportOptions.includeWebpFixed;

  const handleImageSelect = (selectedFiles: File[]) => {
    setFiles(selectedFiles);
    
    // Initialize file names based on original filenames (stripping extension)
    const initialNames = selectedFiles.map(f => 
      f.name.substring(0, f.name.lastIndexOf('.')) || f.name
    );
    setFileNames(initialNames);

    // Load first image for preview
    // Use FileReader for the preview (usually smaller/resized by browser for display, but here we just load it)
    // For the actual processing we will use ObjectURL to save memory
    const reader = new FileReader();
    reader.onload = (e) => {
      setPreviewSrc(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFiles[0]);
    setResults(null);
  };

  const handleNameChange = (index: number, newName: string) => {
    const updatedNames = [...fileNames];
    updatedNames[index] = newName;
    setFileNames(updatedNames);
  };

  const handleGenerate = async () => {
    // If only resizing, we don't need the editorLayoutWidth
    const isLayoutNeeded = !onlyResize;
    
    if (!previewSrc || files.length === 0 || (isLayoutNeeded && editorLayoutWidth === 0)) return;
    
    // Validate that at least one output is selected
    if (!exportOptions.includePdf && !exportOptions.includeWebpFixed && !exportOptions.includeResize) {
        alert("Please select at least one output format.");
        return;
    }

    setIsProcessing(true);
    
    // Use timeout to allow UI to show processing state
    setTimeout(async () => {
      try {
        const batchResults: BatchResult[] = [];
        const isBatch = files.length > 1;

        // Iterate through all files
        for (let i = 0; i < files.length; i++) {
            const file = files[i];
            
            // Get the specific name for this file from state, or fallback to original
            let baseName = fileNames[i]?.trim();
            if (!baseName) {
                baseName = file.name.substring(0, file.name.lastIndexOf('.')) || file.name;
            }

            // Load image for processing using ObjectURL (Much more memory efficient for large files than Base64)
            const objectUrl = URL.createObjectURL(file);
            const img = new Image();
            
            await new Promise<void>((resolve, reject) => {
                img.onload = () => resolve();
                img.onerror = (e) => reject(e);
                img.src = objectUrl;
            });

            try {
                // Pass options to processExports
                // Added file.size to calculate size reduction stats
                const generatedFiles = await processExports(img, crop, editorLayoutWidth, baseName, exportOptions, file.size);
                batchResults.push({
                    originalName: baseName,
                    files: generatedFiles
                });
            } finally {
                // Clean up memory immediately after processing this image
                URL.revokeObjectURL(objectUrl);
            }
        }
        
        setResults(batchResults);
      } catch (error) {
        console.error("Processing failed", error);
        alert("An error occurred while generating the files. The image might be too large for the browser to handle.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleReset = () => {
    setFiles([]);
    setPreviewSrc(null);
    setResults(null);
    setCrop({ x: 0, y: 0, scale: 1 });
    setEditorLayoutWidth(0);
    setFileNames([]);
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

  // Toggle helpers
  const toggleOption = (key: keyof ExportOptions) => {
      setExportOptions(prev => ({
          ...prev,
          [key]: !prev[key]
      }));
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
            <div className="lg:col-span-2 flex flex-col h-full">
               <div className="flex items-center justify-between mb-4">
                  <h3 className="text-lg font-semibold flex items-center gap-2 text-neutral-200">
                    <ImageIcon className="w-5 h-5 text-neutral-500" />
                    {onlyResize ? "Image Preview" : "Adjust Position & Scale"}
                  </h3>
                  {isBatch && (
                      <span className="text-xs font-medium px-3 py-1 bg-brand-500/10 text-brand-400 rounded-full border border-brand-500/20 animate-pulse">
                        Batch Mode: Applying to {files.length} images
                      </span>
                  )}
                  {!onlyResize && (
                    <span className="text-xs font-medium px-2 py-1 bg-neutral-900 rounded text-neutral-400 border border-neutral-800 ml-auto">
                        Previewing A1 (Full Bleed)
                    </span>
                  )}
               </div>
               
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
                        imageSrc={previewSrc} 
                        onCropChange={setCrop}
                        onLayoutChange={setEditorLayoutWidth}
                        initialCrop={crop}
                      />
                  )}
               </div>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-6 shadow-xl border border-neutral-800 h-fit lg:mt-11 flex flex-col">
              <h3 className="text-lg font-bold mb-6 text-white">Export Settings</h3>
              
              <div className="mb-6 flex-1 min-h-0 flex flex-col overflow-y-auto pr-1 custom-scrollbar">
                
                {/* --- File Naming Section --- */}
                <div className="flex justify-between items-end mb-2">
                    <label className="block text-xs font-semibold text-neutral-500 uppercase tracking-wider">
                    {isBatch ? "File Names" : "Output Filename"}
                    </label>
                    {isBatch && (
                        <span className="text-[10px] text-brand-400 font-medium bg-brand-500/10 px-1.5 py-0.5 rounded border border-brand-500/20">
                            {files.length} Files
                        </span>
                    )}
                </div>

                {isBatch ? (
                    <div className="space-y-3 mb-8">
                        {fileNames.map((name, idx) => (
                            <div key={idx} className="group">
                                <div className="flex justify-between mb-1">
                                    <span className="text-[10px] text-neutral-500 truncate max-w-[80%] opacity-70">
                                        Original: {files[idx].name}
                                    </span>
                                    <span className="text-[10px] text-neutral-600 font-mono">#{idx + 1}</span>
                                </div>
                                <div className="relative">
                                    <input
                                        type="text"
                                        value={name}
                                        onChange={(e) => handleNameChange(idx, e.target.value)}
                                        className="w-full bg-neutral-950 border border-neutral-700 text-neutral-100 font-medium text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent block pl-3 pr-8 py-2 placeholder-neutral-600 outline-none transition-all focus:bg-neutral-900"
                                        placeholder={`Filename for image ${idx + 1}`}
                                    />
                                    <div className="absolute inset-y-0 right-0 pr-2.5 flex items-center pointer-events-none text-neutral-500">
                                        <Pencil className="w-3.5 h-3.5 opacity-30" />
                                    </div>
                                </div>
                            </div>
                        ))}
                    </div>
                ) : (
                    <div className="relative group mb-8">
                        <input
                            id="filename"
                            type="text"
                            value={fileNames[0] || ""}
                            onChange={(e) => handleNameChange(0, e.target.value)}
                            className="w-full bg-neutral-950 border border-neutral-700 text-neutral-100 font-medium text-sm rounded-lg focus:ring-2 focus:ring-brand-500 focus:border-transparent block w-full pl-3 pr-10 py-2.5 placeholder-neutral-600 outline-none transition-all"
                            placeholder="Enter file name"
                        />
                        <div className="absolute inset-y-0 right-0 pr-3 flex items-center pointer-events-none text-neutral-500">
                            <Pencil className="w-4 h-4 opacity-50" />
                        </div>
                    </div>
                )}
                
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
                        <div className={`mt-0.5 ${exportOptions.includePdf ? 'text-brand-500' : 'text-neutral-600'}`}>
                            {exportOptions.includePdf ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
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
                         <div className={`mt-0.5 ${exportOptions.includeWebpFixed ? 'text-brand-500' : 'text-neutral-600'}`}>
                            {exportOptions.includeWebpFixed ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                        </div>
                        <div>
                            <p className="text-sm font-medium text-neutral-200">WebP Thumbnail</p>
                            <p className="text-xs text-neutral-500">Fixed 912x1296px crop. Optimized for web.</p>
                        </div>
                    </div>

                    {/* Option 3: Resize */}
                    <div 
                        className={`flex flex-col p-3 rounded-lg border border-neutral-800 bg-neutral-900/50 transition-all ${exportOptions.includeResize ? 'ring-1 ring-brand-500/50 bg-brand-500/5' : 'hover:bg-neutral-800'}`}
                    >
                        <div 
                            className="flex items-start gap-3 cursor-pointer"
                            onClick={() => toggleOption('includeResize')}
                        >
                            <div className={`mt-0.5 ${exportOptions.includeResize ? 'text-brand-500' : 'text-neutral-600'}`}>
                                {exportOptions.includeResize ? <CheckSquare className="w-5 h-5" /> : <Square className="w-5 h-5" />}
                            </div>
                            <div>
                                <p className="text-sm font-medium text-neutral-200">Resize Original</p>
                                <p className="text-xs text-neutral-500">Scale the original image. Ignores crop.</p>
                            </div>
                        </div>
                        
                        {/* Expandable Slider Area */}
                        {exportOptions.includeResize && (
                            <div className="mt-4 pl-8 pr-1 animate-in fade-in slide-in-from-top-1 duration-200">
                                <div className="flex justify-between items-center mb-2">
                                    <span className="text-xs text-neutral-400">Scale Percentage</span>
                                    <span className="text-xs font-mono font-medium text-brand-400">{exportOptions.resizeScale}%</span>
                                </div>
                                <input 
                                    type="range" 
                                    min="1" 
                                    max="100" 
                                    value={exportOptions.resizeScale}
                                    onChange={(e) => setExportOptions(prev => ({...prev, resizeScale: parseInt(e.target.value)}))}
                                    className="w-full h-2 bg-neutral-700 rounded-lg appearance-none cursor-pointer accent-brand-500"
                                />
                                <div className="mt-2 text-[10px] text-neutral-500">
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
                {isBatch ? `Generate ${files.length} Sets` : 'Generate Files'}
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
                  {results.length} image{results.length > 1 ? 's' : ''} processed successfully.
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
                        {batch.files.map((file, fIdx) => (
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
                        ))}
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