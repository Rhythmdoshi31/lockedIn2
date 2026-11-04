"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useEffect, useRef, useState } from "react";

import { pipelineLog } from "@/lib/pipeline-log";
import { deleteResume, loadResume, saveResume } from "@/lib/resume-store";
import {
  analysisResultSchema,
  analyzeErrorSchema,
  type AnalysisResult,
} from "@/schemas/analysis";

const MAXIMUM_RESUME_SIZE = 10 * 1024 * 1024;
const JOB_URL_STORAGE_KEY = "lockedin.jobUrl";
const RESUME_NAME_STORAGE_KEY = "lockedin.resumeName";

function validateResume(file: File): string | null {
  const extension = file.name.split(".").pop()?.toLowerCase();
  if (extension !== "pdf" && extension !== "docx") {
    return "Choose a PDF or DOCX résumé.";
  }
  if (file.size === 0) return "The selected file is empty.";
  if (file.size > MAXIMUM_RESUME_SIZE) return "The résumé must be 10 MB or smaller.";
  return null;
}

async function validateResumeStructure(file: File): Promise<string | null> {
  const extension = file.name.split(".").pop()?.toLowerCase();
  const bytes = new Uint8Array(await file.arrayBuffer());

  if (extension === "pdf") {
    const header = new TextDecoder("ascii").decode(bytes.slice(0, 5));
    const tail = new TextDecoder("ascii").decode(bytes.slice(Math.max(0, bytes.length - 4_096)));
    if (header !== "%PDF-" || !tail.includes("%%EOF")) {
      return "This PDF is incomplete or damaged. Re-export it from the original document and select it again.";
    }
  }

  if (
    extension === "docx" &&
    !(
      bytes[0] === 0x50 &&
      bytes[1] === 0x4b &&
      ((bytes[2] === 0x03 && bytes[3] === 0x04) ||
        (bytes[2] === 0x05 && bytes[3] === 0x06) ||
        (bytes[2] === 0x07 && bytes[3] === 0x08))
    )
  ) {
    return "This DOCX file is incomplete or damaged. Re-save it as a DOCX and select it again.";
  }

  return null;
}

interface UploadFieldProps {
  file: File | null;
  restoring: boolean;
  onChange: (file: File) => void;
  onRemove: () => void;
}

function UploadField({ file, restoring, onChange, onRemove }: UploadFieldProps) {
  const inputRef = useRef<HTMLInputElement>(null);

  return (
    <div className="field-group">
      <div className="field-heading">
        <label htmlFor="resume">Résumé</label>
        <span>PDF or DOCX · 10 MB max</span>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        id="resume"
        name="resume"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required={!file}
        onChange={(event) => {
          const selectedFile = event.target.files?.[0];
          if (selectedFile) onChange(selectedFile);
        }}
      />
      {file ? (
        <div className="file-selected">
          <div className="file-mark" aria-hidden="true"><span /></div>
          <div className="file-details">
            <strong>{file.name}</strong>
            <span>Saved locally and ready</span>
          </div>
          <button className="text-button" type="button" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button
            className="remove-button"
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={() => {
              if (inputRef.current) inputRef.current.value = "";
              onRemove();
            }}
          >
            ×
          </button>
        </div>
      ) : (
        <label className="upload-dropzone" htmlFor="resume">
          <span className="upload-plus" aria-hidden="true">+</span>
          <span>
            <strong>{restoring ? "Restoring your résumé…" : "Choose your résumé"}</strong>
            <small>Select a PDF or DOCX file</small>
          </span>
        </label>
      )}
    </div>
  );
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const [enhancementDecisions, setEnhancementDecisions] = useState<Record<number, "accepted" | "rejected">>({});
  const [copiedEnhancement, setCopiedEnhancement] = useState<number | null>(null);
  const rubric = [
    ["Technical Skills", result.rubric.skills, 45, result.rubricExplanations.skills.explanation],
    ["Experience", result.rubric.experience, 30, result.rubricExplanations.experience.explanation],
    ["Education", result.rubric.education, 10, result.rubricExplanations.education.explanation],
    ["Role Alignment", result.rubric.roleAlignment, 15, result.rubricExplanations.roleAlignment.explanation],
  ] as const;

  function exportAnalysis() {
    const lines = [
      `Gap Analysis: ${result.jobTitle}`,
      result.companyName ? `Company: ${result.companyName}` : "",
      `Match score: ${result.score}/100`,
      "",
      result.personalizedAssessment,
      "",
      "Missing requirements and improvements",
      ...result.gaps.flatMap((gap) => [
        `- [${gap.priority} · ${gap.status}] ${gap.requirement}`,
        `  Job requires: ${gap.jobRequires}`,
        `  Résumé evidence: ${gap.resumeEvidence}`,
        `  Improvement: ${gap.improvement}`,
        gap.suggestedWording ? `  Suggested wording: ${gap.suggestedWording}` : "",
      ]),
      "",
      "Recommended next actions",
      ...result.finalAssessment.nextActions.map((action, index) => `${index + 1}. ${action}`),
    ].filter(Boolean);
    const url = URL.createObjectURL(new Blob([lines.join("\n")], { type: "text/plain;charset=utf-8" }));
    const anchor = document.createElement("a");
    anchor.href = url;
    anchor.download = "lockedin-gap-analysis.txt";
    anchor.click();
    URL.revokeObjectURL(url);
  }

  async function copyEnhancement(index: number, text: string) {
    try {
      await navigator.clipboard.writeText(text);
    } catch {
      const textarea = document.createElement("textarea");
      textarea.value = text;
      textarea.style.position = "fixed";
      textarea.style.opacity = "0";
      document.body.appendChild(textarea);
      textarea.select();
      document.execCommand("copy");
      textarea.remove();
    }
    setCopiedEnhancement(index);
    window.setTimeout(() => setCopiedEnhancement(null), 1_600);
  }

  return (
    <motion.section
      className="results-section"
      aria-labelledby="results-title"
      initial={{ opacity: 0, y: 48 }}
      animate={{ opacity: 1, y: 0 }}
      exit={{ opacity: 0, y: 24 }}
      transition={{ duration: 0.75, ease: [0.22, 1, 0.36, 1] }}
    >
      <div className="results-kicker">
        <span>Gap analysis</span>
        <span>{result.requirementsAnalyzed} requirements checked</span>
      </div>
      <div className="results-intro">
        <div>
          <p className="eyebrow">{result.companyName || result.summaryTitle}</p>
          <h2 id="results-title">Gap Analysis: <em>{result.jobTitle}</em></h2>
          <p className="results-assessment">{result.personalizedAssessment}</p>
        </div>
        <div className="score" aria-label={`Match score: ${result.score} out of 100`}>
          <strong>{result.score}</strong>
          <span>match<br />/ 100</span>
        </div>
      </div>

      <section className="gaps-focus" aria-labelledby="gaps-title">
        <div className="focus-heading">
          <div>
            <p className="section-label">Your priority list</p>
            <h3 id="gaps-title">Missing Requirements<br />and Actionable Improvements</h3>
          </div>
          <span>{result.gaps.length} finding{result.gaps.length === 1 ? "" : "s"}</span>
        </div>

        {result.gaps.length > 0 ? (
          <div className="gap-list">
            {result.gaps.map((gap, index) => (
              <article className={`gap-card priority-${gap.priority.toLowerCase()} status-${gap.status}`} key={`${gap.requirement}-${index}`}>
                <div className="gap-card-heading">
                  <span className="priority-badge">{gap.priority}</span>
                  <span className="finding-status">{gap.status}</span>
                </div>
                <h4>{gap.requirement}</h4>
                <div className="gap-evidence">
                  <div>
                    <span>Job requires</span>
                    <p>{gap.jobRequires}</p>
                  </div>
                  <div>
                    <span>Résumé shows</span>
                    <p>{gap.resumeEvidence}</p>
                  </div>
                </div>
                <div className="gap-context">
                  <div><span>Why it matters</span><p>{gap.whyItMatters}</p></div>
                  <div className="gap-action"><span>How to improve</span><p>{gap.improvement}</p></div>
                </div>
                {gap.suggestedWording && (
                  <blockquote><span>Suggested résumé wording</span>{gap.suggestedWording}</blockquote>
                )}
              </article>
            ))}
          </div>
        ) : (
          <p className="no-gaps">No material missing requirements were found in the résumé evidence.</p>
        )}
      </section>

      <section className="analysis-block match-breakdown" aria-labelledby="breakdown-title">
        <div className="section-heading-row">
          <div><p className="section-label">Match breakdown</p><h3 id="breakdown-title">Where the score comes from</h3></div>
        </div>
        <div className="progress-list">
          {rubric.map(([label, score, total, explanation]) => (
            <div className="progress-item" key={label}>
              <div className="progress-heading"><strong>{label}</strong><span>{score}/{total}</span></div>
              <div className="progress-track" aria-label={`${label}: ${score} out of ${total}`}>
                <span style={{ width: `${Math.round((score / total) * 100)}%` }} />
              </div>
              <p>{explanation}</p>
            </div>
          ))}
        </div>
      </section>

      <section className="analysis-block" aria-labelledby="strengths-title">
        <div className="section-heading-row"><div><p className="section-label">Competitive strengths</p><h3 id="strengths-title">Evidence that works in your favour</h3></div></div>
        <div className="strength-card-grid">
          {result.competitiveStrengths.map((strength) => (
            <article className="strength-card" key={strength.capability}>
              <h4>{strength.capability}</h4>
              {strength.technologies.length > 0 && <p className="strength-tech">{strength.technologies.join(" · ")}</p>}
              <div><span>Résumé evidence</span><p>{strength.resumeEvidence}</p></div>
              <div><span>Relevance to this role</span><p>{strength.relevance}</p></div>
            </article>
          ))}
        </div>
        <details className="skills-disclosure">
          <summary>View complete matching skill list <span>{result.matchingSkills.length}</span></summary>
          <div className="skill-list subdued">
            {result.matchingSkills.map((skill) => <span key={skill}>{skill}</span>)}
          </div>
        </details>
      </section>

      <section className="analysis-block" aria-labelledby="studio-title">
        <div className="section-heading-row"><div><p className="section-label">Resume enhancement studio</p><h3 id="studio-title">Sharper wording, same honest experience</h3></div></div>
        <div className="enhancement-list">
          {result.resumeEnhancements.length > 0 ? result.resumeEnhancements.map((item, index) => (
            <article className={`enhancement-card decision-${enhancementDecisions[index] ?? "pending"}`} key={`${item.section}-${index}`}>
              <div className="enhancement-heading"><span>{item.type.replaceAll("_", " ")}</span><strong>{item.section}</strong></div>
              <div className="rewrite-pair">
                <div><span>Original</span><p>{item.original}</p></div>
                <div><span>AI-improved</span><p>{item.improved}</p></div>
              </div>
              <p className="rewrite-reason"><strong>Why this is stronger:</strong> {item.explanation}</p>
              <div className="enhancement-actions">
                <button type="button" onClick={() => copyEnhancement(index, item.improved)}>{copiedEnhancement === index ? "Copied" : "Copy"}</button>
                <button type="button" onClick={() => setEnhancementDecisions((current) => ({ ...current, [index]: "accepted" }))}>Accept</button>
                <button type="button" onClick={() => setEnhancementDecisions((current) => ({ ...current, [index]: "rejected" }))}>Reject</button>
              </div>
            </article>
          )) : <p className="empty-analysis-note">No rewrite passed the evidence checks, so no wording suggestion is shown.</p>}
        </div>
      </section>

      <section className="analysis-block" aria-labelledby="keywords-title">
        <div className="section-heading-row"><div><p className="section-label">Keyword optimization</p><h3 id="keywords-title">Use the JD’s language naturally</h3></div></div>
        <div className="keyword-columns">
          <div><h4>Already demonstrated</h4>{result.keywords.alreadyDemonstrated.map((item) => <article key={item.keyword}><strong>{item.keyword}</strong><p>{item.evidence}</p></article>)}</div>
          <div><h4>Insufficiently demonstrated</h4>{result.keywords.insufficientlyDemonstrated.map((item) => <article key={item.keyword}><strong>{item.keyword}</strong><p>{item.evidence}</p><small>{item.suggestion}</small></article>)}</div>
          <div><h4>Not found</h4>{result.keywords.notFound.map((item) => <article key={item.keyword}><strong>{item.keyword}</strong><p>{item.howToAddress}</p></article>)}</div>
        </div>
      </section>

      <section className="analysis-block" aria-labelledby="plan-title">
        <div className="section-heading-row"><div><p className="section-label">Action plan</p><h3 id="plan-title">What to do next</h3></div></div>
        <ol className="action-plan-list">
          {result.actionPlan.map((item) => (
            <li key={`${item.priority}-${item.action}`}><span>{item.priority.toString().padStart(2, "0")}</span><div><small>{item.type === "resume_wording" ? "Résumé wording" : "Skill or experience gap"}</small><h4>{item.action}</h4><p>{item.rationale}</p></div></li>
          ))}
        </ol>
      </section>

      <section className="analysis-block final-assessment" aria-labelledby="final-title">
        <div className="section-heading-row"><div><p className="section-label">Final assessment</p><h3 id="final-title">Your application outlook</h3></div><button type="button" className="export-button" onClick={exportAnalysis}>Download analysis ↓</button></div>
        <div className="assessment-pair"><div><span>Strongest area</span><p>{result.finalAssessment.strongestArea}</p></div><div><span>Biggest gap</span><p>{result.finalAssessment.biggestGap}</p></div></div>
        <div className="next-actions"><span>Three recommended actions</span><ol>{result.finalAssessment.nextActions.map((action) => <li key={action}>{action}</li>)}</ol></div>
      </section>
      <p className="result-note">Every finding is tied to a stated job requirement and checked against résumé evidence.</p>
    </motion.section>
  );
}

export default function Home() {
  const [file, setFile] = useState<File | null>(null);
  const [jobUrl, setJobUrl] = useState("");
  const [result, setResult] = useState<AnalysisResult | null>(null);
  const [error, setError] = useState<string | null>(null);
  const [isLoading, setIsLoading] = useState(false);
  const [isRestoring, setIsRestoring] = useState(true);
  const resultsRef = useRef<HTMLDivElement>(null);

  useEffect(() => {
    const restoreRequestId = crypto.randomUUID();
    const savedJobUrl = window.localStorage.getItem(JOB_URL_STORAGE_KEY);
    if (savedJobUrl) queueMicrotask(() => setJobUrl(savedJobUrl));

    loadResume(restoreRequestId)
      .then(async (savedFile) => {
        if (!savedFile) return;

        const validationError = validateResume(savedFile) ?? await validateResumeStructure(savedFile);
        if (validationError) {
          pipelineLog({
            requestId: restoreRequestId,
            stage: "upload.validation",
            event: "restored_resume_validation",
            status: "rejected",
            details: { sizeBytes: savedFile.size, reason: "invalid_stored_document" },
          });
          await deleteResume(restoreRequestId);
          window.localStorage.removeItem(RESUME_NAME_STORAGE_KEY);
          setError(`${validationError} The invalid saved copy was removed from this browser.`);
          return;
        }

        pipelineLog({
          requestId: restoreRequestId,
          stage: "upload.validation",
          event: "restored_resume_validation",
          status: "succeeded",
          details: { sizeBytes: savedFile.size, mimeType: savedFile.type || "unknown" },
        });
        setFile(savedFile);
      })
      .catch(() => setError("Your saved résumé could not be restored. Choose it again."))
      .finally(() => setIsRestoring(false));
  }, []);

  async function handleFileChange(selectedFile: File) {
    const uploadRequestId = crypto.randomUUID();
    const startedAt = performance.now();
    pipelineLog({
      requestId: uploadRequestId,
      stage: "upload.validation",
      event: "resume_selection",
      status: "started",
      details: { sizeBytes: selectedFile.size, mimeType: selectedFile.type || "unknown" },
    });
    const validationError = validateResume(selectedFile);
    if (validationError) {
      pipelineLog({
        requestId: uploadRequestId,
        stage: "upload.validation",
        event: "resume_selection",
        status: "rejected",
        durationMs: Math.round(performance.now() - startedAt),
        details: { reason: "file_metadata_validation" },
      });
      setError(validationError);
      return;
    }

    try {
      const structureError = await validateResumeStructure(selectedFile);
      if (structureError) {
        pipelineLog({
          requestId: uploadRequestId,
          stage: "upload.validation",
          event: "resume_structure_validation",
          status: "rejected",
          durationMs: Math.round(performance.now() - startedAt),
          details: { reason: "invalid_document_structure" },
        });
        setError(structureError);
        return;
      }
    } catch (validationFailure) {
      pipelineLog({
        requestId: uploadRequestId,
        stage: "upload.validation",
        event: "resume_structure_validation",
        status: "failed",
        durationMs: Math.round(performance.now() - startedAt),
        error: validationFailure,
      });
      setError("The selected résumé could not be read by this browser. Select it again.");
      return;
    }

    pipelineLog({
      requestId: uploadRequestId,
      stage: "upload.validation",
      event: "resume_selection",
      status: "succeeded",
      durationMs: Math.round(performance.now() - startedAt),
      details: { sizeBytes: selectedFile.size },
    });
    setError(null);
    setResult(null);
    setFile(selectedFile);
    window.localStorage.setItem(RESUME_NAME_STORAGE_KEY, selectedFile.name);

    try {
      await saveResume(selectedFile, uploadRequestId);
    } catch {
      setError("The résumé is selected, but it could not be saved between visits.");
    }
  }

  async function handleRemoveFile() {
    const deleteRequestId = crypto.randomUUID();
    setFile(null);
    setResult(null);
    setError(null);
    window.localStorage.removeItem(RESUME_NAME_STORAGE_KEY);

    try {
      await deleteResume(deleteRequestId);
    } catch {
      setError("The saved résumé could not be removed from this browser.");
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    const requestId = crypto.randomUUID();
    const requestStartedAt = performance.now();
    setError(null);

    if (!file) {
      pipelineLog({
        requestId,
        stage: "upload.validation",
        event: "analysis_preflight",
        status: "rejected",
        details: { reason: "missing_resume" },
      });
      setError("Choose a PDF or DOCX résumé.");
      return;
    }

    try {
      const url = new URL(jobUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
      pipelineLog({
        requestId,
        stage: "upload.validation",
        event: "analysis_preflight",
        status: "rejected",
        details: { reason: "invalid_job_url" },
      });
      setError("Enter a valid public job posting URL.");
      return;
    }

    setIsLoading(true);
    setResult(null);
    window.localStorage.setItem(JOB_URL_STORAGE_KEY, jobUrl);

    try {
      const formData = new FormData();
      formData.append("resume", file);
      formData.append("jobUrl", jobUrl);

      pipelineLog({
        requestId,
        stage: "upload.api",
        event: "analysis_submission",
        status: "started",
        details: { fileSizeBytes: file.size },
      });
      const response = await fetch("/api/analyze", {
        method: "POST",
        body: formData,
        headers: { "x-request-id": requestId },
      });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The analysis service returned an unreadable response. Please try again.");
      }

      if (!response.ok) {
        const parsedError = analyzeErrorSchema.safeParse(payload);
        pipelineLog({
          requestId,
          stage: "upload.api",
          event: "analysis_submission",
          status: "failed",
          durationMs: Math.round(performance.now() - requestStartedAt),
          details: {
            httpStatus: response.status,
            code: parsedError.success ? parsedError.data.error.code : "UNKNOWN_API_ERROR",
          },
        });
        throw new Error(
          parsedError.success ? parsedError.data.error.message : "The analysis could not be completed.",
        );
      }

      const parsedResult = analysisResultSchema.parse(payload);
      pipelineLog({
        requestId,
        stage: "upload.api",
        event: "analysis_submission",
        status: "succeeded",
        durationMs: Math.round(performance.now() - requestStartedAt),
        details: { httpStatus: response.status, score: parsedResult.score },
      });
      setResult(parsedResult);
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
    } catch (requestError) {
      pipelineLog({
        requestId,
        stage: "upload.pipeline",
        event: "analysis_flow",
        status: "failed",
        durationMs: Math.round(performance.now() - requestStartedAt),
        error: requestError,
      });
      setError(
        requestError instanceof Error
          ? requestError.message
          : "The analysis could not be completed. Please try again.",
      );
    } finally {
      setIsLoading(false);
    }
  }

  return (
    <main className="site-shell">
      <svg
        className="geometric-line-art"
        viewBox="0 0 1440 900"
        preserveAspectRatio="xMidYMid slice"
        aria-hidden="true"
      >
        <defs>
          <pattern id="isometric-grid" width="180" height="104" patternUnits="userSpaceOnUse">
            <path d="M0 52 90 0l90 52-90 52Z" />
            <path d="M90 0v104M0 52l90 52 90-52" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#isometric-grid)" />
      </svg>
      <div className="artwork" aria-hidden="true">
        <Image src="/grained-image-Photoroom.png" alt="" width={1264} height={843} priority />
      </div>
      <header className="site-header">
        <a className="wordmark" href="#top" aria-label="LockedIn home">
          <span className="wordmark-mark" aria-hidden="true">L</span>
          LockedIn
        </a>
        <span className="header-note">Clarity before every application</span>
      </header>
      <section className="hero" id="top">
        <motion.div
          className="hero-copy"
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, ease: [0.22, 1, 0.36, 1] }}
        >
          <p className="eyebrow">Résumé intelligence, thoughtfully composed</p>
          <h1>Stay locked in. <em>Get hired.</em></h1>
          <p className="hero-summary">
            Find out what’s missing from your résumé before you apply. Compare your experience with any job description and discover exactly where you stand.
          </p>
          <p className="supporting-copy">Know your strengths. Spot your gaps. Apply with confidence.</p>
        </motion.div>
        <motion.form
          className="analysis-form"
          onSubmit={handleAnalyze}
          initial={{ opacity: 0, y: 24 }}
          animate={{ opacity: 1, y: 0 }}
          transition={{ duration: 0.8, delay: 0.12, ease: [0.22, 1, 0.36, 1] }}
        >
          <UploadField
            file={file}
            restoring={isRestoring}
            onChange={handleFileChange}
            onRemove={handleRemoveFile}
          />
          <div className="field-group">
            <div className="field-heading">
              <label htmlFor="job-url">The opportunity</label>
              <span>Job posting URL</span>
            </div>
            <div className="url-field">
              <span aria-hidden="true">↗</span>
              <input
                id="job-url"
                name="job-url"
                type="url"
                inputMode="url"
                placeholder="https://company.com/careers/role"
                autoComplete="url"
                value={jobUrl}
                onChange={(event) => setJobUrl(event.target.value)}
                disabled={isLoading}
                required
              />
            </div>
          </div>
          <button className="analyze-button" type="submit" disabled={isLoading || isRestoring}>
            <span>{isLoading ? "Analyzing your match…" : "Find my gaps"}</span>
            {isLoading ? <span className="loading-mark" aria-hidden="true" /> : <span aria-hidden="true">→</span>}
          </button>
          <p className="privacy-note">Saved locally in this browser. Processed securely when you analyze.</p>
          <AnimatePresence>
            {error && (
              <motion.p
                className="form-error"
                role="alert"
                initial={{ opacity: 0, y: -6 }}
                animate={{ opacity: 1, y: 0 }}
                exit={{ opacity: 0 }}
              >
                {error}
              </motion.p>
            )}
          </AnimatePresence>
        </motion.form>
      </section>
      <div className="results-anchor" ref={resultsRef}>
        <AnimatePresence>{result && <AnalysisResults result={result} />}</AnimatePresence>
      </div>
    </main>
  );
}
