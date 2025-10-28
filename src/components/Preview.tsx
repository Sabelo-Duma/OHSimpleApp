// src/components/Preview.tsx
import React, { useState, useEffect, useRef } from "react";
import { SurveyData, Area } from "./types";
import Section from "./common/Section";
import Actions from "./common/Actions";
import Button from "./common/Button";
import { buildWordContent } from "./helpers";
import { Document, Packer, Paragraph, Table } from "docx";

// Import pdfmake with error handling
let pdfMake: any = null;
try {
  pdfMake = require('pdfmake/build/pdfmake');
  const pdfFonts = require('pdfmake/build/vfs_fonts');
  
  // Set up pdfMake fonts with safe access
  if (pdfFonts && pdfFonts.pdfMake && pdfFonts.pdfMake.vfs) {
    pdfMake.vfs = pdfFonts.pdfMake.vfs;
  } else if (pdfFonts && pdfFonts.vfs) {
    pdfMake.vfs = pdfFonts.vfs;
  } else {
    console.warn('PDF fonts not found, PDF generation may not work properly');
    pdfMake.vfs = {};
  }
} catch (error) {
  console.warn('PDFMake initialization failed, PDF generation disabled:', error);
  pdfMake = null;
}

interface PreviewProps {
  data: SurveyData;
  onPrev: () => void;
  onNext: (completedSurvey: SurveyData) => void;
  readOnly?: boolean;
}

// Custom Dialog Component for Survey Completion
interface CompletionDialogProps {
  open: boolean;
  onConfirm: () => void;
}

const CompletionDialog: React.FC<CompletionDialogProps> = ({ open, onConfirm }) => {
  if (!open) return null;

  return (
    <div className="fixed inset-0 bg-black bg-opacity-50 flex items-center justify-center z-50 p-4">
      <div className="bg-white rounded-lg shadow-xl max-w-md w-full mx-auto">
        <div className="p-6">
          <div className="text-center">
            {/* Success Icon */}
            <div className="mx-auto flex items-center justify-center h-12 w-12 rounded-full bg-green-100 mb-4">
              <svg className="h-6 w-6 text-green-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M5 13l4 4L19 7" />
              </svg>
            </div>
            
            {/* Message */}
            <h3 className="text-lg font-semibold text-gray-900 mb-2">
              YOUR SURVEY HAS BEEN SUCCESSFULLY COMPLETED!
            </h3>
            
            {/* OK Button */}
            <div className="mt-6">
              <Button
                onClick={onConfirm}
                variant="success"
                className="w-full justify-center"
              >
                OK
              </Button>
            </div>
          </div>
        </div>
      </div>
    </div>
  );
};

export default function Preview({ data, onPrev, onNext, readOnly = false }: PreviewProps) {
  const [hasViewedPDF, setHasViewedPDF] = useState(!!data.verificationComment || !!data.verificationSignature);
  const [comment, setComment] = useState(data.verificationComment || "");
  const [signature, setSignature] = useState(data.verificationSignature || "");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(!!pdfMake);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);
  const [errorMessage, setErrorMessage] = useState<string | null>(null);
  
  // Canvas signature refs and state
  const canvasRef = useRef<HTMLCanvasElement>(null);
  const [isDrawing, setIsDrawing] = useState(false);
  const [hasSignature, setHasSignature] = useState(!!data.verificationSignature);

  // Generate PDF preview on component mount
  useEffect(() => {
    generatePDFPreview();
  }, []);

  // Initialize canvas with saved signature if it exists
  useEffect(() => {
    if (signature && canvasRef.current) {
      const canvas = canvasRef.current;
      const ctx = canvas.getContext('2d');
      if (ctx) {
        const img = new Image();
        img.onload = () => {
          ctx.clearRect(0, 0, canvas.width, canvas.height);
          ctx.drawImage(img, 0, 0, canvas.width, canvas.height);
        };
        img.src = signature;
      }
    }
  }, [signature]);

  // Canvas drawing functions
  const startDrawing = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!hasViewedPDF || readOnly) return;
    setIsDrawing(true);
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.beginPath();
      ctx.moveTo(x, y);
    }
  };

  const draw = (e: React.MouseEvent<HTMLCanvasElement>) => {
    if (!isDrawing || !hasViewedPDF || readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const rect = canvas.getBoundingClientRect();
    const x = e.clientX - rect.left;
    const y = e.clientY - rect.top;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.lineWidth = 2;
      ctx.lineCap = 'round';
      ctx.strokeStyle = 'black';
      ctx.lineTo(x, y);
      ctx.stroke();
      ctx.beginPath();
      ctx.moveTo(x, y);
      setHasSignature(true);
    }
  };

  const stopDrawing = () => {
    setIsDrawing(false);
  };

  const clearSignature = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const ctx = canvas.getContext('2d');
    if (ctx) {
      ctx.clearRect(0, 0, canvas.width, canvas.height);
      setHasSignature(false);
      setSignature("");
    }
  };

  const saveSignature = () => {
    if (readOnly) return;
    const canvas = canvasRef.current;
    if (!canvas) return;
    
    const dataUrl = canvas.toDataURL('image/png');
    setSignature(dataUrl);
  };

  // Helper to reconstruct area path from numbering (e.g. '1.2.1')
  const getAreaPathObject = (numbering: string) => {
    const parts = numbering.split('.').map((n) => parseInt(n, 10) - 1);
    const [main, sub, ss] = parts;
    const path: any = { main };
    if (sub !== undefined) path.sub = sub;
    if (ss !== undefined) path.ss = ss;
    return path;
  };

  // Recursively collect all areas with their numbering
  const collectAreas = (areas: Area[], prefix = ""): { area: Area, numbering: string, parentNumbering: string }[] => {
    if (!areas || areas.length === 0) return [];
    return areas.flatMap((ar, i) => {
      const numbering = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
      const thisArea = { area: ar, numbering, parentNumbering: prefix };
      const children = ar.subAreas ? collectAreas(ar.subAreas, numbering) : [];
      return [thisArea, ...children];
    });
  };

  // Generate PDF using pdfMake
  const handlePdfClick = () => {
    if (!pdfMake) {
      setErrorMessage('PDF generation is not available in your current environment. Please use the Word document download instead.');
      return;
    }

    let signatureImage = data.verificationSignature || signature;
    if (canvasRef.current && hasSignature && !signatureImage) {
      signatureImage = canvasRef.current.toDataURL("image/png");
    }

    const docDefinition: any = {
      content: [
        { text: "Gijima - OH Measurements: Field Sheet (Noise Zoning)", style: "header" },
        { text: `Client: ${data.client}`, margin: [0, 10, 0, 0] },
        { text: `Project: ${data.project}`, margin: [0, 2, 0, 0] },
        { text: `Site: ${data.site}`, margin: [0, 2, 0, 0] },
        { text: `Survey Type: ${data.surveyType}`, margin: [0, 2, 0, 10] },
        { text: `Start Date: ${data.startDate}`, margin: [0, 0, 0, 0] },
        { text: `End Date: ${data.endDate}`, margin: [0, 0, 0, 10] },
        { text: `Description: ${data.description}`, margin: [0, 0, 0, 10] },

        { text: "Equipment Used", style: "subheader" },
        {
          table: {
            headerRows: 1,
            widths: ["auto", "*", "*", "*", "*", "*", "*"],
            body: [
              ["#", "Name", "Type", "Serial", "Calibration Start", "Calibration End", "Area Ref"],
              ...(data.equipment || []).map((eq, i) => [
                i + 1,
                eq.name,
                eq.type,
                eq.serial,
                eq.startDate || "N/A",
                eq.endDate || "N/A",
                eq.areaRef || "Global",
              ]),
            ],
          },
          fontSize: 8,
          margin: [0, 0, 0, 10],
        },

        { text: "Area Details", style: "subheader" },
        ...(collectAreas(data.areas || []).flatMap(({ area, numbering }: any) => {
          const areaKey = JSON.stringify(getAreaPathObject(numbering));
          const noiseSources = data.noiseSourcesByArea?.[areaKey] || [];
          const measurements = data.measurementsByArea?.[areaKey] || [];
          const controls = data.controlsByArea?.[areaKey];
          const devices = data.hearingProtectionDevices?.[areaKey] || [];
          const exposures = data.exposuresByArea?.[areaKey];
          const c = data.commentsByArea?.[areaKey];

          const section: any[] = [{ text: `${numbering}. ${area.name}`, style: "areaHeader" }];

          if (noiseSources.length > 0) {
            section.push({ text: "Noise Sources", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["auto", "*", "*", "*"],
                body: [
                  ["Yes/No", "Source", "Description", "Time Interval"],
                  ...noiseSources.map((ns: any) => [
                    ns.type ? "Yes" : "No",
                    ns.source,
                    ns.description,
                    ns.mit,
                  ]),
                ],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          if (measurements.length > 0) {
            section.push({ text: "Measurements", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["auto", "auto", "auto", "auto", "*", "*"],
                body: [
                  ["Shift", "Exposure", "Position", "Reading", "SLM ID", "Calibrator ID"],
                  ...measurements.flatMap((m: any) =>
                    m.readings?.map((r: any, i: number) => [
                      m.shiftDuration,
                      m.exposureTime,
                      String.fromCharCode(65 + i),
                      r,
                      m.slmId,
                      m.calibratorId,
                    ]) || [
                      [m.shiftDuration, m.exposureTime, "-", "-", m.slmId, m.calibratorId],
                    ]
                  ),
                ],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          if (controls) {
            section.push({ text: "Controls", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["auto", "*", "*"],
                body: [
                  ["Engineering", "Admin Controls", "Custom Admin"],
                  [
                    controls.engineering ? "Yes" : "No",
                    controls.adminControls?.join(", ") || "No",
                    controls.customAdmin || "N/A",
                  ],
                ],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          if (devices.length > 0) {
            section.push({ text: "Hearing Protection Devices", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["auto", "*", "*", "*", "*", "*", "*", "*", "*"],
                body: [
                  [
                    "Yes/No",
                    "Type",
                    "Manufacturer",
                    "SNR/NRR",
                    "Value",
                    "Condition",
                    "Training",
                    "Fitment",
                    "Maintenance",
                  ],
                  ...devices.map((d: any) => [
                    d.type ? "Yes" : "No",
                    d.type || "N/A",
                    d.manufacturer || "N/A",
                    d.snrOrNrr || "N/A",
                    d.snrValue || "N/A",
                    d.condition || "N/A",
                    d.training || "N/A",
                    d.fitting || "N/A",
                    d.maintenance || "N/A",
                  ]),
                ],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          if (exposures) {
            section.push({ text: "Exposures", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["*", "*", "*", "*"],
                body: [
                  ["Exposure", "Detail", "Prohibited", "Detail"],
                  [
                    exposures.exposure,
                    exposures.exposureDetail,
                    exposures.prohibited,
                    exposures.prohibitedDetail,
                  ],
                ],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          if (c) {
            section.push({ text: "Comments", style: "tableHeader" });
            section.push({
              table: {
                headerRows: 1,
                widths: ["*"],
                body: [["Comment"], [c]],
              },
              fontSize: 8,
              margin: [0, 0, 0, 10],
            });
          }

          return section;
        })),

        // Add Preview comment + signature
        { text: "General Comments", style: "subheader" },
        { text: data.verificationComment || comment || "No additional comments.", fontSize: 10, margin: [0, 0, 0, 10] },
        signatureImage
          ? { image: signatureImage, width: 150, margin: [0, 10, 0, 0] }
          : { text: "Signature: (none)", italics: true },
      ],
      styles: {
        header: { fontSize: 16, bold: true, alignment: "center", margin: [0, 0, 0, 10] },
        subheader: { fontSize: 12, bold: true, margin: [0, 10, 0, 5] },
        areaHeader: { fontSize: 11, bold: true, margin: [0, 10, 0, 5] },
        tableHeader: { fontSize: 10, bold: true, margin: [0, 5, 0, 2] },
      },
      defaultStyle: { fontSize: 10 },
    };

    try {
      // Use getBlob and window.open to view PDF without triggering popup blocker
      pdfMake.createPdf(docDefinition).getBlob((blob: Blob) => {
        const url = URL.createObjectURL(blob);
        window.open(url, '_blank');
        setHasViewedPDF(true);
      });
    } catch (error) {
      console.error('Error generating PDF:', error);
      setErrorMessage('Error generating PDF. Please use the Word document download instead.');
    }
  };

  const generatePDFPreview = async () => {
    setIsGeneratingPDF(true);
    setErrorMessage(null);
    try {
      // Load logo from public folder
      let logoBuffer: ArrayBuffer | undefined;
      try {
        const response = await fetch("/Gijima-Logo.png");
        if (response.ok) {
          logoBuffer = await response.arrayBuffer();
        }
      } catch (err) {
        console.warn("Logo not found, continuing without it.");
      }

      // Build Word content
      const wordChildren: (Paragraph | Table)[] = await buildWordContent(data, logoBuffer);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: wordChildren,
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating PDF preview:", error);
      setErrorMessage("Failed to generate fieldsheet preview. Please try again.");
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleDownloadFieldsheet = () => {
    if (pdfUrl) {
      const link = document.createElement('a');
      link.href = pdfUrl;
      link.download = 'survey-fieldsheet.docx';
      document.body.appendChild(link);
      link.click();
      document.body.removeChild(link);
      setHasViewedPDF(true);
    }
  };

  const handleCompleteSurvey = () => {
    if (readOnly) {
      // In view mode, just return to greeting page
      onNext(data);
    } else {
      // Save signature before showing completion dialog
      if (canvasRef.current && hasSignature && !signature) {
        const dataUrl = canvasRef.current.toDataURL('image/png');
        setSignature(dataUrl);
      }
      // In edit mode, show completion dialog
      setCompletionDialogOpen(true);
    }
  };

  const confirmCompleteSurvey = () => {
    // Get the final signature
    let finalSignature = signature;
    if (canvasRef.current && hasSignature && !finalSignature) {
      finalSignature = canvasRef.current.toDataURL('image/png');
    }

    // Mark survey as completed
    const completedSurvey: SurveyData = {
      ...data,
      status: "Completed" as const,
      completedAt: new Date().toISOString(),
      verificationComment: comment,
      verificationSignature: finalSignature
    };
    
    // Close dialog first to prevent any UI issues
    setCompletionDialogOpen(false);
    
    // Use setTimeout to ensure dialog closes before navigation
    setTimeout(() => {
      // Pass the completed survey back to parent (which should navigate to Greetings screen)
      onNext(completedSurvey);
    }, 100);
  };

  const canProceed = readOnly || (hasViewedPDF && comment.trim() && (hasSignature || signature.trim()));

  return (
    <>
      <Section title="Fieldsheet Preview & Verification">
        <div className="space-y-6 mb-8">
          {/* Error Message Display */}
          {errorMessage && (
            <div className="bg-red-50 border border-red-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-red-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M10 18a8 8 0 100-16 8 8 0 000 16zM8.707 7.293a1 1 0 00-1.414 1.414L8.586 10l-1.293 1.293a1 1 0 101.414 1.414L10 11.414l1.293 1.293a1 1 0 001.414-1.414L11.414 10l1.293-1.293a1 1 0 00-1.414-1.414L10 8.586 8.707 7.293z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-red-800">Error</h3>
                  <div className="mt-2 text-sm text-red-700">
                    <p>{errorMessage}</p>
                  </div>
                  <div className="mt-2">
                    <button
                      type="button"
                      className="text-sm font-medium text-red-800 hover:text-red-900"
                      onClick={() => setErrorMessage(null)}
                    >
                      Dismiss
                    </button>
                  </div>
                </div>
              </div>
            </div>
          )}

          {/* PDF Preview Section */}
          <div className="bg-white border rounded-lg p-6 shadow-sm">
            <h3 className="text-lg font-semibold text-gray-900 mb-4">
              Survey Fieldsheet Preview
            </h3>
            
            {isGeneratingPDF ? (
              <div className="flex items-center justify-center py-12">
                <div className="animate-spin rounded-full h-8 w-8 border-b-2 border-blue-600"></div>
                <span className="ml-3 text-gray-600">Generating fieldsheet preview...</span>
              </div>
            ) : pdfUrl ? (
              <div className="space-y-4">
                <div className="bg-gray-50 border-2 border-dashed border-gray-300 rounded-lg p-8 text-center">
                  <div className="flex flex-col items-center">
                    <div className="w-16 h-16 bg-blue-100 rounded-lg flex items-center justify-center mb-4">
                      <svg className="w-8 h-8 text-blue-600" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                        <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M9 12h6m-6 4h6m2 5H7a2 2 0 01-2-2V5a2 2 0 012-2h5.586a1 1 0 01.707.293l5.414 5.414a1 1 0 01.293.707V19a2 2 0 01-2 2z" />
                      </svg>
                    </div>
                    <h4 className="text-lg font-medium text-gray-900 mb-2">
                      Fieldsheet Document Ready
                    </h4>
                    <p className="text-gray-600 mb-4">
                      Your survey fieldsheet has been generated and is ready for review.
                    </p>
                    <div className="flex gap-3">
                      <Button onClick={handleDownloadFieldsheet} variant="secondary">
                        Download Word Document
                      </Button>
                      {pdfAvailable ? (
                        <Button onClick={handlePdfClick} variant="primary">
                          View PDF Fieldsheet
                        </Button>
                      ) : (
                        <Button 
                          variant="primary" 
                          disabled 
                          className="opacity-50 cursor-not-allowed"
                          onClick={() => {}}
                        >
                          PDF Unavailable
                        </Button>
                      )}
                    </div>
                    {!pdfAvailable && (
                      <p className="text-sm text-orange-600 mt-2">
                        PDF generation is not available in this environment. Please use the Word document.
                      </p>
                    )}
                  </div>
                </div>
              </div>
            ) : (
              <div className="text-center py-12">
                <div className="text-red-600 mb-2">
                  <svg className="w-12 h-12 mx-auto" fill="none" stroke="currentColor" viewBox="0 0 24 24">
                    <path strokeLinecap="round" strokeLinejoin="round" strokeWidth={2} d="M12 9v2m0 4h.01m-6.938 4h13.856c1.54 0 2.502-1.667 1.732-2.5L13.732 4c-.77-.833-1.964-.833-2.732 0L3.732 16.5c-.77.833.192 2.5 1.732 2.5z" />
                  </svg>
                </div>
                <p className="text-gray-600">Failed to generate fieldsheet preview</p>
                <Button onClick={generatePDFPreview} variant="secondary" className="mt-4">
                  Retry
                </Button>
              </div>
            )}
          </div>

          {/* Verification Section */}
          <div className={`border rounded-lg p-6 ${
            hasViewedPDF || readOnly
              ? "bg-blue-50 border-blue-200" 
              : "bg-gray-50 border-gray-200 opacity-60 pointer-events-none"
          }`}>
            <h3 className={`text-lg font-semibold mb-4 ${
              hasViewedPDF || readOnly ? "text-blue-900" : "text-gray-500"
            }`}>
              Document Verification
            </h3>
            
            <div className="space-y-4">
              {/* Confirmation Checkbox - hidden in view mode */}
              {!readOnly && (
                <div className="flex items-start space-x-3">
                  <input
                    type="checkbox"
                    id="viewedPDF"
                    checked={hasViewedPDF}
                    onChange={(e) => setHasViewedPDF(e.target.checked)}
                    className={`mt-1 h-4 w-4 focus:ring-blue-500 border-gray-300 rounded ${
                      hasViewedPDF ? "text-blue-600" : "text-gray-400"
                    }`}
                    disabled={!hasViewedPDF}
                  />
                  <label 
                    htmlFor="viewedPDF" 
                    className={`text-sm font-medium ${
                      hasViewedPDF ? "text-gray-900" : "text-gray-500"
                    }`}
                  >
                    I confirm that I have viewed the complete fieldsheet document (PDF or Word)
                  </label>
                </div>
              )}

              {/* Comment and Signature Section */}
              {(hasViewedPDF || readOnly) && (
                <div className="space-y-4 pt-4 border-t border-blue-200">
                  {/* Comment Section */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">
                      Review Comments {!readOnly && <span className="text-red-500">*</span>}
                    </label>
                    {readOnly ? (
                      <div className="bg-white border border-gray-300 rounded-md p-3 min-h-[80px]">
                        {data.verificationComment || comment || "No comments provided."}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-2">
                          Please provide any comments or observations about the fieldsheet content
                        </p>
                        <textarea
                          value={comment}
                          onChange={(e) => setComment(e.target.value)}
                          rows={4}
                          className="w-full px-3 py-2 border border-gray-300 rounded-md focus:outline-none focus:ring-2 focus:ring-blue-500 focus:border-transparent"
                          placeholder="Enter your review comments here..."
                        />
                      </>
                    )}
                  </div>

                  {/* Signature Section */}
                  <div className="mb-4">
                    <label className="block text-sm font-medium mb-1 text-gray-700">
                      Signature {!readOnly && <span className="text-red-500">*</span>}
                    </label>
                    {readOnly ? (
                      <div className="border border-gray-300 rounded-md p-4 bg-white">
                        {data.verificationSignature || signature ? (
                          <img 
                            src={data.verificationSignature || signature} 
                            alt="Saved signature" 
                            className="max-h-32 mx-auto border rounded bg-white"
                          />
                        ) : (
                          <p className="text-gray-500 text-center">No signature provided</p>
                        )}
                      </div>
                    ) : (
                      <>
                        <p className="text-xs text-gray-500 mb-2">
                          Draw your signature in the canvas below
                        </p>
                        <div
                          className="border border-gray-300 rounded-md mb-2 bg-white"
                          style={{ height: "200px", width: "100%" }}
                        >
                          <canvas
                            ref={canvasRef}
                            width={500}
                            height={200}
                            className="w-full h-full cursor-crosshair bg-white"
                            onMouseDown={startDrawing}
                            onMouseMove={draw}
                            onMouseUp={stopDrawing}
                            onMouseLeave={stopDrawing}
                            style={{ touchAction: 'none', backgroundColor: 'white' }}
                          />
                        </div>
                        <div className="flex gap-2">
                          <Button 
                            variant="secondary" 
                            onClick={clearSignature} 
                            className="text-sm"
                          >
                            Clear
                          </Button>
                          <Button 
                            variant="primary" 
                            onClick={saveSignature} 
                            disabled={!hasSignature}
                            className="text-sm"
                          >
                            Save Signature
                          </Button>
                        </div>
                        {signature && (
                          <div className="mt-3">
                            <p className="text-xs text-gray-500 mb-1">Saved signature:</p>
                            <img src={signature} alt="Saved signature" className="border rounded max-h-20 bg-white" />
                          </div>
                        )}
                      </>
                    )}
                  </div>

                  {/* Summary of verification */}
                  <div className="bg-white border border-gray-200 rounded-lg p-4 mt-4">
                    <h4 className="text-sm font-semibold text-gray-900 mb-2">Verification Summary</h4>
                    <div className="text-sm text-gray-600 space-y-1">
                      <div className="flex items-center">
                        <span className="w-4 h-4 rounded-full bg-green-500 mr-2"></span>
                        Document downloaded and reviewed
                      </div>
                      <div className="flex items-center">
                        <span className={`w-4 h-4 rounded-full mr-2 ${(data.verificationComment || comment.trim()) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        Review comments provided
                      </div>
                      <div className="flex items-center">
                        <span className={`w-4 h-4 rounded-full mr-2 ${(data.verificationSignature || signature) ? 'bg-green-500' : 'bg-gray-300'}`}></span>
                        Signature provided
                      </div>
                    </div>
                  </div>
                </div>
              )}
            </div>
          </div>

          {/* Instructions */}
          {!readOnly && (
            <div className="bg-yellow-50 border border-yellow-200 rounded-lg p-4">
              <div className="flex">
                <div className="flex-shrink-0">
                  <svg className="h-5 w-5 text-yellow-400" viewBox="0 0 20 20" fill="currentColor">
                    <path fillRule="evenodd" d="M8.257 3.099c.765-1.36 2.722-1.36 3.486 0l5.58 9.92c.75 1.334-.213 2.98-1.742 2.98H4.42c-1.53 0-2.493-1.646-1.743-2.98l5.58-9.92zM11 13a1 1 0 11-2 0 1 1 0 012 0zm-1-8a1 1 0 00-1 1v3a1 1 0 002 0V6a1 1 0 00-1-1z" clipRule="evenodd" />
                  </svg>
                </div>
                <div className="ml-3">
                  <h3 className="text-sm font-medium text-yellow-800">
                    Important Instructions
                  </h3>
                  <div className="mt-2 text-sm text-yellow-700">
                    <ul className="list-disc pl-5 space-y-1">
                      <li>Click "View PDF Fieldsheet" to open the complete document in a new tab</li>
                      <li>Alternatively, download the Word document for offline review</li>
                      <li>Verify all survey data, measurements, and equipment information</li>
                      <li>Check for any missing or incorrect information</li>
                      <li>Provide detailed comments about your review</li>
                      <li>Draw your signature to confirm the accuracy of the document</li>
                    </ul>
                  </div>
                </div>
              </div>
            </div>
          )}
        </div>

        <Actions>
          <Button variant="secondary" onClick={onPrev}>
            Back
          </Button>
          <Button 
            onClick={handleCompleteSurvey} 
            variant={readOnly ? "success" : "success"} 
            disabled={!canProceed}
            className={!canProceed ? "opacity-50 cursor-not-allowed" : ""}
          >
            {readOnly ? "Complete Viewing" : "Complete Survey"}
          </Button>
        </Actions>
      </Section>

      {/* Custom Completion Dialog - Only show in edit mode */}
      {!readOnly && (
        <CompletionDialog
          open={completionDialogOpen}
          onConfirm={confirmCompleteSurvey}
        />
      )}
    </>
  );
}