import mammoth from "mammoth";
import { PDFParse } from "pdf-parse";

const MINIMUM_TEXT_LENGTH = 80;
const MAXIMUM_TEXT_LENGTH = 60_000;

export const MAXIMUM_RESUME_SIZE = 10 * 1024 * 1024;

export class ResumeParseError extends Error {
  constructor(
    message: string,
    public readonly code: string,
  ) {
    super(message);
    this.name = "ResumeParseError";
  }
}

function normalizeText(text: string): string {
  return text
    .replace(/\u0000/g, "")
    .replace(/\r\n?/g, "\n")
    .replace(/[\t ]+/g, " ")
    .replace(/\n{3,}/g, "\n\n")
    .trim()
    .slice(0, MAXIMUM_TEXT_LENGTH);
}

function hasPdfSignature(bytes: Uint8Array): boolean {
  return new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
}

function hasZipSignature(bytes: Uint8Array): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

export async function extractResumeText(file: File): Promise<string> {
  if (file.size === 0) {
    throw new ResumeParseError("The selected file is empty.", "EMPTY_FILE");
  }

  if (file.size > MAXIMUM_RESUME_SIZE) {
    throw new ResumeParseError("The résumé must be 10 MB or smaller.", "FILE_TOO_LARGE");
  }

  const extension = file.name.split(".").pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());
  let extractedText = "";

  try {
    if (extension === "pdf") {
      if (!hasPdfSignature(bytes)) {
        throw new ResumeParseError("This file does not appear to be a valid PDF.", "INVALID_FILE");
      }

      const parser = new PDFParse({ data: bytes });
      try {
        const result = await parser.getText();
        extractedText = result.text;
      } finally {
        await parser.destroy();
      }
    } else if (extension === "docx") {
      if (!hasZipSignature(bytes)) {
        throw new ResumeParseError("This file does not appear to be a valid DOCX document.", "INVALID_FILE");
      }

      const result = await mammoth.extractRawText({ buffer: Buffer.from(bytes) });
      extractedText = result.value;
    } else {
      throw new ResumeParseError("Choose a PDF or DOCX résumé.", "UNSUPPORTED_FILE");
    }
  } catch (error) {
    if (error instanceof ResumeParseError) throw error;
    throw new ResumeParseError("The résumé could not be read. Try exporting it again.", "UNREADABLE_FILE");
  }

  const normalizedText = normalizeText(extractedText);
  if (normalizedText.length < MINIMUM_TEXT_LENGTH) {
    throw new ResumeParseError(
      extension === "pdf"
        ? "No readable résumé text was found. Scanned PDFs are not supported yet."
        : "The document does not contain enough readable résumé text.",
      "EMPTY_RESUME_TEXT",
    );
  }

  return normalizedText;
}
