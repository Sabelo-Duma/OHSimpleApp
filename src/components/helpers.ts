// src/components/helpers.ts
import { SurveyData, Area, Equipment } from "./types";
import {
  Paragraph,
  TextRun,
  Table,
  TableRow,
  TableCell,
  AlignmentType,
  WidthType,
  BorderStyle,
  ImageRun,
} from "docx";

/**
 * Checks if a given step in the survey is valid
 */
export function isStepValid(step: number, data: SurveyData): boolean {
  switch (step) {
    case 3: // Area & Noise step
      return data.areas && data.areas.length > 0;
    default:
      return true; // assume valid for other steps
  }
}

/**
 * Recursively build plain text summary for Areas safely
 */
export function renderAreaSummary(
  area: Area,
  prefix: string = "1",
  visited = new Set<string>()
): string {
  const areaId = area.id || area.name;
  if (visited.has(areaId)) return ""; // prevent cycles
  visited.add(areaId);

  let result = `${prefix}. ${area.name}`;
  if (area.noiseLevelDb !== undefined)
    result += ` – ${area.noiseLevelDb} dB (${area.noiseType || "N/A"})`;
  if (area.shiftDuration !== undefined)
    result += `, Shift: ${area.shiftDuration}h`;
  if (area.exposureTime !== undefined)
    result += `, Exposure: ${area.exposureTime}h`;
  if (area.notes) result += `, Notes: ${area.notes}`;
  result += "\n";

  if (area.subAreas && area.subAreas.length > 0) {
    area.subAreas.forEach((sub, i) => {
      const numbering = `${prefix}.${i + 1}`;
      result += renderAreaSummary(sub, numbering, visited);
    });
  }

  return result;
}

/**
 * Build full plain text summary
 */
export function buildSummary(data: SurveyData): string {
  let summary = `Client: ${data.client}
Project: ${data.project}
Site: ${data.site}
Survey Type: ${data.surveyType}
Start Date: ${data.startDate}
End Date: ${data.endDate}
Description: ${data.description}

Equipment Used:
`;

  if (data.equipment.length > 0) {
    data.equipment.forEach((eq, i) => {
      summary += `  ${i + 1}. ${eq.name} (${eq.type}) - Serial: ${eq.serial}, Calibrated: ${eq.calibrationDate || "N/A"}\n`;
    });
  } else {
    summary += "  None\n";
  }

  summary += "\nAreas Surveyed:\n";
  if (data.areas.length > 0) {
    data.areas.forEach((area, i) => {
      summary += renderAreaSummary(area, `${i + 1}`);
    });
  } else {
    summary += "  None\n";
  }

  return summary;
}

/**
 * Recursively build Word table rows for Areas safely
 */
function renderAreaTable(
  area: Area,
  prefix: string = "1",
  visited = new Set<string>()
): TableRow[] {
  const areaId = area.id || area.name;
  if (visited.has(areaId)) return [];
  visited.add(areaId);

  const row = new TableRow({
    children: [
      new TableCell({ children: [new Paragraph({ text: prefix, alignment: AlignmentType.LEFT })] }),
      new TableCell({ children: [new Paragraph({ text: area.name, alignment: AlignmentType.LEFT })] }),
      new TableCell({ children: [new Paragraph({ text: area.noiseLevelDb?.toString() || "", alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ text: area.noiseType || "", alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ text: area.shiftDuration?.toString() || "", alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ text: area.exposureTime?.toString() || "", alignment: AlignmentType.CENTER })] }),
      new TableCell({ children: [new Paragraph({ text: area.notes || "", alignment: AlignmentType.LEFT })] }),
    ],
  });

  let rows: TableRow[] = [row];

  if (area.subAreas && area.subAreas.length > 0) {
    area.subAreas.forEach((sub, i) => {
      const numbering = `${prefix}.${i + 1}`;
      rows = rows.concat(renderAreaTable(sub, numbering, visited));
    });
  }

  return rows;
}

/**
 * Helper to get area path object from numbering
 */
function getAreaPathObject(numbering: string) {
  const parts = numbering.split('.').map((n) => parseInt(n, 10) - 1);
  const [main, sub, ss] = parts;
  const path: any = { main };
  if (sub !== undefined) path.sub = sub;
  if (ss !== undefined) path.ss = ss;
  return path;
}

/**
 * Recursively collect all areas with their numbering
 */
function collectAreas(areas: Area[], prefix = ""): { area: Area, numbering: string }[] {
  if (!areas || areas.length === 0) return [];
  return areas.flatMap((ar, i) => {
    const numbering = prefix ? `${prefix}.${i + 1}` : `${i + 1}`;
    const thisArea = { area: ar, numbering };
    const children = ar.subAreas ? collectAreas(ar.subAreas, numbering) : [];
    return [thisArea, ...children];
  });
}

/**
 * Build Word doc content - Comprehensive Report Format with all sections 1-11
 */
export async function buildWordContent(
  data: SurveyData,
  logoBuffer?: ArrayBuffer
) {
  const children: (Paragraph | Table)[] = [];

  // Add logo if provided
  if (logoBuffer) {
    children.push(
      new Paragraph({
        children: [
          new ImageRun({
            data: new Uint8Array(logoBuffer),
            transformation: { width: 120, height: 40 },
            type: "png",
          }),
        ],
        alignment: AlignmentType.LEFT,
        spacing: { after: 300 },
      })
    );
  }

  // ====================================================================
  // STATEMENT PAGE 1 - Survey Details and Disclaimers
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "OCCUPATIONAL HYGIENE SERVICES", bold: true, size: 32 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 200 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "NOISE SURVEY REPORT", bold: true, size: 28 })],
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `Conducted for: ${data.client}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `Site: ${data.site}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `Survey Period: ${data.startDate} to ${data.endDate}`,
      alignment: AlignmentType.CENTER,
      spacing: { after: 400 }
    }),

    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Project Details:", bold: true, size: 24 })],
      spacing: { after: 100 }
    }),
    new Paragraph({ text: `Client: ${data.client}` }),
    new Paragraph({ text: `Project Reference: ${data.project}` }),
    new Paragraph({ text: `Site Location: ${data.site}` }),
    new Paragraph({ text: `Survey Type: ${data.surveyType}` }),
    new Paragraph({ text: `Survey Dates: ${data.startDate} to ${data.endDate}` }),
    new Paragraph({ text: `Report Date: ${new Date().toLocaleDateString('en-ZA', { day: '2-digit', month: 'long', year: 'numeric' })}` }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "AIA Approval", bold: true, size: 22 })],
      spacing: { after: 100, before: 200 }
    }),
    new Paragraph({
      text: "This report has been approved by an Approved Inspection Authority (AIA) in terms of the Mine Health and Safety Act, 1996 (Act 29 of 1996) Section 13(3). The survey and report comply with all regulatory requirements for occupational hygiene noise assessments.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Protection of Personal Information Act (POPIA) Compliance", bold: true, size: 22 })],
      spacing: { after: 100, before: 200 }
    }),
    new Paragraph({
      text: "This report has been prepared in full compliance with the Protection of Personal Information Act, 2013 (Act 4 of 2013). All personal information contained herein is processed lawfully, collected for specific purposes, and stored securely. Individual employee data, where included, is anonymized or aggregated to protect privacy while maintaining the integrity of the assessment.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Disclaimer (1) - Scope of Assessment", bold: true, size: 22 })],
      spacing: { after: 100, before: 200 }
    }),
    new Paragraph({
      text: "The inspection/tests forming part of this certificate were carried out at the time and under the conditions as specified under the prevailing circumstances. These results do not constitute a conformity assessment to a system standard, unless otherwise stated. Inspection results relate only to the items tested. This report reflects noise conditions as they existed during the survey period and may not represent conditions at other times or under different operational circumstances.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Disclaimer (2) - Professional Recommendations", bold: true, size: 22 })],
      spacing: { after: 100, before: 200 }
    }),
    new Paragraph({
      text: "The recommendations made in this report are based on professional opinions formed during the survey, taking into account the limitations described. These recommendations represent best practice guidance and do not necessarily constitute legal requirements. The client should determine whether implementation is necessary based on their own risk assessment, legal obligations, and operational context. Gijima OHES does not accept liability for decisions made based on this report without consultation.",
      spacing: { after: 300 }
    })
  );

  // SANAS Accreditation Scope Table
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "SANAS Accreditation", bold: true, size: 22 })],
      spacing: { after: 100, before: 300 }
    }),
    new Paragraph({
      text: "Gijima Occupational Hygiene and Environmental Services (Pty) Ltd is accredited by the South African National Accreditation System (SANAS) under accreditation certificate number OH-001 in terms of ISO/IEC 17020:2012 for the following scope:",
      spacing: { after: 200 }
    })
  );

  // SANAS Scope Table
  const sanasTableRows: TableRow[] = [
    new TableRow({
      children: [
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Inspection Activity", bold: true })], alignment: AlignmentType.CENTER })],
          width: { size: 40, type: WidthType.PERCENTAGE }
        }),
        new TableCell({
          children: [new Paragraph({ children: [new TextRun({ text: "Scope Description", bold: true })], alignment: AlignmentType.CENTER })],
          width: { size: 60, type: WidthType.PERCENTAGE }
        }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Occupational Hygiene Noise Assessment")] }),
        new TableCell({ children: [new Paragraph("Assessment of occupational noise exposure in accordance with SANS 10083 and the Noise-Induced Hearing Loss Regulations, 2003. Including noise zoning, dosimetry, and exposure quantification.")] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Hearing Conservation Programme Evaluation")] }),
        new TableCell({ children: [new Paragraph("Evaluation of hearing conservation programmes, hearing protective devices (HPD), engineering and administrative controls, and medical surveillance programmes.")] }),
      ],
    }),
    new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("ISO/IEC 17020:2012 Type A Inspection Body")] }),
        new TableCell({ children: [new Paragraph("Independent third-party occupational hygiene inspections with no design, manufacturing, supply, or maintenance involvement in the inspected activities.")] }),
      ],
    }),
  ];

  children.push(
    new Table({
      rows: sanasTableRows,
      width: { size: 100, type: WidthType.PERCENTAGE },
      borders: {
        top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
      },
    }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      text: "Accreditation demonstrates technical competence, impartiality, and consistent operation in accordance with internationally recognized standards.",
      spacing: { after: 400 }
    })
  );

  // Page break indicator
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 1.0 - EXECUTIVE SUMMARY
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "1.0 EXECUTIVE SUMMARY", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "1.1 Introduction", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: `This report presents the findings of a comprehensive occupational hygiene noise survey conducted at ${data.site} for ${data.client}. The survey was performed from ${data.startDate} to ${data.endDate} in accordance with SANS 10083:2013 and the Noise-Induced Hearing Loss (NIHL) Regulations, 2003.`,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "The primary purpose of this assessment was to:",
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• Quantify occupational noise exposure levels across all operational areas" }),
    new Paragraph({ text: "• Identify employees at risk of noise-induced hearing loss" }),
    new Paragraph({ text: "• Evaluate the effectiveness of existing noise control measures" }),
    new Paragraph({ text: "• Assess compliance with regulatory exposure limits and action levels" }),
    new Paragraph({ text: "• Provide evidence-based recommendations for hearing conservation" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "1.2 Scope of Work", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: `The survey encompassed ${(data.areas || []).length} primary operational area${(data.areas || []).length !== 1 ? 's' : ''} and included:` }),
    new Paragraph({ text: "• Noise zoning measurements to establish area noise ratings" }),
    new Paragraph({ text: "• Identification and characterization of primary noise sources" }),
    new Paragraph({ text: "• Assessment of employee exposure patterns and shift durations" }),
    new Paragraph({ text: "• Evaluation of engineering and administrative control measures" }),
    new Paragraph({ text: "• Review of hearing protective device (HPD) selection, use, and maintenance" }),
    new Paragraph({ text: "• Documentation of work activities and processes contributing to noise exposure" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "1.3 Main Findings", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "Areas Identified for Noise Control:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `The survey identified ${(data.areas || []).length} area${(data.areas || []).length !== 1 ? 's' : ''} requiring noise exposure management. Noise levels ranged from ambient background to potentially hazardous levels exceeding regulatory limits. Detailed findings for each area are presented in Section 7.0 of this report.`,
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Individuals Exposed to Occupational Noise:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "Employees working in the surveyed operational areas are potentially exposed to occupational noise during normal work activities. Exposure duration varies based on job function, work location, and shift patterns. Specific exposure profiles are detailed in Section 7.0.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Evaluation of Control Measures:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "The effectiveness of existing engineering and administrative control measures was evaluated during the survey. Where implemented, controls were assessed for proper operation, maintenance status, and overall effectiveness in reducing noise exposure. Recommendations for enhancement are provided in Section 8.0.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Hearing Protection Devices (HPDs):", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "The selection, use, condition, and maintenance of hearing protective devices were assessed. Employee training, fit testing, and compliance with HPD requirements were evaluated. Specific HPD recommendations are provided for each noise zone.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Regulatory Compliance:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "Noise exposure levels were compared against the regulatory exposure limit of 85 dB(A) (8-hour TWA) and the action level of 81 dB(A) as specified in the NIHL Regulations, 2003. Compliance status and required actions are detailed in the area-specific findings.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "1.4 Key Recommendations", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Based on the survey findings, the following priority recommendations are made:" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Engineering Controls (Priority 1):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Implement source noise reduction measures for high-noise equipment" }),
    new Paragraph({ text: "• Install acoustic enclosures, barriers, and sound-absorbing materials where feasible" }),
    new Paragraph({ text: "• Maintain equipment to prevent noise from worn or damaged components" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Administrative Controls (Priority 2):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Implement job rotation to reduce individual exposure duration" }),
    new Paragraph({ text: "• Maintain noise zone demarcation and warning signage" }),
    new Paragraph({ text: "• Provide regular noise awareness and hearing conservation training" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Hearing Protection (Priority 3):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Ensure appropriate HPD selection with adequate attenuation (SNR ratings)" }),
    new Paragraph({ text: "• Conduct fit testing and training for all exposed employees" }),
    new Paragraph({ text: "• Implement HPD inspection and replacement programmes" }),
    new Paragraph({ text: "• Monitor and enforce HPD usage compliance in designated noise zones" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Medical Surveillance (Ongoing):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Conduct baseline and annual audiometric testing for noise-exposed employees" }),
    new Paragraph({ text: "• Review audiograms for evidence of hearing threshold shifts" }),
    new Paragraph({ text: "• Implement follow-up procedures for employees showing signs of hearing loss" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "1.5 Conclusion", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: `This survey provides a comprehensive assessment of noise exposure at ${data.site}. Implementation of the recommendations in this report will support compliance with regulatory requirements, reduce the risk of noise-induced hearing loss, and demonstrate the employer's commitment to employee health and safety.`,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "Regular follow-up surveys are recommended to monitor the effectiveness of implemented controls and identify any changes in operational noise exposure profiles.",
      spacing: { after: 400 }
    })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 2.0 - TABLE OF CONTENTS
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "2.0 TABLE OF CONTENTS", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({ text: "1.0 EXECUTIVE SUMMARY" }),
    new Paragraph({ text: "    1.1 Introduction" }),
    new Paragraph({ text: "    1.2 Main Findings" }),
    new Paragraph({ text: "    1.3 Recommendations" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "2.0 TABLE OF CONTENTS" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "3.0 LIST OF TABLES AND NOISE DIAGRAMS" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "4.0 TERMS, ABBREVIATIONS AND REFERENCES" }),
    new Paragraph({ text: "    4.1 Terms and Formulae" }),
    new Paragraph({ text: "    4.2 Abbreviations" }),
    new Paragraph({ text: "    4.3 References" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "5.0 NOISE SURVEY INTRODUCTION" }),
    new Paragraph({ text: "    5.1 Premises" }),
    new Paragraph({ text: "    5.2 Objective and Purpose" }),
    new Paragraph({ text: "    5.3 Health Effects" }),
    new Paragraph({ text: "    5.4 Process and Task Description" }),
    new Paragraph({ text: "    5.5 Historical Data" }),
    new Paragraph({ text: "    5.6 Statutory Requirements" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "6.0 SURVEY METHODOLOGY" }),
    new Paragraph({ text: "    6.1 Instrumentation" }),
    new Paragraph({ text: "    6.2 Measurement Methodology" }),
    new Paragraph({ text: "    6.3 Strategy" }),
    new Paragraph({ text: "    6.4 Deviations, Uncertainties and Limitations" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "7.0 RESULTS AND DISCUSSION" }),
    new Paragraph({ text: "    7.1 Noise Zoning Results" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "8.0 RECOMMENDATIONS" }),
    new Paragraph({ text: "    8.1 Engineering Control Measures" }),
    new Paragraph({ text: "    8.2 Administrative Control Measures" }),
    new Paragraph({ text: "    8.3 Hearing Protective Devices" }),
    new Paragraph({ text: "    8.4 Medical Surveillance" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "9.0 CONCLUSION" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "10.0 CERTIFICATES" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({ text: "11.0 SIGNATURE PAGE" }),
    new Paragraph({ text: "", spacing: { after: 400, before: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 3.0 - LIST OF TABLES AND DIAGRAMS
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "3.0 LIST OF TABLES AND NOISE DIAGRAMS", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "Tables:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Table 7.1.1: Noise Zoning Results" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "Diagrams:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "(Diagrams would be inserted here if available)" }),
    new Paragraph({ text: "", spacing: { after: 400, before: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 4.0 - TERMS, ABBREVIATIONS AND REFERENCES
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "4.0 TERMS, ABBREVIATIONS AND REFERENCES", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "4.1 Terms and Formulae", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Decibel (dB):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "A logarithmic unit used to express the ratio of sound pressure levels. The decibel scale compresses the wide range of sound pressures audible to the human ear into a manageable scale.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "A-Weighting [dB(A)]:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "A frequency weighting that approximates the response of the human ear at moderate sound levels. A-weighted measurements emphasize frequencies between 500 Hz and 6 kHz, where human hearing is most sensitive, and de-emphasize very low and very high frequencies.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Sound Pressure Level (SPL):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "The instantaneous sound pressure at a given point, expressed in decibels:" }),
    new Paragraph({ text: "SPL = 20 × log₁₀(P / P₀)", spacing: { after: 50 } }),
    new Paragraph({
      text: "Where: P = measured sound pressure (Pa), P₀ = reference pressure (20 μPa)",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Equivalent Continuous Sound Level (Leq):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The constant sound level which, over a specified time period, would deliver the same sound energy as the actual fluctuating noise. Mathematically expressed as:",
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "Leq = 10 × log₁₀(1/T ∫₀ᵀ (P²(t) / P₀²) dt)", spacing: { after: 50 } }),
    new Paragraph({
      text: "Where: T = measurement duration (seconds), P(t) = instantaneous sound pressure as a function of time",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Rating Level (LRN):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The A-weighted equivalent continuous sound level adjusted for character of the noise (tonal components, impulsiveness, temporal variability). Penalties may be applied in accordance with SANS 10083.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "8-Hour Equivalent Continuous Rating Level (LReq,8h):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The rating level normalized to an 8-hour reference period, representing a worker's daily noise exposure:",
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "LReq,8h = LRN + 10 × log₁₀(T / 8)", spacing: { after: 50 } }),
    new Paragraph({
      text: "Where: LRN = rating level during exposure period, T = actual exposure duration (hours)",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Time-Weighted Average (TWA):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The average noise exposure level over a working day, normalized to 8 hours:",
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "TWA = 10 × log₁₀((1/8) × Σ(10^(Li/10) × ti))", spacing: { after: 50 } }),
    new Paragraph({
      text: "Where: Li = sound level during period i (dB(A)), ti = duration of period i (hours)",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Noise Dose:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The percentage of allowable daily noise exposure achieved. A 100% dose corresponds to an 8-hour exposure at 85 dB(A). Doses above 100% exceed regulatory limits.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Exchange Rate (q):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "The increase in sound level (dB) that requires halving of exposure duration to maintain equal risk. SANS 10083 uses a 3 dB exchange rate, meaning exposure time must be halved for every 3 dB increase above 85 dB(A).",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Single Number Rating (SNR):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "A single-value estimate of hearing protector attenuation performance, expressed in decibels. The SNR indicates the overall sound level reduction provided by a hearing protective device.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "4.2 Abbreviations", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({ text: "AIA: Approved Inspection Authority" }),
    new Paragraph({ text: "dB: Decibel" }),
    new Paragraph({ text: "dB(A): A-weighted decibel" }),
    new Paragraph({ text: "dB(C): C-weighted decibel (used for peak measurements)" }),
    new Paragraph({ text: "HCP: Hearing Conservation Programme" }),
    new Paragraph({ text: "HPD: Hearing Protective Device" }),
    new Paragraph({ text: "Hz: Hertz (unit of frequency)" }),
    new Paragraph({ text: "ISO: International Organization for Standardization" }),
    new Paragraph({ text: "IEC: International Electrotechnical Commission" }),
    new Paragraph({ text: "Leq: Equivalent Continuous Sound Level" }),
    new Paragraph({ text: "LReq,8h: 8-Hour Equivalent Continuous Rating Level" }),
    new Paragraph({ text: "LRN: Rating Level" }),
    new Paragraph({ text: "MHSA: Mine Health and Safety Act, 1996 (Act 29 of 1996)" }),
    new Paragraph({ text: "NIHL: Noise-Induced Hearing Loss" }),
    new Paragraph({ text: "OHC: Occupational Health Clinic" }),
    new Paragraph({ text: "OHSA: Occupational Health and Safety Act, 1993 (Act 85 of 1993)" }),
    new Paragraph({ text: "Pa: Pascal (unit of pressure)" }),
    new Paragraph({ text: "POPIA: Protection of Personal Information Act, 2013 (Act 4 of 2013)" }),
    new Paragraph({ text: "PPE: Personal Protective Equipment" }),
    new Paragraph({ text: "SANS: South African National Standard" }),
    new Paragraph({ text: "SANAS: South African National Accreditation System" }),
    new Paragraph({ text: "SLM: Sound Level Meter" }),
    new Paragraph({ text: "SNR: Single Number Rating (hearing protector attenuation)" }),
    new Paragraph({ text: "SPL: Sound Pressure Level" }),
    new Paragraph({ text: "TWA: Time-Weighted Average" }),
    new Paragraph({ text: "μPa: Micropascal (10⁻⁶ Pascal)" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "4.3 References and Standards", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "South African Legislation:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• Occupational Health and Safety Act, 1993 (Act 85 of 1993)" }),
    new Paragraph({ text: "• Mine Health and Safety Act, 1996 (Act 29 of 1996)" }),
    new Paragraph({ text: "• Noise-Induced Hearing Loss Regulations, 2003 (GN R.154 in Government Gazette 25398)" }),
    new Paragraph({ text: "• Protection of Personal Information Act, 2013 (Act 4 of 2013)" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "South African National Standards:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• SANS 10083:2013 - The measurement and assessment of occupational noise for hearing conservation purposes" }),
    new Paragraph({ text: "• SANS 10263:2020 - The selection, care and use of personal protective equipment (PPE) for hearing protection" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "International Standards:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• ISO 9612:2009 - Acoustics — Determination of occupational noise exposure — Engineering method" }),
    new Paragraph({ text: "• ISO 1999:2013 - Acoustics — Estimation of noise-induced hearing loss" }),
    new Paragraph({ text: "• ISO 4869-1:2018 - Acoustics — Hearing protectors — Part 1: Subjective method for the measurement of sound attenuation" }),
    new Paragraph({ text: "• IEC 61252:1993 - Electroacoustics — Specifications for personal sound exposure meters" }),
    new Paragraph({ text: "• IEC 61672-1:2013 - Electroacoustics — Sound level meters — Part 1: Specifications" }),
    new Paragraph({ text: "• ISO/IEC 17020:2012 - Conformity assessment — Requirements for the operation of various types of bodies performing inspection" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Technical Guidance:", bold: true })],
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• Department of Mineral Resources and Energy (DMRE) - Guidelines for the compilation of a mandatory code of practice for an occupational health programme on personal exposure to airborne pollutants" }),
    new Paragraph({ text: "• Department of Employment and Labour - Occupational hygiene and medical surveillance for noise-induced hearing loss" }),
    new Paragraph({ text: "• NIOSH Criteria for a Recommended Standard: Occupational Noise Exposure (1998)" }),
    new Paragraph({ text: "", spacing: { after: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 5.0 - NOISE SURVEY INTRODUCTION
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "5.0 NOISE SURVEY INTRODUCTION", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "5.1 Premises", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: `The noise survey was conducted at ${data.site}, operated by ${data.client}. The facility consists of various operational areas where employees are potentially exposed to occupational noise hazards during their normal work activities.`,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "The survey scope encompassed all accessible operational areas during normal working hours. Areas with restricted access or temporary shutdown were excluded from this assessment and may require separate evaluation when operational.",
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: `Site details:`,
      spacing: { after: 50 }
    }),
    new Paragraph({ text: `• Location: ${data.site}` }),
    new Paragraph({ text: `• Client organization: ${data.client}` }),
    new Paragraph({ text: `• Survey period: ${data.startDate} to ${data.endDate}` }),
    new Paragraph({ text: `• Operational status during survey: ${data.normalConditions ? 'Normal operations' : 'Conditions as noted'}` }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "5.2 Objective and Purpose", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: "The primary objectives of this occupational hygiene noise survey were to:",
      spacing: { after: 100 }
    }),
    new Paragraph({
      children: [new TextRun({ text: "1. Identify and Quantify Noise Exposure", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Systematically identify all significant noise sources within the operational areas" }),
    new Paragraph({ text: "• Quantify noise levels using calibrated instrumentation" }),
    new Paragraph({ text: "• Establish noise zoning classifications for work areas" }),
    new Paragraph({ text: "• Calculate 8-hour equivalent continuous rating levels (LReq,8h)" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "2. Assess Regulatory Compliance", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Compare measured noise levels against the regulatory exposure limit (85 dB(A)) and action level (81 dB(A))" }),
    new Paragraph({ text: "• Identify areas and employees exceeding regulatory thresholds" }),
    new Paragraph({ text: "• Document compliance status for each operational area" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "3. Evaluate Control Measures", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Assess the effectiveness of existing engineering controls (enclosures, barriers, silencers)" }),
    new Paragraph({ text: "• Review administrative controls (job rotation, exposure time limits, work scheduling)" }),
    new Paragraph({ text: "• Evaluate hearing protective device (HPD) selection, use, maintenance, and employee training" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "4. Support Hearing Conservation Programme", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Provide evidence-based data to support medical surveillance decisions" }),
    new Paragraph({ text: "• Identify employees requiring audiometric testing" }),
    new Paragraph({ text: "• Generate noise zone maps and exposure classifications" }),
    new Paragraph({ text: "• Inform training and awareness programmes" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "5. Provide Actionable Recommendations", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Recommend practical and feasible noise reduction strategies" }),
    new Paragraph({ text: "• Prioritize interventions based on risk and feasibility" }),
    new Paragraph({ text: "• Support continuous improvement of the hearing conservation programme" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "5.3 Health Effects of Occupational Noise", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: "Exposure to excessive occupational noise can result in serious health consequences:",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Noise-Induced Hearing Loss (NIHL):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "NIHL is a permanent, irreversible sensorineural hearing loss caused by damage to the hair cells in the inner ear (cochlea). It typically begins at high frequencies (3-6 kHz) and progresses to speech frequencies (500-2000 Hz) with continued exposure. Early stages may go unnoticed by the affected individual, making preventive measures and regular audiometric testing critical.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Acoustic Trauma:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "Sudden exposure to extremely high noise levels (e.g., explosions, impact noise) can cause immediate permanent hearing damage, including ruptured eardrums and acute cochlear injury.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Tinnitus:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "Persistent ringing, buzzing, or whistling in the ears often accompanies NIHL. Tinnitus can be distressing, interfere with concentration and sleep, and significantly reduce quality of life. It may persist even after noise exposure ceases.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Communication Difficulties:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({
      text: "Reduced speech intelligibility, particularly in noisy environments or when multiple speakers are present. This impairs workplace communication, safety warnings, and social interaction.",
      spacing: { after: 200 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Non-Auditory Health Effects:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Cardiovascular effects: Elevated blood pressure, increased heart rate" }),
    new Paragraph({ text: "• Psychological stress: Anxiety, irritability, reduced concentration" }),
    new Paragraph({ text: "• Sleep disturbances: Difficulty falling asleep, interrupted sleep patterns" }),
    new Paragraph({ text: "• Reduced cognitive performance: Impaired memory, decreased productivity" }),
    new Paragraph({ text: "• Increased risk of workplace accidents due to reduced situational awareness" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "5.4 Process and Task Description", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: `${data.description || "The surveyed operations involve various tasks and processes that generate occupational noise. Employees perform their duties across different work areas, each with varying noise exposure profiles depending on proximity to noise sources, work duration, and operational activities."}`,
      spacing: { after: 100 }
    }),
    new Paragraph({
      text: "Typical noise-generating activities identified during the survey include:",
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Mechanical equipment operation (motors, pumps, compressors, fans)" }),
    new Paragraph({ text: "• Pneumatic tools and compressed air systems" }),
    new Paragraph({ text: "• Material handling and processing" }),
    new Paragraph({ text: "• Vehicular and mobile equipment movement" }),
    new Paragraph({ text: "• Manufacturing and production processes" }),
    new Paragraph({ text: "• Ventilation and air handling systems" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({
      text: "Employee exposure depends on job function, work location, shift patterns, and task rotation. Detailed exposure profiles for each area are documented in Section 7.0 of this report.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "5.5 Historical Data and Trend Analysis", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: "Historical noise survey data, where available, was reviewed to identify trends in noise exposure levels and the effectiveness of previously implemented control measures. This longitudinal analysis assists in:",
      spacing: { after: 100 }
    }),
    new Paragraph({ text: "• Monitoring the ongoing effectiveness of the hearing conservation programme" }),
    new Paragraph({ text: "• Identifying areas where noise levels have increased or decreased over time" }),
    new Paragraph({ text: "• Evaluating the impact of process changes, equipment modifications, or control interventions" }),
    new Paragraph({ text: "• Establishing baseline data for future comparative assessments" }),
    new Paragraph({ text: "• Supporting continuous improvement initiatives" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),
    new Paragraph({
      text: "Where historical data is limited or unavailable, this survey establishes a comprehensive baseline for future monitoring and trend analysis.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "5.6 Statutory Requirements and Regulatory Framework", bold: true, size: 24 })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({
      text: "This survey was conducted in full accordance with South African legislation and national standards:",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Primary Legislation:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Occupational Health and Safety Act, 1993 (Act 85 of 1993)" }),
    new Paragraph({ text: "• Mine Health and Safety Act, 1996 (Act 29 of 1996) - where applicable" }),
    new Paragraph({ text: "• Noise-Induced Hearing Loss (NIHL) Regulations, 2003 (GN R.154)" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Technical Standards:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• SANS 10083:2013 - The measurement and assessment of occupational noise for hearing conservation purposes" }),
    new Paragraph({ text: "• SANS 10263:2020 - Selection, care and use of PPE for hearing protection" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Key Regulatory Requirements:", bold: true })],
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Exposure Limits:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Exposure Limit Value (ELV): 85 dB(A) as an 8-hour time-weighted average (LReq,8h)" }),
    new Paragraph({ text: "• Peak Sound Pressure Level: 140 dB(C) instantaneous maximum" }),
    new Paragraph({ text: "• No employee shall be exposed above these limits under any circumstances" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Action Levels:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Lower Action Level: 81 dB(A) LReq,8h" }),
    new Paragraph({ text: "• Triggers requirements for hearing conservation measures including:" }),
    new Paragraph({ text: "  - Risk assessment and noise monitoring" }),
    new Paragraph({ text: "  - Provision of suitable hearing protection" }),
    new Paragraph({ text: "  - Employee information and training" }),
    new Paragraph({ text: "  - Medical surveillance (audiometric testing)" }),
    new Paragraph({ text: "  - Implementation of control measures (engineering and administrative)" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Employer Obligations:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Conduct noise risk assessments and baseline measurements" }),
    new Paragraph({ text: "• Implement a written hearing conservation programme" }),
    new Paragraph({ text: "• Provide and maintain effective engineering controls where reasonably practicable" }),
    new Paragraph({ text: "• Establish and demarcate noise zones (>85 dB(A))" }),
    new Paragraph({ text: "• Provide suitable hearing protection at no cost to employees" }),
    new Paragraph({ text: "• Conduct regular medical surveillance for exposed employees" }),
    new Paragraph({ text: "• Maintain records of measurements, control measures, and medical surveillance" }),
    new Paragraph({ text: "• Train employees on noise hazards and protective measures" }),
    new Paragraph({ text: "", spacing: { after: 100 } }),

    new Paragraph({
      children: [new TextRun({ text: "Employee Responsibilities:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Use hearing protective devices correctly in designated noise zones" }),
    new Paragraph({ text: "• Cooperate with medical surveillance requirements" }),
    new Paragraph({ text: "• Report hearing protection defects or concerns" }),
    new Paragraph({ text: "• Participate in training and awareness programmes" }),
    new Paragraph({ text: "", spacing: { after: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 6.0 - SURVEY METHODOLOGY
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "6.0 SURVEY METHODOLOGY", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "6.1 Instrumentation", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "The following calibrated instrumentation was used for this survey:" }),
    new Paragraph({ text: "", spacing: { after: 100 } })
  );

  // Equipment Table
  if (data.equipment.length > 0) {
    const equipHeaderRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Equipment Name", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Type", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Serial No.", bold: true })] })] }),
        new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Calibration Date", bold: true })] })] }),
      ],
    });

    const equipRows = data.equipment.map(eq =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(eq.name)] }),
          new TableCell({ children: [new Paragraph(eq.type)] }),
          new TableCell({ children: [new Paragraph(eq.serial)] }),
          new TableCell({ children: [new Paragraph(eq.calibrationDate || eq.startDate || "N/A")] }),
        ],
      })
    );

    children.push(
      new Table({
        rows: [equipHeaderRow, ...equipRows],
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
      })
    );
  } else {
    children.push(new Paragraph("No equipment recorded."));
  }

  children.push(
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      text: "All instrumentation used complies with IEC 61672-1 Class 1 or Class 2 specifications for sound level meters. Equipment calibration is traceable to national or international standards through SANAS-accredited calibration laboratories.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "6.2 Measurement Methodology", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "Noise measurements were conducted in strict accordance with SANS 10083:2013 using the following comprehensive methodology:",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Pre-Measurement Preparation:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Pre-survey site walkthrough to identify noise sources, work areas, and access requirements" }),
    new Paragraph({ text: "• Review of site layout plans, process descriptions, and shift schedules" }),
    new Paragraph({ text: "• Consultation with site management and employees regarding typical operations" }),
    new Paragraph({ text: "• Field calibration of all instruments using traceable acoustic calibrators (94 dB or 114 dB @ 1 kHz)" }),
    new Paragraph({ text: "• Verification of battery status, memory capacity, and instrument functionality" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Noise Zoning Measurements:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Multiple measurement positions selected within each operational area to capture spatial variability" }),
    new Paragraph({ text: "• Measurement positions located at typical employee work locations and movement paths" }),
    new Paragraph({ text: "• Sound level meters positioned at ear height (1.4m - 1.6m above floor/ground level)" }),
    new Paragraph({ text: "• Microphones positioned minimum 0.5m from walls, large surfaces, and the surveyor's body" }),
    new Paragraph({ text: "• Microphones oriented according to manufacturer specifications (typically vertical for random incidence)" }),
    new Paragraph({ text: "• A-weighting network applied to approximate human ear frequency response" }),
    new Paragraph({ text: "• Fast (125 ms) or Slow (1 s) time weighting selected based on noise character" }),
    new Paragraph({ text: "• Measurement duration: Minimum 15 minutes per position, or longer for fluctuating noise" }),
    new Paragraph({ text: "• Leq (equivalent continuous sound level) recorded for each measurement period" }),
    new Paragraph({ text: "• Statistical parameters (L10, L50, L90, Lmax, Lmin) recorded where applicable" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Operational Conditions:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: `• Normal operating conditions prevailed during measurements: ${data.normalConditions || 'Yes'}` }),
    new Paragraph({ text: "• All relevant noise-generating equipment operational during measurements" }),
    new Paragraph({ text: "• Production rates and process parameters representative of typical operations" }),
    new Paragraph({ text: "• Weather conditions suitable for outdoor measurements (wind speed <5 m/s, no precipitation)" }),
    new Paragraph({ text: "• Background noise levels documented for comparison" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Post-Measurement Procedures:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Post-survey field calibration verification (drift <0.5 dB acceptable, <1.0 dB with notation)" }),
    new Paragraph({ text: "• Data download and backup from measurement instruments" }),
    new Paragraph({ text: "• Photographic documentation of measurement positions and noise sources" }),
    new Paragraph({ text: "• Field notes documenting operational conditions, deviations, and observations" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "6.3 Survey Strategy and Approach", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "The noise survey employed a systematic, phased approach to ensure comprehensive assessment of all operational areas:",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Phase 1: Initial Assessment", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Preliminary walkthrough survey to identify all operational areas and noise sources" }),
    new Paragraph({ text: "• Consultation with management, supervisors, and employees regarding work activities" }),
    new Paragraph({ text: "• Review of previous survey data, hearing conservation records, and incident reports" }),
    new Paragraph({ text: "• Development of measurement strategy and position selection rationale" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Phase 2: Measurement Execution", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Systematic measurement of noise levels at predetermined positions" }),
    new Paragraph({ text: "• Documentation of noise source characteristics (continuous, intermittent, impulsive, tonal)" }),
    new Paragraph({ text: "• Recording of operational parameters (equipment type, production rate, process stage)" }),
    new Paragraph({ text: "• Observation of employee work patterns and exposure durations" }),
    new Paragraph({ text: "• Photography of measurement locations and significant noise sources" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Phase 3: Control Measures Assessment", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Evaluation of existing engineering controls:" }),
    new Paragraph({ text: "  - Acoustic enclosures, barriers, and shields" }),
    new Paragraph({ text: "  - Vibration isolation and damping systems" }),
    new Paragraph({ text: "  - Silencers on pneumatic exhaust and ventilation systems" }),
    new Paragraph({ text: "  - Equipment maintenance status and condition" }),
    new Paragraph({ text: "• Review of administrative controls:" }),
    new Paragraph({ text: "  - Job rotation schedules and exposure time limits" }),
    new Paragraph({ text: "  - Work planning and noise zone demarcation" }),
    new Paragraph({ text: "  - Training programmes and employee awareness" }),
    new Paragraph({ text: "• Assessment of hearing protective devices (HPDs):" }),
    new Paragraph({ text: "  - HPD type, manufacturer, and model specifications" }),
    new Paragraph({ text: "  - Single Number Rating (SNR) and attenuation performance" }),
    new Paragraph({ text: "  - Employee training on correct fitting and use" }),
    new Paragraph({ text: "  - Maintenance, storage, and replacement procedures" }),
    new Paragraph({ text: "  - Visual inspection of HPD condition and hygiene" }),
    new Paragraph({ text: "  - Employee compliance and usage patterns" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Phase 4: Data Analysis and Reporting", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Calculation of 8-hour equivalent continuous rating levels (LReq,8h)" }),
    new Paragraph({ text: "• Application of noise character adjustments (tonal, impulsive penalties) per SANS 10083" }),
    new Paragraph({ text: "• Comparison against regulatory limits and action levels" }),
    new Paragraph({ text: "• Risk classification and noise zone designation" }),
    new Paragraph({ text: "• Development of area-specific findings and recommendations" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "6.4 Deviations, Uncertainties and Limitations", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "The following factors should be considered when interpreting the survey results:",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Temporal Limitations:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Measurements represent conditions during the survey period and may not capture all operational variability" }),
    new Paragraph({ text: "• Noise levels may differ during different shifts, production campaigns, or seasonal variations" }),
    new Paragraph({ text: "• Maintenance activities, equipment changes, or process modifications may alter noise profiles" }),
    new Paragraph({ text: "• Start-up, shutdown, and abnormal operating conditions may produce different noise levels" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Spatial Limitations:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Measurement positions selected to represent typical employee exposure locations" }),
    new Paragraph({ text: "• Noise levels may vary at other positions not specifically measured" }),
    new Paragraph({ text: "• Areas with restricted access or temporary shutdown were excluded from assessment" }),
    new Paragraph({ text: "• Mobile employee exposure patterns may differ from fixed position measurements" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Environmental Factors:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Weather conditions (wind, temperature, humidity) may affect outdoor measurements" }),
    new Paragraph({ text: "• Acoustic reflections from nearby surfaces influence measurement results" }),
    new Paragraph({ text: "• Background noise from external sources may contribute to measured levels" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Measurement Uncertainty:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Instrument accuracy: ±1.0 dB (Class 2) or ±0.7 dB (Class 1) per IEC 61672-1" }),
    new Paragraph({ text: "• Calibration uncertainty: ±0.3 dB (acoustic calibrator)" }),
    new Paragraph({ text: "• Field measurement variability: ±1.0 dB (positioning, environmental factors)" }),
    new Paragraph({ text: "• Combined expanded uncertainty: Approximately ±2 dB (95% confidence level)" }),
    new Paragraph({ text: "• This uncertainty is considered when comparing results against regulatory limits" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Operational Conditions:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: `• Normal operating conditions during survey: ${data.normalConditions || 'Confirmed'}` }),
    new Paragraph({ text: "• Any deviations from normal operations are documented in area-specific findings (Section 7.0)" }),
    new Paragraph({ text: "• Results assume typical employee work patterns and exposure durations as reported by management" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Recommendations:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Results should be used as indicative of typical noise exposure under documented conditions" }),
    new Paragraph({ text: "• Periodic re-assessment is recommended following process changes or equipment modifications" }),
    new Paragraph({ text: "• Annual or biennial surveys should be conducted to monitor trends and verify control effectiveness" }),
    new Paragraph({ text: "• Personal dosimetry may be required for employees with highly variable work patterns" }),
    new Paragraph({ text: "", spacing: { after: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 7.0 - RESULTS AND DISCUSSION (EXISTING IMPLEMENTATION)
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "7.0 RESULTS AND DISCUSSION", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({
      children: [new TextRun({ text: `TABLE 7.1.1 NOISE ZONING RESULTS: ${data.surveyType || "Noise Zoning"}`, bold: true })],
      spacing: { before: 200, after: 200 },
    })
  );

  // Build detailed noise zoning results table for each area
  const allAreas = collectAreas(data.areas || []);

  allAreas.forEach(({ area, numbering }) => {
    const areaKey = JSON.stringify(getAreaPathObject(numbering));
    const noiseSources = data.noiseSourcesByArea?.[areaKey] || [];
    const measurements = data.measurementsByArea?.[areaKey] || [];
    const controls = data.controlsByArea?.[areaKey];
    const devices = data.hearingProtectionDevices?.[areaKey] || [];
    const exposures = data.exposuresByArea?.[areaKey];
    const comments = data.commentsByArea?.[areaKey];

    // Calculate average noise level from measurements
    let avgNoiseLevel = "N/A";
    let measuredLevels = "";
    if (measurements.length > 0) {
      const allReadings = measurements.flatMap(m => m.readings?.map(r => parseFloat(r)) || []).filter(r => !isNaN(r));
      if (allReadings.length > 0) {
        const avg = allReadings.reduce((a, b) => a + b, 0) / allReadings.length;
        avgNoiseLevel = avg.toFixed(2);
      }

      // Build measurement positions and readings
      measurements.forEach(m => {
        if (m.readings && m.readings.length > 0) {
          m.readings.forEach((reading, idx) => {
            const position = String.fromCharCode(65 + idx); // A, B, C, D...
            measuredLevels += `${position}: ${reading} dB(A)\n`;
          });
        }
      });
    }

    // Determine risk classification
    const avgDb = parseFloat(avgNoiseLevel);
    let riskClass = "N/A";
    if (!isNaN(avgDb)) {
      if (avgDb < 80) riskClass = "Low Risk";
      else if (avgDb < 85) riskClass = "Medium Risk";
      else if (avgDb < 90) riskClass = "High Risk";
      else riskClass = "Very High Risk";
    }

    // Build noise sources description
    let noiseSourcesDesc = "";
    if (noiseSources.length > 0) {
      noiseSourcesDesc = noiseSources.map(ns =>
        `• ${ns.source} - ${ns.type || "N/A"} - ${ns.description || ""}`
      ).join("\n");
    }

    // Build controls description
    let engineeringControls = controls?.engineering || "No";
    let adminControls = controls?.adminControls?.join(", ") || "None";
    let customAdmin = controls?.customAdmin || "";

    // Build HPD description
    let hpdDesc = "";
    if (devices.length > 0) {
      devices.forEach(d => {
        hpdDesc += `• ${d.type}, ${d.manufacturer} with SNR of ${d.snrValue}.\n`;
        hpdDesc += `  Training: ${d.training}, Fitting: ${d.fitting}, Maintenance: ${d.maintenance}\n`;
        hpdDesc += `  Condition: ${d.condition || "N/A"}\n`;
      });
    } else {
      hpdDesc = "No HPD issued.";
    }

    // Build exposure info
    let exposureInfo = "";
    if (exposures) {
      exposureInfo = `Exposure: ${exposures.exposure || "N/A"}\n`;
      if (exposures.exposureDetail) exposureInfo += `Details: ${exposures.exposureDetail}\n`;
      exposureInfo += `Prohibited Activities: ${exposures.prohibited || "No"}\n`;
      if (exposures.prohibitedDetail) exposureInfo += `Details: ${exposures.prohibitedDetail}`;
    }

    // Create detailed area table
    const areaTableRows: TableRow[] = [];

    // Header row
    areaTableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "No", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Area / Location / Activity", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Measurement Position", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Measured Noise Rating Level in dB(A)", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "8-Hour Equivalent Noise Rating Level (LReq,8h)", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Raw Risk Classification of NIHL", bold: true })] })] }),
          new TableCell({ children: [new Paragraph({ children: [new TextRun({ text: "Discussion", bold: true })] })] }),
        ],
      })
    );

    // Build discussion content
    let discussionText = `Employees work ${area.shiftDuration || 8} hours shifts and spend up to ${area.exposureTime || area.shiftDuration || 8} hours in the respective areas.\n\n`;

    if (noiseSourcesDesc) {
      discussionText += `Primary noise sources:\n${noiseSourcesDesc}\n\n`;
    }

    discussionText += `Evaluation Results:\n• Normal operating conditions prevailed on the day of the survey: ${data.normalConditions || "Yes"}\n\n`;

    discussionText += `Engineering Controls:\n• ${engineeringControls}\n\n`;

    discussionText += `Administrative Controls:\n${adminControls}\n${customAdmin ? `• ${customAdmin}\n` : ""}\n`;

    discussionText += `Hearing Protection Devices:\n${hpdDesc}\n\n`;

    if (exposureInfo) {
      discussionText += `${exposureInfo}\n\n`;
    }

    if (comments) {
      discussionText += `Additional Comments:\n${comments}`;
    }

    // Data row
    areaTableRows.push(
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(numbering)] }),
          new TableCell({ children: [new Paragraph(area.name)] }),
          new TableCell({ children: [new Paragraph(measuredLevels || "N/A")] }),
          new TableCell({ children: [new Paragraph(avgNoiseLevel)] }),
          new TableCell({ children: [new Paragraph(avgNoiseLevel)] }),
          new TableCell({ children: [new Paragraph(riskClass)] }),
          new TableCell({ children: [new Paragraph(discussionText)] }),
        ],
      })
    );

    children.push(
      new Table({
        rows: areaTableRows,
        width: { size: 100, type: WidthType.PERCENTAGE },
        borders: {
          top: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          bottom: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          left: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          right: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideHorizontal: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
          insideVertical: { style: BorderStyle.SINGLE, size: 1, color: "000000" },
        },
      })
    );

    children.push(new Paragraph({ text: "", spacing: { after: 200 } }));
  });

  children.push(new Paragraph({ text: "", spacing: { after: 400, before: 400 } }));

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 8.0 - RECOMMENDATIONS
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "8.0 RECOMMENDATIONS", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({
      text: "The following recommendations are provided to reduce occupational noise exposure, protect employee hearing health, and ensure compliance with regulatory requirements. Recommendations are prioritized according to the hierarchy of controls, with engineering controls as the preferred approach.",
      spacing: { after: 300 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "8.1 Engineering Control Measures (Priority 1)", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "Engineering controls aim to reduce noise at the source or along the transmission path. These are the most effective and sustainable methods of noise control and should be implemented wherever reasonably practicable.",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Noise Source Reduction:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Replace high-noise equipment with quieter alternatives during equipment replacement cycles" }),
    new Paragraph({ text: "• Specify low-noise procurement criteria for all new equipment purchases (request noise emission data from suppliers)" }),
    new Paragraph({ text: "• Modify equipment operation parameters (e.g., reduce impact velocity, lower fan speeds where feasible)" }),
    new Paragraph({ text: "• Balance rotating equipment to reduce vibration-induced noise" }),
    new Paragraph({ text: "• Replace metal components with polymer or composite materials where appropriate" }),
    new Paragraph({ text: "• Install vibration isolation mounts on equipment foundations" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Acoustic Enclosures and Barriers:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Install full or partial acoustic enclosures around high-noise equipment (pumps, compressors, generators)" }),
    new Paragraph({ text: "• Ensure enclosures incorporate sound-absorbing internal linings to prevent reverberation" }),
    new Paragraph({ text: "• Design enclosures with adequate ventilation to prevent overheating while maintaining acoustic integrity" }),
    new Paragraph({ text: "• Seal all gaps, penetrations, and access panels to prevent sound leakage" }),
    new Paragraph({ text: "• Erect acoustic barriers between noise sources and employee work positions" }),
    new Paragraph({ text: "• Consider barrier height, length, and surface mass to achieve desired noise reduction" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Vibration Control and Damping:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Apply vibration-damping treatments to resonant panels and surfaces" }),
    new Paragraph({ text: "• Install flexible connectors (expansion joints) on piping systems to prevent vibration transmission" }),
    new Paragraph({ text: "• Use resilient mounting pads beneath equipment to isolate structure-borne noise" }),
    new Paragraph({ text: "• Apply constrained-layer damping materials to large vibrating surfaces" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Exhaust and Pneumatic Systems:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Install silencers (mufflers) on all compressed air exhaust outlets" }),
    new Paragraph({ text: "• Replace high-velocity air nozzles with low-noise engineered nozzles" }),
    new Paragraph({ text: "• Reduce compressed air pressure to minimum required for effective operation" }),
    new Paragraph({ text: "• Install in-line silencers on ventilation ducting and intake/exhaust systems" }),
    new Paragraph({ text: "• Design exhaust discharge points away from employee work areas" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Acoustic Treatment of Work Areas:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Install sound-absorbing materials (ceiling tiles, wall panels) to reduce reverberation in enclosed spaces" }),
    new Paragraph({ text: "• Increase acoustic absorption area to reduce reflected sound energy" }),
    new Paragraph({ text: "• Use acoustic ceiling clouds or baffles in high-ceiling areas" }),
    new Paragraph({ text: "• Replace hard reflective surfaces with acoustically absorbent alternatives where practical" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Maintenance and Operational Practices:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Implement preventive maintenance schedules to identify and repair worn, misaligned, or damaged components" }),
    new Paragraph({ text: "• Lubricate bearings and moving parts regularly to prevent noise from friction and wear" }),
    new Paragraph({ text: "• Tighten loose components, fasteners, and guards to prevent rattling and vibration" }),
    new Paragraph({ text: "• Replace worn belts, gears, and couplings before failure" }),
    new Paragraph({ text: "• Include noise emission checks in routine equipment inspections" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "8.2 Administrative Control Measures (Priority 2)", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "Administrative controls reduce employee exposure duration and risk through organizational measures, work procedures, and employee management.",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Exposure Time Management:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Implement job rotation schedules to limit individual exposure time in high-noise areas" }),
    new Paragraph({ text: "• Calculate and document maximum permissible exposure times for areas exceeding 85 dB(A)" }),
    new Paragraph({ text: "• Schedule high-noise tasks during periods of minimal staffing where feasible" }),
    new Paragraph({ text: "• Provide designated quiet areas for breaks and administrative tasks away from noise sources" }),
    new Paragraph({ text: "• Consider shift scheduling to minimize the number of employees exposed simultaneously" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Noise Zone Management:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Demarcate and signpost all areas where noise levels exceed 85 dB(A) as designated noise zones" }),
    new Paragraph({ text: "• Display mandatory hearing protection signs at all entrances to noise zones" }),
    new Paragraph({ text: "• Restrict non-essential access to high-noise areas" }),
    new Paragraph({ text: "• Maintain physical barriers (gates, rope barriers) where appropriate" }),
    new Paragraph({ text: "• Update noise zone maps following process changes or new measurements" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Hearing Conservation Programme:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Develop and implement a comprehensive written Hearing Conservation Programme (HCP)" }),
    new Paragraph({ text: "• Assign responsibility for HCP implementation and oversight to a competent person" }),
    new Paragraph({ text: "• Establish procedures for noise monitoring, control evaluation, and programme review" }),
    new Paragraph({ text: "• Conduct annual HCP effectiveness reviews and update as necessary" }),
    new Paragraph({ text: "• Maintain records of noise measurements, control measures, training, and medical surveillance" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Training and Awareness:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Provide comprehensive noise awareness training for all employees exposed to noise ≥81 dB(A)" }),
    new Paragraph({ text: "• Training content should include:" }),
    new Paragraph({ text: "  - Health effects of noise exposure and mechanism of hearing loss" }),
    new Paragraph({ text: "  - Regulatory requirements and employee rights/responsibilities" }),
    new Paragraph({ text: "  - Identification of noise hazards and noise zone locations" }),
    new Paragraph({ text: "  - Correct selection, fitting, use, and maintenance of hearing protection" }),
    new Paragraph({ text: "  - Purpose and procedures for audiometric testing" }),
    new Paragraph({ text: "  - Engineering and administrative controls in place" }),
    new Paragraph({ text: "• Conduct training at induction and annually thereafter" }),
    new Paragraph({ text: "• Maintain training attendance registers and individual training records" }),
    new Paragraph({ text: "• Use visual aids, demonstrations, and practical exercises to enhance learning" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Procurement and Design:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Include noise emission specifications in equipment procurement criteria" }),
    new Paragraph({ text: "• Request manufacturer's noise data for all new equipment" }),
    new Paragraph({ text: "• Consider noise impact during facility design, layout modifications, and process changes" }),
    new Paragraph({ text: "• Conduct noise impact assessments before installing new equipment or processes" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "8.3 Hearing Protective Devices (Priority 3)", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "While hearing protection is the least preferred control in the hierarchy, it remains essential where engineering and administrative controls cannot reduce exposure below 85 dB(A). HPDs must be provided, maintained, and used correctly to ensure effectiveness.",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "HPD Selection and Provision:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Provide suitable hearing protection devices at no cost to all employees exposed to noise ≥85 dB(A)" }),
    new Paragraph({ text: "• Offer HPDs to employees exposed to 81-84 dB(A) (above action level)" }),
    new Paragraph({ text: "• Select HPDs with adequate Single Number Rating (SNR) to reduce noise exposure below 85 dB(A)" }),
    new Paragraph({ text: "• Avoid over-protection (effective exposure should not be reduced below 70 dB(A))" }),
    new Paragraph({ text: "• Provide multiple HPD options to accommodate individual preferences and fit requirements:" }),
    new Paragraph({ text: "  - Disposable foam earplugs (SNR typically 28-37 dB)" }),
    new Paragraph({ text: "  - Reusable pre-molded earplugs (SNR typically 20-30 dB)" }),
    new Paragraph({ text: "  - Banded/semi-insert earplugs (SNR typically 20-25 dB)" }),
    new Paragraph({ text: "  - Earmuffs (SNR typically 25-35 dB)" }),
    new Paragraph({ text: "  - Custom-molded earplugs for long-term users" }),
    new Paragraph({ text: "• Consider communication requirements when selecting HPDs" }),
    new Paragraph({ text: "• Evaluate compatibility with other PPE (safety glasses, helmets, respiratory protection)" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Fitting and Training:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Conduct individual fit testing for all employees issued with HPDs" }),
    new Paragraph({ text: "• Demonstrate correct insertion technique for earplugs (roll-down method for foam plugs)" }),
    new Paragraph({ text: "• Verify seal and fit by visual inspection and user feedback" }),
    new Paragraph({ text: "• Provide fit-check demonstrations to confirm adequate attenuation" }),
    new Paragraph({ text: "• Re-train employees showing incorrect HPD use or non-compliance" }),
    new Paragraph({ text: "• Include HPD fitting as part of induction training for new employees" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Maintenance and Replacement:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Establish HPD replacement schedules:" }),
    new Paragraph({ text: "  - Disposable foam earplugs: Replace daily or when soiled" }),
    new Paragraph({ text: "  - Reusable earplugs: Replace monthly or when damaged" }),
    new Paragraph({ text: "  - Earmuffs: Replace cushions every 6-12 months, headbands annually" }),
    new Paragraph({ text: "• Inspect HPDs regularly for damage, wear, hardening, or contamination" }),
    new Paragraph({ text: "• Provide adequate storage facilities (clean, dry containers) when HPDs are not in use" }),
    new Paragraph({ text: "• Ensure ready availability of replacement HPDs at all times" }),
    new Paragraph({ text: "• Implement hygiene protocols for reusable HPDs (cleaning procedures)" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Monitoring and Compliance:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Conduct regular compliance audits and inspections in noise zones" }),
    new Paragraph({ text: "• Empower supervisors and safety representatives to enforce HPD use requirements" }),
    new Paragraph({ text: "• Include HPD compliance in employee performance evaluations" }),
    new Paragraph({ text: "• Maintain records of HPD issuance, training, and replacement" }),
    new Paragraph({ text: "• Investigate and address reasons for non-compliance (comfort, fit, communication difficulties)" }),
    new Paragraph({ text: "• Apply progressive disciplinary procedures for repeated non-compliance" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Dual Protection (High Noise Environments):", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Require dual protection (earplugs AND earmuffs) where noise levels exceed 105 dB(A)" }),
    new Paragraph({ text: "• Dual protection provides approximately 5-10 dB additional attenuation beyond single HPD use" }),
    new Paragraph({ text: "• Monitor employee acceptance and compliance with dual protection requirements" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "8.4 Medical Surveillance (Ongoing Requirement)", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({
      text: "Medical surveillance through audiometric testing is mandatory for all employees exposed to noise levels ≥81 dB(A). The hearing conservation programme must include comprehensive audiometric testing, record-keeping, and follow-up procedures.",
      spacing: { after: 100 }
    }),

    new Paragraph({
      children: [new TextRun({ text: "Audiometric Testing Requirements:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Baseline audiometric testing:" }),
    new Paragraph({ text: "  - Conduct within 30 days of employment or assignment to noise-exposed position" }),
    new Paragraph({ text: "  - Ensure minimum 14-hour noise-free period prior to baseline test (or use HPDs)" }),
    new Paragraph({ text: "  - Test frequencies: 500, 1000, 2000, 3000, 4000, 6000, 8000 Hz minimum" }),
    new Paragraph({ text: "  - Conduct tests in sound-attenuated booth meeting SANS 10154 requirements" }),
    new Paragraph({ text: "  - Record ambient noise levels in test environment" }),
    new Paragraph({ text: "• Annual audiometric testing:" }),
    new Paragraph({ text: "  - Conduct within 12 months of previous test" }),
    new Paragraph({ text: "  - Compare results against baseline and previous tests" }),
    new Paragraph({ text: "  - Identify Standard Threshold Shifts (STS): ≥10 dB average shift at 2, 3, 4 kHz" }),
    new Paragraph({ text: "• Use calibrated audiometers (calibrated annually per IEC 60645-1)" }),
    new Paragraph({ text: "• Employ trained audiometric technicians or occupational health nurses" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Record Keeping and Confidentiality:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Maintain individual audiometric records for duration of employment plus 40 years" }),
    new Paragraph({ text: "• Ensure confidentiality per POPIA requirements (access limited to medical personnel)" }),
    new Paragraph({ text: "• Provide employees with copies of their audiometric test results" }),
    new Paragraph({ text: "• Maintain separate files for medical and occupational data" }),
    new Paragraph({ text: "• Generate aggregate statistical reports for programme evaluation (de-identified data)" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),

    new Paragraph({
      children: [new TextRun({ text: "Follow-Up Procedures:", bold: true })],
      spacing: { after: 50 }
    }),
    new Paragraph({ text: "• Immediate actions for Standard Threshold Shift (STS):" }),
    new Paragraph({ text: "  - Notify employee of hearing change within 30 days" }),
    new Paragraph({ text: "  - Re-test within 90 days to confirm persistent shift" }),
    new Paragraph({ text: "  - Refer to occupational health physician or audiologist for evaluation" }),
    new Paragraph({ text: "  - Review and reinforce HPD training and fitting" }),
    new Paragraph({ text: "  - Evaluate work area noise exposure and control effectiveness" }),
    new Paragraph({ text: "  - Consider administrative controls to reduce exposure" }),
    new Paragraph({ text: "• Referral to specialist for:" }),
    new Paragraph({ text: "  - Confirmed significant threshold shifts" }),
    new Paragraph({ text: "  - Suspected medical ear conditions (infection, blockage)" }),
    new Paragraph({ text: "  - Employee requests or concerns" }),
    new Paragraph({ text: "• Annual programme review:" }),
    new Paragraph({ text: "  - Analyse population hearing threshold trends" }),
    new Paragraph({ text: "  - Identify high-risk areas or job functions" }),
    new Paragraph({ text: "  - Evaluate control measure effectiveness" }),
    new Paragraph({ text: "  - Review and update HCP based on surveillance findings" }),
    new Paragraph({ text: "", spacing: { after: 300 } }),

    new Paragraph({
      children: [new TextRun({ text: "8.5 Programme Review and Continuous Improvement", bold: true, size: 24 })],
      spacing: { before: 300, after: 100 }
    }),
    new Paragraph({ text: "• Conduct annual hearing conservation programme effectiveness reviews" }),
    new Paragraph({ text: "• Review noise measurement data, control effectiveness, and audiometric trends" }),
    new Paragraph({ text: "• Update risk assessments following process changes, equipment modifications, or new findings" }),
    new Paragraph({ text: "• Implement corrective actions for identified deficiencies" }),
    new Paragraph({ text: "• Consult with employees and safety representatives on programme improvements" }),
    new Paragraph({ text: "• Conduct periodic re-surveys (biennial or following significant changes)" }),
    new Paragraph({ text: "• Benchmark against industry best practices and regulatory requirements" }),
    new Paragraph({ text: "", spacing: { after: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 9.0 - CONCLUSION
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "9.0 CONCLUSION", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({ text: `The occupational hygiene noise survey conducted at ${data.site} for ${data.client} has identified noise exposure levels across various operational areas. The survey was performed in accordance with SANS 10083:2013 and the NIHL Regulations, 2003.` }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({ text: "Key conclusions from this survey include:" }),
    new Paragraph({ text: "• Noise exposure levels have been quantified for all surveyed work areas" }),
    new Paragraph({ text: "• Areas requiring noise control measures have been identified" }),
    new Paragraph({ text: "• Existing control measures have been evaluated for effectiveness" }),
    new Paragraph({ text: "• Recommendations have been provided to reduce noise exposure and protect employee hearing" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({ text: "The employer should implement the recommendations outlined in this report to maintain compliance with legal requirements and protect employees from noise-induced hearing loss. Regular follow-up surveys should be conducted to monitor the effectiveness of implemented controls and identify any changes in noise exposure levels." }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({ text: "A comprehensive hearing conservation programme, including engineering controls, administrative measures, hearing protection, training, and medical surveillance, should be maintained and continuously improved." }),
    new Paragraph({ text: "", spacing: { after: 400, before: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 10.0 - CERTIFICATES
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "10.0 CERTIFICATES", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({ text: "The following certificates and documentation support this report:" }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "Equipment Calibration Certificates:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Calibration certificates for all measurement equipment used in this survey are attached as appendices to this report." }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "SANAS Accreditation Certificate:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Gijima OHES is accredited by SANAS under certificate number OH-001 in terms of ISO/IEC 17020:2012." }),
    new Paragraph({ text: "", spacing: { after: 200 } }),
    new Paragraph({
      children: [new TextRun({ text: "Occupational Hygienist Registration:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "The survey was conducted under the supervision of a qualified and registered Occupational Hygienist." }),
    new Paragraph({ text: "", spacing: { after: 400, before: 400 } })
  );

  // Page break
  children.push(new Paragraph({ text: "---PAGE BREAK---", alignment: AlignmentType.CENTER, spacing: { before: 400, after: 400 } }));

  // ====================================================================
  // SECTION 11.0 - SIGNATURE PAGE
  // ====================================================================
  children.push(
    new Paragraph({
      children: [new TextRun({ text: "11.0 SIGNATURE PAGE", bold: true, size: 28 })],
      spacing: { before: 400, after: 300 }
    }),
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "Report prepared by:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Name: _________________________________" }),
    new Paragraph({ text: "Designation: Occupational Hygienist" }),
    new Paragraph({ text: "Signature: _________________________________" }),
    new Paragraph({ text: `Date: ${new Date().toLocaleDateString()}` }),
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "Report reviewed and approved by:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Name: _________________________________" }),
    new Paragraph({ text: "Designation: Senior Occupational Hygienist / AIA" }),
    new Paragraph({ text: "Signature: _________________________________" }),
    new Paragraph({ text: `Date: ${new Date().toLocaleDateString()}` }),
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "Client acknowledgement:", bold: true })],
      spacing: { before: 200, after: 100 }
    }),
    new Paragraph({ text: "Name: _________________________________" }),
    new Paragraph({ text: "Designation: _________________________________" }),
    new Paragraph({ text: `Company: ${data.client}` }),
    new Paragraph({ text: "Signature: _________________________________" }),
    new Paragraph({ text: "Date: _________________________________" }),
    new Paragraph({ text: "", spacing: { after: 400 } }),
    new Paragraph({
      children: [new TextRun({ text: "END OF REPORT", bold: true })],
      alignment: AlignmentType.CENTER,
      spacing: { before: 600, after: 200 }
    })
  );

  return children;
}

/**
 * Generic helper to remove any area-linked data safely
 */
export function removeAreaData<T extends Record<string, any>>(
  areaMap: T | undefined,
  path: { main: number; sub?: number; ss?: number }
): T {
  if (!areaMap) return {} as T;

  const filtered = Object.fromEntries(
    Object.entries(areaMap).filter(([key]) => {
      try {
        const k = JSON.parse(key);
        if (path.ss !== undefined) return !(k.main === path.main && k.sub === path.sub && k.ss === path.ss);
        if (path.sub !== undefined) return !(k.main === path.main && k.sub === path.sub);
        return k.main !== path.main;
      } catch {
        return true; // keep invalid keys
      }
    })
  );

  return filtered as T; // cast back to original type
}

/**
 * Remove all measurements/controls/hearing/exposures/comments linked to a specific area path
 */
export function removeAreaLinkedData(
  data: SurveyData,
  path: { main: number; sub?: number; ss?: number }
): SurveyData {
  return {
    ...data,
    measurementsByArea: removeAreaData(data.measurementsByArea, path),
    controlsByArea: removeAreaData(data.controlsByArea, path),
    hearingProtectionDevices: removeAreaData(data.hearingProtectionDevices, path),
    exposuresByArea: removeAreaData(data.exposuresByArea, path),
    commentsByArea: removeAreaData(data.commentsByArea, path),
  };
}


