"use client";
import React, { useState, useRef, useEffect } from "react";
import { useRouter } from "next/navigation";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import {
  Card,
  CardContent,
  CardDescription,
  CardHeader,
  CardTitle,
} from "@/components/ui/card";
import { Alert, AlertDescription, AlertTitle } from "@/components/ui/alert";
import {
  UploadCloud,
  CheckCircle,
  AlertCircle,
  Eye,
  X,
  Loader2,
} from "lucide-react";
import { bucketName } from "@/lib/supabase";
import { createClientComponentClient } from "@supabase/auth-helpers-nextjs";
import { Label } from "@/components/ui/label";

interface UploadState {
  isUploading: boolean;
  error: string | null;
  success: boolean;
  eventName: string | null;
  fileUrl: string | null;
  fileName: string | null;
  filePreviewUrl: string | null;
  selectedFile: File | null;
}
const supabase = createClientComponentClient();

const PdfUploader: React.FC = () => {
  const router = useRouter();
  const [user, setUser] = useState<any>(null);
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [uploadState, setUploadState] = useState<UploadState>({
    isUploading: false,
    error: null,
    success: false,
    eventName: null,
    fileUrl: null,
    fileName: null,
    filePreviewUrl: null,
    selectedFile: null,
  });
  useEffect(() => {
    const getUser = async () => {
      const { data } = await supabase.auth.getUser();

      if (!data.user) {
        // Redirect to login if no user
        router.push("/auth/signin");
        return;
      }

      setUser(data.user);
    };

    getUser();
  }, [supabase.auth, router]);
  const handleEventNameChange = (
    event: React.ChangeEvent<HTMLInputElement>
  ) => {
    setUploadState({
      ...uploadState,
      eventName: event.target.value,
    });
  };

  const handleFileChange = (event: React.ChangeEvent<HTMLInputElement>) => {
    const file = event.target.files?.[0];

    if (!file) return;

    // Validate file type
    if (file.type !== "application/pdf") {
      setUploadState({
        ...uploadState,
        error: "Please select a valid PDF file",
        success: false,
        filePreviewUrl: null,
        selectedFile: null,
      });
      return;
    }

    // Create URL for preview
    const previewUrl = URL.createObjectURL(file);

    // Set the selected file and preview URL
    setUploadState({
      ...uploadState,
      error: null,
      success: false,
      fileName: file.name,
      filePreviewUrl: previewUrl,
      selectedFile: file,
    });
  };

  const handleUpload = async () => {
    const { selectedFile, eventName } = uploadState;

    // check if user exists
    if (!user) {
      setUploadState({
        ...uploadState,
        error: "You must be logged in to upload files",
      });
      return;
    }

    if (!selectedFile) {
      setUploadState({
        ...uploadState,
        error: "No file selected",
      });
      return;
    }

    if (!eventName || eventName.trim() === "") {
      setUploadState({
        ...uploadState,
        error: "Please enter an event name",
      });
      return;
    }

    // set uploading state
    setUploadState({
      ...uploadState,
      isUploading: true,
      error: null,
    });

    // Use eventName in the file path
    const filePath = `${user.id}/${eventName}/quote.pdf`;

    try {
      // Actual upload
      const { error } = await supabase.storage
        .from(bucketName)
        .upload(filePath, selectedFile, {
          contentType: "application/pdf",
          cacheControl: "3600",
        });

      if (error) throw error;

      // get the public URL for pdf, to be fed to LLM
      const {
        data: { publicUrl },
      } = supabase.storage.from(bucketName).getPublicUrl(filePath);
      //send a call to extraction edge function
      const extractionData = { pdfUrl: publicUrl, eventName: eventName };
      const response = await supabase.functions.invoke("extraction", {
        body: extractionData,
      });
      console.log(response);
      // set final state
      setUploadState({
        isUploading: false,
        error: null,
        success: true,
        eventName: eventName,
        fileUrl: publicUrl,
        fileName: selectedFile.name,
        filePreviewUrl: uploadState.filePreviewUrl,
        selectedFile: selectedFile,
      });
    } catch (error: any) {
      setUploadState({
        ...uploadState,
        isUploading: false,
        error: error.message || "An error occurred during upload",
        success: false,
        fileUrl: null,
      });
    }
  };

  const handleReset = () => {
    // Revoke the object URL to avoid memory leaks
    if (uploadState.filePreviewUrl) {
      URL.revokeObjectURL(uploadState.filePreviewUrl);
    }

    setUploadState({
      isUploading: false,
      error: null,
      success: false,
      eventName: null,
      fileUrl: null,
      fileName: null,
      filePreviewUrl: null,
      selectedFile: null,
    });
  };

  const handleFileButtonClick = () => {
    // Trigger the hidden file input when custom button is clicked
    fileInputRef.current?.click();
  };
  if (user === null) {
    return (
      <Card className="w-full max-w-md mx-auto">
        <CardContent className="p-6">
          <div className="flex justify-center items-center py-8">
            <div className="animate-spin h-8 w-8 border-4 border-planit border-t-transparent rounded-full"></div>
          </div>
        </CardContent>
      </Card>
    );
  }
  return (
    <Card className="w-full max-w-md mx-auto">
      <CardHeader>
        <CardTitle className="text-xl">
          Marcus&apos;s Hotel Quote Portal
        </CardTitle>
        <CardDescription>
          Upload your hotel quote as a PDF to extract relevant data!
        </CardDescription>
      </CardHeader>

      <CardContent>
        {/* Event Name Input Field */}
        <div className="mb-4">
          <Label htmlFor="eventName" className="text-sm font-medium">
            Event Name
          </Label>
          <Input
            id="eventName"
            type="text"
            placeholder="so I can organize all of your events! :)"
            value={uploadState.eventName || ""}
            onChange={handleEventNameChange}
            className="mt-1"
            disabled={uploadState.success}
          />
        </div>

        {!uploadState.selectedFile && !uploadState.isUploading && (
          <div className="flex flex-col items-center justify-center p-6 border-2 border-dashed rounded-md border-gray-300 bg-gray-50">
            <UploadCloud className="w-12 h-12 text-gray-400 mb-4" />
            <p className="text-sm text-gray-500 mb-4">
              Click to browse your files
            </p>
            {/* Hidden file input */}
            <Input
              ref={fileInputRef}
              type="file"
              accept="application/pdf"
              onChange={handleFileChange}
              className="hidden"
            />

            {/* Custom styled upload button */}
            <Button
              onClick={handleFileButtonClick}
              className="w-full bg-planit hover:bg-orange-400 text-white py-6 rounded-lg flex items-center justify-center"
            >
              <UploadCloud className="mr-2 h-5 w-5" />
              Select PDF
            </Button>
          </div>
        )}

        {uploadState.isUploading && (
          <div className="space-y-4 p-4 border rounded-md bg-gray-50">
            <div className="flex items-center space-x-3">
              <Loader2 className="w-8 h-8 text-planit animate-spin" />
              <p className="text-sm font-medium">
                Extracting Data from {uploadState.fileName}...
              </p>
            </div>
            <div className="text-xs text-gray-500 ml-8">
              This may take a minute or two while I analyze your hotel quote.
              Tea Break!
            </div>
          </div>
        )}

        {uploadState.error && (
          <Alert variant="destructive" className="mt-4">
            <AlertCircle className="h-4 w-4" />
            <AlertTitle>Error</AlertTitle>
            <AlertDescription>{uploadState.error}</AlertDescription>
          </Alert>
        )}

        {uploadState.filePreviewUrl &&
          !uploadState.success &&
          !uploadState.isUploading && (
            <div className="space-y-4">
              <div className="flex items-center justify-between mb-2">
                <h3 className="text-sm font-medium">Preview</h3>
                <Button
                  variant="ghost"
                  size="sm"
                  onClick={handleReset}
                  className="h-8 w-8 p-0"
                >
                  <X className="h-4 w-4" />
                </Button>
              </div>

              <div className="border rounded-md overflow-hidden">
                <iframe
                  src={uploadState.filePreviewUrl}
                  className="w-full h-80"
                  title="PDF Preview"
                />
              </div>

              <div className="flex items-center justify-between p-3 border rounded-md bg-gray-50">
                <div className="flex-1 min-w-0">
                  <p className="text-sm font-medium truncate">
                    {uploadState.fileName}
                  </p>
                  <p className="text-xs text-gray-500 truncate">PDF Document</p>
                </div>
                <Button
                  variant="outline"
                  size="sm"
                  onClick={() =>
                    window.open(uploadState.filePreviewUrl || "", "_blank")
                  }
                >
                  <Eye className="h-4 w-4 mr-1" />
                  View Full
                </Button>
              </div>

              <Button
                onClick={handleUpload}
                className="w-full bg-planit hover:bg-orange-400 text-white py-2 rounded-lg flex items-center justify-center"
                disabled={uploadState.isUploading}
              >
                <UploadCloud className="mr-2 h-5 w-5" />
                Upload PDF
              </Button>
            </div>
          )}

        {uploadState.success && (
          <div className="space-y-4">
            <Alert className="mt-4 bg-green-50 border-green-200">
              <CheckCircle className="h-4 w-4 text-green-500" />
              <AlertTitle className="text-green-700">Success!</AlertTitle>
              <AlertDescription className="text-green-600">
                Your quote for {uploadState.eventName} has been analyzed. Head
                back Home to see the results!
              </AlertDescription>
            </Alert>

            <div className="border rounded-md overflow-hidden">
              <iframe
                src={uploadState.filePreviewUrl || ""}
                className="w-full h-80"
                title="PDF Preview"
              />
            </div>

            <div className="flex items-center p-3 border rounded-md bg-gray-50">
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium truncate">
                  {uploadState.fileName}
                </p>
                <p className="text-xs text-gray-500 truncate">PDF Document</p>
              </div>
              <Button variant="outline" size="sm" asChild>
                <a
                  href={uploadState.fileUrl || "#"}
                  target="_blank"
                  rel="noopener noreferrer"
                >
                  View
                </a>
              </Button>
            </div>

            <Button onClick={handleReset} variant="outline" className="w-full">
              Upload Another PDF
            </Button>
          </div>
        )}
      </CardContent>
    </Card>
  );
};

export default PdfUploader;
