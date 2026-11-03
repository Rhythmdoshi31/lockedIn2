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
        <g>
          <path d="M760 70 C960 6 1260 34 1418 190 C1515 286 1504 438 1386 516 C1268 594 1054 566 970 454 C886 342 944 214 1086 196 C1228 178 1352 276 1328 386 C1304 496 1140 526 1056 446 C972 366 1002 276 1108 252" />
          <path d="M676 168 C846 54 1120 52 1290 142 C1460 232 1512 408 1412 548 C1312 688 1050 728 866 620 C682 512 650 304 790 194 C930 84 1194 112 1302 258 C1410 404 1320 586 1136 610" />
          <path d="M836 20 C994 128 1008 312 888 424 C768 536 790 700 944 792 C1098 884 1328 832 1422 682" />
          <path d="M620 386 C754 282 900 302 954 418 C1008 534 926 648 796 650 C666 652 584 538 620 430 C656 322 804 250 936 304" />
          <path d="M1110 42 C1050 166 1080 294 1198 348 C1316 402 1384 514 1328 628 C1272 742 1098 796 930 740" />
          <path d="M734 816 C874 730 1044 744 1148 844" />
        </g>
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
