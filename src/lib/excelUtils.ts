import ExcelJS from "exceljs";
import * as XLSX from "xlsx";

interface TaskOption {
  taskID: number | string;
  taskName: string;
  standardTimeMins?: number;
  isDynamic?: boolean;
  isForTarget?: boolean;
}

interface TargetOption {
  targetID: number | string;
  targetName: string;
  unit?: number;
  frequency?: string;
}

interface DepartmentConfig {
  deptId: number;
  isIT: boolean;           // Dept 42 - sub-tasks, no Task Count/Std Time
  skipTargetStep: boolean; // Dept 19, 20, 35
  unitEditable: boolean;   // Dept 19, 20, 35
  unitLabel: string;       // "Unit" | "live account count" (Dept 23)
  achievedLabel: string;   // "Achieved Unit" | "Tag Request Worked With" (Dept 19) | "revenue achieved" (Dept 43,44,49,25,26)
  remarksRequired: boolean;// Dept 19, 20, 25, 26
  targetAchievedDept: boolean; // Dept 14, 31, 32 - unit=100, freq=Daily
}

interface ParsedActivity {
  type: "task" | "target";
  taskID?: string;
  taskName?: string;
  setup?: number;
  customTime?: number;
  timeTaken?: number;
  remark?: string;
  targetID?: string;
  targetName?: string;
  unit?: number;
  frequency?: string;
  achievedUnit?: number;
  workDate?: string;
  errors?: string[];
}

export function getDepartmentConfig(deptId: number): DepartmentConfig {
  const isIT = deptId === 42;
  const skipTargetStep = [19, 20, 35].includes(deptId);
  const unitEditable = [19, 20, 35].includes(deptId);
  const targetAchievedDept = [14, 31, 32].includes(deptId);
  const remarksRequired = [19, 20, 25, 26].includes(deptId);

  let unitLabel = "Unit";
  if (deptId === 23) unitLabel = "Live Account Count";

  let achievedLabel = "Achieved Unit";
  if (deptId === 19) achievedLabel = "Tag Request Worked With";
  if ([43, 44, 49, 25, 26].includes(deptId)) achievedLabel = "Revenue Achieved";

  return {
    deptId,
    isIT,
    skipTargetStep,
    unitEditable,
    unitLabel,
    achievedLabel,
    remarksRequired,
    targetAchievedDept,
  };
}

const HEADER_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FF4472C4" },
};

const ID_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFE2EFDA" },
};

const DATE_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFFFF2CC" },
};

const DISABLED_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

const LIST_FILL: ExcelJS.Fill = {
  type: "pattern",
  pattern: "solid",
  fgColor: { argb: "FFF2F2F2" },
};

const HEADER_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FFFFFFFF" },
  size: 11,
};

const ID_FONT: Partial<ExcelJS.Font> = {
  bold: true,
  color: { argb: "FF006100" },
  size: 10,
};

const DISABLED_FONT: Partial<ExcelJS.Font> = {
  color: { argb: "FF999999" },
  italic: true,
};

function parseDateStringToDate(dateStr: string): Date | null {
  if (!dateStr) return null;
  if (dateStr.includes("-")) {
    const p = dateStr.split("-");
    if (p[0].length === 4) {
      return new Date(Number(p[0]), Number(p[1]) - 1, Number(p[2]));
    } else {
      return new Date(Number(p[2]), Number(p[1]) - 1, Number(p[0]));
    }
  }
  return null;
}

// Default number of entry rows — enough for ~13 months of daily data
export const DEFAULT_ROW_COUNT = 400;

// ---- TASK SHEET ----
async function buildTaskSheet(
  workbook: ExcelJS.Workbook,
  tasks: TaskOption[],
  config: DepartmentConfig,
  workDate: string,
  rowCount: number = DEFAULT_ROW_COUNT
) {
  const worksheet = workbook.addWorksheet("Task Entry");

  const firstDataRow = 2;
  const lastDataRow = rowCount + 1;
  const noteRowNum = lastDataRow + 2;

  if (config.isIT) {
    // Dept 42 columns: Work Date | Task ID | Task Type | Task Description | Time Taken
    worksheet.columns = [
      { width: 14 },  // A: Work Date
      { width: 12 },  // B: Task ID (auto)
      { width: 30 },  // C: Task Type (dropdown)
      { width: 40 },  // D: Task Description
      { width: 18 },  // E: Time Taken
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { width: 25 }, // T: helper names (col 20)
      { width: 10 }, // U: helper IDs (col 21)
      { width: 12 }, // V: helper frequency (col 22)
      { width: 10 }, // W: helper unit (col 23)

    ];

    const headers = ["Work Date", "Task ID", "Task Type", "Task Description", "Time Taken (mins)"];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 22;

    const dateExcel = parseDateStringToDate(workDate);

    for (let i = 0; i < rowCount; i++) {
      const rowNum = i + firstDataRow;
      const row = worksheet.addRow([dateExcel, "", "", "", ""]);
      row.getCell(1).numFmt = "DD-MM-YYYY";
      row.getCell(1).fill = DATE_FILL;
      // Task ID auto-fill
      const idCell = row.getCell(2);
      idCell.value = { formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},$T$2:$U$21,2,FALSE))` } as any;
      idCell.fill = ID_FILL;
      idCell.font = ID_FONT;
    }

    // Helper columns: T = Names, U = IDs, V = StdTime
    tasks.forEach((t, i) => {
      const rowNum = i + firstDataRow;
      worksheet.getCell(`T${rowNum}`).value = t.taskName;
      worksheet.getCell(`T${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`T${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
      worksheet.getCell(`U${rowNum}`).value = t.taskID;
      worksheet.getCell(`U${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`U${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
      worksheet.getCell(`V${rowNum}`).value = t.standardTimeMins || 0;
      worksheet.getCell(`V${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`V${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
    });

    const lastRow = tasks.length > 0 ? tasks.length + 1 : 1;
    const nameRange = `$T$2:$T$${lastRow}`;
    const vlookupRange = `$T$2:$V$${lastRow}`;

    // Update Task ID VLOOKUP to use 3-column range
    for (let i = 0; i < rowCount; i++) {
      const rowNum = i + firstDataRow;
      const idCell = worksheet.getCell(`B${rowNum}`);
      idCell.value = { formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},${vlookupRange},2,FALSE))` } as any;
      idCell.fill = ID_FILL;
      idCell.font = ID_FONT;
    }

    // Dropdown on C
    if (tasks.length > 0) {
      for (let row = firstDataRow; row <= lastDataRow; row++) {
        worksheet.getCell(`C${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [nameRange],
          showErrorMessage: true,
          errorTitle: "Invalid Task",
          error: "Select a task from the dropdown.",
        };
      }
    }

    // Std Time VLOOKUP — not applicable for IT (no Std Time column)

    // Time Taken validation (E)
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      worksheet.getCell(`E${row}`).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid Time",
        error: "Time Taken must be a positive number.",
      };
    }

  } else {
    // Normal columns: Work Date | Task ID | Task Type | Task Count | Std Time | Description | Time Taken
    worksheet.columns = [
      { width: 14 },  // A: Work Date
      { width: 12 },  // B: Task ID (auto)
      { width: 30 },  // C: Task Type (dropdown)
      { width: 12 },  // D: Task Count
      { width: 18 },  // E: Std Time (auto)
      { width: 40 },  // F: Description
      { width: 18 },  // G: Time Taken
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { hidden: true }, { hidden: true }, { hidden: true },
      { width: 25 }, // T: helper names (col 20)
      { width: 10 }, // U: helper IDs (col 21)
      { width: 10 }, // V: helper StdTime (col 22)
    ];

    const headers = ["Work Date", "Task ID", "Task Type", "Task Count", "Std Time (mins)", "Task Description", "Time Taken (mins)"];
    const headerRow = worksheet.addRow(headers);
    headerRow.eachCell((cell) => {
      cell.fill = HEADER_FILL;
      cell.font = HEADER_FONT;
      cell.alignment = { vertical: "middle", horizontal: "center" };
    });
    headerRow.height = 22;

    const dateExcel = parseDateStringToDate(workDate);

    for (let i = 0; i < rowCount; i++) {
      const rowNum = i + firstDataRow;
      const row = worksheet.addRow([dateExcel, "", "", 1, "", "", ""]);
      row.getCell(1).numFmt = "DD-MM-YYYY";
      row.getCell(1).fill = DATE_FILL;
      const idCell = row.getCell(2);
      idCell.value = { formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},$T$2:$V$21,2,FALSE))` } as any;
      idCell.fill = ID_FILL;
      idCell.font = ID_FONT;
    }

    // Helper columns: T = Names, U = IDs, V = StdTime
    tasks.forEach((t, i) => {
      const rowNum = i + firstDataRow;
      worksheet.getCell(`T${rowNum}`).value = t.taskName;
      worksheet.getCell(`T${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`T${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
      worksheet.getCell(`U${rowNum}`).value = t.taskID;
      worksheet.getCell(`U${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`U${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
      worksheet.getCell(`V${rowNum}`).value = t.standardTimeMins || 0;
      worksheet.getCell(`V${rowNum}`).fill = LIST_FILL;
      worksheet.getCell(`V${rowNum}`).font = { color: { argb: "FF999999" }, size: 8 };
    });

    const lastRow = tasks.length > 0 ? tasks.length + 1 : 1;
    const nameRange = `$T$2:$T$${lastRow}`;
    const vlookupRange = `$T$2:$V$${lastRow}`;

    // Task ID VLOOKUP with correct helper range
    for (let i = 0; i < rowCount; i++) {
      const rowNum = i + firstDataRow;
      const idCell = worksheet.getCell(`B${rowNum}`);
      idCell.value = { formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},${vlookupRange},2,FALSE))` } as any;
      idCell.fill = ID_FILL;
      idCell.font = ID_FONT;
    }

    // Dropdown on C
    if (tasks.length > 0) {
      for (let row = firstDataRow; row <= lastDataRow; row++) {
        worksheet.getCell(`C${row}`).dataValidation = {
          type: "list",
          allowBlank: true,
          formulae: [nameRange],
          showErrorMessage: true,
          errorTitle: "Invalid Task",
          error: "Select a task from the dropdown.",
        };
      }
    }

    // Std Time VLOOKUP (E) — auto-fill from helper column V
    if (tasks.length > 0) {
      for (let row = firstDataRow; row <= lastDataRow; row++) {
        const stdCell = worksheet.getCell(`E${row}`);
        stdCell.value = { formula: `IF(C${row}="","",VLOOKUP(C${row},${vlookupRange},3,FALSE))` } as any;
        stdCell.fill = DISABLED_FILL;
        stdCell.font = DISABLED_FONT;
      }
    }

    // Task Count validation (D)
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      worksheet.getCell(`D${row}`).dataValidation = {
        type: "whole",
        operator: "between",
        allowBlank: true,
        formulae: [1, 150],
        showErrorMessage: true,
        errorTitle: "Invalid Count",
        error: "Task Count must be between 1 and 150.",
      };
    }

    // Time Taken validation (G)
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      worksheet.getCell(`G${row}`).dataValidation = {
        type: "decimal",
        operator: "greaterThanOrEqual",
        allowBlank: true,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Invalid Time",
        error: "Time Taken must be a positive number.",
      };
    }
  }

  // Unlock the editable cells, then protect the sheet so everything else is read-only
  for (let row = firstDataRow; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).protection = { locked: false }; // Work Date
    worksheet.getCell(`C${row}`).protection = { locked: false }; // Task Type
    if (config.isIT) {
      worksheet.getCell(`D${row}`).protection = { locked: false }; // Description
      worksheet.getCell(`E${row}`).protection = { locked: false }; // Time Taken
    } else {
      worksheet.getCell(`D${row}`).protection = { locked: false }; // Task Count
      worksheet.getCell(`F${row}`).protection = { locked: false }; // Description
      worksheet.getCell(`G${row}`).protection = { locked: false }; // Time Taken
    }
  }
  await worksheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  // Note row
  worksheet.getCell(`A${noteRowNum}`).value =
    config.isIT
      ? "Note: Select Task Type — Task ID auto-fills. Set the Work Date on each row to log data for any day/month; blank rows are ignored on upload."
      : "Note: Select Task Type — Task ID and Std Time auto-fill. Task Count defaults to 1. Set the Work Date on each row to log data for any day/month; blank rows are ignored on upload.";
  worksheet.getCell(`A${noteRowNum}`).font = {
    italic: true,
    color: { argb: "FF666666" },
    size: 10,
  };
}

// ---- TARGET SHEET ----
async function buildTargetSheet(
  workbook: ExcelJS.Workbook,
  targets: TargetOption[],
  config: DepartmentConfig,
  workDate: string,
  rowCount: number = DEFAULT_ROW_COUNT
) {
  const worksheet = workbook.addWorksheet("Target Entry");

  const firstDataRow = 2;
  const lastDataRow = rowCount + 1;
  const noteRowNum = lastDataRow + 2;

  // Columns: A=Work Date | B=Target ID | C=Target Name | D=Unit | E=Frequency | F=Achieved | G=Remarks
  // Hidden: H-S, T=Names, U=IDs
  worksheet.columns = [
    { width: 14 },  // A: Work Date
    { width: 12 },  // B: Target ID (auto)
    { width: 35 },  // C: Target Name (dropdown)
    { width: 18 },  // D: Unit (label varies by dept)
    { width: 15 },  // E: Frequency (auto-filled, read-only)
    { width: 18 },  // F: Achieved Unit (label varies by dept)
    { width: 40 },  // G: Remarks
    { hidden: true }, { hidden: true }, { hidden: true },
    { hidden: true }, { hidden: true }, { hidden: true },
    { hidden: true }, { hidden: true }, { hidden: true },
    { hidden: true }, { hidden: true }, { hidden: true },
    { width: 25 }, // T: helper names (col 20)
    { width: 10 }, // U: helper IDs (col 21)
  ];

  // Dynamic header labels
  const unitHeader = config.unitLabel;
  const achievedHeader = config.achievedLabel;
  const headers = ["Work Date", "Target ID", "Target Name", unitHeader, "Frequency", achievedHeader, "Remarks"];
  const headerRow = worksheet.addRow(headers);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
    cell.alignment = { vertical: "middle", horizontal: "center" };
  });
  headerRow.height = 22;

  const dateExcel = parseDateStringToDate(workDate);

  for (let i = 0; i < rowCount; i++) {
    const rowNum = i + firstDataRow;
    const row = worksheet.addRow([dateExcel, "", "", "", "", "", ""]);

    // Work Date
    row.getCell(1).numFmt = "DD-MM-YYYY";
    row.getCell(1).fill = DATE_FILL;

    // Target ID auto-fill via VLOOKUP
    const idCell = row.getCell(2);
    idCell.value = { formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},$T$2:$U$21,2,FALSE))` } as any;
    idCell.fill = ID_FILL;
    idCell.font = ID_FONT;

    // Frequency auto-fill (read-only, greyed)
    const freqCell = row.getCell(5);
    freqCell.fill = DISABLED_FILL;
    freqCell.font = DISABLED_FONT;

    // Unit - editable only for dept 19, 20, 35
    const unitCell = row.getCell(4);
    if (!config.unitEditable) {
      unitCell.fill = DISABLED_FILL;
      unitCell.font = DISABLED_FONT;
    }
  }
  // Helper columns: T = Names, U = IDs, V = Frequency, W = Unit
  targets.forEach((t, i) => {
    const rowNum = i + firstDataRow;
    worksheet.getCell(`T${rowNum}`).value = t.targetName;
    worksheet.getCell(`U${rowNum}`).value = t.targetID;
    worksheet.getCell(`V${rowNum}`).value = t.frequency || "";
    worksheet.getCell(`W${rowNum}`).value = t.unit ?? "";
    ["T", "U", "V", "W"].forEach((col) => {
      const cell = worksheet.getCell(`${col}${rowNum}`);
      cell.fill = LIST_FILL;
      cell.font = { color: { argb: "FF999999" }, size: 8 };
    });
  });

  const lastRow = targets.length > 0 ? targets.length + 1 : 1;
  const nameRange = `$T$2:$T$${lastRow}`;
  const vlookupRange = `$T$2:$W$${lastRow}`;

  // Update VLOOKUP formulas with correct range
  for (let i = 0; i < rowCount; i++) {
    const rowNum = i + firstDataRow;
    worksheet.getCell(`B${rowNum}`).value = {
      formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},${vlookupRange},2,FALSE))`
    } as any;

    // Frequency — always auto-filled from target definition
    worksheet.getCell(`E${rowNum}`).value = {
      formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},${vlookupRange},3,FALSE))`
    } as any;

    // Unit — auto-filled only for depts where it's not manually editable
    if (!config.unitEditable) {
      worksheet.getCell(`D${rowNum}`).value = {
        formula: `IF(C${rowNum}="","",VLOOKUP(C${rowNum},${vlookupRange},4,FALSE))`
      } as any;
    }
  }

  // Dropdown on C (Target Name)
  if (targets.length > 0) {
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      worksheet.getCell(`C${row}`).dataValidation = {
        type: "list",
        allowBlank: true,
        formulae: [nameRange],
        showErrorMessage: true,
        errorTitle: "Invalid Target",
        error: "Select a target from the dropdown.",
      };
    }
  }

  // Unit validation (D) - numeric, editable only for certain depts
  for (let row = firstDataRow; row <= lastDataRow; row++) {
    worksheet.getCell(`D${row}`).dataValidation = {
      type: "decimal",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: "Unit must be a positive number.",
    };
  }

  // Achieved Unit validation (F) - numeric
  for (let row = firstDataRow; row <= lastDataRow; row++) {
    worksheet.getCell(`F${row}`).dataValidation = {
      type: "decimal",
      operator: "greaterThanOrEqual",
      allowBlank: true,
      formulae: [0],
      showErrorMessage: true,
      errorTitle: "Invalid Value",
      error: `${achievedHeader} must be a positive number.`,
    };
  }

  // Remarks validation (G) - required for certain depts
  if (config.remarksRequired) {
    for (let row = firstDataRow; row <= lastDataRow; row++) {
      worksheet.getCell(`G${row}`).dataValidation = {
        type: "textLength",
        operator: "greaterThan",
        allowBlank: false,
        formulae: [0],
        showErrorMessage: true,
        errorTitle: "Remarks Required",
        error: "Remarks are required for this department.",
      };
    }
  }

  // Note row
  // Unlock the editable cells, then protect the sheet so everything else is read-only
  for (let row = firstDataRow; row <= lastDataRow; row++) {
    worksheet.getCell(`A${row}`).protection = { locked: false }; // Work Date
    worksheet.getCell(`C${row}`).protection = { locked: false }; // Target Name
    if (config.unitEditable) {
      worksheet.getCell(`D${row}`).protection = { locked: false }; // Unit (editable depts only)
    }
    worksheet.getCell(`F${row}`).protection = { locked: false }; // Achieved Unit
    worksheet.getCell(`G${row}`).protection = { locked: false }; // Remarks
  }
  await worksheet.protect("", { selectLockedCells: true, selectUnlockedCells: true });

  // Note row
  const notes: string[] = [];
  notes.push("Select Target Name from dropdown — Target ID auto-fills.");
  notes.push("Set the Work Date on each row to log targets for any day/month; blank rows are ignored on upload.");
  if (config.unitEditable) {
    notes.push("Unit is editable for your department.");
  } else {
    notes.push("Unit is auto-filled (read-only).");
  }
  if (config.targetAchievedDept) {
    notes.push("Target achieved = 100 or 0 only. Frequency = Daily.");
  }
  if (config.remarksRequired) {
    notes.push("Remarks are mandatory.");
  }

  worksheet.getCell(`A${noteRowNum}`).value = `Note: ${notes.join(" ")}`;
  worksheet.getCell(`A${noteRowNum}`).font = {
    italic: true,
    color: { argb: "FF666666" },
    size: 10,
  };
}

// ---- FREQUENCY INFO SHEET ----
function buildFrequencySheet(workbook: ExcelJS.Workbook) {
  const worksheet = workbook.addWorksheet("Frequency Rules");

  worksheet.columns = [{ width: 15 }, { width: 60 }];

  const headerRow = worksheet.addRow(["Frequency", "Valid Submission Days"]);
  headerRow.eachCell((cell) => {
    cell.fill = HEADER_FILL;
    cell.font = HEADER_FONT;
  });

  const rules = [
    ["DAILY", "Any day"],
    ["WEEKLY", "Only on Mondays or Fridays"],
    ["MONTHLY", "Within 5 days of the last day of the month"],
    ["QUARTERLY", "Only on quarter-end dates: Mar 31, Jun 30, Sep 30, Dec 31 (+5 days grace)"],
  ];

  rules.forEach(([freq, rule]) => {
    worksheet.addRow([freq, rule]);
  });
}

// ---- MAIN EXPORT ----
export async function generateExcelTemplate(
  tasks: TaskOption[],
  targets: TargetOption[],
  deptId: number,
  workDate: string,
  rowCount: number = DEFAULT_ROW_COUNT
): Promise<void> {
  const config = getDepartmentConfig(deptId);

  console.log("generateExcelTemplate:", {
    deptId,
    config,
    tasks: tasks.map((t) => `${t.taskID}:${t.taskName}`),
    targets: targets.map((t) => `${t.targetID}:${t.targetName}`),
    workDate,
    rowCount,
  });

  const workbook = new ExcelJS.Workbook();
  workbook.creator = "Taskly";
  workbook.created = new Date();

  await buildTaskSheet(workbook, tasks, config, workDate, rowCount);
  if (!config.skipTargetStep) {
    await buildTargetSheet(workbook, targets, config, workDate, rowCount);
  }
  buildFrequencySheet(workbook);

  const fileName = `Activity_Log_Template_${workDate}.xlsx`;
  const buffer = await workbook.xlsx.writeBuffer();

  const blob = new Blob([buffer], {
    type: "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet",
  });
  const url = URL.createObjectURL(blob);
  const link = document.createElement("a");
  link.href = url;
  link.download = fileName;
  document.body.appendChild(link);
  link.click();
  document.body.removeChild(link);
  URL.revokeObjectURL(url);
}

// ---- PARSE UPLOAD ----
export function parseUploadedExcel(
  file: File,
  tasks: TaskOption[],
  targets: TargetOption[],
  deptId: number
): Promise<{ activities: ParsedActivity[]; errors: string[] }> {
  const config = getDepartmentConfig(deptId);

  return new Promise((resolve, reject) => {
    const reader = new FileReader();

    reader.onload = (e) => {
      try {
        const data = new Uint8Array(e.target?.result as ArrayBuffer);
        const workbook = XLSX.read(data, { type: "array" });

        const allErrors: string[] = [];
        const activities: ParsedActivity[] = [];

        // Parse Task Entry sheet
        const taskSheetName = workbook.SheetNames.find((n) => {
          const lower = n.toLowerCase().trim();
          return lower.includes("task") || lower === "tasks" || lower === "task entry";
        });
        console.log("Available sheets:", workbook.SheetNames, "Matched task sheet:", taskSheetName);
        if (taskSheetName) {
          const sheet = workbook.Sheets[taskSheetName];
          const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
            header: 1,
            defval: "",
          });

          const dataRows = rows.slice(1);

          dataRows.forEach((row, idx) => {
            const rowNum = idx + 2;

            if (config.isIT) {
              // A=WorkDate, B=TaskID, C=TaskType, D=Description, E=TimeTaken
              const workDateVal = row[0] ?? "";
              const taskIdRaw = String(row[1] || "").trim();
              const taskName = String(row[2] || "").trim();
              const remark = String(row[3] || "").trim();
              const timeTaken = Number(row[4]);

              if (!taskIdRaw && !taskName && !remark && !timeTaken) return;

              const errors: string[] = [];
              let matchedTask: TaskOption | undefined;
              if (taskIdRaw) {
                matchedTask = tasks.find((t) => String(t.taskID) === taskIdRaw);
              }
              if (!matchedTask && taskName) {
                matchedTask = tasks.find(
                  (t) => t.taskName.toLowerCase() === taskName.toLowerCase()
                );
              }

              if (!taskIdRaw && !taskName) {
                errors.push(`Row ${rowNum}: Task ID or Task Type is required`);
              } else               if (!matchedTask) {
                errors.push(`Row ${rowNum}: Invalid Task "${taskName || taskIdRaw}"`);
              }
              if (!timeTaken || timeTaken <= 0) {
                errors.push(`Row ${rowNum}: Time Taken must be a positive number`);
              }

              activities.push({
                type: "task",
                taskID: matchedTask ? String(matchedTask.taskID) : taskIdRaw,
                taskName: matchedTask ? matchedTask.taskName : taskName,
                setup: 1,
                customTime: 0,
                timeTaken: timeTaken || 0,
                remark: remark,
                workDate: parseExcelDate(workDateVal),
                errors,
              });
              allErrors.push(...errors);
            } else {
              // A=WorkDate, B=TaskID, C=TaskType, D=TaskCount, E=StdTime, F=Description, G=TimeTaken
              const workDateVal = row[0] ?? "";
              const taskIdRaw = String(row[1] || "").trim();
              const taskName = String(row[2] || "").trim();
              const setup = Number(row[3]) || 1;
              const customTime = Number(row[4]);
              const remark = String(row[5] || "").trim();
              const timeTaken = Number(row[6]);

              if (!taskIdRaw && !taskName && !customTime && !timeTaken) return;

              const errors: string[] = [];
              let matchedTask: TaskOption | undefined;
              if (taskIdRaw) {
                matchedTask = tasks.find((t) => String(t.taskID) === taskIdRaw);
              }
              if (!matchedTask && taskName) {
                matchedTask = tasks.find(
                  (t) => t.taskName.toLowerCase() === taskName.toLowerCase()
                );
              }

              if (!taskIdRaw && !taskName) {
                errors.push(`Row ${rowNum}: Task ID or Task Type is required`);
              } else if (!matchedTask) {
                errors.push(`Row ${rowNum}: Invalid Task "${taskName || taskIdRaw}"`);
              }
              if (setup < 1) {
                errors.push(`Row ${rowNum}: Task Count must be at least 1`);
              }
              if (!timeTaken || timeTaken <= 0) {
                errors.push(`Row ${rowNum}: Time Taken must be a positive number`);
              }

              activities.push({
                type: "task",
                taskID: matchedTask ? String(matchedTask.taskID) : taskIdRaw,
                taskName: matchedTask ? matchedTask.taskName : taskName,
                setup: setup,
                customTime: customTime || 0,
                timeTaken: timeTaken || 0,
                remark: remark,
                workDate: parseExcelDate(workDateVal),
                errors,
              });
              allErrors.push(...errors);
            }
          });
        }

        // Parse Target Entry sheet
        if (!config.skipTargetStep) {
          const targetSheetName = workbook.SheetNames.find((n) => {
            const lower = n.toLowerCase().trim();
            return lower.includes("target") || lower === "targets" || lower === "target entry";
          });
          console.log("Matched target sheet:", targetSheetName);
          if (targetSheetName) {
            const sheet = workbook.Sheets[targetSheetName];
            const rows = XLSX.utils.sheet_to_json<string[]>(sheet, {
              header: 1,
              defval: "",
            });

            const dataRows = rows.slice(1);

            dataRows.forEach((row, idx) => {
              const rowNum = idx + 2;

              // A=WorkDate, B=TargetID, C=TargetName, D=Unit, E=Frequency, F=Achieved, G=Remarks
              const workDateVal = row[0] ?? "";
              const targetIdRaw = String(row[1] || "").trim();
              const targetName = String(row[2] || "").trim();
              const unit = Number(row[3]);
              const frequency = String(row[4] || "").trim();
              const achievedUnit = Number(row[5]);
              const remark = String(row[6] || "").trim();

              if (!targetIdRaw && !targetName && !unit && !achievedUnit) return;

              const errors: string[] = [];
              let matchedTarget: TargetOption | undefined;
              if (targetIdRaw) {
                matchedTarget = targets.find(
                  (t) => String(t.targetID) === targetIdRaw
                );
              }
              if (!matchedTarget && targetName) {
                matchedTarget = targets.find(
                  (t) => t.targetName.toLowerCase() === targetName.toLowerCase()
                );
              }

              if (!targetIdRaw && !targetName) {
                errors.push(`Row ${rowNum}: Target ID or Target Name is required`);
              } else if (!matchedTarget) {
                errors.push(`Row ${rowNum}: Invalid Target "${targetName || targetIdRaw}"`);
              }
              if (!achievedUnit && achievedUnit !== 0) {
                errors.push(`Row ${rowNum}: Achieved Unit is required`);
              }
              if (config.remarksRequired && !remark) {
                errors.push(`Row ${rowNum}: Remarks are required for this department`);
              }

              const resolvedFrequency = frequency || matchedTarget?.frequency || "";
              const resolvedDate = parseExcelDate(workDateVal);
              if (resolvedFrequency && resolvedDate) {
                const freqCheck = validateFrequencyDate(resolvedFrequency, resolvedDate);
                if (!freqCheck.isValid) {
                  errors.push(`Row ${rowNum}: ${freqCheck.message}`);
                }
              }

              activities.push({
                type: "target",
                targetID: matchedTarget ? String(matchedTarget.targetID) : targetIdRaw,
                targetName: matchedTarget ? matchedTarget.targetName : targetName,
                unit: unit || matchedTarget?.unit || 0,
                frequency: resolvedFrequency,
                achievedUnit: achievedUnit || 0,
                remark: remark,
                workDate: resolvedDate,
                errors,
              });
              allErrors.push(...errors);
            });
          }
        }

        console.log("Parsed activities:", activities.length, "tasks:", activities.filter(a => a.type === "task").length, "targets:", activities.filter(a => a.type === "target").length);
        resolve({ activities, errors: allErrors });
      } catch (err) {
        reject(err);
      }
    };

    reader.onerror = () => reject(new Error("Failed to read file"));
    reader.readAsArrayBuffer(file);
  });
}

function pad2(n: number): string {
  return String(n).padStart(2, "0");
}

function toISODate(year: number, month: number, day: number): string {
  return `${String(year).padStart(4, "0")}-${pad2(month)}-${pad2(day)}`;
}

function parseExcelDate(val: string | number | Date): string {
  if (val === null || val === undefined) return "";

  if (val instanceof Date) {
    if (isNaN(val.getTime())) return "";
    return toISODate(val.getUTCFullYear(), val.getUTCMonth() + 1, val.getUTCDate());
  }

  const str = String(val).trim();
  if (!str) return "";

  // Excel serial date number (stored as a number when cells are not read as Dates)
  const numDate = Number(str);
  if (!isNaN(numDate) && numDate > 0 && numDate < 2958466) {
    const d = new Date(Math.round((numDate - 25569) * 86400 * 1000));
    if (isNaN(d.getTime())) return str;
    return toISODate(d.getUTCFullYear(), d.getUTCMonth() + 1, d.getUTCDate());
  }

  // DD/MM/YYYY
  if (str.includes("/")) {
    const p = str.split("/");
    if (p.length === 3) {
      return toISODate(Number(p[2]), Number(p[1]), Number(p[0]));
    }
  }

  // YYYY-MM-DD or DD-MM-YYYY
  if (str.includes("-")) {
    const p = str.split("-");
    if (p.length === 3) {
      if (p[0].length === 4) return toISODate(Number(p[0]), Number(p[1]), Number(p[2]));
      return toISODate(Number(p[2]), Number(p[1]), Number(p[0]));
    }
  }

  return str;
}

function isWeeklyAllowed(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-").map(Number);
  const d = new Date(parts[0], parts[1] - 1, parts[2]);
  const dayOfWeek = d.getDay();
  return dayOfWeek === 1 || dayOfWeek === 5;
}

function isLastDayOfMonth(dateStr: string): boolean {
  if (!dateStr) return false;
  const parts = dateStr.split("-").map(Number);
  const current = new Date(parts[0], parts[1] - 1, parts[2]);
  const lastDay = new Date(parts[0], parts[1], 0);
  const end = new Date(lastDay);
  end.setDate(end.getDate() + 5);
  return current >= lastDay && current <= end;
}

function validateFrequencyDate(frequency: string, dateStr: string): { isValid: boolean; message: string } {
  switch (frequency.toUpperCase()) {
    case "DAILY":
      return { isValid: true, message: "" };
    case "WEEKLY":
      const weeklyOk = isWeeklyAllowed(dateStr);
      return {
        isValid: weeklyOk,
        message: weeklyOk ? "" : "Weekly target can only be added on Mondays or Fridays",
      };
    case "MONTHLY":
      const monthlyOk = isLastDayOfMonth(dateStr);
      return {
        isValid: monthlyOk,
        message: monthlyOk ? "" : "Monthly target can only be added within 5 days of the last day of the month",
      };
    default:
      return { isValid: true, message: "" };
  }
}
