export const MAX_RESUME_BYTES = 10 * 1024 * 1024;
export const PDF_TYPE = "application/pdf";
export const DOCX_TYPE = "application/vnd.openxmlformats-officedocument.wordprocessingml.document";

export async function validateResumeUpload(value: FormDataEntryValue | null) {
  if (!(value instanceof File) || value.size < 1 || value.size > MAX_RESUME_BYTES || ![PDF_TYPE, DOCX_TYPE].includes(value.type)) return { error: "Choose a PDF or DOCX résumé up to 10 MB." } as const;
  const bytes = new Uint8Array(await value.arrayBuffer());
  const isPdf = value.type === PDF_TYPE && new TextDecoder().decode(bytes.slice(0, 5)) === "%PDF-";
  const isDocx = value.type === DOCX_TYPE && bytes[0] === 0x50 && bytes[1] === 0x4b && [[0x03,0x04],[0x05,0x06],[0x07,0x08]].some(([a,b]) => bytes[2] === a && bytes[3] === b);
  if (!isPdf && !isDocx) return { error: "The selected résumé is invalid or damaged." } as const;
  return { file: value, bytes, extension: isPdf ? "pdf" : "docx" } as const;
}
