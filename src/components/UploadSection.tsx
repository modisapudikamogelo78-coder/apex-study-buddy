import { useState, useCallback } from "react";
import { Button } from "@/components/ui/button";
import { Upload, FileText, X, Loader2 } from "lucide-react";
import { toast } from "@/hooks/use-toast";

export const UploadSection = () => {
  const [file, setFile] = useState<File | null>(null);
  const [text, setText] = useState("");
  const [isDragging, setIsDragging] = useState(false);
  const [isProcessing, setIsProcessing] = useState(false);

  const handleDragOver = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(true);
  }, []);

  const handleDragLeave = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
  }, []);

  const handleDrop = useCallback((e: React.DragEvent) => {
    e.preventDefault();
    setIsDragging(false);
    const droppedFile = e.dataTransfer.files[0];
    if (droppedFile && (droppedFile.type === "application/pdf" || droppedFile.type === "text/plain")) {
      setFile(droppedFile);
      setText("");
    } else {
      toast({
        title: "Invalid file type",
        description: "Please upload a PDF or text file",
        variant: "destructive",
      });
    }
  }, []);

  const handleFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const selectedFile = e.target.files?.[0];
    if (selectedFile) {
      setFile(selectedFile);
      setText("");
    }
  };

  const removeFile = () => {
    setFile(null);
  };

  const handleProcess = () => {
    if (!file && !text.trim()) {
      toast({
        title: "No content",
        description: "Please upload a file or paste your notes",
        variant: "destructive",
      });
      return;
    }
    
    setIsProcessing(true);
    // Simulating processing
    setTimeout(() => {
      setIsProcessing(false);
      toast({
        title: "Notes uploaded!",
        description: "Your learning materials are being generated...",
      });
      document.getElementById("features")?.scrollIntoView({ behavior: "smooth" });
    }, 2000);
  };

  return (
    <section id="upload" className="py-24 relative">
      {/* Background accent */}
      <div className="absolute inset-0 bg-gradient-surface" />
      
      <div className="container relative z-10 px-4">
        <div className="text-center mb-12">
          <h2 className="font-display text-3xl md:text-5xl font-bold mb-4">
            Upload Your <span className="text-gradient-primary">Notes</span>
          </h2>
          <p className="text-muted-foreground max-w-xl mx-auto">
            Drop a PDF, paste text, or upload any study material. Our AI transforms it into 
            three powerful learning experiences.
          </p>
        </div>

        <div className="max-w-2xl mx-auto">
          {/* File upload zone */}
          <div
            onDragOver={handleDragOver}
            onDragLeave={handleDragLeave}
            onDrop={handleDrop}
            className={`
              relative border-2 border-dashed rounded-2xl p-8 text-center transition-all duration-300
              ${isDragging 
                ? "border-primary bg-primary/5 scale-[1.02]" 
                : "border-border hover:border-primary/50 bg-card/30"
              }
              ${file ? "border-success bg-success/5" : ""}
            `}
          >
            {file ? (
              <div className="flex items-center justify-between">
                <div className="flex items-center gap-3">
                  <div className="w-12 h-12 rounded-xl bg-success/20 flex items-center justify-center">
                    <FileText className="w-6 h-6 text-success" />
                  </div>
                  <div className="text-left">
                    <p className="font-medium text-foreground">{file.name}</p>
                    <p className="text-sm text-muted-foreground">
                      {(file.size / 1024).toFixed(1)} KB
                    </p>
                  </div>
                </div>
                <button
                  onClick={removeFile}
                  className="p-2 hover:bg-destructive/10 rounded-lg transition-colors"
                >
                  <X className="w-5 h-5 text-destructive" />
                </button>
              </div>
            ) : (
              <>
                <input
                  type="file"
                  accept=".pdf,.txt"
                  onChange={handleFileChange}
                  className="absolute inset-0 w-full h-full opacity-0 cursor-pointer"
                />
                <div className="w-16 h-16 rounded-2xl bg-secondary flex items-center justify-center mx-auto mb-4">
                  <Upload className="w-8 h-8 text-primary" />
                </div>
                <p className="font-display font-semibold text-lg mb-2">
                  Drop your notes here
                </p>
                <p className="text-sm text-muted-foreground">
                  PDF or TXT files supported • Max 10MB
                </p>
              </>
            )}
          </div>

          {/* Divider */}
          <div className="flex items-center gap-4 my-6">
            <div className="flex-1 h-px bg-border" />
            <span className="text-sm text-muted-foreground">or paste text</span>
            <div className="flex-1 h-px bg-border" />
          </div>

          {/* Text input */}
          <textarea
            value={text}
            onChange={(e) => {
              setText(e.target.value);
              if (e.target.value) setFile(null);
            }}
            placeholder="Paste your notes, lecture content, or any study material here..."
            className="w-full h-40 p-4 rounded-xl bg-card/50 border border-border focus:border-primary focus:ring-2 focus:ring-primary/20 outline-none resize-none text-foreground placeholder:text-muted-foreground transition-all"
          />

          {/* Process button */}
          <Button 
            variant="hero" 
            size="xl" 
            className="w-full mt-6"
            onClick={handleProcess}
            disabled={isProcessing}
          >
            {isProcessing ? (
              <>
                <Loader2 className="w-5 h-5 animate-spin" />
                Processing...
              </>
            ) : (
              <>
                Generate Learning Materials
                <Upload className="w-5 h-5" />
              </>
            )}
          </Button>
        </div>
      </div>
    </section>
  );
};
