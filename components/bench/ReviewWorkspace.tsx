"use client";

import { useActionState, useEffect, useMemo, useRef, useState, useTransition } from "react";
import { approveFinding, dropFinding, editFinding, moveFinding, promoteFinding, publish } from "@/app/bench/actions";
import { pageLabel } from "@/components/FindingCard";
import { LENS_NAMES, type Citation, type Lens } from "@/engine/types";

export type WFinding = {
  id: string;
  checkId: string;
  checkName: string;
  lens: string;
  title: string;
  observed: string;
  likelyEffect: string;
  notYetProven: string;
  state: string;
  editReason: string | null;
  draftedBy: string;
  score: number;
  selected: boolean;
  mode: string;
  citation: Citation | null;
};

type WPage = { kind: string; url: string; httpStatus: number | null; mobileShot: string | null; desktopShot: string | null; mobileHeight: number | null; desktopHeight: number | null };

const REASONS: [string, string][] = [
  ["WORDING", "Wording: right finding, better phrasing"],
  ["SEVERITY", "Severity: right finding, wrong rank"],
  ["EVIDENCE_WRONG", "Evidence wrong: wrong element or page"],
  ["FALSE_POSITIVE", "False positive: nothing is actually wrong"],
  ["UNSAFE", "Unsafe: a claim we can't defend (suspends the check)"],
];

const fd = (obj: Record<string, string>) => {
  const f = new FormData();
  for (const [k, v] of Object.entries(obj)) f.set(k, v);
  return f;
};

export function ReviewWorkspace({ runId, canPublish, pages, shown, others, passes, unseen }: { runId: string; canPublish: boolean; pages: WPage[]; shown: WFinding[]; others: WFinding[]; passes: string[]; unseen: { id: string; name: string; why: string }[] }) {
  const all = useMemo(() => [...shown, ...others.filter((o) => o.state !== "DROPPED")], [shown, others]);
  const [activeId, setActiveId] = useState<string | null>(all[0]?.id ?? null);
  const [mode, setMode] = useState<null | "edit" | "drop">(null);
  const [pending, start] = useTransition();
  const active = all.find((f) => f.id === activeId) ?? null;

  const [pageKind, setPageKind] = useState<string>(active?.citation?.pageKind ?? pages[0]?.kind ?? "HOME");
  const [viewport, setViewport] = useState<"mobile" | "desktop">(active?.citation?.viewport ?? "mobile");
  useEffect(() => {
    if (active?.citation) {
      setPageKind(active.citation.pageKind);
      setViewport(active.citation.viewport === "desktop" ? "desktop" : "mobile");
    }
  }, [active?.id, active?.citation]);

  // Keyboard review: j/k move, a approve, e edit, d drop, p promote.
  useEffect(() => {
    const onKey = (e: KeyboardEvent) => {
      const t = e.target as HTMLElement;
      if (t.closest("input, textarea, select") || e.metaKey || e.ctrlKey || e.altKey) return;
      const i = all.findIndex((f) => f.id === activeId);
      if (e.key === "j" || e.key === "ArrowDown") { setActiveId(all[Math.min(all.length - 1, i + 1)]?.id ?? null); setMode(null); e.preventDefault(); }
      else if (e.key === "k" || e.key === "ArrowUp") { setActiveId(all[Math.max(0, i - 1)]?.id ?? null); setMode(null); e.preventDefault(); }
      else if (!active) return;
      else if (e.key === "a" && active.selected) { start(() => approveFinding(fd({ id: active.id }))); advance(active.id); }
      else if (e.key === "e" && active.selected) { setMode("edit"); e.preventDefault(); }
      else if (e.key === "d") { setMode("drop"); e.preventDefault(); }
      else if (e.key === "p" && !active.selected) start(() => promoteFinding(fd({ id: active.id })));
      else if (e.key === "Escape") setMode(null);
    };
    window.addEventListener("keydown", onKey);
    return () => window.removeEventListener("keydown", onKey);
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [all, activeId, active]);

  const undecided = shown.filter((f) => f.state === "DRAFT").length;

  // After a decision, move to the next finding that still needs one.
  const advance = (fromId: string) => {
    const next = shown.find((f) => f.id !== fromId && f.state === "DRAFT");
    if (next) setActiveId(next.id);
    setMode(null);
  };

  return (
    <div className="review">
      <Viewer pages={pages} kind={pageKind} setKind={setPageKind} viewport={viewport} setViewport={setViewport} active={active} />

      <div className="stack" style={{ ["--stack" as string]: "14px" }}>
        <div className="card card-pad spread" style={{ boxShadow: "none", padding: 16 }}>
          <p className="mini">
            <span className="kbd">j</span>/<span className="kbd">k</span> move · <span className="kbd">a</span> approve · <span className="kbd">e</span> edit · <span className="kbd">d</span> drop · <span className="kbd">p</span> promote
          </p>
          {canPublish ? <PublishForm runId={runId} undecided={undecided} /> : null}
        </div>

        <h3 style={{ fontSize: 16 }}>Shown to the founder ({shown.length}/3)</h3>
        {shown.length === 0 ? <p className="muted small">No findings selected. Publishing will send a clean report, or promote one below.</p> : null}
        {shown.map((f, i) => (
          <FindingEditor key={f.id} f={f} index={i} count={shown.length} active={f.id === activeId} onFocus={() => { setActiveId(f.id); }} mode={f.id === activeId ? mode : null} setMode={setMode} pending={pending} onDecided={() => advance(f.id)} />
        ))}

        <h3 style={{ fontSize: 16, marginTop: 12 }}>Also fired, not shown ({others.filter((o) => o.state !== "DROPPED").length})</h3>
        {others.map((f) => (
          <div key={f.id} className={`fcard${f.id === activeId ? " active" : ""}${f.state === "DROPPED" ? " dropped" : ""}`} onClick={() => setActiveId(f.id)}>
            <div className="spread">
              <span className="mini"><strong>{f.checkId}</strong> · {LENS_NAMES[f.lens as Lens]} · score {f.score}</span>
              {f.state === "DROPPED" ? <span className="state DROPPED">dropped · {f.editReason?.toLowerCase().replace("_", " ")}</span> : (
                <button className="btn btn-ghost btn-sm" disabled={pending || shown.length >= 3} onClick={(e) => { e.stopPropagation(); start(() => promoteFinding(fd({ id: f.id }))); }}>Promote</button>
              )}
            </div>
            <strong style={{ fontSize: 15 }}>{f.title}</strong>
            {f.id === activeId && f.citation ? <p className="snippet">{f.citation.snippet}</p> : null}
          </div>
        ))}

        <details className="more">
          <summary>Passed ({passes.length})</summary>
          <div className="row" style={{ gap: 6 }}>{passes.map((p) => <span className="chip pass status" key={p}>{p}</span>)}</div>
        </details>
        <details className="more">
          <summary>Not assessed: could not be observed ({unseen.length})</summary>
          <ul className="small muted" style={{ paddingLeft: 18 }}>{unseen.map((u) => <li key={u.id}><strong>{u.id}</strong> {u.name}: {u.why}</li>)}</ul>
        </details>
      </div>
    </div>
  );
}

function Viewer({ pages, kind, setKind, viewport, setViewport, active }: { pages: WPage[]; kind: string; setKind: (k: string) => void; viewport: "mobile" | "desktop"; setViewport: (v: "mobile" | "desktop") => void; active: WFinding | null }) {
  const frame = useRef<HTMLDivElement>(null);
  const page = pages.find((p) => p.kind === kind) ?? pages[0];
  const desktop = viewport === "desktop" && !!page?.desktopShot;
  const shot = desktop ? page?.desktopShot : page?.mobileShot;
  const width = desktop ? 1440 : 390;
  const height = (desktop ? page?.desktopHeight : page?.mobileHeight) ?? 844;
  const box = active?.citation && active.citation.pageKind === page?.kind && (active.citation.viewport ?? "mobile") === (desktop ? "desktop" : "mobile") ? active.citation.box : undefined;

  useEffect(() => {
    const el = frame.current;
    if (!el) return;
    const canvas = el.querySelector(".canvas") as HTMLElement | null;
    const scale = canvas ? canvas.clientWidth / width : 1;
    el.scrollTo({ top: box ? Math.max(0, box.y * scale - el.clientHeight / 3) : 0, behavior: "smooth" });
  }, [box, kind, viewport, width]);

  return (
    <div className="viewer">
      <div className="viewer-tabs">
        {pages.map((p) => (
          <button key={p.kind} className={p.kind === page?.kind ? "on" : ""} onClick={() => setKind(p.kind)} title={p.url}>
            {pageLabel(p.kind)}{p.httpStatus && p.httpStatus >= 400 ? ` (${p.httpStatus})` : ""}
          </button>
        ))}
      </div>
      <div className="spread">
        <span className="mini" style={{ overflowWrap: "anywhere" }}>{page?.url}</span>
        <div className="viewer-tabs">
          <button className={!desktop ? "on" : ""} onClick={() => setViewport("mobile")}>Phone</button>
          <button className={desktop ? "on" : ""} onClick={() => setViewport("desktop")} disabled={!page?.desktopShot}>Desktop</button>
        </div>
      </div>
      <div className="viewer-frame" ref={frame}>
        {shot ? (
          <div className="canvas" style={{ maxWidth: desktop ? "100%" : 390 }}>
            {/* eslint-disable-next-line @next/next/no-img-element */}
            <img src={`/e/${shot}`} alt={`${pageLabel(page!.kind)} screenshot`} />
            {box ? <div className="hl" style={{ left: `${(box.x / width) * 100}%`, top: `${(box.y / height) * 100}%`, width: `${(box.w / width) * 100}%`, height: `${(box.h / height) * 100}%` }} /> : null}
          </div>
        ) : (
          <p className="muted small" style={{ padding: 20 }}>No screenshot for this page.</p>
        )}
      </div>
    </div>
  );
}

function FindingEditor({ f, index, count, active, onFocus, mode, setMode, pending, onDecided }: { f: WFinding; index: number; count: number; active: boolean; onFocus: () => void; mode: null | "edit" | "drop"; setMode: (m: null | "edit" | "drop") => void; pending: boolean; onDecided: () => void }) {
  const [editState, editAction, editing] = useActionState(editFinding, {} as { error?: string; ok?: boolean });
  const [dropState, dropAction, dropping] = useActionState(dropFinding, {} as { error?: string; ok?: boolean });
  const [, start] = useTransition();
  useEffect(() => {
    if (editState.ok || dropState.ok) onDecided();
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [editState, dropState]);

  return (
    <div className={`fcard${active ? " active" : ""}`} onClick={onFocus}>
      <div className="spread">
        <span className="mini">
          <strong>#{index + 1}</strong> · <strong>{f.checkId}</strong> · {LENS_NAMES[f.lens as Lens]} · score {f.score} · <span title="Check mode">{f.mode}</span> · {f.draftedBy === "claude" ? "AI-worded" : "template"}
        </span>
        <span className={`state ${f.state}`}>{f.state === "DRAFT" ? "needs decision" : f.state.toLowerCase()}{f.editReason ? ` · ${f.editReason.toLowerCase().replace("_", " ")}` : ""}</span>
      </div>

      {mode === "edit" ? (
        <form action={editAction} className="stack" style={{ ["--stack" as string]: "10px" }} onClick={(e) => e.stopPropagation()}>
          <input type="hidden" name="id" value={f.id} />
          <div className="field"><label>Title</label><input name="title" className="input" defaultValue={f.title} autoFocus /></div>
          <div className="field"><label>What we saw</label><textarea name="observed" className="textarea" defaultValue={f.observed} /></div>
          <div className="field"><label>Likely effect</label><textarea name="likelyEffect" className="textarea" defaultValue={f.likelyEffect} /></div>
          <div className="field"><label>Not yet proven</label><textarea name="notYetProven" className="textarea" defaultValue={f.notYetProven} /></div>
          <ReasonFields />
          {editState.error ? <p className="form-error">{editState.error}</p> : null}
          <div className="row"><button className="btn btn-primary btn-sm" disabled={editing}>Save edit</button><button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode(null)}>Cancel</button></div>
        </form>
      ) : (
        <>
          <h3>{f.title}</h3>
          <div className="facet observed"><span className="label">What we saw</span><p>{f.observed}</p></div>
          <div className="facet"><span className="label">Likely effect</span><p>{f.likelyEffect}</p></div>
          <div className="facet"><span className="label">Not yet proven</span><p>{f.notYetProven}</p></div>
          {f.citation ? <p className="snippet"><strong style={{ fontStyle: "normal" }}>{pageLabel(f.citation.pageKind)}:</strong> {f.citation.snippet}</p> : null}
        </>
      )}

      {mode === "drop" ? (
        <form action={dropAction} className="stack" style={{ ["--stack" as string]: "10px" }} onClick={(e) => e.stopPropagation()}>
          <input type="hidden" name="id" value={f.id} />
          <ReasonFields drop />
          {dropState.error ? <p className="form-error">{dropState.error}</p> : null}
          <div className="row"><button className="btn btn-danger btn-sm" disabled={dropping}>Drop finding</button><button type="button" className="btn btn-quiet btn-sm" onClick={() => setMode(null)}>Cancel</button></div>
        </form>
      ) : null}

      {mode === null ? (
        <div className="row" style={{ gap: 6 }} onClick={(e) => e.stopPropagation()}>
          <button className="btn btn-primary btn-sm" disabled={pending} onClick={() => { start(() => approveFinding(fd({ id: f.id }))); onDecided(); }}>Approve</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFocus(); setMode("edit"); }}>Edit</button>
          <button className="btn btn-ghost btn-sm" onClick={() => { onFocus(); setMode("drop"); }}>Drop</button>
          <span style={{ flex: 1 }} />
          <button className="btn btn-quiet btn-sm" aria-label="Move up" disabled={index === 0} onClick={() => start(() => moveFinding(fd({ id: f.id, dir: "up" })))}>↑</button>
          <button className="btn btn-quiet btn-sm" aria-label="Move down" disabled={index === count - 1} onClick={() => start(() => moveFinding(fd({ id: f.id, dir: "down" })))}>↓</button>
        </div>
      ) : null}
    </div>
  );
}

function ReasonFields({ drop = false }: { drop?: boolean }) {
  return (
    <div className="split" style={{ gap: 10 }}>
      <div className="field">
        <label>Reason (required)</label>
        <select name="reason" className="select" required defaultValue="">
          <option value="" disabled>Choose…</option>
          {REASONS.filter(([k]) => (drop ? k !== "WORDING" : true)).map(([k, l]) => <option key={k} value={k}>{l}</option>)}
        </select>
      </div>
      <div className="field"><label>Note (optional)</label><input name="note" className="input" placeholder="What was wrong?" /></div>
    </div>
  );
}

function PublishForm({ runId, undecided }: { runId: string; undecided: number }) {
  const [state, action, pending] = useActionState(publish, {} as { error?: string });
  return (
    <form action={action} className="row">
      <input type="hidden" name="runId" value={runId} />
      {state.error ? <span className="mini" style={{ color: "var(--danger)" }}>{state.error}</span> : null}
      <button className="btn btn-primary btn-sm" disabled={pending || undecided > 0} title={undecided ? "Decide on every shown finding first" : "Publish and email"}>
        {pending ? "Publishing…" : undecided ? `${undecided} to decide` : "Publish & send"}
      </button>
    </form>
  );
}
