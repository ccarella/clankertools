"use client";

import React, { useState, useRef, useEffect } from "react";
import { Plus, Camera, Upload } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { cn } from "@/lib/utils";

interface PhotoPickerProps {
  onImageSelect: (file: File, preview: string) => void;
  onError?: (message: string) => void;
  maxSizeMB?: number;
  acceptTypes?: string;
  showCamera?: boolean;
  capture?: "user" | "environment";
  value?: File | null;
  className?: string;
}

export function PhotoPicker({
  onImageSelect,
  onError,
  maxSizeMB = 5,
  acceptTypes = "image/jpeg,image/jpg,image/png,image/gif,image/webp",
  showCamera = false,
  capture,
  value = null,
  className,
}: PhotoPickerProps) {
  const [imagePreview, setImagePreview] = useState<string | null>(null);
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);
  const [cameraSupported, setCameraSupported] = useState(false);
  const fileInputRef = useRef<HTMLInputElement>(null);

  useEffect(() => {
    if (showCamera && typeof navigator !== "undefined" && navigator.mediaDevices?.getUserMedia) {
      navigator.mediaDevices.getUserMedia({ video: true })
        .then(() => setCameraSupported(true))
        .catch(() => setCameraSupported(false));
    }
  }, [showCamera]);

  useEffect(() => {
    if (value === null) {
      setImagePreview(null);
    }
  }, [value]);

  const validateFile = (file: File): string | null => {
    const maxSizeBytes = maxSizeMB * 1024 * 1024;
    if (file.size > maxSizeBytes) {
      return `File size exceeds ${maxSizeMB}MB limit`;
    }

    const acceptedTypes = acceptTypes.split(',').map(type => type.trim());
    if (!acceptedTypes.includes(file.type)) {
      return "Please select a valid image file (JPEG, PNG, GIF, WebP)";
    }

    return null;
  };

  const handleFileSelection = (file: File) => {
    const error = validateFile(file);
    if (error) {
      onError?.(error);
      return;
    }

    setIsProcessing(true);
    const reader = new FileReader();
    reader.onloadend = () => {
      const preview = reader.result as string;
      setImagePreview(preview);
      setIsProcessing(false);
      onImageSelect(file, preview);
    };
    reader.readAsDataURL(file);
  };

  const handleFileInputChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleDragEnter = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    if (e.dataTransfer.types.includes('Files')) {
      setIsDragging(true);
    }
  };

  const handleDragLeave = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);
  };

  const handleDragOver = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
  };

  const handleDrop = (e: React.DragEvent) => {
    e.preventDefault();
    e.stopPropagation();
    setIsDragging(false);

    const file = e.dataTransfer.files[0];
    if (file) {
      handleFileSelection(file);
    }
  };

  const handleCameraCapture = async () => {
    try {
      const stream = await navigator.mediaDevices.getUserMedia({ video: true });
      stream.getTracks().forEach(track => track.stop());
      fileInputRef.current?.click();
    } catch (error) {
      console.error("Camera access denied:", error);
      fileInputRef.current?.click();
    }
  };

  return (
    <div className={cn("space-y-2", className)} data-testid="photo-picker-container">
      <input
        ref={fileInputRef}
        type="file"
        accept={acceptTypes}
        capture={capture}
        className="hidden"
        onChange={handleFileInputChange}
        data-testid="file-input"
      />
      
      {!imagePreview ? (
        <Card 
          className={cn(
            "p-8 border-2 border-dashed border-border hover:border-primary/50 transition-colors cursor-pointer",
            isDragging && "border-primary bg-primary/5"
          )}
          onClick={() => fileInputRef.current?.click()}
          onDragEnter={handleDragEnter}
          onDragLeave={handleDragLeave}
          onDragOver={handleDragOver}
          onDrop={handleDrop}
          data-testid="photo-picker-dropzone"
        >
          <div className="flex flex-col items-center justify-center text-center">
            {isProcessing ? (
              <>
                <div className="w-12 h-12 border-4 border-primary border-t-transparent rounded-full animate-spin mb-4" />
                <p className="text-sm text-muted-foreground">Processing...</p>
              </>
            ) : (
              <>
                <div className="w-12 h-12 rounded-full bg-muted flex items-center justify-center mb-4">
                  <Plus className="w-6 h-6 text-muted-foreground" />
                </div>
                <p className="text-sm text-muted-foreground">
                  Click to upload or drag and drop
                </p>
                {showCamera && cameraSupported && (
                  <Button
                    type="button"
                    variant="ghost"
                    size="sm"
                    className="mt-2"
                    onClick={(e) => {
                      e.stopPropagation();
                      handleCameraCapture();
                    }}
                  >
                    <Camera className="w-4 h-4 mr-2" />
                    Take Photo
                  </Button>
                )}
              </>
            )}
          </div>
        </Card>
      ) : (
        <Card className="p-4">
          <div className="relative">
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img
              src={imagePreview}
              alt="Selected image"
              className="w-full h-48 object-cover rounded-lg"
            />
            <Button
              type="button"
              variant="secondary"
              size="sm"
              className="absolute top-2 right-2"
              onClick={() => fileInputRef.current?.click()}
            >
              <Upload className="w-4 h-4 mr-2" />
              Change
            </Button>
          </div>
        </Card>
      )}
    </div>
  );
}