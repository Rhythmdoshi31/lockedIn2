import mammoth from "mammoth";
import { CanvasFactory } from "pdf-parse/worker";
import { PDFParse } from "pdf-parse";

import { pipelineLog } from "@/lib/pipeline-log";

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

function hasPdfSignature(buffer: Buffer): boolean {
  return buffer.subarray(0, 5).toString("ascii") === "%PDF-";
}

function hasPdfEndMarker(buffer: Buffer): boolean {
  const markerPosition = buffer.lastIndexOf("%%EOF", buffer.length, "ascii");
  return markerPosition >= Math.max(0, buffer.length - 4_096);
}

function hasZipSignature(bytes: Buffer): boolean {
  return (
    bytes[0] === 0x50 &&
    bytes[1] === 0x4b &&
    ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
      (bytes[2] === 0x05 && bytes[3] === 0x06) ||
      (bytes[2] === 0x07 && bytes[3] === 0x08))
  );
}

export async function extractResumeText(file: File, requestId: string): Promise<string> {
  const extractionStartedAt = performance.now();
  const extension = file.name.split(".").pop()?.toLowerCase() ?? "unknown";
  pipelineLog({
    requestId,
    stage: "resume.validation",
    event: "resume_received",
    status: "started",
    details: {
      extension,
      mimeType: file.type || "unknown",
      sizeBytes: file.size,
      pdfParseVersion: "2.4.5",
    },
  });

  if (file.size === 0) {
    pipelineLog({
      requestId,
      stage: "resume.validation",
      event: "file_size_check",
      status: "rejected",
      details: { reason: "empty_file" },
    });
    throw new ResumeParseError("The selected file is empty.", "EMPTY_FILE");
  }

  if (file.size > MAXIMUM_RESUME_SIZE) {
    pipelineLog({
      requestId,
      stage: "resume.validation",
      event: "file_size_check",
      status: "rejected",
      details: { reason: "file_too_large", sizeBytes: file.size },
    });
    throw new ResumeParseError("The résumé must be 10 MB or smaller.", "FILE_TOO_LARGE");
  }

  const bufferStartedAt = performance.now();
  let buffer: Buffer;
  try {
    buffer = Buffer.from(await file.arrayBuffer());
    pipelineLog({
      requestId,
      stage: "resume.buffer",
      event: "file_to_buffer",
      status: "succeeded",
      durationMs: Math.round(performance.now() - bufferStartedAt),
      details: { sizeBytes: buffer.byteLength, matchesUploadSize: buffer.byteLength === file.size },
    });
  } catch (error) {
    pipelineLog({
      requestId,
      stage: "resume.buffer",
      event: "file_to_buffer",
      status: "failed",
      durationMs: Math.round(performance.now() - bufferStartedAt),
      error,
    });
    throw new ResumeParseError(
      "The uploaded résumé could not be transferred to the document reader. Select the file again.",
      "FILE_BUFFER_FAILED",
    );
  }

  let extractedText = "";

  try {
    if (extension === "pdf") {
      if (!hasPdfSignature(buffer)) {
        throw new ResumeParseError("This file does not appear to be a valid PDF.", "INVALID_FILE");
      }
      if (!hasPdfEndMarker(buffer)) {
        throw new ResumeParseError(
          "This PDF is incomplete or damaged. Re-export it from the original document and try again.",
          "INCOMPLETE_PDF",
        );
      }

      const parserStartedAt = performance.now();
      pipelineLog({
        requestId,
        stage: "resume.pdf.extract",
        event: "pdf_parse",
        status: "started",
        details: {
          sizeBytes: buffer.byteLength,
          inputType: "Buffer",
          libraryVersion: "2.4.5",
          canvasFactory: "pdf-parse/worker",
          nodeMajorVersion: Number(process.versions.node.split(".")[0]),
        },
      });
      const parser = new PDFParse({ data: buffer, CanvasFactory });
      try {
        const result = await parser.getText();
        extractedText = result.text;
        pipelineLog({
          requestId,
          stage: "resume.pdf.extract",
          event: "pdf_parse",
          status: "succeeded",
          durationMs: Math.round(performance.now() - parserStartedAt),
          details: { pages: result.total, extractedCharacters: result.text.length },
        });
      } finally {
        await parser.destroy();
      }
    } else if (extension === "docx") {
      if (!hasZipSignature(buffer)) {
        throw new ResumeParseError("This file does not appear to be a valid DOCX document.", "INVALID_FILE");
      }

      const parserStartedAt = performance.now();
      pipelineLog({
        requestId,
        stage: "resume.docx.extract",
        event: "mammoth_extract",
        status: "started",
        details: { sizeBytes: buffer.byteLength, inputType: "Buffer" },
      });
      const result = await mammoth.extractRawText({ buffer });
      extractedText = result.value;
      pipelineLog({
        requestId,
        stage: "resume.docx.extract",
        event: "mammoth_extract",
        status: "succeeded",
        durationMs: Math.round(performance.now() - parserStartedAt),
        details: {
          extractedCharacters: result.value.length,
          parserWarnings: result.messages.length,
        },
      });
    } else {
      throw new ResumeParseError("Choose a PDF or DOCX résumé.", "UNSUPPORTED_FILE");
    }
  } catch (error) {
    pipelineLog({
      requestId,
      stage: extension === "pdf" ? "resume.pdf.extract" : "resume.docx.extract",
      event: "document_extraction",
      status: error instanceof ResumeParseError ? "rejected" : "failed",
      durationMs: Math.round(performance.now() - extractionStartedAt),
      details: { extension },
      error,
    });
    if (error instanceof ResumeParseError) throw error;

    const parserErrorName = error instanceof Error ? error.name : "";
    if (extension === "pdf" && parserErrorName === "PasswordException") {
      throw new ResumeParseError(
        "This PDF is password-protected. Remove the password and upload it again.",
        "PASSWORD_PROTECTED_PDF",
      );
    }
    if (extension === "pdf") {
      throw new ResumeParseError(
        "PDF text extraction failed because the document is damaged or uses an unsupported structure. Re-export it as a standard PDF and try again.",
        "PDF_EXTRACTION_FAILED",
      );
    }
    throw new ResumeParseError(
      "DOCX text extraction failed because the document package is damaged or unsupported. Re-save it as a DOCX and try again.",
      "DOCX_EXTRACTION_FAILED",
    );
  }

  const normalizedText = normalizeText(extractedText);
  if (normalizedText.length < MINIMUM_TEXT_LENGTH) {
    pipelineLog({
      requestId,
      stage: "resume.text.validation",
      event: "extracted_text_check",
      status: "rejected",
      details: { extension, extractedCharacters: normalizedText.length },
    });
    throw new ResumeParseError(
      extension === "pdf"
        ? "No readable résumé text was found. Scanned PDFs are not supported yet."
        : "The document does not contain enough readable résumé text.",
      "EMPTY_RESUME_TEXT",
    );
  }

  pipelineLog({
    requestId,
    stage: "resume.extraction",
    event: "resume_text_ready",
    status: "succeeded",
    durationMs: Math.round(performance.now() - extractionStartedAt),
    details: { extension, extractedCharacters: normalizedText.length },
  });
  return normalizedText;
}
