import React, { useState } from 'react';
import { ImageUploader } from './components/ImageUploader';
import { CropEditor } from './components/CropEditor';
import { Button } from './components/Button';
import { CropState, GeneratedFile } from './types';
import { processExports } from './services/pdfService';
import { ArrowLeft, Download, FileText, Image as ImageIcon, Printer } from 'lucide-react';

function App() {
  const [file, setFile] = useState<File | null>(null);
  const [imageSrc, setImageSrc] = useState<string | null>(null);
  const [crop, setCrop] = useState<CropState>({ x: 0, y: 0, scale: 1 });
  const [editorLayoutWidth, setEditorLayoutWidth] = useState<number>(0);
  
  const [isProcessing, setIsProcessing] = useState(false);
  const [results, setResults] = useState<GeneratedFile[] | null>(null);

  const handleImageSelect = (selectedFile: File) => {
    setFile(selectedFile);
    const reader = new FileReader();
    reader.onload = (e) => {
      setImageSrc(e.target?.result as string);
    };
    reader.readAsDataURL(selectedFile);
    setResults(null);
  };

  const handleGenerate = async () => {
    if (!imageSrc || !file || editorLayoutWidth === 0) return;
    
    setIsProcessing(true);
    
    setTimeout(async () => {
      try {
        const img = new Image();
        img.src = imageSrc;
        await img.decode();

        const generatedFiles = await processExports(img, crop, editorLayoutWidth, 0, file.name);
        setResults(generatedFiles);
      } catch (error) {
        console.error("Processing failed", error);
        alert("An error occurred while generating the files.");
      } finally {
        setIsProcessing(false);
      }
    }, 100);
  };

  const handleReset = () => {
    setFile(null);
    setImageSrc(null);
    setResults(null);
    setCrop({ x: 0, y: 0, scale: 1 });
    setEditorLayoutWidth(0);
  };

  const downloadFile = (file: GeneratedFile) => {
    const a = document.createElement('a');
    a.href = file.url;
    a.download = file.name;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
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
          {imageSrc && (
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
        
        {!imageSrc ? (
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
                icon={<ImageIcon className="w-6 h-6 text-brand-500" />}
                title="High Res"
                desc="Maintains 300 DPI for crisp printing quality."
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
                    Adjust Position & Scale
                  </h3>
                  <span className="text-xs font-medium px-2 py-1 bg-neutral-900 rounded text-neutral-400 border border-neutral-800">
                    Previewing A1 (Full Bleed)
                  </span>
               </div>
               <div className="flex-1 min-h-0">
                  <CropEditor 
                    imageSrc={imageSrc} 
                    onCropChange={setCrop}
                    onLayoutChange={setEditorLayoutWidth}
                    initialCrop={crop}
                  />
               </div>
            </div>

            <div className="bg-neutral-900 rounded-2xl p-6 shadow-xl border border-neutral-800 h-fit lg:mt-11">
              <h3 className="text-lg font-bold mb-6 text-white">Export Summary</h3>
              
              <div className="space-y-4 mb-8">
                <SpecItem label="Source File" value={file?.name || 'Unknown'} />
                <div className="h-px bg-neutral-800 my-2"></div>
                <SpecItem label="Output 1" value="PDF A1 (60x84.7cm) + 3mm Bleed" sub="300 DPI • CMYK Ready" />
                <SpecItem label="Output 2" value="PDF A2 (42.6x60cm) + 3mm Bleed" sub="300 DPI • CMYK Ready" />
                <SpecItem label="Output 3" value="WebP (912x1296px)" sub="Optimized for web" />
              </div>

              <Button 
                onClick={handleGenerate} 
                className="w-full shadow-brand-500/10 shadow-lg" 
                size="lg"
                isLoading={isProcessing}
              >
                Generate Files
              </Button>
              <p className="text-xs text-center text-neutral-500 mt-4">
                Processing high-res images may take a few seconds.
              </p>
            </div>
          </div>
        ) : (
          // STEP 3: RESULTS
          <div className="max-w-2xl mx-auto mt-10 animate-in fade-in slide-in-from-bottom-8 duration-500">
            <div className="text-center mb-8">
              <div className="w-16 h-16 bg-gradient-to-br from-green-500/20 to-emerald-500/20 text-emerald-400 rounded-full flex items-center justify-center mx-auto mb-4 border border-emerald-500/20">
                <Download className="w-8 h-8" />
              </div>
              <h2 className="text-3xl font-bold text-white">Files Ready!</h2>
              <p className="text-neutral-400 mt-2">Your images have been processed and converted successfully.</p>
            </div>

            <div className="bg-neutral-900 rounded-2xl shadow-xl border border-neutral-800 overflow-hidden divide-y divide-neutral-800">
              {results.map((file, idx) => (
                <div key={idx} className="p-6 flex items-center justify-between hover:bg-neutral-800/50 transition-colors group">
                  <div className="flex items-center gap-4">
                    <div className={
                      `w-12 h-12 rounded-lg flex items-center justify-center text-lg font-bold shadow-inner
                      ${file.type === 'pdf' 
                        ? 'bg-rose-500/10 text-rose-400 border border-rose-500/20' 
                        : 'bg-sky-500/10 text-sky-400 border border-sky-500/20'}`
                    }>
                      {file.type === 'pdf' ? 'PDF' : 'IMG'}
                    </div>
                    <div>
                      <h4 className="font-semibold text-neutral-200">{file.name}</h4>
                      <p className="text-sm text-neutral-500">{file.dimensions}</p>
                    </div>
                  </div>
                  <Button variant="outline" size="sm" onClick={() => downloadFile(file)}>
                    <Download className="w-4 h-4 mr-2" />
                    Download
                  </Button>
                </div>
              ))}
            </div>

            <div className="mt-8 flex justify-center">
              <Button variant="ghost" onClick={handleReset}>
                Process Another Image
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