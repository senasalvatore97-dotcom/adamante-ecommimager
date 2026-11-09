"use client";

import { useEffect, useRef, useState } from "react";
import {
  ArrowDownToLine, ArrowLeft, ArrowRight, Check, CheckCircle2, ChevronRight,
  Clock3, Download, Gem, Images, ImagePlus, Info, KeyRound,
  Layers3, LoaderCircle, LockKeyhole, LogOut, PackageOpen, Plus, RefreshCw,
  ShieldCheck, Sparkles, Trash2, UploadCloud, WandSparkles, X
} from "lucide-react";
import {
  SHOTS, CATEGORIES, blankSet, type Project, type ShotId, type Category, type ImageSet
} from "@/lib/shots";
import { getProjects, getReference, saveProject, setReference, clearReference, removeProject } from "@/lib/database";
import { imageToDataUrl, downloadDataUrl, downloadZip, sanitizeFileName } from "@/lib/image-utils";

type Tab = "studio" | "references" | "archive";
type SessionState = "loading" | "login" | "ready";
type ResultStatus = Record<ShotId, "idle" | "working" | "done" | "error">;

const EMPTY_REFERENCES: ImageSet = blankSet();
const INITIAL_STATUS: ResultStatus = { hero: "idle", front: "idle", worn: "idle", box: "idle" };

function formatDate(value: number): string {
  return new Intl.DateTimeFormat("it-IT", { day: "2-digit", month: "short", year: "numeric" }).format(value);
}

function StudioMark() {
  return <span className="studio-mark" aria-hidden="true"><span className="studio-mark-inner">A</span></span>;
}

export default function Home() {
  const [session, setSession] = useState<SessionState>("loading");
  const [configured, setConfigured] = useState(true);
  const [password, setPassword] = useState("");
  const [loginError, setLoginError] = useState("");
  const [loggingIn, setLoggingIn] = useState(false);
  const [tab, setTab] = useState<Tab>("studio");
  const [references, setReferences] = useState<ImageSet>(EMPTY_REFERENCES);
  const [project, setProject] = useState<Project | null>(null);
  const [projects, setProjects] = useState<Project[]>([]);
  const [isGenerating, setIsGenerating] = useState(false);
  const [activeShot, setActiveShot] = useState<ShotId | null>(null);
  const [statuses, setStatuses] = useState<ResultStatus>(INITIAL_STATUS);
  const [errors, setErrors] = useState<Partial<Record<ShotId, string>>>({});
  const [notice, setNotice] = useState("");
  const [preview, setPreview] = useState<string | null>(null);
  const [archiveQuery, setArchiveQuery] = useState("");
  const productInput = useRef<HTMLInputElement>(null);
  const abortOnUnmount = useRef(false);

  useEffect(() => {
    abortOnUnmount.current = false;
    async function initialize() {
      try {
        const response = await fetch("/api/session", { cache: "no-store" });
        const data = await response.json();
        if (abortOnUnmount.current) return;
        setConfigured(Boolean(data.configured));
        setSession(data.authenticated ? "ready" : "login");
      } catch {
        if (!abortOnUnmount.current) {
          setLoginError("Impossibile contattare il server.");
          setSession("login");
        }
      }
      try {
        const [savedRefs, savedProjects] = await Promise.all([
          Promise.all(SHOTS.map((shot) => getReference(shot.id))),
          getProjects()
        ]);
        if (abortOnUnmount.current) return;
        const next = blankSet();
        SHOTS.forEach((shot, index) => { next[shot.id] = savedRefs[index] ?? null; });
        setReferences(next);
        const sorted = savedProjects.sort((a, b) => b.createdAt - a.createdAt);
        setProjects(sorted);
        if (sorted[0]) setProject(sorted[0]);
      } catch {
        if (!abortOnUnmount.current) setNotice("Archivio locale non disponibile. Controlla le impostazioni del browser.");
      }
    }
    void initialize();
    return () => { abortOnUnmount.current = true; };
  }, []);

  useEffect(() => {
    function onEscape(event: KeyboardEvent) {
      if (event.key === "Escape") setPreview(null);
    }
    window.addEventListener("keydown", onEscape);
    return () => window.removeEventListener("keydown", onEscape);
  }, []);

  const configuredCount = SHOTS.filter((shot) => references[shot.id]).length;
  const generatedCount = project ? SHOTS.filter((shot) => project.results[shot.id]).length : 0;
  const canGenerate = Boolean(project && configuredCount === 4 && !isGenerating);
  const archiveFiltered = projects.filter((item) => item.title.toLowerCase().includes(archiveQuery.toLowerCase()));

  async function signIn(event: React.FormEvent<HTMLFormElement>) {
    event.preventDefault();
    setLoggingIn(true);
    setLoginError("");
    try {
      const response = await fetch("/api/session", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({ password })
      });
      const data = await response.json();
      if (!response.ok) throw new Error(data.error ?? "Impossibile accedere.");
      setPassword("");
      setSession("ready");
    } catch (error) {
      setLoginError(error instanceof Error ? error.message : "Accesso non riuscito.");
    } finally {
      setLoggingIn(false);
    }
  }

  async function signOut() {
    await fetch("/api/session", { method: "DELETE" }).catch(() => undefined);
    setSession("login");
    setPassword("");
    setTab("studio");
  }

  function updateProject(changes: Partial<Project>) {
    if (!project) return;
    const next: Project = { ...project, ...changes };
    setProject(next);
    setProjects((prev) => prev.map((p) => p.id === next.id ? next : p));
    void saveProject(next).catch(() => setNotice("Impossibile salvare le modifiche nell'archivio."));
  }

  async function receiveProduct(file: File | undefined) {
    if (!file || isGenerating) return;
    try {
      setNotice("");
      const original = await imageToDataUrl(file, 1600, 0.93);
      const next: Project = {
        id: crypto.randomUUID(),
        title: file.name.replace(/\.[^.]+$/, "").replace(/[-_]+/g, " ").slice(0, 90) || "Nuovo gioiello",
        category: "anello",
        notes: "",
        original,
        results: blankSet(),
        createdAt: Date.now()
      };
      await saveProject(next);
      setProjects((prev) => [next, ...prev]);
      setProject(next);
      setStatuses(INITIAL_STATUS);
      setErrors({});
      setTab("studio");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Immagine non valida.");
    }
  }

  async function receiveReference(slot: ShotId, file: File | undefined) {
    if (!file || isGenerating) return;
    try {
      const data = await imageToDataUrl(file, 1200, 0.88);
      await setReference(slot, data);
      setReferences((prev) => ({ ...prev, [slot]: data }));
      setNotice("");
    } catch (error) {
      setNotice(error instanceof Error ? error.message : "Reference non valida.");
    }
  }

  async function deleteReference(slot: ShotId) {
    if (isGenerating) return;
    await clearReference(slot);
    setReferences((prev) => ({ ...prev, [slot]: null }));
  }

  async function makeImage(currentProject: Project, slot: ShotId): Promise<string> {
    if (!references[slot]) throw new Error("Carica prima la reference per questo scatto.");
    const response = await fetch("/api/generate", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        image: currentProject.original,
        reference: references[slot],
        slot,
        category: currentProject.category,
        notes: currentProject.notes
      })
    });
    const result = await response.json().catch(() => ({}));
    if (response.status === 401) setSession("login");
    if (!response.ok) throw new Error(result.error ?? "Impossibile generare l'immagine.");
    if (typeof result.image !== "string") throw new Error("Il servizio non ha restituito un'immagine.");
    return result.image;
  }

  async function generateAll() {
    if (!canGenerate || !project) return;
    setIsGenerating(true);
    setErrors({});
    setNotice("");
    let working = project;
    try {
      for (const shot of SHOTS) {
        setActiveShot(shot.id);
        setStatuses((prev) => ({ ...prev, [shot.id]: "working" }));
        try {
          const image = await makeImage(working, shot.id);
          working = { ...working, results: { ...working.results, [shot.id]: image } };
          await saveProject(working);
          setProject(working);
          setProjects((prev) => prev.map((item) => item.id === working.id ? working : item));
          setStatuses((prev) => ({ ...prev, [shot.id]: "done" }));
        } catch (error) {
          setErrors((prev) => ({ ...prev, [shot.id]: error instanceof Error ? error.message : "Errore imprevisto." }));
          setStatuses((prev) => ({ ...prev, [shot.id]: "error" }));
          if (error instanceof Error && error.message.includes("Sessione scaduta")) break;
        }
      }
    } finally {
      setActiveShot(null);
      setIsGenerating(false);
    }
  }

  async function regenerateOne(slot: ShotId) {
    if (!project || isGenerating) return;
    setIsGenerating(true);
    setActiveShot(slot);
    setStatuses((prev) => ({ ...prev, [slot]: "working" }));
    setErrors((prev) => ({ ...prev, [slot]: "" }));
    try {
      const image = await makeImage(project, slot);
      const updated = { ...project, results: { ...project.results, [slot]: image } };
      await saveProject(updated);
      setProject(updated);
      setProjects((prev) => prev.map((item) => item.id === updated.id ? updated : item));
      setStatuses((prev) => ({ ...prev, [slot]: "done" }));
    } catch (error) {
      setErrors((prev) => ({ ...prev, [slot]: error instanceof Error ? error.message : "Errore imprevisto." }));
      setStatuses((prev) => ({ ...prev, [slot]: "error" }));
    } finally {
      setActiveShot(null);
      setIsGenerating(false);
    }
  }

  async function removeArchiveProject(item: Project) {
    if (!window.confirm("Eliminare definitivamente questa lavorazione dal browser?")) return;
    try {
      await removeProject(item.id);
      const next = projects.filter((p) => p.id !== item.id);
      setProjects(next);
      if (project?.id === item.id) setProject(next[0] ?? null);
    } catch {
      setNotice("Non è stato possibile eliminare la lavorazione.");
    }
  }

  function openProject(item: Project) {
    if (isGenerating) return;
    setProject(item);
    setStatuses(INITIAL_STATUS);
    setErrors({});
    setTab("studio");
  }

  async function saveZip() {
    if (!project) return;
    const images = SHOTS.flatMap((shot) => project.results[shot.id] ? [{ id: shot.id, data: project.results[shot.id] as string }] : []);
    if (!images.length) return;
    try {
      await downloadZip(project.title, images);
    } catch {
      setNotice("Impossibile creare lo ZIP. Riprova il download dei singoli file.");
    }
  }

  if (session === "loading") {
    return <div className="startup"><StudioMark /><LoaderCircle className="spin" size={24} /><p>Preparazione dello studio...</p></div>;
  }

  if (session === "login") {
    return <main className="login-page">
      <div className="login-decoration"><div className="orb orb-one" /><div className="orb orb-two" /><span className="login-vertical">ADAMANTE / PHOTO STUDIO</span></div>
      <section className="login-panel">
        <StudioMark />
        <div className="login-eyebrow">UNO STUDIO DEDICATO ALL'ECCELLENZA</div>
        <h1>Ogni dettaglio<br /><em>conta.</em></h1>
        <p className="login-description">Lo studio fotografico digitale di Adamante. Quattro prospettive, un'unica identità visiva.</p>
        <form onSubmit={signIn} className="login-form">
          <label htmlFor="password">PASSWORD DELLO STUDIO</label>
          <div className="login-input-wrap"><LockKeyhole size={18} /><input id="password" type="password" autoComplete="current-password" placeholder="Inserisci la password" value={password} onChange={(event) => setPassword(event.target.value)} required /></div>
          {loginError && <p className="form-error">{loginError}</p>}
          {!configured && <p className="form-error">Configurazione necessaria: aggiungi OPENAI_API_KEY, STUDIO_PASSWORD e SESSION_SECRET nelle variabili d'ambiente.</p>}
          <button className="primary-button login-button" type="submit" disabled={loggingIn || !configured}>
            {loggingIn ? <LoaderCircle size={18} className="spin" /> : <KeyRound size={18} />}
            Accedi allo studio <ArrowRight size={17} />
          </button>
        </form>
        <div className="login-footnote"><ShieldCheck size={16} /> Accesso riservato · Chiave API protetta sul server</div>
      </section>
    </main>;
  }

  return <div className="site-shell">
    <header className="site-header">
      <div className="brand"><StudioMark /><div className="brand-wordmark"><strong>ADAMANTE</strong><small>PHOTO STUDIO</small></div></div>
      <nav className="top-nav" aria-label="Navigazione">
        <button className={tab === "studio" ? "nav-button active" : "nav-button"} onClick={() => setTab("studio")}><Layers3 size={16} /> Studio</button>
        <button className={tab === "references" ? "nav-button active" : "nav-button"} onClick={() => setTab("references")}><Images size={16} /> Reference <span className="nav-count">{configuredCount}/4</span></button>
        <button className={tab === "archive" ? "nav-button active" : "nav-button"} onClick={() => setTab("archive")}><Clock3 size={16} /> Archivio</button>
      </nav>
      <div className="header-right"><span className="header-secure"><span className="status-dot" /> Area riservata</span><button className="icon-button logout-button" onClick={() => void signOut()} aria-label="Esci dallo studio" title="Esci"><LogOut size={19} /></button></div>
    </header>

    <div className="site-main">
      {notice && <div className="notice" role="alert"><Info size={17} />{notice}<button onClick={() => setNotice("")} aria-label="Chiudi"><X size={15} /></button></div>}

      {tab === "studio" && <>
        <div className="intro-row">
          <div><div className="eyebrow"><span className="eyebrow-line" /> ADAMANTE / GENERATIVE ATELIER</div><h1 className="page-title">La bellezza, <em>in ogni dettaglio.</em></h1><p className="page-description">Una fotografia originale. Quattro immagini coordinate, pronte per il tuo catalogo.</p></div>
          <div className="intro-caption"><Gem size={18} strokeWidth={1.4} /><span>STUDIO FOTOGRAFICO<br />ALTA GIOIELLERIA</span></div>
        </div>
        <div className="studio-columns">
          <aside className="editor-panel">
            <div className="panel-heading"><span className="panel-number">01 / ORIGINALE</span><h2>Il tuo gioiello</h2><p>Carica la fotografia di partenza.</p></div>
            <input ref={productInput} type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden onChange={(e) => { void receiveProduct(e.target.files?.[0]); e.currentTarget.value = ""; }} />
            {project ? <div className="product-preview">
              <img src={project.original} alt={"Foto originale di " + project.title} />
              <button className="preview-replace" onClick={() => productInput.current?.click()} disabled={isGenerating}><RefreshCw size={14} /> Nuovo prodotto</button>
            </div> : <div className="upload-zone" role="button" tabIndex={0} onClick={() => productInput.current?.click()} onKeyDown={(e) => { if (e.key === "Enter") productInput.current?.click(); }} onDragOver={(e) => e.preventDefault()} onDrop={(e) => { e.preventDefault(); void receiveProduct(e.dataTransfer.files?.[0]); }}>
              <span className="upload-symbol"><UploadCloud size={26} strokeWidth={1.4} /></span><strong>Trascina qui la foto</strong><span>oppure clicca per sfogliare</span><small>JPG, PNG, WEBP · Max 35 MB</small>
            </div>}
            <div className="field-group">
              <label htmlFor="product-title">NOME O CODICE ARTICOLO</label>
              <input id="product-title" className="form-control" placeholder="Es. Anello smeraldo 001" disabled={!project || isGenerating} value={project?.title ?? ""} onChange={(e) => updateProject({ title: e.target.value })} />
            </div>
            <div className="field-group">
              <label htmlFor="product-category">CATEGORIA</label>
              <select id="product-category" className="form-control" disabled={!project || isGenerating} value={project?.category ?? "anello"} onChange={(e) => updateProject({ category: e.target.value as Category })}>
                {CATEGORIES.map((option) => <option key={option.value} value={option.value}>{option.label}</option>)}
              </select>
            </div>
            <div className="field-group">
              <label htmlFor="product-notes">DETTAGLI DA PRESERVARE <span className="optional">FACOLTATIVO</span></label>
              <textarea id="product-notes" className="form-control text-area" rows={4} placeholder="Es. Oro rosa 18 kt, smeraldo centrale, doppio giro di diamanti. Non cambiare la montatura." disabled={!project || isGenerating} value={project?.notes ?? ""} onChange={(e) => updateProject({ notes: e.target.value.slice(0, 1600) })} />
            </div>
            <div className="editor-separator" />
            <div className="reference-health">
              <div className="reference-health-top"><span><CheckCircle2 size={16} /> Stile fotografico</span><span>{configuredCount} / 4</span></div>
              <div className="reference-progress">{SHOTS.map((shot) => <span key={shot.id} className={references[shot.id] ? "filled" : ""} />)}</div>
              {configuredCount < 4 ? <p>Importa tutte le reference per mantenere uno stile coerente.</p> : <p>Quattro reference caricate e pronte all'uso.</p>}
              <button className="inline-link" onClick={() => setTab("references")}>Gestisci reference <ArrowRight size={14} /></button>
            </div>
            <button className="primary-button generate-button" disabled={!canGenerate} onClick={() => void generateAll()}>
              {isGenerating ? <LoaderCircle size={19} className="spin" /> : <Sparkles size={19} strokeWidth={1.7} />}
              {isGenerating ? "Generazione in corso..." : generatedCount > 0 ? "Rigenera tutte e quattro" : "Genera le quattro foto"}
              {!isGenerating && <ArrowRight size={18} />}
            </button>
            {!project && <p className="under-button">Inizia caricando la fotografia del prodotto.</p>}
            {project && configuredCount < 4 && <p className="under-button">Mancano {4 - configuredCount} reference per avviare la generazione.</p>}
          </aside>

          <section className="results-section">
            <div className="results-head"><div><span className="panel-number">02 / RISULTATI</span><h2>Le quattro prospettive<span className="heading-period">.</span></h2><p>Uno standard fotografico unico, pensato per Adamante.</p></div>
              <button className="secondary-button" disabled={generatedCount === 0 || isGenerating} onClick={() => void saveZip()}><ArrowDownToLine size={17} /> Scarica set <span>{generatedCount}/4</span></button>
            </div>
            <div className="shot-grid">
              {SHOTS.map((shot) => {
                const image = project?.results[shot.id];
                const active = activeShot === shot.id;
                return <article key={shot.id} className={"shot-card" + (active ? " processing" : "")}>
                  <div className="shot-image">
                    {image ? <button className="view-result" onClick={() => setPreview(image)} aria-label={"Ingrandisci " + shot.title}><img src={image} alt={shot.title + " di " + (project?.title ?? "gioiello")} /></button> :
                      <div className="shot-placeholder"><span className="shot-corner top-left" /><span className="shot-corner top-right" /><span className="shot-corner bottom-left" /><span className="shot-corner bottom-right" /><div className="placeholder-number">{shot.number}</div><div className="placeholder-center"><Gem size={36} strokeWidth={0.8} /><span>{shot.short.toUpperCase()}</span></div></div>}
                    <span className="shot-top-label">{shot.number} <span>/ 04</span></span>
                    {active && <div className="shot-loading"><LoaderCircle className="spin" size={31} /><strong>Creazione in corso</strong><span>La fotografia prende forma...</span></div>}
                    {image && !active && <span className="ready-chip"><Check size={13} /> Pronta</span>}
                  </div>
                  <div className="shot-bottom"><div className="shot-copy"><h3>{shot.title}</h3><p>{shot.description}</p></div><div className="shot-actions">
                    {image && <button className="small-action" disabled={isGenerating} title="Scarica PNG" aria-label={"Scarica " + shot.title} onClick={() => downloadDataUrl(image, sanitizeFileName(project?.title ?? "adamante") + "-" + shot.id + ".png")}><Download size={16} /></button>}
                    <button className="small-action" disabled={!project || !references[shot.id] || isGenerating} title={image ? "Rigenera scatto" : "Genera scatto"} aria-label={"Genera " + shot.title} onClick={() => void regenerateOne(shot.id)}>{image ? <RefreshCw size={16} /> : <WandSparkles size={16} />}</button>
                  </div></div>
                  {errors[shot.id] && <div className="shot-error" role="alert"><Info size={15} />{errors[shot.id]}</div>}
                </article>;
              })}
            </div>
            <div className="results-foot"><div className="foot-icon"><ShieldCheck size={19} /></div><p><strong>Fedeltà prima di tutto.</strong> Il sistema tenta di rispettare montatura, pietre e proporzioni. Verifica sempre i dettagli del gioiello prima della pubblicazione.</p></div>
          </section>
        </div>
      </>}

      {tab === "references" && <>
        <div className="intro-row reference-intro"><div><div className="eyebrow"><span className="eyebrow-line" /> ADAMANTE / DIREZIONE ARTISTICA</div><h1 className="page-title">Uno stile <em>riconoscibile.</em></h1><p className="page-description">Le quattro fotografie che definiscono luce, composizione e atmosfera di ogni scatto.</p></div><button className="secondary-button" onClick={() => setTab("studio")}><ArrowLeft size={16} /> Torna allo studio</button></div>
        <div className="reference-banner"><div><span className="banner-kicker">IL DNA VISIVO DI ADAMANTE</span><h2>Un riferimento per ogni prospettiva.</h2><p>Carica le quattro fotografie che hai scelto come standard. Verranno conservate in questo browser e utilizzate automaticamente per ogni nuovo gioiello.</p></div><div className="reference-banner-number">{String(configuredCount).padStart(2, "0")}<span>/ 04</span></div></div>
        <div className="reference-grid">
          {SHOTS.map((shot) => <article className="reference-card" key={shot.id}>
            <div className="reference-card-image">
              {references[shot.id] ? <img src={references[shot.id] as string} alt={"Reference per " + shot.title} /> : <div className="reference-empty"><ImagePlus size={34} strokeWidth={1.1} /><span>REFERENCE DA CARICARE</span></div>}
              <span className="reference-number">{shot.number} / 04</span>
            </div>
            <div className="reference-details"><div className="reference-card-title"><h3>{shot.title}</h3>{references[shot.id] ? <span className="reference-saved"><Check size={14} /> Salvata</span> : <span className="reference-missing">Mancante</span>}</div><p>{shot.referenceNote}</p><div className="reference-card-actions">
              <label className="reference-upload"><UploadCloud size={16} /> {references[shot.id] ? "Sostituisci" : "Carica reference"}<input type="file" accept="image/jpeg,image/png,image/webp,image/heic" hidden disabled={isGenerating} onChange={(e) => { void receiveReference(shot.id, e.target.files?.[0]); e.currentTarget.value = ""; }} /></label>
              {references[shot.id] && <button className="small-action" disabled={isGenerating} onClick={() => void deleteReference(shot.id)} aria-label={"Rimuovi " + shot.title}><Trash2 size={16} /></button>}
            </div></div>
          </article>)}
        </div>
        <div className="reference-guidance"><Info size={19} /><div><strong>Le reference guidano lo stile, non il prodotto.</strong><p>Per esempio, lo smeraldo verde delle immagini di esempio non verrà richiesto su un nuovo articolo. Le caratteristiche del nuovo gioiello vengono sempre dalla sua fotografia originale.</p></div></div>
      </>}

      {tab === "archive" && <>
        <div className="intro-row"><div><div className="eyebrow"><span className="eyebrow-line" /> ADAMANTE / COLLEZIONE</div><h1 className="page-title">Il tuo <em>archivio.</em></h1><p className="page-description">Ritrova le lavorazioni salvate in questo browser.</p></div><button className="secondary-button" onClick={() => { setTab("studio"); window.requestAnimationFrame(() => productInput.current?.click()); }}><Plus size={17} /> Nuovo progetto</button></div>
        <div className="archive-head"><span>{projects.length} LAVORAZIONI SALVATE</span><input className="archive-search" placeholder="Cerca per nome o codice..." value={archiveQuery} onChange={(e) => setArchiveQuery(e.target.value)} /></div>
        {archiveFiltered.length ? <div className="archive-grid">{archiveFiltered.map((item) => <article className="archive-card" key={item.id}>
          <button className="archive-cover" onClick={() => openProject(item)}>{item.results.hero ? <img src={item.results.hero} alt={item.title} /> : <img src={item.original} alt={item.title} />}</button>
          <div className="archive-body"><span>{formatDate(item.createdAt)} · {CATEGORIES.find((c) => c.value === item.category)?.label}</span><div className="archive-card-footer"><div><h3>{item.title}</h3><small>{SHOTS.filter((s) => item.results[s.id]).length} di 4 immagini</small></div><button className="small-action archive-delete" onClick={() => void removeArchiveProject(item)} aria-label={"Elimina " + item.title}><Trash2 size={16} /></button></div><button className="archive-open" onClick={() => openProject(item)}>Apri lavorazione <ChevronRight size={16} /></button></div>
        </article>)}</div> : <div className="archive-empty"><PackageOpen size={42} strokeWidth={1.2} /><h2>Nessuna lavorazione trovata</h2><p>Carica il tuo primo gioiello per iniziare.</p><button className="secondary-button" onClick={() => setTab("studio")}>Vai allo studio <ArrowRight size={16} /></button></div>}
        <div className="reference-guidance"><Info size={19} /><div><strong>Archivio conservato nel dispositivo.</strong><p>Le immagini non sono ancora sincronizzate tra computer o browser diversi. Per conservarle altrove scarica sempre il set fotografico finale.</p></div></div>
      </>}
    </div>

    <footer className="site-footer"><span>© ADAMANTE PHOTO STUDIO</span><div><span>FORMATO 1:1</span><span>PNG 1024 × 1024</span><span>AI-POWERED ATELIER</span></div><span>CREATO PER LA BELLEZZA DEI DETTAGLI</span></footer>

    {preview && <div className="lightbox" role="dialog" aria-modal="true" aria-label="Anteprima fotografia" onClick={() => setPreview(null)}><button className="lightbox-close" aria-label="Chiudi anteprima" onClick={() => setPreview(null)}><X size={24} /></button><img src={preview} alt="Anteprima della fotografia generata" onClick={(e) => e.stopPropagation()} /></div>}
  </div>;
}
