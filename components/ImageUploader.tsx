import React, { useRef, useState } from 'react';
import { Upload, Images } from 'lucide-react';
import { clsx } from 'clsx';

interface ImageUploaderProps {
  onImageSelected: (files: File[]) => void;
}

export const ImageUploader: React.FC<ImageUploaderProps> = ({ onImageSelected }) => {
  const [isDragging, setIsDragging] = useState(false);
  const inputRef = useRef<HTMLInputElement>(null);

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  };

  const handleDragLeave = () => {
    setIsDragging(false);
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    
    if (e.dataTransfer.files && e.dataTransfer.files.length > 0) {
      validateAndProcess(e.dataTransfer.files);
    }
  };

  const handleChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    if (e.target.files && e.target.files.length > 0) {
      validateAndProcess(e.target.files);
    }
  };

  const validateAndProcess = (fileList: FileList) => {
    const validFiles: File[] = [];
    Array.from(fileList).forEach(file => {
      if (file.type === 'image/jpeg' || file.type === 'image/png') {
        validFiles.push(file);
      }
    });

    if (validFiles.length > 0) {
      onImageSelected(validFiles);
    } else {
      alert('Please upload valid JPEG or PNG files.');
    }
  };

  return (
    <div
      className={clsx(
        "relative group cursor-pointer flex flex-col items-center justify-center w-full h-80 rounded-2xl border-2 border-dashed transition-all duration-300",
        isDragging 
          ? "border-brand-500 bg-brand-500/10 scale-[1.01] shadow-xl shadow-brand-500/10" 
          : "border-neutral-700 bg-neutral-900/50 hover:border-brand-500/50 hover:bg-neutral-800"
      )}
      onDragOver={handleDragOver}
      onDragLeave={handleDragLeave}
      onDrop={handleDrop}
      onClick={() => inputRef.current?.click()}
    >
      <input
        type="file"
        ref={inputRef}
        className="hidden"
        accept="image/png, image/jpeg"
        multiple
        onChange={handleChange}
      />
      
      <div className="flex flex-col items-center space-y-4 text-center p-6">
        <div className={clsx(
          "p-4 rounded-full transition-colors duration-300",
          isDragging 
            ? "bg-brand-500 text-white" 
            : "bg-neutral-800 text-neutral-400 group-hover:bg-neutral-700 group-hover:text-brand-400"
        )}>
          {isDragging ? <Images className="w-8 h-8" /> : <Upload className="w-8 h-8" />}
        </div>
        <div className="space-y-1">
          <p className="text-lg font-semibold text-neutral-200 group-hover:text-white transition-colors">
            Click or drag images here
          </p>
          <p className="text-sm text-neutral-500 group-hover:text-neutral-400 transition-colors">
            Supports batch upload • High-Res JPG or PNG
          </p>
        </div>
      </div>
    </div>
  );
};