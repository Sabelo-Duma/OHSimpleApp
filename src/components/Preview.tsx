// src/components/Preview.tsx
import React, { useState, useEffect, useRef } from "react";
import { SurveyData, Area } from "./types";
import Section from "./common/Section";
import Actions from "./common/Actions";
import Button from "./common/Button";
import { buildWordContent } from "./helpers";
import { Document, Packer, Paragraph, Table, Footer, PageNumber, AlignmentType, TextRun } from "docx";
import ConfirmDialog from "./common/ConfirmDialog";
import SignatureCanvas from "react-signature-canvas";

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

export default function Preview({ data, onPrev, onNext, readOnly = false }: PreviewProps) {
  const [hasViewedPDF, setHasViewedPDF] = useState(!!data.verificationComment || !!data.verificationSignature);
  const [comment, setComment] = useState(data.verificationComment || "");
  const [signature, setSignature] = useState(data.verificationSignature || "");
  const [pdfUrl, setPdfUrl] = useState<string | null>(null);
  const [isGeneratingPDF, setIsGeneratingPDF] = useState(false);
  const [pdfAvailable, setPdfAvailable] = useState(!!pdfMake);
  const [completionDialogOpen, setCompletionDialogOpen] = useState(false);

  // Canvas signature refs and state
  const sigCanvas = useRef<any>(null);
  const [hasSignature, setHasSignature] = useState(!!data.verificationSignature);

  // Generate PDF preview on component mount
  useEffect(() => {
    generatePDFPreview();
  }, []);

  // Initialize canvas with saved signature if it exists
  useEffect(() => {
    if (signature && sigCanvas.current) {
      sigCanvas.current.fromDataURL(signature);
    }
  }, [signature]);

  // Track when user starts drawing to enable save button
  const handleSignatureEnd = () => {
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      setHasSignature(true);
    }
  };

  const clearSignature = () => {
    if (readOnly) return;
    if (sigCanvas.current) {
      sigCanvas.current.clear();
      setHasSignature(false);
      setSignature("");
    }
  };

  const saveSignature = () => {
    if (readOnly) return;
    if (sigCanvas.current && !sigCanvas.current.isEmpty()) {
      const dataUrl = sigCanvas.current.toDataURL('image/png');
      setSignature(dataUrl);
      setHasSignature(true);
    }
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
      alert('PDF generation is not available in your current environment. Please use the Word document download instead.');
      return;
    }

    let signatureImage = data.verificationSignature || signature;
    if (sigCanvas.current && hasSignature && !signatureImage) {
      signatureImage = sigCanvas.current.toDataURL("image/png");
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
      pdfMake.createPdf(docDefinition).open();
      setHasViewedPDF(true);
    } catch (error) {
      console.error('Error generating PDF:', error);
      alert('Error generating PDF. Please use the Word document download instead.');
    }
  };

  const generatePDFPreview = async () => {
    setIsGeneratingPDF(true);
    try {
      // Build Word content
      const wordChildren: (Paragraph | Table)[] = await buildWordContent(data);

      const doc = new Document({
        sections: [
          {
            properties: {},
            children: wordChildren,
            footers: {
              default: new Footer({
                children: [
                  new Paragraph({
                    alignment: AlignmentType.CENTER,
                    children: [
                      new TextRun("Page "),
                      new TextRun({
                        children: [PageNumber.CURRENT],
                      }),
                      new TextRun(" of "),
                      new TextRun({
                        children: [PageNumber.TOTAL_PAGES],
                      }),
                    ],
                  }),
                ],
              }),
            },
          },
        ],
      });

      const blob = await Packer.toBlob(doc);
      const url = URL.createObjectURL(blob);
      setPdfUrl(url);
    } catch (error) {
      console.error("Error generating PDF preview:", error);
    } finally {
      setIsGeneratingPDF(false);
    }
  };

  const handleViewWordPreview = async () => {
    if (!pdfUrl) return;

    // Word documents cannot be viewed directly in browser tabs like PDFs
    // Browsers only support viewing PDFs, images, text, and HTML
    // For Word documents, we need to trigger a download

    const link = document.createElement('a');
    link.href = pdfUrl;

    // Generate dynamic filename based on survey data
    const timestamp = new Date().toLocaleString('en-GB', {
      day: '2-digit',
      month: 'long',
      year: '2-digit',
      hour: '2-digit',
      minute: '2-digit',
      second: '2-digit',
      hour12: false
    }).replace(/[,:\s]+/g, '-').toUpperCase();

    const reportTitle = `Report_${data.client || 'Survey'}-${data.project || 'Project'}-${timestamp}.docx`;

    // Set download attribute to provide a filename
    link.download = reportTitle;

    // Trigger download
    document.body.appendChild(link);
    link.click();
    document.body.removeChild(link);

    // Note: This does NOT mark the document as viewed
    // Only viewing the PDF Fieldsheet enables the comment/signature section
  };

  const handleCompleteSurvey = () => {
    if (readOnly) {
      // In view mode, just return to greeting page
      onNext(data);
    } else {
      // In edit mode, show completion dialog
      setCompletionDialogOpen(true);
    }
  };

  const confirmCompleteSurvey = () => {
    // Mark survey as completed
    const completedSurvey: SurveyData = {
      ...data,
      status: "Completed" as const,
      completedAt: new Date().toISOString(),
      verificationComment: comment,
      verificationSignature: signature
    };
    
    // Pass the completed survey back to parent
    onNext(completedSurvey);
    setCompletionDialogOpen(false);
  };

  // User must view PDF, provide comment, AND draw a signature to complete the survey
  const canProceed = readOnly || (hasViewedPDF && comment.trim() && hasSignature);

  return (
    <>
      <Section title="Fieldsheet Preview & Verification">
        <div className="space-y-6 mb-8">

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
                      <li>Click "Download Word Report" to download the complete comprehensive report (for your records)</li>
                      <li>Click "View PDF Fieldsheet" to view and verify the survey data (required to enable comment and signature sections)</li>
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
                      <Button onClick={handleViewWordPreview} variant="secondary">
                        Download Word Report
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
                    I confirm that I have viewed the PDF Fieldsheet
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
                        <div className="border border-gray-300 rounded-md bg-white mb-2 w-full" style={{ height: "200px" }}>
                          <SignatureCanvas
                            ref={sigCanvas}
                            penColor="black"
                            backgroundColor="white"
                            canvasProps={{
                              className: "sigCanvas w-full h-full",
                              style: { width: '100%', height: '100%' }
                            }}
                            onEnd={handleSignatureEnd}
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

      {/* Completion Confirmation Dialog - Only show in edit mode */}
      {!readOnly && (
        <ConfirmDialog
          open={completionDialogOpen}
          title="Survey Completed!"
          message="Survey successfully completed! Thank you!"
          confirmText="OK"
          cancelText=""
          confirmButtonVariant="success"
          onConfirm={confirmCompleteSurvey}
          onCancel={() => setCompletionDialogOpen(false)}
        />
      )}
    </>
  );
}