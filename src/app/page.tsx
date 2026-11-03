"use client";

import Image from "next/image";
import { AnimatePresence, motion } from "motion/react";
import { FormEvent, useRef, useState } from "react";

const matchingSkills = [
  "Product strategy",
  "Cross-functional leadership",
  "User research",
  "Data-informed decisions",
  "Roadmap planning",
];

const reportSections = [
  {
    number: "01",
    title: "Gaps",
    copy: "The role asks for direct marketplace experience and familiarity with experimentation platforms. Neither is clearly evidenced in the résumé.",
  },
  {
    number: "02",
    title: "Strengths",
    copy: "Your record of leading multi-disciplinary teams and translating research into measurable product outcomes aligns closely with the role.",
  },
  {
    number: "03",
    title: "Recommendation",
    copy: "Bring the quantified impact of your two most relevant launches into the opening summary. Clarify the scale of the teams and markets you supported.",
  },
];

function UploadField() {
  const [file, setFile] = useState<File | null>(null);
  const inputRef = useRef<HTMLInputElement>(null);

  function removeFile() {
    setFile(null);
    if (inputRef.current) inputRef.current.value = "";
  }

  return (
    <div className="field-group">
      <div className="field-heading">
        <label htmlFor="resume">Résumé</label>
        <span>PDF or DOCX</span>
      </div>
      <input
        ref={inputRef}
        className="sr-only"
        id="resume"
        name="resume"
        type="file"
        accept=".pdf,.docx,application/pdf,application/vnd.openxmlformats-officedocument.wordprocessingml.document"
        required={!file}
        onChange={(event) => setFile(event.target.files?.[0] ?? null)}
      />
      {file ? (
        <div className="file-selected">
          <div className="file-mark" aria-hidden="true"><span /></div>
          <div className="file-details">
            <strong>{file.name}</strong>
            <span>Ready for analysis</span>
          </div>
          <button className="text-button" type="button" onClick={() => inputRef.current?.click()}>
            Replace
          </button>
          <button
            className="remove-button"
            type="button"
            aria-label={`Remove ${file.name}`}
            onClick={removeFile}
          >
            ×
          </button>
        </div>
      ) : (
        <label className="upload-dropzone" htmlFor="resume">
          <span className="upload-plus" aria-hidden="true">+</span>
          <span>
            <strong>Choose your résumé</strong>
            <small>Select a PDF or DOCX file</small>
          </span>
        </label>
      )}
    </div>
  );
}

function MockResults() {
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
        <span aria-hidden="true">No. 001</span>
      </div>
      <div className="results-intro">
        <div>
          <p className="eyebrow">Your alignment</p>
          <h2 id="results-title">A compelling foundation.</h2>
        </div>
        <div className="score" aria-label="Match score: 84 out of 100">
          <strong>84</strong>
          <span>/ 100</span>
        </div>
      </div>
      <div className="results-rule" />
      <div className="skills-block">
        <p className="section-label">Matching skills</p>
        <div className="skill-list">
          {matchingSkills.map((skill) => <span key={skill}>{skill}</span>)}
        </div>
      </div>
      <div className="report-grid">
        {reportSections.map((section) => (
          <article key={section.number} className="report-card">
            <span>{section.number}</span>
            <h3>{section.title}</h3>
            <p>{section.copy}</p>
          </article>
        ))}
      </div>
      <p className="mock-note">Illustrative preview · Final insights will be based on your documents.</p>
    </motion.section>
  );
}

export default function Home() {
  const [showResults, setShowResults] = useState(false);
  const resultsRef = useRef<HTMLDivElement>(null);

  function handleAnalyze(event: FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setShowResults(true);
    window.setTimeout(() => {
      resultsRef.current?.scrollIntoView({ behavior: "smooth", block: "start" });
    }, 180);
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
          <pattern
            id="isometric-flow"
            width="320"
            height="184"
            patternUnits="userSpaceOnUse"
          >
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
          <UploadField />
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
                required
              />
            </div>
          </div>
          <button className="analyze-button" type="submit">
            <span>Find my gaps</span>
            <span aria-hidden="true">→</span>
          </button>
          <p className="privacy-note">Your résumé stays in this browser. Nothing is stored remotely.</p>
        </motion.form>
      </section>
      <div className="results-anchor" ref={resultsRef}>
        <AnimatePresence>{showResults && <MockResults />}</AnimatePresence>
      </div>
    </main>
  );
}
