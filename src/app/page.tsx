"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useEffect, useRef, useState } from "react";

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

interface ResultListProps {
  number: string;
  title: string;
  items: string[];
}

function ResultList({ number, title, items }: ResultListProps) {
  return (
    <article className="report-card">
      <span>{number}</span>
      <h3>{title}</h3>
      <ul>{items.map((item) => <li key={item}>{item}</li>)}</ul>
    </article>
  );
}

function AnalysisResults({ result }: { result: AnalysisResult }) {
  const rubric = [
    ["Skills", result.rubric.skills, 45],
    ["Experience", result.rubric.experience, 30],
    ["Education", result.rubric.education, 10],
    ["Role alignment", result.rubric.roleAlignment, 15],
  ] as const;

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
        <span>Analysis</span>
        <span>Evidence-based score</span>
      </div>
      <div className="results-intro">
        <div>
          <p className="eyebrow">Your alignment</p>
          <h2 id="results-title">{result.summaryTitle}</h2>
        </div>
        <div className="score" aria-label={`Match score: ${result.score} out of 100`}>
          <strong>{result.score}</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="results-rule" />

      <div className="rubric-grid" aria-label="Score breakdown">
        {rubric.map(([label, score, total]) => (
          <div key={label}>
            <span>{label}</span>
            <strong>{score}<small>/{total}</small></strong>
          </div>
        ))}
      </div>

      <div className="skills-block">
        <p className="section-label">Matching skills</p>
        <div className="skill-list">
          {result.matchingSkills.length > 0 ? (
            result.matchingSkills.map((skill) => <span key={skill}>{skill}</span>)
          ) : (
            <p>No directly matching skills were verified.</p>
          )}
        </div>
      </div>

      {result.missingSkills.length > 0 && (
        <div className="missing-skills-block">
          <p className="section-label">Missing or unverified</p>
          <div className="missing-skill-list">
            {result.missingSkills.map((item) => (
              <article key={`${item.skill}-${item.status}`}>
                <div><strong>{item.skill}</strong><span>{item.status}</span></div>
                <p>{item.explanation}</p>
              </article>
            ))}
          </div>
        </div>
      )}

      <div className="report-grid">
        <ResultList number="01" title="Gaps" items={result.gaps} />
        <ResultList number="02" title="Strengths" items={result.strengths} />
        <ResultList number="03" title="Recommendations" items={result.recommendations} />
      </div>

      {result.sectionFeedback.length > 0 && (
        <div className="section-feedback">
          <p className="section-label">Section-by-section</p>
          {result.sectionFeedback.map((item) => (
            <article key={item.section}>
              <h3>{item.section}</h3>
              <p>{item.assessment}</p>
            </article>
          ))}
        </div>
      )}
      <p className="result-note">Recommendations are limited to experience evidenced in your résumé.</p>
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
    const savedJobUrl = window.localStorage.getItem(JOB_URL_STORAGE_KEY);
    if (savedJobUrl) queueMicrotask(() => setJobUrl(savedJobUrl));

    loadResume()
      .then((savedFile) => {
        if (savedFile) setFile(savedFile);
      })
      .catch(() => setError("Your saved résumé could not be restored. Choose it again."))
      .finally(() => setIsRestoring(false));
  }, []);

  async function handleFileChange(selectedFile: File) {
    const validationError = validateResume(selectedFile);
    if (validationError) {
      setError(validationError);
      return;
    }

    setError(null);
    setResult(null);
    setFile(selectedFile);
    window.localStorage.setItem(RESUME_NAME_STORAGE_KEY, selectedFile.name);

    try {
      await saveResume(selectedFile);
    } catch {
      setError("The résumé is selected, but it could not be saved between visits.");
    }
  }

  async function handleRemoveFile() {
    setFile(null);
    setResult(null);
    setError(null);
    window.localStorage.removeItem(RESUME_NAME_STORAGE_KEY);

    try {
      await deleteResume();
    } catch {
      setError("The saved résumé could not be removed from this browser.");
    }
  }

  async function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setError(null);

    if (!file) {
      setError("Choose a PDF or DOCX résumé.");
      return;
    }

    try {
      const url = new URL(jobUrl);
      if (!['http:', 'https:'].includes(url.protocol)) throw new Error();
    } catch {
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

      const response = await fetch("/api/analyze", { method: "POST", body: formData });
      let payload: unknown;
      try {
        payload = await response.json();
      } catch {
        throw new Error("The analysis service returned an unreadable response. Please try again.");
      }

      if (!response.ok) {
        const parsedError = analyzeErrorSchema.safeParse(payload);
        throw new Error(
          parsedError.success ? parsedError.data.error.message : "The analysis could not be completed.",
        );
      }

      const parsedResult = analysisResultSchema.parse(payload);
      setResult(parsedResult);
      window.setTimeout(() => {
        resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
      }, 180);
    } catch (requestError) {
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
          <pattern id="isometric-flow" width="320" height="184" patternUnits="userSpaceOnUse">
            <path d="M-240 46 C-160 -46 -80 -46 0 46 S160 138 240 46 S400 -46 480 46 S640 138 720 46" />
            <path d="M-240 138 C-160 46 -80 46 0 138 S160 230 240 138 S400 46 480 138 S640 230 720 138" />
            <path d="M-160 0 C-80 92 0 92 80 0 S240 -92 320 0 S480 92 560 0" />
            <path d="M-160 184 C-80 92 0 92 80 184 S240 276 320 184 S480 92 560 184" />
          </pattern>
        </defs>
        <rect width="100%" height="100%" fill="url(#isometric-flow)" />
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
