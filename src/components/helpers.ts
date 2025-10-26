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
 * Build Word doc content
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

  children.push(
    new Paragraph({ text: "Survey Summary", heading: "Heading1" }),
    new Paragraph({ children: [new TextRun(`Client: ${data.client}`)] }),
    new Paragraph({ children: [new TextRun(`Project: ${data.project}`)] }),
    new Paragraph({ children: [new TextRun(`Site: ${data.site}`)] }),
    new Paragraph({ children: [new TextRun(`Survey Type: ${data.surveyType}`)] }),
    new Paragraph({ children: [new TextRun(`Start Date: ${data.startDate}`)] }),
    new Paragraph({ children: [new TextRun(`End Date: ${data.endDate}`)] }),
    new Paragraph({ children: [new TextRun(`Description: ${data.description}`)] }),
    new Paragraph({ text: "Equipment Used", heading: "Heading2" })
  );

  // Equipment Table
  if (data.equipment.length > 0) {
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("Name")] }),
        new TableCell({ children: [new Paragraph("Type")] }),
        new TableCell({ children: [new Paragraph("Serial")] }),
        new TableCell({ children: [new Paragraph("Calibration Date")] }),
      ],
    });

    const rows = data.equipment.map(eq =>
      new TableRow({
        children: [
          new TableCell({ children: [new Paragraph(eq.name)] }),
          new TableCell({ children: [new Paragraph(eq.type)] }),
          new TableCell({ children: [new Paragraph(eq.serial)] }),
          new TableCell({ children: [new Paragraph(eq.calibrationDate || "N/A")] }),
        ],
      })
    );

    children.push(
      new Table({
        rows: [headerRow, ...rows],
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
    children.push(new Paragraph("None"));
  }

  // Areas Table
  children.push(new Paragraph({ text: "Areas Surveyed", heading: "Heading2" }));

  if (data.areas.length > 0) {
    const headerRow = new TableRow({
      children: [
        new TableCell({ children: [new Paragraph("No.")] }),
        new TableCell({ children: [new Paragraph("Area Name")] }),
        new TableCell({ children: [new Paragraph("Noise Level (dB)")] }),
        new TableCell({ children: [new Paragraph("Noise Type")] }),
        new TableCell({ children: [new Paragraph("Shift (hrs)")] }),
        new TableCell({ children: [new Paragraph("Exposure (hrs)")] }),
        new TableCell({ children: [new Paragraph("Notes")] }),
      ],
    });

    let rows: TableRow[] = [headerRow];
    data.areas.forEach((area, i) => {
      rows = rows.concat(renderAreaTable(area, `${i + 1}`));
    });

    children.push(
      new Table({
        rows,
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
    children.push(new Paragraph("None"));
  }

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


