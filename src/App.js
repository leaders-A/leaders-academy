import { useState, useRef } from "react";

// ── API ──────────────────────────────────────────────────────
// Vercel 서버리스 함수를 통해 호출 (API 키 보안 유지)
async function callClaude(system, messages) {
  const res = await fetch("/api/claude", {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify({
      model: "claude-sonnet-4-20250514",
      max_tokens: 8000,
      system,
      messages,
    }),
  });
  if (!res.ok) {
    const err = await res.json().catch(() => ({}));
    throw new Error(err.error || `API 오류: ${res.status}`);
  }
  const d = await res.json();
  return d.content?.[0]?.text || "";
}

function fileToBase64(file) {
  return new Promise((res, rej) => {
    const r = new FileReader();
    r.onload = () => res(r.result.split(",")[1]);
    r.onerror = () => rej(new Error("파일 읽기 실패"));
    r.readAsDataURL(file);
  });
}

function extractHtmlText(html) {
  const doc = new DOMParser().parseFromString(html, "text/html");
  doc.querySelectorAll("script,style").forEach(el => el.remove());
  return doc.body.innerText || doc.body.textContent || "";
}

function cleanForPrint(t) {
  return t
    .replace(/[\u{1F300}-\u{1FFFF}]/gu, "")
    .replace(/[━─=＝]{2,}/g, "")
    .replace(/[•·▶▷◆■●★☆※]/g, "")
    .replace(/\n{3,}/g, "\n\n")
    .trim();
}

function today() { return new Date().toLocaleDateString("ko-KR"); }

// ── 상수 ─────────────────────────────────────────────────────
const TRACKS = ["공대·IT계열", "자연과학계열", "의약·생명계열", "인문·사회계열", "경상·경영계열", "예체능계열"];
const ADM_TYPES = ["일반전형", "농어촌전형", "사회배려자전형", "특기자전형"];
const RURAL_PERIODS = [
  "중학교 3년 (학생만)",
  "중학교 3년 + 고등학교 3년 (총 6년, 학생+부모)",
  "초등학교 + 중학교 + 고등학교 (12년)",
];
const MAX_PDF_MB = 20;

// ── 농어촌 대학 목록 ─────────────────────────────────────────
const RURAL_UNIVS = [
  { tier: "최상위권", color: "#ef4444", bg: "rgba(239,68,68,0.08)", border: "rgba(239,68,68,0.25)",
    schools: [
      { name: "서울대학교", note: "농어촌학생 특별전형", cut: "1등급대" },
      { name: "연세대학교", note: "농어촌학생 특별전형", cut: "1~2등급대" },
      { name: "고려대학교", note: "농어촌학생 특별전형", cut: "1~2등급대" },
      { name: "성균관대학교", note: "농어촌학생 특별전형", cut: "2등급대" },
    ]
  },
  { tier: "상위권", color: "#f97316", bg: "rgba(249,115,22,0.08)", border: "rgba(249,115,22,0.25)",
    schools: [
      { name: "한양대학교", note: "농어촌학생 특별전형", cut: "2등급대" },
      { name: "경희대학교", note: "농어촌학생 특별전형", cut: "2~3등급대" },
      { name: "중앙대학교", note: "농어촌학생 특별전형", cut: "2~3등급대" },
      { name: "이화여자대학교", note: "농어촌학생 특별전형", cut: "2등급대" },
      { name: "서강대학교", note: "농어촌학생 특별전형", cut: "2등급대" },
      { name: "한국외국어대학교", note: "농어촌학생 특별전형", cut: "2~3등급대" },
    ]
  },
  { tier: "중상위권", color: "#eab308", bg: "rgba(234,179,8,0.08)", border: "rgba(234,179,8,0.25)",
    schools: [
      { name: "건국대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
      { name: "동국대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
      { name: "숭실대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "세종대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
      { name: "국민대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "홍익대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
      { name: "아주대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
      { name: "인하대학교", note: "농어촌학생 특별전형", cut: "3등급대" },
    ]
  },
  { tier: "중위권 / 국립대", color: "#22c55e", bg: "rgba(34,197,94,0.08)", border: "rgba(34,197,94,0.25)",
    schools: [
      { name: "강원대학교", note: "농어촌 + 지역인재 중복 가능", cut: "3~5등급대" },
      { name: "충북대학교", note: "농어촌학생 특별전형", cut: "3~5등급대" },
      { name: "충남대학교", note: "농어촌학생 특별전형", cut: "3~5등급대" },
      { name: "전북대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
      { name: "전남대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
      { name: "경북대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "경상국립대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
      { name: "제주대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
      { name: "한국교원대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "공주대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
    ]
  },
  { tier: "수도권 중위권", color: "#60a5fa", bg: "rgba(96,165,250,0.08)", border: "rgba(96,165,250,0.25)",
    schools: [
      { name: "가톨릭대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "단국대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "명지대학교", note: "농어촌학생 특별전형", cut: "4등급대" },
      { name: "성신여자대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "덕성여자대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "광운대학교", note: "농어촌학생 특별전형", cut: "3~4등급대" },
      { name: "서울시립대학교", note: "농어촌학생 특별전형", cut: "2~3등급대" },
      { name: "한성대학교", note: "농어촌학생 특별전형", cut: "4~5등급대" },
    ]
  },
];

const TABS = [
  { key: "analysis", label: "생기부 분석", icon: "📋" },
  { key: "university", label: "대학 맞춤 추천", icon: "🏫" },
  { key: "rural", label: "농어촌전형 대학", icon: "🌾" },
];

// ── 스타일 ─────────────────────────────────────────────────────
const C = { gold: "#C9A84C", goldLight: "#e8c96a", navy: "#0B1E3D", navyMid: "#1a1d2e", navyDark: "#0f1117", border: "#2a2d3e", borderLight: "#3a3d50", text: "#e2e8f0", textSub: "#94a3b8", textMuted: "#64748b" };
const S = {
  root: { fontFamily: "'Noto Sans KR', sans-serif", background: C.navyDark, minHeight: "100vh", color: C.text },
  header: { background: C.navyMid, borderBottom: `1px solid ${C.border}`, padding: "0 28px", display: "flex", alignItems: "center", height: 62, position: "sticky", top: 0, zIndex: 50 },
  logoWrap: { display: "flex", alignItems: "center", gap: 12, marginRight: 32 },
  logoMark: { width: 40, height: 40, background: `linear-gradient(135deg, ${C.navy}, #1a3560)`, border: "1.5px solid rgba(201,168,76,0.55)", borderRadius: 10, display: "flex", flexDirection: "column", alignItems: "center", justifyContent: "center", boxShadow: "0 0 14px rgba(201,168,76,0.12)", position: "relative", overflow: "hidden" },
  tabs: { display: "flex", gap: 2, flex: 1 },
  tab: (a) => ({ padding: "0 22px", height: 62, display: "flex", alignItems: "center", gap: 6, cursor: "pointer", fontSize: 13, fontWeight: a ? 700 : 500, color: a ? C.gold : C.textSub, background: "transparent", border: "none", borderBottom: a ? `2px solid ${C.gold}` : "2px solid transparent", fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" }),
  body: { maxWidth: 920, margin: "0 auto", padding: "28px 20px" },
  card: { background: C.navyMid, border: `1px solid ${C.border}`, borderRadius: 14, padding: "20px 22px", marginBottom: 14 },
  stepLabel: (c) => ({ display: "inline-flex", alignItems: "center", background: c || C.gold, color: C.navyDark, fontSize: 10, fontWeight: 900, padding: "3px 12px", borderRadius: 20 }),
  stepTitle: { display: "inline", fontSize: 13, fontWeight: 700, color: C.text, marginLeft: 8 },
  label: { fontSize: 11, fontWeight: 600, color: C.textSub, marginBottom: 6, display: "block" },
  input: { width: "100%", padding: "10px 14px", background: "#252838", border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", boxSizing: "border-box" },
  select: { width: "100%", padding: "10px 14px", background: "#252838", border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", boxSizing: "border-box" },
  textarea: { width: "100%", padding: "10px 14px", background: "#252838", border: `1px solid ${C.borderLight}`, borderRadius: 8, color: C.text, fontSize: 13, fontFamily: "'Noto Sans KR', sans-serif", outline: "none", resize: "vertical", boxSizing: "border-box", lineHeight: 1.7 },
  chip: (a) => ({ padding: "8px 14px", borderRadius: 8, cursor: "pointer", fontSize: 13, fontWeight: a ? 700 : 500, background: a ? "#7c3aed" : "#252838", color: a ? "#e2e8f0" : C.textSub, border: a ? "2px solid #a78bfa" : `2px solid ${C.borderLight}`, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s", flex: 1 }),
  trackChip: (a) => ({ padding: "7px 12px", borderRadius: 8, cursor: "pointer", fontSize: 12, fontWeight: a ? 700 : 400, background: a ? "rgba(201,168,76,0.18)" : "#252838", color: a ? C.goldLight : C.textSub, border: a ? `1.5px solid ${C.gold}` : `1.5px solid ${C.borderLight}`, fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s" }),
  btn: { width: "100%", padding: 15, background: `linear-gradient(90deg, ${C.gold}, ${C.goldLight})`, border: "none", borderRadius: 12, color: C.navyDark, fontSize: 14, fontWeight: 900, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif", marginTop: 6 },
  result: { background: "#141624", border: `1px solid ${C.border}`, borderRadius: 12, padding: 20, marginTop: 14, fontSize: 13, lineHeight: 2, color: "#cbd5e1", whiteSpace: "pre-wrap" },
  loading: { textAlign: "center", padding: "36px 0", color: C.gold, fontSize: 13 },
  watermark: { marginTop: 8, padding: "7px 14px", background: "rgba(201,168,76,0.06)", borderLeft: `3px solid ${C.gold}`, borderRadius: 8, fontSize: 10, color: C.textMuted },
  printBtn: { padding: "7px 16px", background: "#1e40af", border: "none", borderRadius: 8, color: "#fff", fontSize: 11, fontWeight: 700, cursor: "pointer", fontFamily: "'Noto Sans KR', sans-serif" },
  resultHeader: { display: "flex", justifyContent: "space-between", alignItems: "center", marginBottom: 12 },
};

// ── 나이스 업로드 ────────────────────────────────────────────
function NeisUploader({ uploadState, onFileLoaded, onClear }) {
  const inputRef = useRef(null);
  const [dragOver, setDragOver] = useState(false);

  const handleFile = async (file) => {
    if (!file) return;
    const ext = file.name.split(".").pop().toLowerCase();
    if (!["pdf", "html", "htm"].includes(ext)) { alert("PDF 또는 HTML 파일만 가능합니다."); return; }
    if (ext === "pdf" && file.size / 1024 / 1024 > MAX_PDF_MB) { alert(`PDF는 최대 ${MAX_PDF_MB}MB까지 가능합니다.`); return; }
    onFileLoaded({ status: "loading", name: file.name, type: ext, sizeMB: (file.size / 1024 / 1024).toFixed(1) });
    try {
      if (ext === "pdf") {
        const b64 = await fileToBase64(file);
        onFileLoaded({ status: "ready", name: file.name, type: "pdf", b64, sizeMB: (file.size / 1024 / 1024).toFixed(1) });
      } else {
        const text = extractHtmlText(await file.text());
        if (!text || text.trim().length < 50) { alert("HTML에서 내용을 추출하지 못했습니다. PDF로 시도하세요."); onFileLoaded(null); return; }
        onFileLoaded({ status: "ready", name: file.name, type: "html", text, sizeMB: (file.size / 1024 / 1024).toFixed(1) });
      }
    } catch { alert("파일 읽기 오류. 다시 시도하세요."); onFileLoaded(null); }
  };

  const isReady = uploadState?.status === "ready";
  const isLoading = uploadState?.status === "loading";
  const isPDF = uploadState?.type === "pdf";

  return (
    <div>
      {/* 안내 배너 */}
      <div style={{ background: "rgba(59,130,246,0.07)", border: "1px solid rgba(59,130,246,0.22)", borderRadius: 10, padding: "11px 15px", marginBottom: 12, display: "flex", gap: 10 }}>
        <div style={{ fontSize: 18, flexShrink: 0 }}>📌</div>
        <div style={{ display: "grid", gridTemplateColumns: "1fr 1fr", gap: "2px 20px", fontSize: 11, color: C.textSub, lineHeight: 1.9 }}>
          <div><span style={{ color: "#60a5fa", fontWeight: 700 }}>PDF 저장 (권장)</span><br />나이스 → 학생생활기록부 → 인쇄 → PDF로 저장</div>
          <div><span style={{ color: "#a78bfa", fontWeight: 700 }}>HTML 저장 (대안)</span><br />생기부 화면 → 브라우저 다른이름으로저장 → .html</div>
        </div>
      </div>

      {!isReady ? (
        <div
          onDrop={e => { e.preventDefault(); setDragOver(false); handleFile(e.dataTransfer.files[0]); }}
          onDragOver={e => { e.preventDefault(); setDragOver(true); }}
          onDragLeave={() => setDragOver(false)}
          onClick={() => inputRef.current?.click()}
          style={{ border: `2px dashed ${dragOver ? C.gold : isLoading ? "#3b82f6" : C.borderLight}`, borderRadius: 12, padding: "32px 20px", textAlign: "center", cursor: isLoading ? "default" : "pointer", background: dragOver ? "rgba(201,168,76,0.05)" : C.navyMid, transition: "all 0.2s" }}
        >
          {isLoading ? (
            <div>
              <div style={{ fontSize: 28, marginBottom: 8 }}>⏳</div>
              <div style={{ fontSize: 13, fontWeight: 700, color: "#60a5fa" }}>PDF 파일 불러오는 중...</div>
              <div style={{ fontSize: 11, color: C.textSub, marginTop: 4 }}>{uploadState.name} · {uploadState.sizeMB}MB</div>
            </div>
          ) : (
            <div>
              <div style={{ display: "flex", justifyContent: "center", gap: 10, marginBottom: 10 }}>
                <span style={{ padding: "5px 12px", background: "rgba(239,68,68,0.1)", border: "1px solid rgba(239,68,68,0.25)", borderRadius: 6, fontSize: 11, color: "#fca5a5", fontWeight: 700 }}>PDF</span>
                <span style={{ padding: "5px 12px", background: "rgba(168,85,247,0.1)", border: "1px solid rgba(168,85,247,0.25)", borderRadius: 6, fontSize: 11, color: "#c4b5fd", fontWeight: 700 }}>HTML</span>
              </div>
              <div style={{ fontSize: 13, fontWeight: 700, color: dragOver ? C.gold : C.text, marginBottom: 4 }}>{dragOver ? "여기에 놓으세요!" : "나이스 생기부 파일 업로드"}</div>
              <div style={{ fontSize: 11, color: C.textSub }}>드래그하거나 클릭 · 최대 {MAX_PDF_MB}MB</div>
            </div>
          )}
          <input ref={inputRef} type="file" accept=".pdf,.html,.htm" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) handleFile(e.target.files[0]); e.target.value = ""; }} />
        </div>
      ) : (
        <div style={{ background: isPDF ? "rgba(239,68,68,0.07)" : "rgba(168,85,247,0.07)", border: `1px solid ${isPDF ? "rgba(239,68,68,0.25)" : "rgba(168,85,247,0.25)"}`, borderRadius: 12, padding: "14px 18px", display: "flex", alignItems: "center", gap: 12 }}>
          <div style={{ fontSize: 28 }}>{isPDF ? "📄" : "🌐"}</div>
          <div style={{ flex: 1 }}>
            <div style={{ display: "flex", alignItems: "center", gap: 8, marginBottom: 3 }}>
              <span style={{ fontSize: 13, fontWeight: 700, color: "#34d399" }}>생기부 파일 로드 완료</span>
              <span style={{ fontSize: 10, fontWeight: 800, padding: "1px 7px", borderRadius: 10, background: isPDF ? "rgba(239,68,68,0.15)" : "rgba(168,85,247,0.15)", color: isPDF ? "#fca5a5" : "#c4b5fd" }}>{isPDF ? "PDF" : "HTML"}</span>
            </div>
            <div style={{ fontSize: 11, color: C.textSub }}>{uploadState.name} · {uploadState.sizeMB}MB</div>
            <div style={{ fontSize: 10, color: C.textMuted, marginTop: 2 }}>AI가 파일 전체를 직접 읽어 성적 및 세특을 자동 추출합니다</div>
          </div>
          <div style={{ display: "flex", flexDirection: "column", gap: 5 }}>
            <button onClick={() => inputRef.current?.click()} style={{ padding: "5px 12px", background: "transparent", border: `1px solid ${C.borderLight}`, borderRadius: 7, color: C.textSub, cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans KR', sans-serif" }}>교체</button>
            <button onClick={onClear} style={{ padding: "5px 12px", background: "transparent", border: "1px solid #ef4444", borderRadius: 7, color: "#f87171", cursor: "pointer", fontSize: 11, fontWeight: 700, fontFamily: "'Noto Sans KR', sans-serif" }}>삭제</button>
          </div>
          <input ref={inputRef} type="file" accept=".pdf,.html,.htm" style={{ display: "none" }} onChange={e => { if (e.target.files[0]) { onClear(); handleFile(e.target.files[0]); } e.target.value = ""; }} />
        </div>
      )}
      <style>{`@keyframes spin{from{transform:rotate(0deg)}to{transform:rotate(360deg)}}`}</style>
    </div>
  );
}

// ── 메인 앱 ─────────────────────────────────────────────────
export default function App() {
  const [tab, setTab] = useState("analysis");
  return (
    <div style={S.root}>
      <link href="https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;600;700;900&family=Playfair+Display:wght@700;900&family=Cormorant+Garamond:wght@600;700&display=swap" rel="stylesheet" />
      <div style={S.header}>
        <div style={S.logoWrap}>
          <div style={S.logoMark}>
            <div style={{ position: "absolute", top: 0, left: 0, right: 0, height: 2, background: "linear-gradient(90deg,transparent,#C9A84C,transparent)" }} />
            <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 13, fontWeight: 900, color: C.gold, letterSpacing: 1 }}>L</span>
            <div style={{ width: 16, height: 1, background: "rgba(201,168,76,0.45)", margin: "2px 0" }} />
            <span style={{ fontFamily: "'Noto Sans KR',sans-serif", fontSize: 7, fontWeight: 700, color: "rgba(201,168,76,0.65)", letterSpacing: 2 }}>ACE</span>
          </div>
          <div>
            <div style={{ display: "flex", alignItems: "baseline", gap: 6 }}>
              <span style={{ fontFamily: "'Playfair Display',serif", fontSize: 18, fontWeight: 900, background: `linear-gradient(90deg,${C.goldLight},${C.gold},#f0d878)`, WebkitBackgroundClip: "text", WebkitTextFillColor: "transparent", letterSpacing: 1.5 }}>LEADERS</span>
              <span style={{ fontFamily: "'Cormorant Garamond',serif", fontSize: 12, fontWeight: 600, color: "rgba(201,168,76,0.6)", letterSpacing: 3 }}>Academy</span>
            </div>
            <div style={{ fontSize: 10, color: C.textMuted, letterSpacing: 1, marginTop: 1 }}>입시 분석 시스템</div>
          </div>
        </div>
        <div style={S.tabs}>
          {TABS.map(t => (
            <button key={t.key} style={S.tab(tab === t.key)} onClick={() => setTab(t.key)}>
              {t.icon} {t.label}
            </button>
          ))}
        </div>
        <div style={{ marginLeft: "auto", fontSize: 11, color: C.textMuted, whiteSpace: "nowrap" }}>
          남양주 화도읍 마석로 59 · 511-0984
        </div>
      </div>
      <div style={S.body}>
        {tab === "analysis"    && <AnalysisTab />}
        {tab === "university"  && <UniversityTab />}
        {tab === "rural"       && <RuralTab />}
      </div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 1: 생기부 분석
// ════════════════════════════════════════════════════════════
function AnalysisTab() {
  const [name, setName]           = useState("");
  const [school, setSchool]       = useState("심석고등학교");
  const [grade, setGrade]         = useState("고2");
  const [track, setTrack]         = useState("공대·IT계열");
  const [admType, setAdmType]     = useState("일반전형");
  const [majors, setMajors]       = useState([{u:"",m:""},{u:"",m:""},{u:"",m:""}]);
  const [uploadState, setUploadState] = useState(null);
  const [naesin, setNaesin]       = useState({ korean:"", math:"", english:"", science:"", social:"" });
  const [sespec, setSespec]       = useState("");
  const [extraAct, setExtraAct]   = useState("");
  const [loading, setLoading]     = useState(false);
  const [result, setResult]       = useState("");

  const hasFile = uploadState?.status === "ready";
  const nextGrade = grade === "고1" ? "고2" : grade === "고2" ? "고3" : null;

  const buildMessages = () => {
    const majorStr = majors.filter(m => m.u||m.m).map((m,i)=>`${i+1}지망: ${m.u} ${m.m}`).join(", ") || "미입력";
    const ctx = `학생: ${name||"익명"} / ${school} ${grade} / ${track} / ${admType}\n희망진로: ${majorStr}`;
    const extractInstr = `\n[성적 자동 추출 지시]\n파일에서 학기별 전 과목(과목명, 단위수, 원점수, 석차등급)을 직접 읽어 정리하세요.\n전체 이수단위 가중 평균 등급도 계산해 분석 첫 항목에 출력하세요.\n`;
    const prompt = buildAnalysisPrompt(track, admType, grade, nextGrade);
    if (hasFile && uploadState.type === "pdf")
      return [{ role:"user", content:[{ type:"document", source:{ type:"base64", media_type:"application/pdf", data:uploadState.b64 } }, { type:"text", text:`[리더스학원 생기부 분석]\n${ctx}${extractInstr}\n추가요청: ${sespec||"없음"}\n\n${prompt}` }] }];
    if (hasFile && uploadState.type === "html")
      return [{ role:"user", content:`[리더스학원 생기부 분석]\n${ctx}${extractInstr}\n【생기부 HTML】\n${uploadState.text.slice(0,7000)}\n\n추가요청: ${sespec||"없음"}\n\n${prompt}` }];
    const naesinStr = `국어${naesin.korean||"-"} / 수학${naesin.math||"-"} / 영어${naesin.english||"-"} / 과학${naesin.science||"-"} / 사회${naesin.social||"-"}`;
    return [{ role:"user", content:`[리더스학원 생기부 분석 (수동입력)]\n${ctx}\n내신: ${naesinStr}\n세특: ${sespec||"미입력"}\n비교과: ${extraAct||"미입력"}\n\n${prompt}` }];
  };

  const handleSubmit = async () => {
    setLoading(true); setResult("");
    try {
      const sys = `당신은 15년 경력 대입 컨설턴트이자 전 입학사정관입니다.
2025~2026 학종 평가 기준으로 생활기록부 전체를 항목별로 정밀 분석합니다.

[절대 준수 규칙]
1. 이모지, 특수기호(━ - = * #), 목록기호(• ▶ ★), 체크마크(✅ ⚠️) 절대 사용 금지
2. 항목 구분은 반드시 [번호. 제목] 형식으로만 하세요
3. 하위 항목은 가) 나) 다) 또는 1) 2) 3) 형식으로만 구분하세요
4. 파일이 첨부된 경우 생기부 실제 내용을 직접 인용하여 근거로 활용하세요
5. 각 항목마다 평가 등급(우수/양호/보통/미흡)을 반드시 명시하세요
6. 구체적인 근거 없는 막연한 평가는 절대 금지 — 반드시 생기부 내용을 인용하여 평가하세요
7. 학종 입학사정관 관점에서 실질적으로 도움이 되는 구체적 개선 방향을 제시하세요
8. ${track} 계열 특성과 ${admType}을 모든 평가에 반영하세요
9. 현재 학년은 ${grade}입니다${nextGrade ? ` — 반드시 ${nextGrade} 전략을 마지막 파트에 별도로 상세히 제안하세요` : ""}`;
      setResult(await callClaude(sys, buildMessages()));
    } catch { setResult("분석 중 오류가 발생했습니다."); }
    setLoading(false);
  };

  const handlePrint = () => {
    const majorStr = majors.filter(m=>m.u||m.m).map((m,i)=>`${i+1}지망: ${m.u} ${m.m}`).join(" / ") || "-";
    printAnalysis(result, { name, school, grade, track, admType, majorStr, fileUsed: hasFile ? uploadState.name : null, nextGrade });
  };

  return (
    <div>
      {/* STEP 1 */}
      <div style={S.card}>
        <div style={{ marginBottom: 16 }}><span style={S.stepLabel()}>STEP 1</span><span style={S.stepTitle}>학생 기본 정보</span></div>
        <div style={{ display: "grid", gridTemplateColumns: "repeat(4,1fr)", gap: 14, marginBottom: 14 }}>
          <div><label style={S.label}>학생 이름</label><input style={S.input} value={name} onChange={e=>setName(e.target.value)} placeholder="이름 (익명 가능)" /></div>
          <div><label style={S.label}>학교</label>
            <select style={S.select} value={school} onChange={e=>setSchool(e.target.value)}>
              {["심석고등학교","마석고등학교","기타"].map(s=><option key={s}>{s}</option>)}
            </select></div>
          <div><label style={S.label}>학년</label>
            <select style={S.select} value={grade} onChange={e=>setGrade(e.target.value)}>
              {["고1","고2","고3"].map(g=><option key={g}>{g}</option>)}
            </select></div>
          <div><label style={S.label}>전형 유형</label>
            <select style={S.select} value={admType} onChange={e=>setAdmType(e.target.value)}>
              {ADM_TYPES.map(t=><option key={t}>{t}</option>)}
            </select></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>희망 계열</label>
          <div style={{ display: "flex", gap: 8, flexWrap: "wrap" }}>
            {TRACKS.map(t => <button key={t} style={S.trackChip(track===t)} onClick={()=>setTrack(t)}>{t}</button>)}
          </div>
        </div>
        <div>
          <label style={S.label}>희망 대학 / 학과 (1~3지망)</label>
          {majors.map((m,i) => (
            <div key={i} style={{ display:"flex", gap:8, alignItems:"center", marginBottom:8 }}>
              <span style={{ fontSize:11, color:C.textSub, minWidth:32 }}>{i+1}지망</span>
              <input style={{...S.input, flex:1}} placeholder="대학교" value={m.u} onChange={e=>{const a=[...majors];a[i]={...a[i],u:e.target.value};setMajors(a);}} />
              <input style={{...S.input, flex:1}} placeholder="학과/전공" value={m.m} onChange={e=>{const a=[...majors];a[i]={...a[i],m:e.target.value};setMajors(a);}} />
            </div>
          ))}
        </div>
      </div>

      {/* STEP 2: 나이스 업로드 */}
      <div style={S.card}>
        <div style={{ marginBottom: 14 }}>
          <span style={S.stepLabel("#1d4ed8")}>STEP 2</span>
          <span style={S.stepTitle}>나이스(NEIS) 생기부 파일 업로드</span>
          <span style={{ marginLeft:10, fontSize:10, background:"rgba(29,78,216,0.18)", color:"#60a5fa", padding:"2px 10px", borderRadius:10, fontWeight:700 }}>권장</span>
        </div>
        <NeisUploader uploadState={uploadState} onFileLoaded={setUploadState} onClear={()=>setUploadState(null)} />
      </div>

      {/* STEP 3 */}
      {!hasFile ? (
        <div style={S.card}>
          <div style={{ marginBottom: 14 }}><span style={S.stepLabel("#374151")}>STEP 3</span><span style={S.stepTitle}>직접 입력 (파일 없을 때)</span></div>
          <div style={{ display:"grid", gridTemplateColumns:"repeat(5,1fr)", gap:12, marginBottom:14 }}>
            {[["korean","국어"],["math","수학"],["english","영어"],["science","과학"],["social","사회"]].map(([k,lbl])=>(
              <div key={k}><label style={S.label}>{lbl} 등급</label>
                <input style={S.input} placeholder="예: 2.3" value={naesin[k]} onChange={e=>setNaesin(n=>({...n,[k]:e.target.value}))} /></div>
            ))}
          </div>
          <div style={{ marginBottom:12 }}>
            <label style={S.label}>세특 주요 내용</label>
            <textarea style={{...S.textarea, height:70}} value={sespec} onChange={e=>setSespec(e.target.value)} placeholder="주요 과목 세특 내용..." />
          </div>
          <div>
            <label style={S.label}>비교과 활동</label>
            <textarea style={{...S.textarea, height:55}} value={extraAct} onChange={e=>setExtraAct(e.target.value)} placeholder="동아리, 봉사, 수상, 독서..." />
          </div>
        </div>
      ) : (
        <div style={S.card}>
          <div style={{ marginBottom: 12 }}>
            <span style={S.stepLabel("#374151")}>STEP 3</span>
            <span style={S.stepTitle}>추가 분석 요청사항 (선택)</span>
          </div>
          <div style={{ background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.22)", borderRadius:9, padding:"12px 14px", marginBottom:12 }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#34d399", marginBottom:8 }}>AI 성적 자동 추출 — 별도 입력 불필요</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:"4px 16px", fontSize:11, color:"#6ee7b7", lineHeight:1.9 }}>
              <div>1. 학기별 전 과목 이름 / 단위수 자동 읽기</div>
              <div>2. 원점수 / 평균 / 표준편차 자동 추출</div>
              <div>3. 석차등급 과목별 자동 정리</div>
              <div>4. 전체 이수단위 가중 평균등급 자동 계산</div>
            </div>
          </div>
          <label style={S.label}>중점 분석 요청 (선택)</label>
          <textarea style={{...S.textarea, height:55}} value={sespec} onChange={e=>setSespec(e.target.value)} placeholder="예: 수학 세특 개선 방향, 3학년 선택과목 전략..." />
        </div>
      )}

      {nextGrade && (
        <div style={{ padding:"10px 16px", background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.2)", borderRadius:8, marginBottom:14, fontSize:12, color:"#6ee7b7" }}>
          현재 {grade} 생기부를 분석하면 하단에 {nextGrade} 생기부 전략 및 방향 제안이 자동으로 포함됩니다.
        </div>
      )}

      <button style={S.btn} onClick={handleSubmit} disabled={loading}>
        {hasFile ? "성적 자동 추출 및 AI 생기부 종합 분석 시작" : "AI 생기부 종합 분석 시작"}
      </button>

      {loading && (
        <div style={S.loading}>
          <div style={{ marginBottom:6 }}>{hasFile ? "생기부 파일 전체를 항목별로 정밀 분석 중입니다..." : "AI가 생기부를 분석하고 있습니다..."}</div>
          <div style={{ fontSize:11, color:C.textMuted }}>{hasFile ? "항목별 분석 → 역량별 평가 → 종합 진단 → 대학 추천 → 전략 도출 (60~90초 소요)" : "잠시만 기다려주세요..."}</div>
        </div>
      )}

      {result && (
        <AnalysisResult
          result={result}
          name={name} school={school} grade={grade} track={track}
          admType={admType} nextGrade={nextGrade}
          majorStr={majors.filter(m=>m.u||m.m).map((m,i)=>`${i+1}지망: ${m.u} ${m.m}`).join(" / ") || "-"}
          fileUsed={hasFile ? uploadState.name : null}
          onPrint={handlePrint}
        />
      )}
    </div>
  );
}

function buildAnalysisPrompt(track, admType, grade, nextGrade) {

  const nextPart = nextGrade ? `

[파트 5. ${nextGrade} 생기부 전략 로드맵]
(${grade} 분석 결과를 바탕으로 ${nextGrade}에서 무엇을 어떻게 해야 하는지 구체적으로 제시)

가) ${nextGrade} 세특 집중 강화 과목 및 방향
   - 현재 세특에서 가장 약한 과목 2개와 심화 탐구 방향
   - ${track} 입학사정관이 높이 평가하는 탐구 키워드 5개 이상
   - 진로와 연결되는 세특 주제 예시 2개

나) ${nextGrade} 선택과목 전략
   - ${track} 입시에서 유리한 선택과목 구체적 명시 (과목명 + 선택 이유)
   - 현재까지의 과목 이수 흐름과의 연계성 설명

다) ${nextGrade} 비교과 보완 계획
   - 동아리: 지금 당장 어떤 유형의 동아리에서 어떤 역할을 해야 하는지
   - 봉사: 진로와 연계된 봉사 방향
   - 독서: 반드시 읽어야 할 분야와 권수 목표

라) ${nextGrade} 내신 관리 전략
   - ${track} 학종에서 중요도가 높은 과목과 목표 등급
   - 현재 취약 과목 보완 방법` : "";

  return `
다음 형식으로 생활기록부를 항목별로 정밀 분석하세요.
이모지와 특수기호는 절대 사용하지 말고, [번호. 제목] 형식으로만 구분하세요.
각 항목은 반드시 실제 생기부 내용을 인용하여 구체적인 근거를 제시해야 합니다.
막연한 칭찬이나 추상적인 표현은 절대 금지 — 입학사정관 관점의 실질 평가를 작성하세요.


[파트 1. 생기부 항목별 정밀 분석]

[1-1. 인적·학적사항]
평가: (이상없음 / 주의 중 선택)
기재 내용: (파일에서 확인된 내용 요약)
학종 영향: (입시에 미치는 영향 간략 서술)

[1-2. 출결상황]
평가: (우수 / 양호 / 주의 중 선택)
학년별 현황: (학년별 결석/지각/조퇴 수치를 표 형식으로: 1학년 결석_일 / 지각_회 / 조퇴_회, 2학년 ..., 3학년 ...)
미인정 항목: (미인정 기록이 있으면 구체적 명시, 없으면 '없음')
공동체역량 평가: (출결이 성실성·책임감 평가에 미치는 영향 서술)

[1-3. 창의적체험활동 — 자율활동]
평가: (우수 / 양호 / 보통 / 미흡 중 선택)
1학년 자율활동: (실제 기재된 활동명과 핵심 내용 구체적으로 인용)
2학년 자율활동: (실제 기재된 활동명과 핵심 내용 구체적으로 인용)
3학년 자율활동: (있으면 기재, 없으면 '해당학년 미제공')
진로 연계 활동: (자율활동 중 ${track} 진로와 연결되는 활동 추출)
리더십·참여도: (학생자치, 선거관리, 역할 수행 등 구체 사례)
입학사정관 시각: (이 자율활동이 학종에서 어떻게 읽히는지 솔직한 2~3문장 평가)

[1-4. 창의적체험활동 — 동아리활동]
평가: (우수 / 양호 / 보통 / 미흡 중 선택)
1학년 동아리: (동아리명 / 시간 / 핵심 활동 내용 / 본인 역할)
2학년 동아리: (동아리명 / 시간 / 핵심 활동 내용 / 본인 역할)
자율동아리: (자율동아리 참여 현황 — 있으면 명시, 없으면 '없음')
진로 연계성 분석: (희망 진로와 동아리 활동의 연결고리 — 관련성 높음/보통/낮음으로 판정 후 근거)
동아리 역할 평가: (단순 참여인지 / 주도적 역할인지 / 탐구 깊이가 있는지 구체적으로)
가장 강점 동아리: (과목명과 구체적 근거 — 입학사정관이 주목할 포인트)
보완 필요: (동아리 종류, 역할, 탐구 깊이 측면에서 아쉬운 점과 개선 방향)

[1-5. 창의적체험활동 — 진로활동]
평가: (우수 / 양호 / 보통 / 미흡 중 선택)
1학년 진로활동: (소그룹명, 탐구 주제, 활동 내용 핵심 인용)
2학년 진로활동: (소그룹명, 탐구 주제, 활동 내용 핵심 인용)
진로 일관성: (1학년→2학년으로 진로가 심화·발전되고 있는지 구체적으로 — 일관/심화/변동 판정)
탐구 깊이 분석: (진로 관련 탐구 활동이 표면적 체험 수준인지 / 실질적 역량 성장이 드러나는지)
희망 진로와 활동 매칭도: (방송작가·미디어 등 구체적 진로와 활동 내용의 일치 정도 — 높음/보통/낮음 + 근거)
보완 필요: (진로활동에서 부족한 체험이나 탐구 영역)

[1-6. 교과성적]
파일에서 추출한 전 과목 성적:
(학년-학기별로 이수한 모든 과목의 과목명 / 단위수 / 원점수 / 석차등급을 순서대로 나열)
전체 이수단위 가중 평균 등급: (직접 계산하여 소수점 2자리까지 명시)
학년별 평균 등급 변화: (1학년 전체평균 → 2학년 전체평균 → 추이 방향)
계열 관련 과목 분석: (${track}에서 중요한 과목들의 등급과 이수 여부 — 과목별로 강점/취약 판정)
학종 성적 경쟁력: (현재 성적대로 지원 가능한 대학 수준 솔직하게 평가)

[1-7. 세부능력 및 특기사항 (세특) — 과목별 전수 분석]
전체 세특 수준: (우수 / 양호 / 보통 / 미흡 중 선택)
세특 기재 밀도: (기재된 과목 수 / 전체 과목 대비 비율 평가)

1학년 과목별 세특:
(파일에서 확인한 1학년 각 과목 세특을 아래 형식으로 하나씩 분석)
a) 과목명 | 핵심 활동 및 탐구 내용 요약 (1~2문장) | 수준: 우수/양호/보통/미흡 | 진로 연계: 높음/보통/낮음
b) 과목명 | 핵심 활동 및 탐구 내용 요약 | 수준 | 진로 연계
(... 1학년 이수 과목 전부 기재)

2학년 과목별 세특:
(파일에서 확인한 2학년 각 과목 세특을 아래 형식으로 하나씩 분석)
a) 과목명 | 핵심 활동 및 탐구 내용 요약 (1~2문장) | 수준: 우수/양호/보통/미흡 | 진로 연계: 높음/보통/낮음
b) 과목명 | 핵심 활동 및 탐구 내용 요약 | 수준 | 진로 연계
(... 2학년 이수 과목 전부 기재)

세특 종합 분석:
- 가장 강점 세특 TOP3: (과목명 + 구체적 근거 — 입학사정관이 주목할 포인트)
- 가장 취약 세특: (과목명 + 문제점 + 구체적 개선 방향)
- ${track} 전공 관련 과목 세특 심층 분석: (전공 연계 과목의 탐구 수준이 충분한지)
- 진로 연계 일관성: (전체 세특에서 희망 진로가 얼마나 일관되게 드러나는지 종합 평가)
- 세특 개선을 위한 3학년 탐구 주제 제안: (${track} 계열에서 입학사정관이 높이 평가하는 탐구 키워드와 주제 2~3개 구체적으로 제안)

[1-8. 행동특성 및 종합의견 — 학년별 심층 분석]
평가: (우수 / 양호 / 보통 / 미흡 중 선택)

1학년 행특 분석:
- 담임 기재 핵심 표현 인용: (실제 행특에서 가장 중요한 표현 직접 인용)
- 드러난 성격·역량: (어떤 인성적 특성이 기재되었는지)
- 진로 관련 언급: (행특에서 진로와 관련된 내용이 있는지)
- 학종 활용 가치: (이 행특을 면접/자소서에서 어떻게 활용할 수 있는지)

2학년 행특 분석:
- 담임 기재 핵심 표현 인용: (실제 행특에서 가장 중요한 표현 직접 인용)
- 1학년 대비 변화·성장: (성격, 역량, 진로 의식 측면에서 어떻게 발전했는지)
- 드러난 핵심 역량: (학종 3대 역량 중 어느 역량이 행특에서 가장 잘 드러나는지)
- 학종 활용 가치: (이 행특을 면접/자소서에서 어떻게 활용할 수 있는지)

행특 종합 평가:
- 1~2학년 행특에서 일관되게 드러나는 핵심 인성 키워드 3가지
- 행특이 전체 생기부와 얼마나 유기적으로 연결되는지
- 3학년 행특 기재를 위해 담임 선생님께 요청할 내용 제안


[파트 2. 역량별 종합 분석]

[2-1. 학업역량]
등급: (매우우수 / 우수 / 보통 / 미흡 중 선택)
평가 근거: (성적, 세특, 수업 태도를 종합하여 구체적으로 3~4문장)
핵심 강점: (학업역량 중 가장 돋보이는 부분)
개선 필요: (학업역량 중 보완해야 할 부분)

[2-2. 진로역량]
등급: (매우우수 / 우수 / 보통 / 미흡 중 선택)
평가 근거: (진로활동, 세특의 진로 연계, 동아리를 종합하여 3~4문장)
핵심 강점: (진로역량 중 가장 돋보이는 부분)
개선 필요: (진로탐색의 깊이나 일관성 측면에서 보완 필요한 부분)

[2-3. 공동체역량]
등급: (매우우수 / 우수 / 보통 / 미흡 중 선택)
평가 근거: (자율활동, 봉사, 행특, 출결을 종합하여 3~4문장)
핵심 강점: (공동체역량 중 가장 돋보이는 부분)
개선 필요: (리더십, 협력, 성실성 측면에서 보완 필요한 부분)


[파트 3. 종합 학종 경쟁력 진단]

종합 등급: (상위권 / 중상위권 / 중위권 / 중하위권 / 하위권 중 선택)
진단 요약: (현재 생기부 수준을 입학사정관 관점에서 솔직하게 3~5문장으로 총평)
최대 강점 3가지: (번호와 함께 구체적으로)
최우선 보완 과제 3가지: (번호와 함께 구체적으로)


[파트 4. 맞춤 대학 추천]

(현재 생기부 수준, ${track}, ${admType}, 성적을 종합하여 현실적인 대학 추천)

[4-1. 도전권 (현재보다 한 단계 높은 목표)]
1번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유 (생기부 어떤 부분이 강점이 되는지)
2번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유

[4-2. 적정권 (현재 생기부로 충분히 경쟁 가능)]
1번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유
2번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유
3번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유

[4-3. 안정권 (합격 가능성이 높은 현실적 선택)]
1번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유
2번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유
3번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 추천 이유
${admType === "농어촌전형" ? `
[4-4. 농어촌전형 특화 추천]
1번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 농어촌 전형 특이사항
2번) 대학명 | 학과명 | 전형명 | 예상 내신 컷 | 합격 가능성 | 농어촌 전형 특이사항` : ""}

[4-4. 대학 선택 전략]
현재 상황에서 수시 지원 6장을 어떻게 배분할지 구체적으로 제안하세요.
(예: 도전 2장 + 적정 3장 + 안정 1장 등 근거와 함께)


[파트 5. 이번 학기 즉시 실행 로드맵]
(우선순위 순서로 7가지, 번호와 함께 구체적으로)
1.
2.
3.
4.
5.
6.
7.${nextPart}`;
}

// ── 분석 결과 파트별 뷰어 ────────────────────────────────────
const RESULT_PARTS = [
  { key: "all", label: "전체 보기" },
  { key: "p1",  label: "파트1 항목별" },
  { key: "p2",  label: "파트2 역량별" },
  { key: "p3",  label: "파트3 종합 진단" },
  { key: "p4",  label: "파트4 대학 추천" },
  { key: "p5",  label: "파트5 전략 로드맵" },
];

function extractPart(text, partKey) {
  if (partKey === "all") return text;
  const starts = { p1:"[파트 1.", p2:"[파트 2.", p3:"[파트 3.", p4:"[파트 4.", p5:"[파트 5." };
  const si = text.indexOf(starts[partKey]);
  if (si === -1) return "해당 파트 내용이 없습니다.";
  let ei = text.length;
  Object.entries(starts).forEach(([k, marker]) => {
    if (k !== partKey) {
      const idx = text.indexOf(marker, si + 10);
      if (idx !== -1 && idx < ei) ei = idx;
    }
  });
  return text.slice(si, ei).trim();
}

function AnalysisResult({ result, name, school, grade, track, admType, nextGrade, majorStr, fileUsed, onPrint }) {
  const [activePart, setActivePart] = useState("all");
  const displayText = extractPart(result, activePart);
  const hasP5 = result.includes("[파트 5.");
  const visibleParts = RESULT_PARTS.filter(p => !(p.key === "p5" && !hasP5));

  return (
    <div style={{ marginTop: 16 }}>
      <div style={{ background: C.navyMid, border: `1px solid ${C.border}`, borderRadius: "14px 14px 0 0", padding: "16px 20px", borderBottom: `2px solid ${C.gold}` }}>
        <div style={{ display: "flex", justifyContent: "space-between", alignItems: "flex-start", flexWrap: "wrap", gap: 10 }}>
          <div>
            <div style={{ fontSize: 15, fontWeight: 800, color: C.text, display: "flex", alignItems: "center", gap: 8, flexWrap: "wrap" }}>
              생기부 종합 분석 보고서
              {fileUsed && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 10, background: "rgba(59,130,246,0.18)", color: "#60a5fa", border: "1px solid rgba(59,130,246,0.3)" }}>NEIS 파일 연동</span>}
              {nextGrade && <span style={{ fontSize: 10, fontWeight: 800, padding: "2px 9px", borderRadius: 10, background: "rgba(16,185,129,0.15)", color: "#34d399", border: "1px solid rgba(16,185,129,0.3)" }}>{grade} 분석 + {nextGrade} 전략</span>}
            </div>
            <div style={{ fontSize: 12, color: C.textSub, marginTop: 5, display: "flex", gap: 12, flexWrap: "wrap" }}>
              <span>{name||"학생"} · {school} {grade}</span>
              <span style={{ color: C.borderLight }}>|</span>
              <span>{track} · {admType}</span>
              {fileUsed && <><span style={{ color: C.borderLight }}>|</span><span style={{ color: "#60a5fa" }}>{fileUsed}</span></>}
            </div>
          </div>
          <button style={{ ...S.printBtn, padding: "9px 20px", fontSize: 12 }} onClick={onPrint}>보고서 출력</button>
        </div>
        <div style={{ display: "flex", gap: 5, marginTop: 14, flexWrap: "wrap" }}>
          {visibleParts.map(p => (
            <button key={p.key} onClick={() => setActivePart(p.key)} style={{
              padding: "6px 12px", borderRadius: 8, cursor: "pointer",
              fontSize: 11, fontWeight: activePart === p.key ? 800 : 500,
              background: activePart === p.key ? C.gold : "#252838",
              color: activePart === p.key ? C.navyDark : C.textSub,
              border: activePart === p.key ? "none" : `1px solid ${C.borderLight}`,
              fontFamily: "'Noto Sans KR', sans-serif", transition: "all 0.15s",
            }}>
              {p.label}
            </button>
          ))}
        </div>
      </div>
      <div style={{
        background: "#141624", border: `1px solid ${C.border}`, borderTop: "none",
        borderRadius: "0 0 14px 14px", padding: 22,
        fontSize: 13, lineHeight: 2.1, color: "#cbd5e1", whiteSpace: "pre-wrap",
        maxHeight: activePart === "all" ? 700 : 560, overflowY: "auto",
      }}>
        {displayText}
      </div>
      <div style={S.watermark}>5파트 항목별 근거 기반 분석 · 리더스학원 AI 입시 분석 시스템 · LEADERS ACADEMY · {today()}</div>
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 2: 대학 맞춤 추천
// ════════════════════════════════════════════════════════════
function UniversityTab() {
  const [grade, setGrade]               = useState("고2");
  const [region, setRegion]             = useState("전국");
  const [naesin, setNaesin]             = useState("");
  const [suneung, setSuneung]           = useState("미응시/해당없음");
  const [strengths, setStrengths]       = useState("");
  const [admType, setAdmType]           = useState("일반전형");
  const [ruralPeriod, setRuralPeriod]   = useState(RURAL_PERIODS[0]);
  const [ruralRegion, setRuralRegion]   = useState("");
  const [ruralSchool, setRuralSchool]   = useState("농어촌 지역 학교 (읍·면 소재)");
  const [track, setTrack]               = useState("공대·IT계열");
  const [career, setCareer]             = useState("");
  const [extra, setExtra]               = useState("");
  const [uploadState, setUploadState]   = useState(null);
  const [loading, setLoading]           = useState(false);
  const [result, setResult]             = useState("");

  const hasFile = uploadState?.status === "ready";

  const handleSubmit = async () => {
    setLoading(true); setResult("");
    try {
      const admText = admType === "농어촌전형"
        ? `농어촌전형 (거주기간: ${ruralPeriod}, 지역: ${ruralRegion||"미입력"}, 학교: ${ruralSchool})`
        : admType === "둘다비교" ? "일반전형 + 농어촌전형 비교" : "일반전형";

      const baseText = `[리더스학원 대학 맞춤 추천]
학년: ${grade} | 지역: ${region} | 내신: ${naesin||"미입력"} | 수능: ${suneung}
강점: ${strengths||"미입력"} | 전형: ${admText} | 계열: ${track}
진로: ${career||"미입력"} | 기타: ${extra||"없음"}

다음 형식으로 작성하세요. 이모지와 특수기호(━ - = * #) 없이 번호와 한글만 사용하세요.

[종합 입시 전략 요약]
현재 상황을 1~2문장으로 요약하고 전략 방향 제시

[내신 및 전형 분석]
현재 내신에서 유리한 전형 유형 설명
${admType === "농어촌전형" || admType === "둘다비교" ? "농어촌전형 자격 요건 검토 및 주의사항" : ""}

[추천 대학 목록]
안정권 3~4곳: 대학명 / 학과 / 전형명 / 예상 내신 컷
적정권 3~4곳: 대학명 / 학과 / 전형명 / 예상 내신 컷
도전권 2~3곳: 대학명 / 학과 / 전형명 / 예상 내신 컷

[지금 당장 해야 할 것 TOP 3]
번호와 함께 구체적으로`;

      const sys = "대입 전문 컨설턴트. 2025~2026 최신 전형 기준. 농어촌전형 정원외 선발 특성 정확히 반영. 계열별 전형 특성 차이 구분. 이모지와 특수기호 절대 사용 금지.";
      let messages;
      if (hasFile && uploadState.type === "pdf")
        messages = [{ role:"user", content:[{ type:"document", source:{ type:"base64", media_type:"application/pdf", data:uploadState.b64 } }, { type:"text", text:baseText }] }];
      else
        messages = [{ role:"user", content: baseText }];
      setResult(await callClaude(sys, messages));
    } catch { setResult("오류가 발생했습니다."); }
    setLoading(false);
  };

  return (
    <div>
      <div style={S.card}>
        <div style={{ marginBottom: 16 }}><span style={S.stepLabel()}>STEP 1</span><span style={S.stepTitle}>기본 정보</span></div>
        <div style={{ display:"grid", gridTemplateColumns:"repeat(3,1fr)", gap:14, marginBottom:14 }}>
          <div><label style={S.label}>학년</label><select style={S.select} value={grade} onChange={e=>setGrade(e.target.value)}>{["고1","고2","고3"].map(g=><option key={g}>{g}</option>)}</select></div>
          <div><label style={S.label}>희망 지역</label><select style={S.select} value={region} onChange={e=>setRegion(e.target.value)}>{["전국","서울","수도권(경기/인천)","충청권","경상권","전라권","강원/제주"].map(r=><option key={r}>{r}</option>)}</select></div>
          <div><label style={S.label}>내신 평균 등급</label><select style={S.select} value={naesin} onChange={e=>setNaesin(e.target.value)}><option value="">선택</option>{["1등급대","2등급대","3등급대","4등급대","5등급대","6등급대 이하"].map(n=><option key={n}>{n}</option>)}</select></div>
          <div><label style={S.label}>수능 예상 백분위</label><select style={S.select} value={suneung} onChange={e=>setSuneung(e.target.value)}>{["미응시/해당없음","상위 10% 이내","상위 11~30%","상위 31~50%","상위 51~70%","상위 70% 이하"].map(s=><option key={s}>{s}</option>)}</select></div>
          <div style={{ gridColumn:"span 2" }}><label style={S.label}>강점 과목</label><input style={S.input} value={strengths} onChange={e=>setStrengths(e.target.value)} placeholder="예: 수학, 물리 강점 / 국어 보통" /></div>
        </div>
        <div style={{ marginBottom: 14 }}>
          <label style={S.label}>희망 계열</label>
          <div style={{ display:"flex", gap:8, flexWrap:"wrap" }}>
            {TRACKS.map(t => <button key={t} style={S.trackChip(track===t)} onClick={()=>setTrack(t)}>{t}</button>)}
          </div>
        </div>
        <div><label style={S.label}>희망 진로</label><input style={S.input} value={career} onChange={e=>setCareer(e.target.value)} placeholder="예: 소프트웨어 개발자, 의사, 교사" /></div>
      </div>

      <div style={S.card}>
        <div style={{ marginBottom: 14 }}><span style={S.stepLabel()}>전형 선택</span></div>
        <div style={{ display:"flex", gap:10, marginBottom: 14 }}>
          {[{k:"일반전형"},{k:"농어촌전형"},{k:"둘다비교"}].map(({k}) => (
            <button key={k} style={S.chip(admType===k)} onClick={()=>setAdmType(k)}>{k}</button>
          ))}
        </div>
        {(admType==="농어촌전형" || admType==="둘다비교") && (
          <div style={{ background:"rgba(16,185,129,0.07)", border:"1px solid rgba(16,185,129,0.22)", borderRadius:10, padding:"14px 16px" }}>
            <div style={{ fontSize:12, fontWeight:700, color:"#34d399", marginBottom:10 }}>농어촌 특별전형 조건</div>
            <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:14 }}>
              <div><label style={S.label}>거주 기간</label><select style={S.select} value={ruralPeriod} onChange={e=>setRuralPeriod(e.target.value)}>{RURAL_PERIODS.map(o=><option key={o}>{o}</option>)}</select></div>
              <div><label style={S.label}>거주 지역</label><input style={S.input} value={ruralRegion} onChange={e=>setRuralRegion(e.target.value)} placeholder="예: 경기 남양주시 화도읍" /></div>
              <div><label style={S.label}>학교 위치</label><select style={S.select} value={ruralSchool} onChange={e=>setRuralSchool(e.target.value)}><option>농어촌 지역 학교 (읍·면 소재)</option><option>도시 지역 학교 (동 소재)</option></select></div>
            </div>
            <div style={{ marginTop:10, padding:"8px 12px", background:"rgba(16,185,129,0.06)", borderRadius:7, fontSize:11, color:"#6ee7b7", lineHeight:1.9 }}>
              남양주시 화도읍 읍·면 소재 → 농어촌전형 해당 가능 (개별 대학 요강 최종 확인 필수)<br />
              정원 외 선발로 내신 1~2등급 완화 효과 가능 / 부모 거주 요건 포함 시 주민등록 확인 필요
            </div>
          </div>
        )}
      </div>

      <div style={S.card}>
        <div style={{ marginBottom: 12 }}>
          <span style={S.stepLabel("#1d4ed8")}>선택</span>
          <span style={S.stepTitle}>나이스 생기부 파일 첨부 (더 정확한 추천)</span>
        </div>
        <NeisUploader uploadState={uploadState} onFileLoaded={setUploadState} onClear={()=>setUploadState(null)} />
        <div style={{ marginTop:14 }}>
          <label style={S.label}>기타 요청사항</label>
          <textarea style={{...S.textarea, height:55}} value={extra} onChange={e=>setExtra(e.target.value)} placeholder="장학금 선호, 취업률 중시, 특정 대학 포함/제외 등" />
        </div>
      </div>

      <button style={S.btn} onClick={handleSubmit} disabled={loading}>대학 맞춤 분석 시작</button>
      {loading && <div style={S.loading}>AI가 맞춤 대학을 분석하고 있습니다...</div>}
      {result && (
        <div>
          <div style={S.resultHeader}>
            <span style={{ fontSize:14, fontWeight:700 }}>대학 맞춤 추천 결과</span>
            <button style={S.printBtn} onClick={()=>printSimple(result, "대학 맞춤 추천 분석 보고서")}>보고서 출력</button>
          </div>
          <div style={S.result}>{result}</div>
          <div style={S.watermark}>리더스학원 AI 입시 분석 시스템 · 2025~2026 기준 · {today()}</div>
        </div>
      )}
    </div>
  );
}

// ════════════════════════════════════════════════════════════
// TAB 3: 농어촌전형 대학 목록
// ════════════════════════════════════════════════════════════
function RuralTab() {
  const [filter, setFilter]     = useState("전체");
  const [search, setSearch]     = useState("");
  const [naesin, setNaesin]     = useState("");

  const gradeNum = naesin ? parseInt(naesin.replace(/[^0-9]/, "")) || 0 : 0;
  const tiers = ["전체", "최상위권", "상위권", "중상위권", "중위권 / 국립대", "수도권 중위권"];

  const filtered = RURAL_UNIVS.map(g => ({
    ...g,
    schools: g.schools.filter(s =>
      (filter === "전체" || g.tier === filter) &&
      (search === "" || s.name.includes(search))
    )
  })).filter(g => g.schools.length > 0);

  const isOk = (cut) => {
    if (!gradeNum) return false;
    const n = parseInt(cut.replace(/[^0-9]/, ""));
    return gradeNum <= n;
  };

  const total = RURAL_UNIVS.reduce((s, g) => s + g.schools.length, 0);

  return (
    <div>
      <div style={S.card}>
        <div style={{ display:"flex", justifyContent:"space-between", alignItems:"center", flexWrap:"wrap", gap:12, marginBottom:16 }}>
          <div>
            <div style={{ fontSize:15, fontWeight:800, color:C.goldLight, marginBottom:4 }}>농어촌특별전형 운영 대학 목록</div>
            <div style={{ fontSize:11, color:C.textSub }}>
              총 {total}개교 · 정원 외 선발 · 2025~2026 기준
              {gradeNum > 0 && <span style={{ marginLeft:8, color:"#34d399", fontWeight:700 }}>내신 {naesin} 기준 지원 가능 대학 강조 표시</span>}
            </div>
          </div>
          <div style={{ display:"flex", gap:10, alignItems:"center" }}>
            <div>
              <label style={{ ...S.label, marginBottom:3 }}>내신 등급 입력</label>
              <select style={{ ...S.select, width:130 }} value={naesin} onChange={e=>setNaesin(e.target.value)}>
                <option value="">미입력</option>
                {["1등급대","2등급대","3등급대","4등급대","5등급대"].map(n=><option key={n}>{n}</option>)}
              </select>
            </div>
            <div>
              <label style={{ ...S.label, marginBottom:3 }}>대학명 검색</label>
              <input style={{ ...S.input, width:150 }} placeholder="대학명 검색..." value={search} onChange={e=>setSearch(e.target.value)} />
            </div>
          </div>
        </div>

        {/* 필터 탭 */}
        <div style={{ display:"flex", gap:6, flexWrap:"wrap", marginBottom:18 }}>
          {tiers.map(t => (
            <button key={t} onClick={()=>setFilter(t)} style={{ padding:"5px 14px", borderRadius:20, cursor:"pointer", fontSize:11, fontWeight:filter===t?800:500, background:filter===t?C.gold:"#252838", color:filter===t?C.navyDark:C.textSub, border:filter===t?"none":`1px solid ${C.borderLight}`, fontFamily:"'Noto Sans KR',sans-serif", transition:"all 0.15s" }}>
              {t}
            </button>
          ))}
        </div>

        {/* 대학 목록 */}
        {filtered.length === 0 ? (
          <div style={{ textAlign:"center", color:C.textMuted, padding:"28px 0", fontSize:13 }}>검색 결과가 없습니다.</div>
        ) : (
          filtered.map(group => (
            <div key={group.tier} style={{ marginBottom:20 }}>
              <div style={{ display:"flex", alignItems:"center", gap:8, marginBottom:10 }}>
                <div style={{ width:8, height:8, borderRadius:"50%", background:group.color }} />
                <span style={{ fontSize:12, fontWeight:800, color:group.color }}>{group.tier}</span>
                <div style={{ flex:1, height:1, background:group.border }} />
                <span style={{ fontSize:10, color:C.textMuted }}>{group.schools.length}개교</span>
              </div>
              <div style={{ display:"grid", gridTemplateColumns:"1fr 1fr", gap:8 }}>
                {group.schools.map(s => {
                  const ok = isOk(s.cut);
                  return (
                    <div key={s.name} style={{ background:ok?group.bg:"#1e2130", border:`1px solid ${ok?group.border:C.border}`, borderRadius:9, padding:"11px 14px", position:"relative" }}>
                      {ok && <div style={{ position:"absolute", top:7, right:9, fontSize:9, fontWeight:800, color:group.color, background:group.bg, border:`1px solid ${group.border}`, padding:"1px 7px", borderRadius:8 }}>지원 가능</div>}
                      <div style={{ fontSize:13, fontWeight:700, color:ok?C.text:C.textSub, marginBottom:5 }}>{s.name}</div>
                      <div style={{ fontSize:10, color:C.textMuted, lineHeight:1.8 }}>
                        {s.note}<br />
                        <span style={{ color:"#475569" }}>정원 외 선발</span>
                        <span style={{ margin:"0 8px", color:C.borderLight }}>|</span>
                        <span style={{ color:"#475569" }}>예상 컷: </span>
                        <span style={{ color:group.color, fontWeight:600 }}>{s.cut}</span>
                      </div>
                    </div>
                  );
                })}
              </div>
            </div>
          ))
        )}
      </div>
      <div style={{ padding:"10px 16px", background:"rgba(255,255,255,0.02)", border:`1px solid ${C.border}`, borderRadius:8, fontSize:10, color:C.textMuted, lineHeight:1.8 }}>
        위 목록은 참고용입니다. 실제 지원 전 각 대학 입학처 홈페이지에서 2026학년도 모집요강을 반드시 확인하세요.
        농어촌 자격 기준(거주 기간, 학교 소재지)은 대학마다 다를 수 있습니다.
      </div>
    </div>
  );
}

// ── 출력 렌더러 ───────────────────────────────────────────────
function escHtml(s) {
  return (s||"").replace(/&/g,"&amp;").replace(/</g,"&lt;").replace(/>/g,"&gt;");
}

// 등급 뱃지 색상
function gradeBadge(text) {
  const map = {
    "매우우수": ["#166534","#dcfce7"], "우수": ["#1e40af","#dbeafe"],
    "양호": ["#854d0e","#fef9c3"], "보통": ["#6b7280","#f3f4f6"],
    "미흡": ["#9f1239","#ffe4e6"], "주의": ["#9f1239","#ffe4e6"],
    "상위권": ["#166534","#dcfce7"], "중상위권": ["#1e40af","#dbeafe"],
    "중위권": ["#854d0e","#fef9c3"], "중하위권": ["#6b7280","#f3f4f6"],
    "하위권": ["#9f1239","#ffe4e6"],
    "이상없음": ["#166534","#dcfce7"],
  };
  return text.replace(/(매우우수|우수|양호|보통|미흡|주의|상위권|중상위권|중위권|중하위권|하위권|이상없음)/g, (m) => {
    const c = map[m] || ["#374151","#f9fafb"];
    return `<span style="display:inline-block;padding:1px 8px;border-radius:10px;font-size:10px;font-weight:800;color:${c[0]};background:${c[1]};border:1px solid ${c[0]}33;vertical-align:middle;margin:0 2px">${m}</span>`;
  });
}

// 파트 탭 색상
const PART_COLORS = {
  "파트 1": { bg: "#0B1E3D", light: "#e8f0fe", accent: "#1e40af" },
  "파트 2": { bg: "#14532d", light: "#dcfce7", accent: "#166534" },
  "파트 3": { bg: "#78350f", light: "#fef3c7", accent: "#b45309" },
  "파트 4": { bg: "#581c87", light: "#f3e8ff", accent: "#7e22ce" },
  "파트 5": { bg: "#134e4a", light: "#ccfbf1", accent: "#0f766e" },
};

function renderAnalysisHtml(rawText) {
  const lines = rawText.split("\n");
  let html = "";
  let currentPart = null;
  let inActionList = false;
  let inSubsection = false;

  const flushInActionList = () => { if(inActionList){ html += `</div>`; inActionList=false; } };
  const flushSubsection = () => { if(inSubsection){ html += `</div>`; inSubsection=false; } };

  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    const trimmed = line.trim();
    if (!trimmed) { html += `<div style="height:6px"></div>`; continue; }

    // ── [파트 N. 제목] 메인 파트 헤더
    const partMatch = trimmed.match(/^\[파트\s*(\d+)\.\s*(.+?)\]$/);
    if (partMatch) {
      flushInActionList(); flushSubsection();
      const partKey = `파트 ${partMatch[1]}`;
      const col = PART_COLORS[partKey] || PART_COLORS["파트 1"];
      currentPart = partKey;
      html += `
<div style="margin:22px 0 12px;page-break-inside:avoid">
  <div style="display:flex;align-items:center;gap:0;margin-bottom:0">
    <div style="background:${col.bg};color:#fff;padding:6px 18px;border-radius:6px 0 0 6px;font-size:11px;font-weight:900;letter-spacing:1px;white-space:nowrap">
      파트 ${partMatch[1]}
    </div>
    <div style="background:${col.accent};color:#fff;padding:6px 20px;border-radius:0 6px 6px 0;font-size:12px;font-weight:800;flex:1">
      ${escHtml(partMatch[2])}
    </div>
  </div>
  <div style="height:2px;background:linear-gradient(90deg,${col.bg},${col.accent},transparent)"></div>
</div>`;
      continue;
    }

    // ── [N-N. 소제목] 서브섹션 헤더
    const subMatch = trimmed.match(/^\[(\d+[-–]\d+)\.\s*(.+?)\]$/) ||
                     trimmed.match(/^\[(\d+)\.\s*(.+?)\]$/) ;
    if (subMatch) {
      flushInActionList(); flushSubsection();
      const col = currentPart ? PART_COLORS[currentPart] : PART_COLORS["파트 1"];
      inSubsection = true;
      html += `
<div style="margin:14px 0 6px;page-break-inside:avoid">
  <div style="display:flex;align-items:center;gap:8px;margin-bottom:6px">
    <div style="width:3px;height:18px;background:${col.accent};border-radius:2px;flex-shrink:0"></div>
    <div style="font-size:12px;font-weight:800;color:${col.bg}">${escHtml(subMatch[1])}. ${gradeBadge(escHtml(subMatch[2]))}</div>
  </div>
  <div style="background:${col.light};border-left:3px solid ${col.accent};border-radius:0 6px 6px 0;padding:10px 14px;font-size:12px;line-height:2;color:#1a1a2e">`;
      continue;
    }

    // ── [4-1. 도전권] 등 대학 추천 서브
    const univMatch = trimmed.match(/^\[4[-–]\d+\.\s*(.+?)\]$/);
    if (univMatch) {
      flushInActionList(); flushSubsection();
      html += `
<div style="margin:10px 0 5px">
  <div style="background:#f5f3ff;border:1px solid #7c3aed;border-radius:6px;padding:6px 14px;font-size:11px;font-weight:800;color:#5b21b6;display:inline-block">${escHtml(univMatch[1])}</div>
</div>`;
      continue;
    }

    // ── 파트 5 전략 서브섹션
    const p5sub = trimmed.match(/^\[파트\s*5\..+\]\s*(.+)$/) ||
                  (currentPart === "파트 5" && trimmed.match(/^가\)|^나\)|^다\)|^라\)/));

    // ── 번호 목록 (1. 2. 3. / 1번) 2번) / 가) 나))
    const numMatch = trimmed.match(/^(\d+번?\)|\d+\.|가\)|나\)|다\)|라\)|마\)|바\))\s+(.+)/);
    if (numMatch) {
      flushSubsection();
      // 이번학기 실행 과제 (파트5 또는 실행 로드맵 구간)
      const isAction = currentPart === "파트 5" || trimmed.match(/^\d+\.\s/) && i < lines.length;
      const isUniv = trimmed.match(/^\d+번\)/);

      if (isUniv) {
        // 대학 추천 행
        const parts = numMatch[2].split("|").map(s=>s.trim());
        const [univ="", dept="", type="", cut="", prob="", reason=""] = parts;
        html += `
<div style="display:grid;grid-template-columns:auto auto auto auto auto 1fr;gap:0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;margin:4px 0;font-size:11px">
  <div style="background:#0B1E3D;color:#fff;padding:7px 10px;font-weight:800;white-space:nowrap">${escHtml(univ)}</div>
  <div style="background:#1e3a5f;color:#bfdbfe;padding:7px 10px;font-weight:700;white-space:nowrap">${escHtml(dept)}</div>
  <div style="background:#f8fafc;padding:7px 10px;color:#374151;border-left:1px solid #e5e7eb;white-space:nowrap">${escHtml(type)}</div>
  <div style="background:#f8fafc;padding:7px 10px;color:#7e22ce;font-weight:800;border-left:1px solid #e5e7eb;white-space:nowrap">${escHtml(cut)}</div>
  <div style="background:#f8fafc;padding:7px 10px;border-left:1px solid #e5e7eb;white-space:nowrap">${gradeBadge(escHtml(prob))}</div>
  <div style="background:#fafaf9;padding:7px 10px;color:#555;border-left:1px solid #e5e7eb;line-height:1.6">${escHtml(reason)}</div>
</div>`;
      } else {
        // 일반 번호 목록
        const col = currentPart ? PART_COLORS[currentPart] : PART_COLORS["파트 1"];
        html += `
<div style="display:flex;gap:10px;align-items:flex-start;padding:5px 0;border-bottom:1px dashed #f0f0f0">
  <div style="background:${col.accent};color:#fff;border-radius:50%;width:20px;height:20px;display:flex;align-items:center;justify-content:center;font-size:10px;font-weight:900;flex-shrink:0;margin-top:2px">${numMatch[1].replace(/[번)\.]/g,"")}</div>
  <div style="font-size:12px;line-height:1.9;color:#1a1a2e;flex:1">${gradeBadge(escHtml(numMatch[2]))}</div>
</div>`;
      }
      continue;
    }

    // ── 콜론 레이블 행 (평가: / 학년별: 등)
    const labelMatch = trimmed.match(/^(.{2,10}):\s*(.+)/);
    if (labelMatch && !trimmed.startsWith("http")) {
      flushInActionList();
      const col = currentPart ? PART_COLORS[currentPart] : PART_COLORS["파트 1"];
      html += `
<div style="display:flex;gap:0;margin:3px 0;align-items:flex-start;font-size:12px">
  <div style="min-width:90px;font-weight:800;color:${col.bg};padding:3px 8px;background:${col.light};border-radius:4px 0 0 4px;flex-shrink:0;line-height:1.7">${escHtml(labelMatch[1])}</div>
  <div style="flex:1;padding:3px 10px;background:#fafafa;border:1px solid #e5e7eb;border-left:none;border-radius:0 4px 4px 0;line-height:1.9;color:#1a1a2e">${gradeBadge(escHtml(labelMatch[2]))}</div>
</div>`;
      continue;
    }

    // ── a) b) c) 항목
    const subItemMatch = trimmed.match(/^([a-z]\)|[가-힣]\))\s+(.+)/);
    if (subItemMatch) {
      html += `<div style="display:flex;gap:8px;padding:3px 0 3px 8px;font-size:12px;color:#374151;line-height:1.9">
        <span style="font-weight:800;color:#64748b;flex-shrink:0">${escHtml(subItemMatch[1])}</span>
        <span>${gradeBadge(escHtml(subItemMatch[2]))}</span>
      </div>`;
      continue;
    }

    // ── 기본 텍스트
    flushInActionList();
    html += `<div style="font-size:12px;line-height:1.9;color:#374151;padding:2px 0">${gradeBadge(escHtml(trimmed))}</div>`;
  }

  flushInActionList();
  flushSubsection();
  return html;
}

function printAnalysis(result, info) {
  const renderedBody = renderAnalysisHtml(cleanForPrint(result));
  const hasP5 = result.includes("파트 5");
  const partLabels = [
    { num:1, title:"항목별 분석", color:"#1e40af" },
    { num:2, title:"역량별 분석", color:"#166534" },
    { num:3, title:"종합 진단",   color:"#b45309" },
    { num:4, title:"대학 추천",   color:"#7e22ce" },
    ...(hasP5 ? [{ num:5, title:"전략 로드맵", color:"#0f766e" }] : []),
  ];
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8">
<title>생기부 분석 보고서 — ${escHtml(info.name||"학생")} (${escHtml(info.school)} ${escHtml(info.grade)})</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;500;600;700;900&family=Playfair+Display:wght@700;900&family=Cormorant+Garamond:wght@600;700&display=swap');

/* ── 기본 ── */
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;color:#222;font-family:'Noto Sans KR',sans-serif;font-size:12px}
@page{size:A4 portrait;margin:12mm 14mm 14mm 14mm}
@media print{
  html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
  .no-print{display:none}
}

/* ── 헤더 (흰 배경, 하단 선, 전화번호만) ── */
.hdr{background:#fff;padding:15px 28px 12px;display:flex;justify-content:space-between;align-items:center;border-bottom:2px solid #1e293b}
.logo-row{display:flex;align-items:center;gap:11px}
.lmark{width:40px;height:40px;flex-shrink:0;border:1.5px solid #c8a84c;border-radius:8px;display:flex;flex-direction:column;align-items:center;justify-content:center;background:#fafaf7;position:relative;overflow:hidden}
.lmark::before{content:'';position:absolute;top:0;left:0;right:0;height:2px;background:linear-gradient(90deg,transparent,#c8a84c,transparent)}
.lmark-l{font-family:'Playfair Display',serif;font-size:14px;font-weight:900;color:#1e293b}
.lmark-div{width:16px;height:1px;background:#c8a84c;margin:2px 0}
.lmark-ace{font-size:6.5px;font-weight:700;color:#94a3b8;letter-spacing:2px}
.brand-main{font-family:'Playfair Display',serif;font-size:20px;font-weight:900;color:#1e293b;letter-spacing:2px;line-height:1}
.brand-sub{font-family:'Cormorant Garamond',serif;font-size:11px;font-weight:600;color:#94a3b8;letter-spacing:3px;margin-top:2px}
.hdr-right{text-align:right}
.hdr-report-type{font-size:8.5px;font-weight:700;color:#94a3b8;letter-spacing:2px;text-transform:uppercase;margin-bottom:3px}
.hdr-title{font-size:15px;font-weight:900;color:#1e293b;margin-bottom:4px}
.hdr-tel{font-size:10px;color:#94a3b8}
.badge{display:inline-block;padding:2px 8px;border-radius:10px;font-size:9px;font-weight:800;margin-left:4px;vertical-align:middle}
.badge-b{background:#e5e7eb;color:#334155;border:1px solid #d1d5db}
.badge-g{background:#e5e7eb;color:#334155;border:1px solid #d1d5db}
.badge-gold{background:#f5f0e8;color:#7a5c1e;border:1px solid #d9c99e}

/* ── 학생 정보 카드 ── */
.scard{display:grid;grid-template-columns:repeat(5,1fr);background:#f8f9fb;border-bottom:1px solid #e9eaec}
.scell{padding:9px 14px;border-right:1px solid #e9eaec}
.scell:last-child{border-right:none}
.scell.w2{grid-column:span 2}
.scell.w3{grid-column:span 3}
.scell label{font-size:8px;font-weight:800;color:#adb5bd;letter-spacing:1.2px;text-transform:uppercase;display:block;margin-bottom:3px}
.scell span{font-size:12px;font-weight:800;color:#1e293b}

/* ── 파일 정보 바 ── */
.fbar{padding:6px 18px;background:#f1f3f8;border-left:3px solid #6b7280;font-size:10px;color:#4b5563;border-bottom:1px solid #e9eaec}

/* ── 목차 바 ── */
.toc{display:flex;background:#f0f2f6;border-bottom:1.5px solid #d1d5db;margin-bottom:0}
.toc-item{flex:1;padding:8px 6px;text-align:center;border-right:1px solid #dde1e7}
.toc-item:last-child{border-right:none}
.pnum{font-size:7.5px;font-weight:900;letter-spacing:1.5px;text-transform:uppercase;color:#9ca3af;margin-bottom:2px}
.ptitle{font-size:10px;font-weight:800;color:#1e293b}

/* ── 파트 헤더 ── */
.ph{display:flex;align-items:stretch;margin:20px 0 8px;border-radius:6px;overflow:hidden;border:1px solid #d1d5db}
.ph-num{background:#334155;color:#fff;display:flex;flex-direction:column;align-items:center;justify-content:center;padding:10px 14px;min-width:50px}
.ph-num .pn-small{font-size:7.5px;font-weight:700;letter-spacing:1.5px;opacity:.7;margin-bottom:1px}
.ph-num .pn-big{font-size:21px;font-weight:900;line-height:1}
.ph-body{flex:1;padding:10px 16px;background:#475569;display:flex;flex-direction:column;justify-content:center}
.ph-body .ph-en{font-size:7.5px;font-weight:700;letter-spacing:2px;text-transform:uppercase;color:rgba(255,255,255,.5);margin-bottom:3px}
.ph-body .ph-ko{font-size:13px;font-weight:900;color:#fff}

/* ── 섹션 카드 ── */
.sec{margin:7px 0;border:1px solid #e5e7eb;border-radius:6px;overflow:hidden;page-break-inside:avoid}
.sec-head{padding:7px 13px;background:#f1f3f7;display:flex;align-items:center;gap:8px;border-bottom:1px solid #e5e7eb}
.sec-head .sh-bar{width:4px;height:15px;background:#334155;border-radius:2px;flex-shrink:0}
.sec-head .sh-title{font-size:11px;font-weight:900;color:#1e293b}
.sh2{background:#f8f9fb;padding:6px 13px;display:flex;align-items:center;gap:7px;border-bottom:1px solid #eff0f2}
.sh2-bar{width:3px;height:13px;background:#9ca3af;border-radius:2px;flex-shrink:0}
.sh2-title{font-size:10.5px;font-weight:800;color:#4b5563}
.sec-body{padding:11px 14px;background:#fff;font-size:11px;line-height:1.95;color:#374151}

/* 배지 */
.badge-dark{display:inline-block;padding:2px 9px;border-radius:10px;font-size:9px;font-weight:900;background:#334155;color:#fff}
.badge-mid{display:inline-block;padding:2px 9px;border-radius:10px;font-size:9px;font-weight:900;background:#6b7280;color:#fff}
.badge-light{display:inline-block;padding:2px 9px;border-radius:10px;font-size:9px;font-weight:900;background:#e5e7eb;color:#374151;border:1px solid #d1d5db}

/* ── 라벨-값 행 ── */
.lv-row{display:flex;gap:0;margin:4px 0;align-items:flex-start}
.lv-key{min-width:88px;font-weight:800;font-size:10px;padding:4px 8px;background:#f4f5f7;border-radius:4px 0 0 4px;border:1px solid #e5e7eb;color:#374151;line-height:1.7;flex-shrink:0}
.lv-val{flex:1;padding:4px 10px;background:#fafafa;border:1px solid #e9eaec;border-left:none;border-radius:0 4px 4px 0;line-height:1.85;font-size:11px;color:#1e293b}

/* ── 대학 추천 행 ── */
.univ-row{display:grid;grid-template-columns:125px 108px 115px 68px 60px 1fr;gap:0;border:1px solid #e5e7eb;border-radius:5px;overflow:hidden;margin:3px 0;font-size:10px}
.ur-univ{background:#334155;color:#fff;padding:8px 9px;font-weight:900;line-height:1.35}
.ur-dept{background:#475569;color:#e5e7eb;padding:8px 9px;font-weight:700;line-height:1.35}
.ur-cell{padding:8px 9px;background:#f8f9fb;border-left:1px solid #e5e7eb;color:#374151;line-height:1.4}
.ur-cut{font-weight:900;color:#1e293b}
.ur-reason{background:#fff;border-left:1px solid #e5e7eb;padding:8px 9px;color:#6b7280;font-size:9.5px;line-height:1.6}

/* ── 번호 항목 ── */
.num-item{display:flex;gap:8px;align-items:flex-start;padding:4px 2px;border-bottom:1px solid #f3f4f6}
.num-dot{width:19px;height:19px;border-radius:50%;background:#334155;color:#fff;display:flex;align-items:center;justify-content:center;font-size:9.5px;font-weight:900;flex-shrink:0;margin-top:1px}
.num-text{font-size:11px;line-height:1.85;flex:1;color:#1e293b}

/* ── 면책 ── */
.disc{margin-top:16px;padding:8px 13px;background:#f8f9fb;border-left:3px solid #9ca3af;font-size:9.5px;color:#6b7280;line-height:1.85}

/* ── 푸터 ── */
.footer{display:flex;justify-content:space-between;align-items:center;margin-top:12px;padding:8px 0 0;border-top:1.5px solid #1e293b;font-size:9px;color:#6b7280}
.footer .fl{font-family:'Playfair Display',serif;font-size:11px;font-weight:700;color:#1e293b}
</style>
</head>
<body>

<!-- ① 헤더 (흰 배경, 전화번호만) -->
<div class="hdr">
  <div class="logo-row">
    <div class="lmark">
      <span class="lmark-l">L</span>
      <div class="lmark-div"></div>
      <span class="lmark-ace">ACE</span>
    </div>
    <div>
      <div class="brand-main">LEADERS</div>
      <div class="brand-sub">ACADEMY</div>
    </div>
  </div>
  <div class="hdr-right">
    <div class="hdr-report-type">Student Record Analysis Report</div>
    <div class="hdr-title">
      학생부 종합전형 분석 보고서
      ${info.fileUsed ? `<span class="badge badge-b">NEIS 연동</span>` : ""}
      ${info.nextGrade ? `<span class="badge badge-g">${escHtml(info.grade)} + ${escHtml(info.nextGrade)}</span>` : ""}
      <span class="badge badge-gold">${escHtml(info.admType)}</span>
    </div>
    <div class="hdr-tel">☎ 031-511-0984 &nbsp;·&nbsp; 분석일: ${today()}</div>
  </div>
</div>

<!-- ② 학생 정보 카드 -->
<div class="scard">
  <div class="scell"><label>학생명</label><span>${escHtml(info.name||"익명")}</span></div>
  <div class="scell"><label>학교</label><span style="font-size:11px">${escHtml(info.school||"-")}</span></div>
  <div class="scell"><label>학년</label><span>${escHtml(info.grade||"-")}</span></div>
  <div class="scell"><label>희망 계열</label><span style="font-size:11px">${escHtml(info.track||"-")}</span></div>
  <div class="scell"><label>전형 유형</label><span style="font-size:11px">${escHtml(info.admType||"-")}</span></div>
  <div class="scell w3"><label>희망 대학 / 학과</label><span style="font-size:10.5px;font-weight:700">${escHtml(info.majorStr||"미입력")}</span></div>
  ${info.fileUsed ? `<div class="scell w2"><label>분석 파일</label><span style="font-size:10px;font-weight:700">${escHtml(info.fileUsed)}</span></div>` : `<div class="scell w2"><label>입력 방식</label><span style="font-size:10px;color:#6b7280">수동 직접 입력</span></div>`}
</div>

${info.fileUsed ? `<div class="fbar">분석 파일: <strong>${escHtml(info.fileUsed)}</strong> &nbsp;·&nbsp; AI가 파일 전체를 직접 읽어 성적 및 세특을 자동 추출하여 분석하였습니다</div>` : ""}

<!-- ③ 목차 바 -->
<div class="toc">
  ${partLabels.map(p=>`
  <div class="toc-item">
    <div class="pnum" style="color:#6b7280">PART ${p.num}</div>
    <div class="ptitle">${p.title}</div>
  </div>`).join("")}
</div>

<!-- ④ 본문 -->
${renderedBody}

<!-- ⑤ 면책 -->
<div class="disc">
  본 보고서는 리더스학원 AI 입시 분석 시스템(LEADERS Academy AI Consulting System)이 생성한 참고 자료입니다.
  대학별 전형 요강 및 내신 컷은 반드시 각 대학 입학처 공식 2026학년도 모집요강으로 최종 확인하시기 바랍니다.
  농어촌전형 자격 요건(거주 기간, 학교 소재지 등)은 대학마다 다를 수 있으니 개별 확인이 필요합니다.
</div>

<!-- ⑥ 푸터 -->
<div class="footer">
  <div><span class="fl">LEADERS Academy</span> &nbsp; AI 입시 분석 시스템 &nbsp;·&nbsp; ☎ 031-511-0984</div>
  <div>${escHtml(info.name||"학생")} &nbsp;·&nbsp; ${escHtml(info.school||"")} ${escHtml(info.grade||"")} &nbsp;·&nbsp; ${today()}</div>
</div>

<script>
// 파트 헤더 클래스 적용 (렌더러 출력 후 DOM 조작)
document.querySelectorAll('[data-partnum]').forEach(el=>{
  const num = el.dataset.partnum;
  el.classList.add('part-block');
});
window.onload = () => window.print();
</script>
</body></html>`);
  w.document.close();
}

function printSimple(result, title) {
  const renderedBody = renderAnalysisHtml(cleanForPrint(result));
  const w = window.open("", "_blank");
  w.document.write(`<!DOCTYPE html><html><head>
<meta charset="utf-8"><title>${escHtml(title)}</title>
<style>
@import url('https://fonts.googleapis.com/css2?family=Noto+Sans+KR:wght@400;700;900&family=Playfair+Display:wght@700&display=swap');
*{margin:0;padding:0;box-sizing:border-box}
html,body{background:#fff;color:#1a1a2e;font-family:'Noto Sans KR',sans-serif;font-size:11.5px}
html{-webkit-print-color-adjust:exact;print-color-adjust:exact}
@page{size:A4;margin:13mm 14mm 14mm 14mm}
.hdr{background:#0f1c30;padding:15px 24px 12px;display:flex;justify-content:space-between;align-items:center;position:relative}
.hdr::after{content:'';position:absolute;bottom:0;left:0;right:0;height:2px;background:linear-gradient(90deg,#b89a3a,rgba(184,154,58,.1))}
.brand-main{font-family:'Playfair Display',serif;font-size:17px;font-weight:900;color:#b89a3a;letter-spacing:2px}
.hdr-right{text-align:right}
.hdr-title{font-size:13px;font-weight:900;color:#fff;margin-bottom:3px}
.hdr-tel{font-size:9px;color:rgba(255,255,255,.4)}
.body{padding:12px 22px 22px}
.disc{margin-top:14px;padding:7px 12px;background:#f5f6f9;border-left:3px solid #4a5568;font-size:9px;color:#64748b;line-height:1.85;border-radius:0 3px 3px 0}
.footer{display:flex;justify-content:space-between;padding:8px 22px;border-top:2px solid #0f1c30;background:#f0f2f6;font-size:9px;color:#64748b}
.fl{font-family:'Playfair Display',serif;font-size:10px;font-weight:700;color:#0f1c30}
</style></head><body>
<div class="hdr">
  <div class="brand-main">LEADERS Academy</div>
  <div class="hdr-right">
    <div class="hdr-title">${escHtml(title)}</div>
    <div class="hdr-tel">☎ 031-511-0984 &nbsp;·&nbsp; ${today()}</div>
  </div>
</div>
<div class="body">
${renderedBody}
<div class="disc">본 자료는 리더스학원 AI 입시 분석 시스템으로 생성된 참고 자료입니다. 대학별 세부 전형 요강은 반드시 최신 모집요강으로 확인하세요.</div>
</div>
<div class="footer">
  <span><span class="fl">LEADERS Academy</span> &nbsp; AI 입시 분석 시스템 &nbsp;·&nbsp; ☎ 031-511-0984</span>
  <span>${today()}</span>
</div>
<script>window.onload=()=>window.print();</script>
</body></html>`);
  w.document.close();
}
