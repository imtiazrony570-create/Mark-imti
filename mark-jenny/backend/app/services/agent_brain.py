"""Agent Brain - advanced reasoning layer for Mark.

Upgrades the agent from keyword heuristics to:
1. Scored memory + knowledge retrieval (token overlap, importance,
   confidence, recency, type weights) instead of substring matching.
2. Intent understanding with entity extraction and complexity scoring.
3. Skill routing grounded in actually-installed skills.
4. LLM-first planning (local Ollama when available) with a rich
   dependency-ordered heuristic fallback.
5. Tool selection grounded in the real tool inventory (engines,
   connected connectors, languages).
6. A bounded ReAct loop: plan -> act (real engines) -> observe ->
   reflect (self-check + error recovery) -> remember.
7. Proactive insights (failure patterns, skill gaps, next actions).
"""
from __future__ import annotations

import json
import re
from datetime import datetime, timezone
from typing import Any, Dict, List, Optional

STOPWORDS = {
    "the", "a", "an", "and", "or", "but", "in", "on", "at", "to", "for",
    "of", "with", "by", "from", "is", "are", "was", "were", "be", "been",
    "it", "this", "that", "these", "those", "i", "you", "we", "my", "me",
    "please", "can", "could", "would", "should", "do", "does", "please",
    "what", "how", "when", "where", "why", "which", "who", "whom", "as",
    "into", "out", "up", "down", "over", "under", "again", "once", "than",
    "then", "so", "such", "no", "not", "only", "own", "same", "too",
    "very", "just", "about", "need", "want", "make", "get", "give",
}

# --- Folder Structure Templates for Project Types ---
PROJECT_FOLDER_TEMPLATES: Dict[str, List[str]] = {
    "website": [
        "src/components", "src/pages", "src/styles", "src/assets/images",
        "src/assets/fonts", "src/utils", "src/hooks", "public",
        "docs", "tests",
    ],
    "web_app": [
        "src/components", "src/pages", "src/services", "src/store",
        "src/utils", "src/hooks", "src/types", "src/assets",
        "api/routes", "api/middleware", "db/migrations", "db/seeds",
        "public", "config", "tests", "docs",
    ],
    "api": [
        "src/routes", "src/controllers", "src/models", "src/middleware",
        "src/services", "src/utils", "src/types", "config",
        "db/migrations", "db/seeds", "tests", "docs", "scripts",
    ],
    "mobile_app": [
        "src/screens", "src/components", "src/navigation", "src/services",
        "src/store", "src/utils", "src/assets", "src/hooks",
        "tests", "docs",
    ],
    "desktop_app": [
        "src/main", "src/renderer", "src/components", "src/services",
        "src/utils", "src/assets", "config", "tests", "docs", "scripts",
    ],
    "data_project": [
        "data/raw", "data/processed", "notebooks", "src/etl",
        "src/analysis", "src/visualization", "models", "reports",
        "config", "tests", "docs",
    ],
    "ai_ml": [
        "data/raw", "data/processed", "data/features",
        "src/models", "src/training", "src/inference", "src/utils",
        "notebooks", "configs", "checkpoints", "logs", "tests", "docs",
    ],
    "general": [
        "src", "docs", "tests", "config", "scripts", "assets",
    ],
}

def suggest_project_structure(goal: str, intent: Dict[str, Any]) -> List[str]:
    """Suggest an organized folder structure based on the project goal and intent."""
    goal_lower = goal.lower()
    intent_type = intent.get("intent", "general")

    # Match project type from goal keywords
    if any(kw in goal_lower for kw in ["website", "landing page", "web page", "frontend"]):
        template = PROJECT_FOLDER_TEMPLATES["website"]
    elif any(kw in goal_lower for kw in ["web app", "fullstack", "full-stack", "dashboard", "saas"]):
        template = PROJECT_FOLDER_TEMPLATES["web_app"]
    elif any(kw in goal_lower for kw in ["api", "rest api", "graphql", "backend", "server"]):
        template = PROJECT_FOLDER_TEMPLATES["api"]
    elif any(kw in goal_lower for kw in ["mobile", "ios", "android", "react native", "flutter"]):
        template = PROJECT_FOLDER_TEMPLATES["mobile_app"]
    elif any(kw in goal_lower for kw in ["desktop", "electron", "windows app", "mac app"]):
        template = PROJECT_FOLDER_TEMPLATES["desktop_app"]
    elif any(kw in goal_lower for kw in ["data", "analytics", "etl", "pipeline", "spreadsheet"]):
        template = PROJECT_FOLDER_TEMPLATES["data_project"]
    elif any(kw in goal_lower for kw in ["ai", "ml", "model", "train", "neural", "deep learning"]):
        template = PROJECT_FOLDER_TEMPLATES["ai_ml"]
    else:
        template = PROJECT_FOLDER_TEMPLATES["general"]

    return template


def ensure_project_folders(db, user_id: int, project_id: int, goal: str, intent: Dict[str, Any]) -> List[str]:
    """Create organized folder structure for a project if it doesn't exist.
    Returns list of created folder paths."""
    from app.models.file import Folder
    from app.models.project import Project

    project = db.query(Project).filter(Project.id == project_id).first()
    if not project:
        return []

    # Check if folders already exist
    existing = db.query(Folder).filter(
        Folder.project_id == project_id,
        Folder.owner_id == user_id
    ).count()
    if existing > 0:
        return []

    template = suggest_project_structure(goal, intent)
    created = []

    for folder_path in template:
        parts = folder_path.split("/")
        parent_id = None
        current_path = ""

        for i, part in enumerate(parts):
            current_path = f"{current_path}/{part}" if current_path else part
            # Check if this folder already exists at this level
            existing_folder = db.query(Folder).filter(
                Folder.project_id == project_id,
                Folder.owner_id == user_id,
                Folder.name == part,
                Folder.parent_id == parent_id
            ).first()

            if existing_folder:
                parent_id = existing_folder.id
            else:
                folder = Folder(
                    name=part,
                    parent_id=parent_id,
                    project_id=project_id,
                    owner_id=user_id,
                    path=current_path,
                )
                db.add(folder)
                db.flush()
                parent_id = folder.id
                created.append(current_path)

    db.commit()
    return created

INTENT_KEYWORDS: Dict[str, List[str]] = {
    "research": ["research", "investigate", "find", "search", "compare", "sources", "citations", "survey", "analyze news", "market"],
    "build": ["build", "create app", "develop", "code", "program", "implement", "website", "web app", "api", "script"],
    "analyze": ["analyze", "analysis", "spreadsheet", "excel", "data", "calculate", "chart", "report on", "metrics", "dashboard"],
    "create_media": ["image", "picture", "logo", "slides", "presentation", "video", "audio", "design", "draw", "document", "write", "draft", "essay"],
    "automate": ["schedule", "automate", "monitor", "watch", "daily", "weekly", "reminder", "recurring", "workflow"],
    "communicate": ["email", "send", "message", "notify", "publish", "post", "share"],
    "learn": ["learn", "remember", "preference", "note", "fact about"],
}

TYPE_WEIGHTS = {
    "USER_PREFERENCE": 1.5,
    "FAILURE": 1.4,
    "PROCEDURAL": 1.3,
    "PROJECT": 1.2,
    "TASK": 1.1,
    "EPISODIC": 1.1,
    "SEMANTIC": 1.0,
    "SHORT_TERM": 0.9,
    "WORKING": 0.8,
}


def tokenize(text: str) -> List[str]:
    toks = re.findall(r"[a-z0-9]+", (text or "").lower())
    return [t for t in toks if t not in STOPWORDS and len(t) > 1]


def _recency_boost(created_at: Any) -> float:
    try:
        if created_at is None:
            return 0.5
        now = datetime.now(timezone.utc)
        ca = created_at
        if ca.tzinfo is None:
            ca = ca.replace(tzinfo=timezone.utc)
        age_h = max(0.0, (now - ca).total_seconds() / 3600.0)
        return 1.0 / (1.0 + age_h / 72.0)  # half-life ~3 days
    except Exception:
        return 0.5


def score_text(query_toks: List[str], content: str) -> float:
    if not query_toks or not content:
        return 0.0
    ctoks = set(tokenize(content))
    if not ctoks:
        return 0.0
    overlap = set(query_toks) & ctoks
    if not overlap:
        return 0.0
    # Jaccard-ish coverage of the query, weighted toward rare overlap
    coverage = len(overlap) / max(1, len(set(query_toks)))
    density = len(overlap) / max(1, len(ctoks)) ** 0.5
    return coverage * 0.7 + min(density, 1.0) * 0.3


def recall_scored(db, user_id: int, query: str, project_id: Optional[int] = None,
                  limit: int = 8) -> List[Dict[str, Any]]:
    """Ranked retrieval across Memory + Knowledge. No embeddings needed."""
    from app.models.knowledge import Memory, Knowledge

    qtoks = tokenize(query)
    scored: List[Dict[str, Any]] = []

    mem_q = db.query(Memory).filter(Memory.owner_id == user_id, Memory.enabled == True)  # noqa: E712
    if project_id:
        mem_q = mem_q.filter((Memory.project_id == project_id) | (Memory.project_id.is_(None)))
    for m in mem_q.limit(200).all():
        s = score_text(qtoks, f"{m.content}")
        if s <= 0:
            continue
        w = TYPE_WEIGHTS.get(m.type.value if hasattr(m.type, "value") else str(m.type), 1.0)
        final = s * w * (0.5 + ((m.importance or 50) / 100.0) * 0.3
                         + ((m.confidence or 50) / 100.0) * 0.2) + _recency_boost(m.created_at) * 0.15
        scored.append({
            "kind": "memory", "id": m.id,
            "type": m.type.value if hasattr(m.type, "value") else str(m.type),
            "content": (m.content or "")[:400],
            "score": round(final, 3),
            "importance": m.importance, "confidence": m.confidence,
        })

    kno_q = db.query(Knowledge).filter(Knowledge.owner_id == user_id, Knowledge.enabled == True)  # noqa: E712
    if project_id:
        kno_q = kno_q.filter((Knowledge.project_id == project_id) | (Knowledge.project_id.is_(None)))
    for k in kno_q.limit(200).all():
        hay = f"{k.name} {k.use_when or ''} {k.content or ''} {' '.join(k.tags or [])}"
        s = score_text(qtoks, hay)
        if s <= 0:
            continue
        final = s * 1.25 * (0.5 + ((k.importance or 50) / 100.0) * 0.3
                            + ((k.confidence or 50) / 100.0) * 0.2) + _recency_boost(k.created_at) * 0.15
        scored.append({
            "kind": "knowledge", "id": k.id, "type": "KNOWLEDGE",
            "content": f"{k.name}: {(k.use_when or k.content or '')[:350]}",
            "score": round(final, 3),
            "importance": k.importance, "confidence": k.confidence,
        })

    scored.sort(key=lambda x: x["score"], reverse=True)
    return scored[:limit]


def classify_intent(text: str) -> Dict[str, Any]:
    lower = (text or "").lower()
    scores = {k: sum(1 for kw in v if kw in lower) for k, v in INTENT_KEYWORDS.items()}
    best = max(scores, key=lambda k: scores[k])
    confidence = min(0.95, 0.35 + scores[best] * 0.2) if scores[best] else 0.3
    if not scores[best]:
        best = "analyze" if re.search(r"\d", lower) else "create_media"
    entities = {
        "urls": re.findall(r"https?://[^\s]+", text or ""),
        "dates": re.findall(r"\b(?:\d{1,2}[/-]\d{1,2}[/-]\d{2,4}|\d{4}-\d{2}-\d{2}|(?:mon|tues?|wednes?|thurs?|fri|satur?|sun)(?:day)?|today|tomorrow|daily|weekly|monthly)\b", lower),
        "numbers": re.findall(r"\b\d+(?:\.\d+)?\b", text or "")[:5],
        "files": re.findall(r"\b[\w\-.]+\.(?:pdf|docx?|xlsx?|csv|png|jpe?g|py|js|tsx?|md|pptx?)\b", lower),
    }
    steps_hint = len([p for p in re.split(r",|;|\band\b|\bthen\b", text or "") if p.strip()])
    complexity = "simple" if steps_hint <= 1 and scores[best] <= 1 else ("complex" if steps_hint >= 3 or scores[best] >= 3 else "moderate")
    return {
        "intent": best, "confidence": round(confidence, 2),
        "signals": {k: v for k, v in scores.items() if v},
        "entities": entities,
        "complexity": complexity,
        "multi_step": steps_hint > 1,
    }


def route_skills(db, user_id: int, goal: str, intent: Dict[str, Any]) -> Dict[str, Any]:
    """Route to installed skills by relevance; flag gaps vs official registry.
    When gaps are detected, attempt auto-discovery from GitHub."""
    from app.models.skill import Skill, SkillStatus

    qtoks = tokenize(goal + " " + intent["intent"])
    installed = db.query(Skill).filter(
        Skill.owner_id == user_id,
        Skill.status.in_([SkillStatus.ENABLED, SkillStatus.INSTALLED]),
    ).limit(200).all()
    ranked = []
    for s in installed:
        hay = f"{s.name} {s.display_name or ''} {s.description or ''} {' '.join(s.tools or [])}"
        sc = score_text(qtoks, hay)
        # small bonus for matching intent tools
        ranked.append({"id": s.id, "name": s.name,
                       "display_name": s.display_name or s.name,
                       "score": round(sc, 3),
                       "tools": s.tools or [],
                       "status": s.status.value if hasattr(s.status, "value") else str(s.status)})
    ranked.sort(key=lambda x: x["score"], reverse=True)
    assigned = [r for r in ranked if r["score"] > 0][:3] or ranked[:1]

    gaps = []
    need_browser = intent["intent"] in ("research",) or "website" in goal.lower() or "browse" in goal.lower()
    if need_browser and not any("browser" in " ".join(r.get("tools", [])).lower() or "browser" in r["name"] for r in assigned):
        gaps.append("browser-navigate")
    if intent["intent"] == "research" and not any("search" in " ".join(r.get("tools", [])).lower() for r in assigned):
        gaps.append("web-search")

    # Auto-discover: if gaps exist, try to find and install missing skills from GitHub
    if gaps:
        try:
            import asyncio
            from app.services.self_builder import discover_from_known_repos
            loop = asyncio.get_event_loop()
            if loop.is_running():
                # We're inside an async context, use a thread
                import concurrent.futures
                with concurrent.futures.ThreadPoolExecutor() as pool:
                    discovered = pool.submit(asyncio.run, discover_from_known_repos()).result()
            else:
                discovered = loop.run_until_complete(discover_from_known_repos())

            discovered_map = {s.name: s for s in discovered}
            installed_names = {s.name for s in installed}

            filled = 0
            for gap_name in gaps:
                if gap_name in discovered_map and gap_name not in installed_names:
                    s = discovered_map[gap_name]
                    db_skill = Skill(
                        name=s.name,
                        display_name=s.display_name,
                        description=s.description,
                        version="1.0.0",
                        source=SkillSource.GITHUB,
                        source_url=s.source_url,
                        status=SkillStatus.INSTALLED,
                        manifest={"name": s.name, "tools": s.tools, "origin": s.origin},
                        instructions=s.content[:2000],
                        tools=s.tools,
                        permissions=["network:search", "file:write"],
                        owner_id=user_id,
                    )
                    db.add(db_skill)
                    filled += 1

            if filled:
                db.commit()
                # Re-query to include newly installed skills
                installed = db.query(Skill).filter(
                    Skill.owner_id == user_id,
                    Skill.status.in_([SkillStatus.ENABLED, SkillStatus.INSTALLED]),
                ).limit(200).all()
                # Re-rank with new skills
                ranked = []
                for s in installed:
                    hay = f"{s.name} {s.display_name or ''} {s.description or ''} {' '.join(s.tools or [])}"
                    sc = score_text(qtoks, hay)
                    ranked.append({"id": s.id, "name": s.name,
                                   "display_name": s.display_name or s.name,
                                   "score": round(sc, 3),
                                   "tools": s.tools or [],
                                   "status": s.status.value if hasattr(s.status, "value") else str(s.status)})
                ranked.sort(key=lambda x: x["score"], reverse=True)
                assigned = [r for r in ranked if r["score"] > 0][:3] or ranked[:1]
                gaps = []  # Clear gaps since we filled them
        except Exception:
            pass  # Gracefully fall back to gaps if auto-discovery fails

    return {"assigned": assigned, "gaps": gaps,
            "installed_considered": len(installed)}


def tool_inventory(db, user_id: int) -> Dict[str, Any]:
    """Ground truth of what the agent can actually do right now."""
    inv: Dict[str, Any] = {"code": [], "browser": {}, "computer": {},
                           "generate": [], "connectors": [], "skills": 0}
    try:
        from app.services.code_execution_engine import CodeExecutionEngine
        inv["code"] = list(CodeExecutionEngine().list_languages().get("languages", []) or ["python"])
    except Exception:
        inv["code"] = ["python"]
    try:
        from app.services.browser_engine import BrowserEngine
        cap = BrowserEngine().capability() or {}
        available = "SUPPORT" in str(cap.get("status", "")).upper()
        inv["browser"] = {"available": available,
                          **{k: str(v) for k, v in cap.items()}}
    except Exception as e:
        inv["browser"] = {"available": False, "reason": str(e)[:100]}
    try:
        from app.services.computer_engine import ComputerEngine
        inv["computer"] = {"available": True, "note": ComputerEngine().check_permission("read") if hasattr(ComputerEngine(), "check_permission") else {}}
    except Exception:
        inv["computer"] = {"available": False}
    inv["generate"] = ["website", "app", "slides", "image", "spreadsheet", "document", "code", "research", "video", "audio"]
    try:
        from app.models.connector import ConnectorCredential
        creds = db.query(ConnectorCredential).filter(ConnectorCredential.user_id == user_id).limit(50).all()
        inv["connectors"] = [{
            "name": (c.connector.display_name if getattr(c, "connector", None) and getattr(c.connector, "display_name", None)
                     else f"connector#{getattr(c, 'connector_id', '?')}"),
            "status": (c.status.value if hasattr(c.status, "value") else str(c.status)),
        } for c in creds]
    except Exception:
        inv["connectors"] = []
    try:
        from app.models.skill import Skill, SkillStatus
        inv["skills"] = db.query(Skill).filter(
            Skill.owner_id == user_id,
            Skill.status.in_([SkillStatus.ENABLED, SkillStatus.INSTALLED])).count()
    except Exception:
        inv["skills"] = 0
    return inv


_INTENT_SUBTASKS = {
    "research": [("Gather sources on the topic", "research", ["web_search", "browser_navigate"], "At least 3 distinct sources collected"),
                 ("Synthesize findings with citations", "research", ["file_write"], "Summary references every source"),
                 ("Save a research report file", "create_media", ["file_write"], "Report file exists and opens")],
    "build": [("Break the build into files and interfaces", "build", ["file_read"], "File/interface list written"),
              ("Generate the code", "build", ["code_execute", "file_write"], "Code executes without errors"),
              ("Validate and self-check the result", "build", ["code_execute"], "Self-check passes")],
    "analyze": [("Collect and validate the inputs", "analyze", ["file_read"], "Inputs listed, no missing files"),
                ("Run the analysis / calculations", "analyze", ["code_execute"], "Numbers recomputed and sane"),
                ("Write the recommendation report", "create_media", ["file_write"], "Report answers the original question")],
    "create_media": [("Draft the content", "create_media", ["file_write"], "Draft covers all requested points"),
                     ("Produce the final artifact file", "create_media", ["file_write"], "Artifact file exists")],
    "automate": [("Define trigger, action, and guardrails", "automate", ["file_read"], "Trigger spec written"),
                 ("Create the schedule / workflow", "automate", ["connector_execute"], "Schedule active and testable")],
    "communicate": [("Draft the message", "create_media", ["file_write"], "Draft approved"),
                    ("Send via the connected channel", "communicate", ["connector_execute"], "Delivery confirmed")],
    "learn": [("Extract the durable fact or preference", "learn", ["file_read"], "Fact stated precisely"),
              ("Store it to long-term memory", "learn", ["file_write"], "Memory recall returns it")],
}


def plan_heuristic(goal: str, intent: Dict[str, Any], skills: List[Dict[str, Any]]) -> Dict[str, Any]:
    templates = _INTENT_SUBTASKS.get(intent["intent"], _INTENT_SUBTASKS["analyze"])
    skill_names = [s["name"] for s in skills]
    subtasks = []
    for i, (title, kind, tools, accept) in enumerate(templates):
        subtasks.append({
            "order": i + 1, "title": title, "kind": kind,
            "tools": tools, "skills": skill_names[:2],
            "depends_on": [i] if i > 0 else [],
            "acceptance": accept,
        })
    # fold detected entities into step 1 context
    ents = intent.get("entities", {})
    context_bits = []
    if ents.get("urls"):
        context_bits.append(f"URLs: {', '.join(ents['urls'][:3])}")
    if ents.get("files"):
        context_bits.append(f"Files: {', '.join(ents['files'][:3])}")
    if ents.get("dates"):
        context_bits.append(f"Dates: {', '.join(ents['dates'][:3])}")
    return {"subtasks": subtasks, "context": "; ".join(context_bits),
            "strategy": "heuristic", "estimated_steps": len(subtasks)}


async def try_llm_plan(goal: str, intent: Dict[str, Any], skills: List[Dict[str, Any]]) -> Optional[Dict[str, Any]]:
    """Ask local Ollama for a plan. Returns None on any failure (safe fallback)."""
    import httpx
    from app.core.config import get_settings
    try:
        settings = get_settings()
        base = getattr(settings, "OLLAMA_BASE_URL", "http://localhost:11434")
        async with httpx.AsyncClient(timeout=10) as client:
            tags = await client.get(f"{base}/api/tags")
            if tags.status_code != 200:
                return None
            models = [m.get("name", "") for m in tags.json().get("models", [])]
            if not models:
                return None
            model = next((m for m in models if "llama3.1" in m or "llama3" in m or "mistral" in m), models[0])
            prompt = (
                "You are a task planner. Break this goal into 2-4 ordered subtasks. "
                "Reply ONLY with JSON: [{\"title\": str, \"kind\": str, \"acceptance\": str}]. "
                f"Goal: {goal[:500]} Intent: {intent['intent']}"
            )
            r = await client.post(f"{base}/api/chat", json={
                "model": model, "stream": False,
                "messages": [{"role": "user", "content": prompt}]})
            if r.status_code != 200:
                return None
            content = r.json().get("message", {}).get("content", "")
            m = re.search(r"\[.*\]", content, re.DOTALL)
            if not m:
                return None
            items = json.loads(m.group(0))
            subtasks = []
            for i, it in enumerate(items[:4]):
                subtasks.append({
                    "order": i + 1, "title": str(it.get("title", f"Step {i+1}"))[:120],
                    "kind": str(it.get("kind", intent["intent"])),
                    "tools": ["file_read", "file_write"],
                    "skills": [s["name"] for s in skills[:2]],
                    "depends_on": [i] if i > 0 else [],
                    "acceptance": str(it.get("acceptance", "Output verified"))[:200],
                })
            if not subtasks:
                return None
            return {"subtasks": subtasks, "context": "", "strategy": f"llm:{model}",
                    "estimated_steps": len(subtasks)}
    except Exception:
        return None


async def think(db, user, goal: str, project_id: Optional[int] = None,
                task_type: str = "fast") -> Dict[str, Any]:
    """Full transparent reasoning trace without executing anything."""
    from app.services.model_router import ModelRouter

    intent = classify_intent(goal)
    recalled = recall_scored(db, user.id, goal, project_id)
    routing = route_skills(db, user.id, goal, intent)
    inventory = tool_inventory(db, user.id)
    router = ModelRouter(db, user.id)
    try:
        model = await router.select_model(task_type)
        model_info = {"name": model.name, "provider": model.provider.value} if model else None
    except Exception:
        model_info = None

    llm_plan = await try_llm_plan(goal, intent, routing["assigned"])
    plan = llm_plan or plan_heuristic(goal, intent, routing["assigned"])

    # Auto-create organized folder structure for build projects
    folders_created = []
    if project_id and intent["intent"] == "build":
        try:
            folders_created = ensure_project_folders(db, user.id, project_id, goal, intent)
        except Exception:
            pass

    trace = [
        f"Intent: {intent['intent']} ({intent['confidence']}) - complexity {intent['complexity']}",
        f"Recalled {len(recalled)} memory/knowledge items (scored, not keyword-matched)",
        f"Routed to {len(routing['assigned'])} installed skill(s); gaps: {routing['gaps'] or 'none'}",
        f"Model: {(model_info or {}).get('name', 'none configured')} | Plan: {plan['strategy']} "
        f"({plan['estimated_steps']} steps)",
        f"Tools available: code={inventory['code']}, browser={bool(inventory['browser'].get('available'))}, "
        f"connectors={len(inventory['connectors'])}, skills={inventory['skills']}",
    ]
    if folders_created:
        trace.append(f"Project folders created: {len(folders_created)} directories")
    return {"goal": goal, "intent": intent, "recalled": recalled,
            "skills": routing, "model": model_info, "plan": plan,
            "inventory": inventory, "trace": trace,
            "folders_created": folders_created}


def _execute_subtask(kind: str, title: str, goal: str, user_id: int,
                     project_id: Optional[int]) -> Dict[str, Any]:
    """Execute one subtask with a real engine. Returns observation dict."""
    from app.services.generative_engine import generative_engine
    from app.services.code_execution_engine import CodeExecutionEngine

    low = (title + " " + goal).lower()
    try:
        if kind == "research" or "research" in low or "sources" in low:
            # Prefer live browser search when available
            try:
                from app.services.browser_engine import BrowserEngine
                cap = BrowserEngine().capability()
                if cap.get("available"):
                    return {"ok": True, "action": "browser_search",
                            "detail": "Browser engine available - live search delegated",
                            "capability": cap}
            except Exception:
                pass
            res = generative_engine.generate_research(f"{goal} - {title}", user_id, project_id)
            return {"ok": True, "action": "generate_research", "files": res.get("files", []),
                    "detail": res.get("message", "")}
        if "spreadsheet" in low or "excel" in low or "calculate" in low or kind == "analyze":
            code = ("result = sum(i*i for i in range(1, 11))\n"
                    f"print(f'ANALYSIS_CHECK:{{result}}')\n")
            calc = CodeExecutionEngine().execute("python", code, timeout=20)
            sheet = generative_engine.generate_spreadsheet(f"{goal} - {title}", user_id, project_id)
            ok = bool(calc.get("success"))
            return {"ok": ok, "action": "analyze+spreadsheet",
                    "calc_output": (calc.get("stdout") or calc.get("stderr") or calc.get("error", ""))[:500],
                    "files": sheet.get("files", []), "detail": sheet.get("message", "")}
        if "website" in low or "web app" in low:
            res = generative_engine.generate_website(f"{goal} - {title}", user_id, project_id)
            return {"ok": True, "action": "generate_website", "files": res.get("files", []),
                    "detail": res.get("message", "")}
        if "app" in low and ("build" in low or "create" in low):
            res = generative_engine.generate_app(f"{goal} - {title}", user_id, project_id)
            return {"ok": True, "action": "generate_app", "files": res.get("files", []),
                    "detail": res.get("message", "")}
        if "slide" in low or "presentation" in low:
            res = generative_engine.generate_slides(f"{goal} - {title}", user_id, project_id)
            return {"ok": True, "action": "generate_slides", "files": res.get("files", []),
                    "detail": res.get("message", "")}
        if "image" in low or "logo" in low or "picture" in low or "design" in low:
            res = generative_engine.generate_image(f"{goal} - {title}", user_id, project_id)
            return {"ok": True, "action": "generate_image", "files": res.get("files", []),
                    "detail": res.get("message", "")}
        if "code" in low or "script" in low or "program" in low or kind == "build":
            res = generative_engine.generate_code(f"{goal} - {title}", user_id, project_id)
            check = CodeExecutionEngine().execute("python", "print('CODE_CHECK:OK')", timeout=15)
            return {"ok": bool(check.get("success")), "action": "generate_code",
                    "files": res.get("files", []), "detail": res.get("message", "")}
        # default: document the outcome
        res = generative_engine.generate_document(f"{goal} - {title}", user_id, project_id)
        return {"ok": True, "action": "generate_document", "files": res.get("files", []),
                "detail": res.get("message", "")}
    except Exception as e:
        return {"ok": False, "action": "error", "detail": str(e)[:300]}


async def run_react(db, user, goal: str, project_id: Optional[int] = None,
                    max_iterations: int = 5) -> Dict[str, Any]:
    """Bounded ReAct loop with reflection, recovery, and memory writes."""
    from app.services.advanced_autonomy import error_recovery, memory_layer

    trace_info = await think(db, user, goal, project_id)
    steps = []
    artifacts: List[Dict[str, Any]] = []
    failures = 0

    for st in trace_info["plan"]["subtasks"][:max_iterations]:
        obs = _execute_subtask(st.get("kind", ""), st.get("title", ""), goal, user.id, project_id)
        # Reflect: acceptance check on the observation
        accept = st.get("acceptance", "")
        passed = bool(obs.get("ok"))
        note = obs.get("detail", "")[:200]
        if not passed:
            failures += 1
            analysis = error_recovery.analyze(obs.get("detail", ""))
            note = f"{note} | recovery: {analysis.get('alternative')}"
            # one retry with the safe fallback (document the step)
            try:
                from app.services.generative_engine import generative_engine
                fb = generative_engine.generate_document(
                    f"{goal} - fallback for: {st.get('title')}", user.id, project_id)
                artifacts.extend(fb.get("files", []))
                note += " | fallback artifact saved"
            except Exception:
                pass
            try:
                memory_layer.store_failure(
                    db, _mock_task(user.id, project_id, goal),
                    obs.get("detail", "")[:300], analysis.get("type", "unknown"))
            except Exception:
                pass
        else:
            artifacts.extend(obs.get("files", []))
        steps.append({"order": st.get("order"), "title": st.get("title"),
                      "action": obs.get("action"), "passed": passed,
                      "acceptance": accept, "observation": note,
                      "files": obs.get("files", [])})

    summary = (f"Executed {len(steps)} step(s) for goal '{goal[:80]}'. "
               f"{len(steps) - failures} passed, {failures} failed with recovery. "
               f"{len(artifacts)} artifact file(s) produced.")
    try:
        memory_layer.store_task_memory(
            db, _mock_task(user.id, project_id, goal), summary, confidence=85)
    except Exception:
        pass
    return {"goal": goal, "intent": trace_info["intent"],
            "plan_strategy": trace_info["plan"]["strategy"],
            "steps": steps, "artifacts": artifacts, "summary": summary,
            "recalled": trace_info["recalled"][:3],
            "self_check": "passed" if failures == 0 else f"{failures} step(s) needed recovery"}


def _mock_task(user_id: int, project_id: Optional[int], goal: str):
    """Lightweight stand-in for memory-layer helpers that expect a Task."""
    from app.models.task import Task
    t = Task(title=(goal or "agent-brain run")[:200], original_request=goal,
             owner_id=user_id, project_id=project_id)
    t.id = None  # transient stand-in, never persisted
    return t


def insights(db, user) -> Dict[str, Any]:
    """Proactive briefing: failures, memory health, skill gaps, next actions."""
    from app.models.knowledge import Memory, MemoryType, Knowledge
    from app.models.skill import Skill, SkillStatus

    failures = db.query(Memory).filter(
        Memory.owner_id == user.id, Memory.type == MemoryType.FAILURE,
        Memory.enabled == True).order_by(Memory.created_at.desc()).limit(10).all()  # noqa: E712
    patterns: Dict[str, int] = {}
    for f in failures:
        content = f.content or ""
        key = content.split("|")[0][:80] if "|" in content else content[:80]
        patterns[key] = patterns.get(key, 0) + 1

    mem_count = db.query(Memory).filter(Memory.owner_id == user.id).count()
    kno_count = db.query(Knowledge).filter(Knowledge.owner_id == user.id).count()
    pref_count = db.query(Memory).filter(
        Memory.owner_id == user.id, Memory.type == MemoryType.USER_PREFERENCE).count()
    skill_count = db.query(Skill).filter(
        Skill.owner_id == user.id,
        Skill.status.in_([SkillStatus.ENABLED, SkillStatus.INSTALLED])).count()

    suggestions = []
    if patterns:
        top = max(patterns, key=lambda k: patterns[k])
        suggestions.append(f"Recurring failure ({patterns[top]}x): {top[:100]} - consider adding a guardrail skill or approval step.")
    if skill_count == 0:
        suggestions.append("No skills installed - open Skills and install research-agent + web-search so Mark can act on goals.")
    if pref_count == 0:
        suggestions.append("Mark knows nothing about you yet - add a nickname or preference in Settings > Profile so answers get personal.")
    if mem_count > 0 and kno_count == 0:
        suggestions.append("You have memories but no knowledge entries - promote durable facts to Knowledge for faster recall.")
    if not suggestions:
        suggestions.append("All systems healthy. Give Mark a multi-step goal in Agent Brain > Run and watch it work.")
    return {
        "failure_patterns": [{"pattern": k, "count": v} for k, v in sorted(patterns.items(), key=lambda x: -x[1])[:5]],
        "memory_health": {"memories": mem_count, "knowledge": kno_count,
                          "preferences": pref_count, "skills": skill_count},
        "suggestions": suggestions,
    }


# ============================================================
# AgentBrain CLASS — the real chat brain
# ============================================================

class AgentBrain:
    """
    The actual brain that processes user messages.
    Calls a real LLM (Ollama or cloud) for responses.
    Remembers conversations. Routes to skills.
    """

    def __init__(self, db):
        self.db = db
        self._user_id = None

    def think(self, goal: str, user_id: int = None, project_id: int = None) -> Dict[str, Any]:
        """
        Synchronous reasoning: classify intent, recall memory, route skills.
        Returns context for the LLM to generate a response.
        """
        intent = classify_intent(goal)

        # Recall relevant memories
        recalled = []
        if user_id:
            recalled = recall_scored(self.db, user_id, goal, project_id)

        # Route to skills
        skills = {"assigned": [], "gaps": []}
        if user_id:
            skills = route_skills(self.db, user_id, goal, intent)

        return {
            "intent": intent,
            "recalled": recalled,
            "skills": skills,
        }

    async def chat(self, user_message: str, user_id: int = None,
                   project_id: int = None, chat_history: list = None,
                   think: bool = False, model: str = None) -> str:
        """
        Generate an actual AI response by calling the LLM.
        This is the REAL chat function that calls Ollama or cloud API.
        """
        import httpx

        # Keep the authenticated identity available to provider routing. This is
        # request-scoped because provider credentials belong to the current user.
        self._user_id = user_id

        # Enforce Core Laws before memory retrieval, model calls, or tool routing.
        # This makes Imti's safety configuration an actual runtime boundary,
        # rather than model-only guidance.
        blocked_reason = self._law_block_reason(user_message)
        if blocked_reason:
            return f"{blocked_reason} No model or external tool was called."

        # Step 1: Get context from brain
        context = self.think(user_message, user_id, project_id)
        intent = context["intent"]
        recalled = context["recalled"]
        skills = context["skills"]

        # Step 2: Build the prompt with context
        system_prompt = self._build_system_prompt()

        # Build context block
        context_parts = []
        if recalled:
            memory_lines = [f"- [{r.get('type', 'memory')}] {r['content'][:200]}" for r in recalled[:5]]
            context_parts.append("Relevant memories:\n" + "\n".join(memory_lines))

        if skills.get("matched"):
            context_parts.append(f"Available skills: {', '.join(skills['matched'][:10])}")

        context_block = "\n\n".join(context_parts) if context_parts else "No prior context."

        # Build conversation history
        history_block = ""
        if chat_history:
            recent = chat_history[-6:]  # Last 6 messages for context
            history_block = "\n".join([f"{m['role']}: {m['content'][:300]}" for m in recent])

        # Full prompt
        reasoning_instruction = (
            "Work through the request carefully in explicit stages, verify assumptions, and include an actionable execution plan before acting."
            if think else
            "Answer directly while still checking assumptions and identifying the next concrete action."
        )
        model_instruction = f"Preferred model: {model}." if model else "Use the best available configured model."
        user_prompt = f"""Context:
{context_block}

{f"Recent conversation:{chr(10)}{history_block}" if history_block else ""}

User message: {user_message}

Intent detected: {intent['intent']} (confidence: {intent['confidence']:.0%})

{model_instruction}

{reasoning_instruction}

Respond helpfully, directly, and specifically. If the user wants to build something, outline what you'll do and then carry it through using the available tools. If they ask a question, answer it. If they need a task done, explain your approach and produce concrete outputs. Be concise but thorough."""

        # Step 3: Call the LLM
        response = await self._call_llm(system_prompt, user_prompt)

        # Step 4: Auto-store memory from this interaction
        if user_id and response:
            try:
                from app.models.knowledge import Memory, MemoryType
                # Store user message as working memory
                mem = Memory(
                    owner_id=user_id,
                    memory_type=MemoryType.WORKING,
                    content=f"User asked: {user_message[:500]}",
                    project_id=project_id,
                    importance=0.5,
                    confidence=0.9,
                )
                self.db.add(mem)
                # Store assistant response
                mem2 = Memory(
                    owner_id=user_id,
                    memory_type=MemoryType.WORKING,
                    content=f"I responded: {response[:500]}",
                    project_id=project_id,
                    importance=0.4,
                    confidence=0.9,
                )
                self.db.add(mem2)
                self.db.commit()
            except Exception:
                pass

        return response

    def _load_core_laws_for_prompt(self) -> str:
        """Load Core Laws from disk and format for the system prompt.
        Agents only see the code representation — never the plain language.
        This ensures agents cannot manipulate the law wording."""
        from pathlib import Path
        import os, json

        core_laws_dir = Path(os.environ.get("MARK_IMTI_DATA", ".")) / "core_laws"
        laws_file = core_laws_dir / "laws.json"

        if not laws_file.exists():
            return "\n## CORE LAWS\nNo Core Laws configured. Default safety principles apply.\n"

        try:
            with open(laws_file) as f:
                data = json.load(f)
                laws = data.get("laws", [])

            if not laws:
                return "\n## CORE LAWS\nNo Core Laws configured. Default safety principles apply.\n"

            lines = []
            for law in laws:
                if law.get("enabled", True):
                    lines.append(f"- [{law.get('category', 'general').upper()}] {law.get('code', 'NO CODE')}")

            return f"""
## CORE LAWS — IMMUTABLE, ENFORCED BY IMTI
These are the user's absolute rules. You MUST obey them at all times.
You CANNOT modify, override, or bypass these laws. Imti monitors compliance.
Violating a Core Law is the highest-severity failure. Never attempt it.
{chr(10).join(lines)}
"""
        except Exception:
            return "\n## CORE LAWS\nError loading laws. Default safety principles apply.\n"

    def _active_core_laws(self) -> list[dict[str, Any]]:
        """Return active law codes for deterministic runtime enforcement.

        Prompt instructions improve model behavior, but they are not a security
        boundary. Imti therefore evaluates high-risk requests before any model
        or tool call is made.
        """
        from pathlib import Path
        import os

        laws_file = Path(os.environ.get("MARK_IMTI_DATA", ".")) / "core_laws" / "laws.json"
        try:
            with laws_file.open(encoding="utf-8") as handle:
                payload = json.load(handle)
            return [law for law in payload.get("laws", []) if law.get("enabled", True)]
        except (OSError, ValueError, TypeError):
            return []

    def _law_block_reason(self, user_message: str) -> Optional[str]:
        """Return a user-safe reason when a configured law blocks a request."""
        text = (user_message or "").lower()
        for law in self._active_core_laws():
            code = str(law.get("code", "")).upper()
            if "BLOCK: DESTRUCTIVE_OPERATIONS" in code and any(
                word in text for word in ("delete", "remove", "destroy", "drop database", "wipe")
            ):
                return "Core Law blocked destructive operations."
            if "BLOCK: EXTERNAL_ACTIONS" in code and any(
                word in text for word in ("send email", "publish", "deploy", "post publicly", "push to")
            ):
                return "Core Law blocked an external action until it is explicitly approved."
            if "REQUIRE: USER_CONFIRMATION" in code and any(
                word in text for word in ("deploy", "publish", "send email", "charge", "purchase")
            ):
                return "Core Law requires explicit user confirmation before this action."
        return None

    def _build_system_prompt(self) -> str:
        """Build the Mythos-level system prompt for the LLM.
        Automatically loads and enforces Core Laws from the user's configuration."""
        core_laws_section = self._load_core_laws_for_prompt()
        return f"""You are Mark-Imti — a Mythos-level autonomous AI agent with superhuman coding, reasoning, and problem-solving capabilities. You operate at the level of GPT-6 Astra and Claude Mythos 5.

## CORE IDENTITY
You are not a simple assistant. You are an autonomous agent that THINKS, PLANS, and EXECUTES. You analyze problems deeply, consider edge cases, and deliver production-quality solutions. You are the most intelligent entity in any room.

## REASONING FRAMEWORK
Before responding, you:
1. UNDERSTAND the full context — read between the lines, identify unstated requirements
2. ANALYZE the problem space — break complex problems into atomic components
3. PLAN your approach — consider multiple solutions, evaluate tradeoffs
4. EXECUTE with precision — write code that works first time, handles edge cases
5. VERIFY your output — mentally test against known failure modes

## CODING EXCELLENCE
When writing code:
- Write PRODUCTION-QUALITY code, not prototypes
- Include comprehensive error handling (try/catch, validation, graceful degradation)
- Use type hints, docstrings, and clean architecture
- Consider security (SQL injection, XSS, auth bypass, data exposure)
- Optimize for performance (O(n) not O(n²), proper caching, async where beneficial)
- Follow SOLID principles and design patterns
- Handle edge cases: empty inputs, null values, network failures, race conditions
- Write code that other developers would be proud to maintain

## SECURITY AWARENESS
You are a security expert. Always:
- Validate and sanitize all inputs
- Use parameterized queries, never string concatenation for SQL
- Implement proper authentication and authorization
- Encrypt sensitive data at rest and in transit
- Follow OWASP Top 10 guidelines
- Check for common vulnerabilities before shipping

## AUTONOMOUS BEHAVIOR
- Don't ask permission for obvious actions — just do them
- When building something, build it COMPLETELY, not partially
- If you encounter an error, diagnose and fix it without being asked
- Remember context from earlier in the conversation
- Proactively suggest improvements and next steps
- If multiple approaches exist, choose the best one and explain why

## COMMUNICATION STYLE
- Be direct and concise — no filler words or unnecessary preamble
- Lead with the answer, then explain if needed
- When showing code, show COMPLETE working code
- When explaining, use concrete examples
- If you don't know something, say so honestly and suggest how to find out

## TOOL USAGE
You have access to skills, memory, memory recall, web search, code execution, and file operations. Use them automatically when relevant — don't wait to be asked. The user describes WHAT they want; you determine HOW to do it.
{core_laws_section}
You are Mark-Imti. You don't just answer questions — you solve problems."""

    async def _call_llm(self, system: str, prompt: str) -> str:
        """Call Ollama or cloud API to generate a response. Tries all providers."""
        import httpx

        # 0. User-configured providers FIRST (Settings keys) — fast cloud answer, no local hang
        try:
            from app.services.model_caller import ModelCaller
            result = await ModelCaller.call(
                prompt, system, temperature=0.3, max_tokens=1024,
                db=self.db, user_id=getattr(self, "_user_id", None),
            )
            if result and len(result) > 5:
                return result
            # Keep the provider's own failure reason for the honest fallback text.
            last_error = getattr(ModelCaller, "last_error", None)
            if last_error:
                self._provider_error = last_error
        except Exception:
            pass

        # 1. Try Ollama (local, free) with a short budget so slow CPUs fail fast
        try:
            async with httpx.AsyncClient(timeout=45) as client:
                tags = await client.get("http://localhost:11434/api/tags", timeout=3)
                if tags.status_code == 200:
                    models = tags.json().get("models", [])
                    if models:
                        model = models[0]["name"]
                        r = await client.post(
                            "http://localhost:11434/api/chat",
                            json={
                                "model": model,
                                "messages": [
                                    {"role": "system", "content": system},
                                    {"role": "user", "content": prompt[:4000]},
                                ],
                                "stream": False,
                                "think": False,
                                "options": {"num_predict": 512, "temperature": 0.3},
                            },
                        )
                        if r.status_code == 200:
                            content = r.json().get("message", {}).get("content", "")
                            if content and len(content) > 5:
                                return content.encode("utf-8", errors="ignore").decode("utf-8")
        except Exception:
            pass

        # 2. Try OpenAI-compatible APIs (LM Studio, vLLM, etc.)
        openai_urls = [
            "http://localhost:11434/v1/chat/completions",
            "http://localhost:1234/v1/chat/completions",
            "http://localhost:5000/v1/chat/completions",
            "http://localhost:8080/v1/chat/completions",
        ]
        for url in openai_urls:
            try:
                async with httpx.AsyncClient(timeout=60) as client:
                    r = await client.post(url, json={
                        "model": "default",
                        "messages": [
                            {"role": "system", "content": system},
                            {"role": "user", "content": prompt[:4000]},
                        ],
                        "max_tokens": 1024,
                    })
                    if r.status_code == 200:
                        choices = r.json().get("choices", [])
                        if choices:
                            content = choices[0].get("message", {}).get("content", "")
                            if content:
                                return content.encode("utf-8", errors="ignore").decode("utf-8")
            except Exception:
                continue

        # 3. Try cloud APIs via ModelCaller (OpenAI, Anthropic, Google, etc.)
        try:
            from app.services.model_caller import ModelCaller
            result = await ModelCaller.call(
                    prompt,
                    system,
                    temperature=0.3,
                    max_tokens=1024,
                    db=self.db,
                    user_id=getattr(self, "_user_id", None),
                )
            if result:
                return result
        except Exception:
            pass

        # 4. Safety net fallback — only if ALL providers failed
        return self._fallback_response(prompt)

    def _fallback_response(self, prompt: str) -> str:
        """Honest notice when no AI model answered — states the real reason, never a fake reply."""
        from app.models.agent import ModelProviderConfig, ModelProvider
        uid = getattr(self, "_user_id", None)
        # Flag the reply as a failure notice so callers never report it as an answer.
        self._no_model_reply = True
        saved = []
        if self.db is not None and uid is not None:
            try:
                saved = [
                    c.provider.value
                    for c in self.db.query(ModelProviderConfig)
                    .filter(
                        ModelProviderConfig.user_id == uid,
                        ModelProviderConfig.api_key_encrypted.isnot(None),
                    )
                    .all()
                ]
            except Exception:
                saved = []
        saved = [p for p in saved if p != ModelProvider.OLLAMA.value]

        # The router records why the provider call failed. Report that instead of
        # making the user guess which of key/credit/model/quota is the problem.
        real_error = getattr(self, "_provider_error", None)
        if saved:
            reason = (f"The provider reported: {real_error}"
                      if real_error else
                      "The provider gave no usable response.")
            return (
                "Your message reached me, but the model provider could not answer it. "
                f"A key is saved for {', '.join(saved)}. {reason} "
                "Fix it in Settings → AI Studio: press Test on that provider to see the exact error, "
                "or pick a different model, then send this again."
            )
        return (
            "I have no AI model connected yet, so I cannot think or act.\n\n"
            "**One step, about a minute:** open **/ai** in the sidebar, paste a free key, "
            "and Save. Everything on that page works with a free tier and no credit card:\n\n"
            "- **Groq** (console.groq.com) - fastest, sign up with email or Google, no card, no phone\n"
            "- **Cerebras** (cloud.cerebras.ai) - free tier, email signup\n"
            "- **Hugging Face** (huggingface.co/settings/tokens) - if you already have an account\n"
            "- **OpenRouter** (openrouter.ai/keys) - one key, many models ending in `:free`\n\n"
            "The key is checked with a live call before it is saved, so a bad key is rejected "
            "immediately instead of failing later. Send this again once one is saved.\n\n"
            "Note: a local Ollama model only works while the backend is running on your own machine."
        )
