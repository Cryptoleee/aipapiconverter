import React, { useEffect, useRef, useState, useCallback } from 'react';
import { CropState, SPECS } from '../types';
import { Move, ZoomIn, Info, AlignHorizontalJustifyCenter, Maximize, Minimize } from 'lucide-react';

interface CropEditorProps {
  imageSrc: string;
  onCropChange: (crop: CropState) => void;
  onLayoutChange: (width: number) => void;
  initialCrop: CropState;
}

export const CropEditor: React.FC<CropEditorProps> = ({ imageSrc, onCropChange, onLayoutChange, initialCrop }) => {
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const containerRef = useRef<HTMLDivElement>(null);
  const [image, setImage] = useState<HTMLImageElement | null>(null);
  const [dragStart, setDragStart] = useState<{ x: number; y: number } | null>(null);
  const [crop, setCrop] = useState<CropState>(initialCrop);
  
  const [viewLayout, setViewLayout] = useState<{width: number, height: number} | null>(null);

  // Load Image
  useEffect(() => {
    const img = new Image();
    img.src = imageSrc;
    img.onload = () => {
      setImage(img);
      // Initialize with the stored crop state for this image, not a reset
      setCrop(initialCrop);
    };
  }, [imageSrc]); // Only reload if source changes. We rely on key={} in parent to handle file switches cleanly.

  useEffect(() => {
    if (viewLayout) {
      onLayoutChange(viewLayout.width);
    }
  }, [viewLayout, onLayoutChange]);

  // Main Drawing Loop
  const draw = useCallback(() => {
    const canvas = canvasRef.current;
    if (!canvas || !image) return;
    const ctx = canvas.getContext('2d');
    if (!ctx) return;

    const w = canvas.width;
    const h = canvas.height;

    // Clear background - Dark Neutral for the "Table" (neutral-950 equivalent)
    ctx.fillStyle = '#0a0a0a'; 
    ctx.fillRect(0, 0, w, h);

    // Calculate Aspect Ratio of the Target (A1 Full Bleed)
    const fullBleedWidth = SPECS.A1.widthCm + (SPECS.A1.bleedMm * 0.2);
    const fullBleedHeight = SPECS.A1.heightCm + (SPECS.A1.bleedMm * 0.2);
    const targetAspect = fullBleedWidth / fullBleedHeight;
    
    const margin = 40;
    let viewH = h - (margin * 2);
    let viewW = viewH * targetAspect;

    if (viewW > w - (margin * 2)) {
      viewW = w - (margin * 2);
      viewH = viewW / targetAspect;
    }

    if (!viewLayout || Math.abs(viewLayout.width - viewW) > 0.5) {
      setViewLayout({ width: viewW, height: viewH });
    }

    const viewX = (w - viewW) / 2;
    const viewY = (h - viewH) / 2;

    const cx = w / 2;
    const cy = h / 2;
    
    const baseScale = viewW / image.naturalWidth;
    const currentScale = baseScale * Math.max(0.05, crop.scale); 

    const drawW = image.naturalWidth * currentScale;
    const drawH = image.naturalHeight * currentScale;
    
    const drawX = cx - (drawW / 2) + crop.x;
    const drawY = cy - (drawH / 2) + crop.y;

    // 1. Draw Ghost Image (dimmed background)
    ctx.save();
    ctx.globalAlpha = 0.15;
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    ctx.restore();

    // 2. Draw White Canvas (The Paper)
    ctx.fillStyle = '#ffffff';
    // Add a slight shadow to the paper to lift it from the dark desk
    ctx.shadowColor = 'rgba(0,0,0,0.5)';
    ctx.shadowBlur = 20;
    ctx.fillRect(viewX, viewY, viewW, viewH);
    ctx.shadowBlur = 0;

    // 3. Clip to Full Bleed Area and Draw Active Image
    ctx.save();
    ctx.beginPath();
    ctx.rect(viewX, viewY, viewW, viewH);
    ctx.clip();
    ctx.drawImage(image, drawX, drawY, drawW, drawH);
    ctx.restore();

    // 4. Visual Guides
    const pxPerCm = viewW / fullBleedWidth;
    const bleedPx = (SPECS.A1.bleedMm / 10) * pxPerCm;

    // Cut Line (Blue)
    ctx.strokeStyle = '#3b82f6'; // blue-500
    ctx.lineWidth = 2;
    ctx.setLineDash([]);
    ctx.strokeRect(viewX + bleedPx, viewY + bleedPx, viewW - (bleedPx * 2), viewH - (bleedPx * 2));

    // Bleed Edge (Red Dashed)
    ctx.strokeStyle = '#ef4444'; // red-500
    ctx.lineWidth = 1;
    ctx.setLineDash([4, 4]);
    ctx.strokeRect(viewX, viewY, viewW, viewH);
    
    // Mask out the area outside bleed
    ctx.fillStyle = 'rgba(10, 10, 10, 0.85)'; // neutral-950 with opacity
    ctx.beginPath();
    ctx.rect(0, 0, w, h);
    ctx.rect(viewX, viewY, viewW, viewH);
    ctx.fill('evenodd');

  }, [image, crop, viewLayout]);

  useEffect(() => {
    let animationFrameId: number;
    const render = () => {
      draw();
      animationFrameId = window.requestAnimationFrame(render);
    };
    render();
    return () => window.cancelAnimationFrame(animationFrameId);
  }, [draw]);

  // --- Interaction Handlers ---

  const handleMouseDown = (e: React.MouseEvent) => {
    setDragStart({ x: e.clientX - crop.x, y: e.clientY - crop.y });
  };

  const handleMouseMove = (e: React.MouseEvent) => {
    if (dragStart) {
      const newX = e.clientX - dragStart.x;
      const newY = e.clientY - dragStart.y;
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleMouseUp = () => {
    setDragStart(null);
    onCropChange(crop);
  };

  const handleTouchStart = (e: React.TouchEvent) => {
    const touch = e.touches[0];
    setDragStart({ x: touch.clientX - crop.x, y: touch.clientY - crop.y });
  };
  
  const handleTouchMove = (e: React.TouchEvent) => {
    if (dragStart) {
      const touch = e.touches[0];
      const newX = touch.clientX - dragStart.x;
      const newY = touch.clientY - dragStart.y;
      setCrop(prev => ({ ...prev, x: newX, y: newY }));
    }
  };

  const handleZoom = (e: React.ChangeEvent<HTMLInputElement>) => {
    const newScale = parseFloat(e.target.value);
    const newCrop = { ...crop, scale: newScale };
    setCrop(newCrop);
    onCropChange(newCrop);
  };

  const handleCenter = () => {
    const newCrop = { ...crop, x: 0, y: 0 };
    setCrop(newCrop);
    onCropChange(newCrop);
  };

  const handleFit = () => {
    if (!image || !viewLayout) return;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const viewAspect = viewLayout.width / viewLayout.height;
    
    let scale = 1;
    if (imageAspect > viewAspect) {
        scale = 1;
    } else {
        scale = (viewLayout.height * image.naturalWidth) / (viewLayout.width * image.naturalHeight);
    }

    const newCrop = { x: 0, y: 0, scale };
    setCrop(newCrop);
    onCropChange(newCrop);
  };

  const handleFill = () => {
    if (!image || !viewLayout) return;
    const imageAspect = image.naturalWidth / image.naturalHeight;
    const viewAspect = viewLayout.width / viewLayout.height;
    
    let scale = 1;
    if (imageAspect > viewAspect) {
        scale = (viewLayout.height * image.naturalWidth) / (viewLayout.width * image.naturalHeight);
    } else {
        scale = 1;
    }
    
    const newCrop = { x: 0, y: 0, scale };
    setCrop(newCrop);
    onCropChange(newCrop);
  };

  useEffect(() => {
    const updateSize = () => {
      if (containerRef.current && canvasRef.current) {
        canvasRef.current.width = containerRef.current.clientWidth;
        canvasRef.current.height = containerRef.current.clientHeight;
        draw();
      }
    };
    window.addEventListener('resize', updateSize);
    updateSize();
    return () => window.removeEventListener('resize', updateSize);
  }, [draw]);

  return (
    <div className="flex flex-col gap-4 w-full h-full">
      {/* Canvas Area */}
      <div 
        ref={containerRef} 
        className="flex-1 min-h-[400px] bg-neutral-900 rounded-xl overflow-hidden relative cursor-move shadow-inner touch-none border border-neutral-800"
        onMouseDown={handleMouseDown}
        onMouseMove={handleMouseMove}
        onMouseUp={handleMouseUp}
        onMouseLeave={handleMouseUp}
        onTouchStart={handleTouchStart}
        onTouchMove={handleTouchMove}
        onTouchEnd={handleMouseUp}
      >
        <canvas ref={canvasRef} className="w-full h-full block" />
        
        <div className="absolute top-4 left-4 bg-neutral-900/90 backdrop-blur-md px-3 py-2 rounded-lg text-xs font-medium text-neutral-300 shadow-lg border border-neutral-700 pointer-events-none flex flex-col gap-1">
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full bg-blue-500 shadow-[0_0_8px_rgba(59,130,246,0.8)]"></span> Cut Line</div>
          <div className="flex items-center gap-2"><span className="w-2 h-2 rounded-full border border-dashed border-red-500"></span> Bleed Edge</div>
        </div>

        {/* Floating Alignment Toolbar */}
        <div className="absolute bottom-4 left-1/2 -translate-x-1/2 bg-neutral-900/90 backdrop-blur-md shadow-xl rounded-full px-2 py-1.5 flex items-center gap-1 border border-neutral-700" onMouseDown={e => e.stopPropagation()} onTouchStart={e => e.stopPropagation()}>
            <button onClick={handleFit} title="Fit Inside" className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-brand-400 rounded-full transition-colors">
                <Minimize className="w-4 h-4" />
            </button>
            <button onClick={handleFill} title="Fill Frame" className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-brand-400 rounded-full transition-colors">
                <Maximize className="w-4 h-4" />
            </button>
            <div className="w-px h-4 bg-neutral-700 mx-1"></div>
            <button onClick={handleCenter} title="Center" className="p-2 hover:bg-neutral-800 text-neutral-400 hover:text-brand-400 rounded-full transition-colors">
                <AlignHorizontalJustifyCenter className="w-4 h-4" />
            </button>
        </div>
      </div>

      {/* Controls */}
      <div className="flex items-center gap-4 bg-neutral-900 p-4 rounded-xl shadow-sm border border-neutral-800">
        <div className="flex items-center gap-2 text-neutral-400">
          <ZoomIn className="w-5 h-5" />
          <span className="text-sm font-medium">Zoom</span>
        </div>
        <input 
          type="range" 
          min="0.1" 
          max="3.0" 
          step="0.01" 
          value={crop.scale} 
          onChange={handleZoom} 
          className="flex-1 h-2 bg-neutral-800 rounded-lg appearance-none cursor-pointer accent-brand-500 hover:accent-brand-400"
        />
        <div className="text-sm font-mono text-neutral-400 w-12 text-right">
          {Math.round(crop.scale * 100)}%
        </div>
      </div>
      
      <div className="flex items-center justify-center gap-2 text-xs text-neutral-500">
        <Move className="w-3 h-3" />
        <span>Drag image to position</span>
      </div>
    </div>
  );
};