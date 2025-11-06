"""
Módulo de segurança e confiabilidade para o Challenge2025.

Funções principais:
- audit_log: grava eventos de auditoria (antes→depois)
- rotate_backups: cria backups rotativos do Excel
- ensure_columns / assign_uuids: garante colunas extras e IDs
- validate_row: valida domínio e tipos por linha
- find_row: localiza índice por UUID ou Número
- set_runtime_refs: injeta referências a SHEETS, XLSX_PATH e save_all_sheets
- mutating: decorador para endpoints mutadores com lock otimista + auditoria
- restore_task_from_audit: restaura uma linha a partir do audit.jsonl

Uso no app_final.py:

    from seguranca_utils import (
        audit_log, rotate_backups, ensure_columns, assign_uuids,
        validate_row, find_row, set_runtime_refs, mutating,
        restore_task_from_audit,
    )

    # após carregar os DataFrames e definir caminhos, injete as refs:
    set_runtime_refs(SHEETS, XLSX_PATH, save_all_sheets)

    @app.post('/editar-tarefa')
    @mutating('editar')
    def editar_tarefa(payload=None, df=None, idx=None, before=None, **kwargs):
        # ... alterar df.loc[idx, ...]
        return {"status": "editada"}

Observação: este módulo é agnóstico de Flask; os endpoints devem passar
`payload` ao decorador via assinatura da função ou **kwargs.
"""
from __future__ import annotations

import os
import json
import uuid
import shutil
import datetime as dt
from functools import wraps
from typing import Any, Callable, Dict, Optional

# ------------------------ Config e diretórios ------------------------
DATA_DIR = os.environ.get("DATA_DIR", "data")
LOG_DIR = os.path.join(DATA_DIR, "_logs")
BKP_DIR = os.path.join(DATA_DIR, "_backup")

os.makedirs(LOG_DIR, exist_ok=True)
os.makedirs(BKP_DIR, exist_ok=True)

AUDIT_FILE = os.path.join(LOG_DIR, "audit.jsonl")

AUDIT_ENABLED = os.environ.get("AUDIT_ENABLED", "true").lower() == "true"
BKP_ENABLED = os.environ.get("BACKUP_ROTATION_ENABLED", "true").lower() == "true"
OPT_LOCK_ENABLED = os.environ.get("OPTIMISTIC_LOCK_ENABLED", "true").lower() == "true"
SCHEMA_VALIDATION_STRICT = os.environ.get("SCHEMA_VALIDATION_STRICT", "true").lower() == "true"

# Referências de runtime (injetadas pelo app)
_SHEETS: Dict[str, Any] = {}
_XLSX_PATH: Optional[str] = None
_save_all_sheets: Optional[Callable[[], None]] = None

# ------------------------ Helpers básicos ------------------------

def now_iso() -> str:
    return dt.datetime.now().isoformat(timespec="seconds")


def audit_log(event: Dict[str, Any]) -> None:
    """Registra um evento em audit.jsonl (append-only)."""
    if not AUDIT_ENABLED:
        return
    with open(AUDIT_FILE, "a", encoding="utf-8") as f:
        event = {**event, "ts": now_iso()}
        f.write(json.dumps(event, ensure_ascii=False) + "\n")


def rotate_backups(xlsx_path: str, keep: int = 7) -> None:
    """Cria um backup rotativo do arquivo Excel antes de gravar em disco."""
    if not BKP_ENABLED or not xlsx_path or not os.path.exists(xlsx_path):
        return
    stamp = dt.datetime.now().strftime("%Y%m%d-%H%M")
    base = os.path.basename(xlsx_path)
    dst = os.path.join(BKP_DIR, f"{os.path.splitext(base)[0]}-{stamp}.xlsx")
    shutil.copy2(xlsx_path, dst)
    # aplicar retenção
    files = sorted([p for p in os.listdir(BKP_DIR) if p.endswith(".xlsx")])
    while len(files) > keep:
        old = files.pop(0)
        try:
            os.remove(os.path.join(BKP_DIR, old))
        except Exception:
            pass

# ------------------------ Regras de validação ------------------------
REQUIRED_COLS = ["Número", "Nome", "Fase", "Condição", "Prioridade"]
EXTRA_COLS = ["task_uuid", "version", "project_uuid"]

VALID_COND = {"Sempre", "A", "B", "C"}
VALID_PRIOR = {"Crítica", "Alta", "Média", "Baixa", "Sempre", "A", "B", "C"}


def ensure_columns(df, project_uuid: Optional[str] = None):
    """Garante presença das colunas extras e preenche project_uuid se faltante."""
    for c in EXTRA_COLS:
        if c not in df.columns:
            df[c] = None if c != "version" else 1
    if project_uuid and df["project_uuid"].isna().any():
        df.loc[df["project_uuid"].isna(), "project_uuid"] = project_uuid
    return df


def assign_uuids(df):
    """Atribui UUIDs e inicializa versão quando ausentes."""
    if "task_uuid" not in df.columns:
        df["task_uuid"] = None
    mask = df["task_uuid"].isna() | (df["task_uuid"].astype(str).str.len() == 0)
    if getattr(mask, "sum", None):
        df.loc[mask, "task_uuid"] = [str(uuid.uuid4()) for _ in range(int(mask.sum()))]
    if "version" not in df.columns:
        df["version"] = 1
    df["version"] = df["version"].fillna(1).astype(int)
    return df


class ValidationError(Exception):
    def __init__(self, errors):
        super().__init__("validation error")
        self.errors = errors

def validate_row(row: Dict[str, Any]) -> None:
    if not SCHEMA_VALIDATION_STRICT:
        return

    def pick(*keys, default=""):
        for k in keys:
            if k in row and str(row.get(k, "")).strip() != "":
                return row[k]
        return default

    numero = pick("Número", "numero")
    nome   = pick("Nome", "nome")
    cond   = str(pick("Condição", "condicao")).strip()

    errs = []
    if not str(numero).strip():
        errs.append({"field": "numero", "msg": "obrigatório"})
    if not str(nome).strip():
        errs.append({"field": "nome", "msg": "obrigatório"})

    # Condição: valida só se vier
    VALID_COND = {"Sempre", "A", "B", "C"}
    if cond and cond not in VALID_COND:
        errs.append({"field": "condicao", "msg": f"valor inválido: {cond}"})

    # Prioridade: valida só se vier explicitamente com esses rótulos
    prioridade = str(row.get("Prioridade", "")).strip()
    VALID_PRIOR = {"Crítica", "Alta", "Média", "Baixa", "Sempre", "A", "B", "C"}
    if prioridade and prioridade not in VALID_PRIOR:
        errs.append({"field": "Prioridade", "msg": f"valor inválido: {prioridade}"})

    # Duração: aceitar marcadores de conclusão (ex.: "Concluído"),
    # e só exigir numérico quando não for marcador.
    dur = pick("Duração", "duracao")
    if dur not in (None, "", " "):
        s = str(dur).strip().lower()
        if "conclu" not in s:  # se não for "Concluído", exige número
            try:
                float(str(dur).replace(",", "."))
            except Exception:
                errs.append({"field": "duracao", "msg": f"não numérico: {dur}"})

    if errs:
        raise ValidationError(errs)

# ------------------------ Localização de linhas ------------------------

def find_row(df, task_uuid: Optional[str] = None, numero: Optional[Any] = None):
    if task_uuid:
        m = df["task_uuid"].astype(str) == str(task_uuid)
        if m.any():
            return df.index[m][0]
    if numero is not None:
        col = "numero" if "numero" in df.columns else ("Número" if "Número" in df.columns else None)
        if col:
            m = df[col].astype(str) == str(numero)
            if m.any():
                return df.index[m][0]
    return None


# ------------------------ Injeção de dependências ------------------------

def set_runtime_refs(sheets: Dict[str, Any], xlsx_path: str, save_all_sheets_cb: Callable[[], None]) -> None:
    """Injeta referências necessárias para salvar e acessar DF em memória."""
    global _SHEETS, _XLSX_PATH, _save_all_sheets
    _SHEETS = sheets
    _XLSX_PATH = xlsx_path
    _save_all_sheets = save_all_sheets_cb

# ------------------------ Decorador de mutação ------------------------

def mutating(action_name: str) -> Callable:
    """
    Decorador para endpoints mutadores.
    A função decorada deve aceitar `payload=None, df=None, idx=None, before=None`.
    - Resolve df/idx a partir de `payload.sheet`, `payload.task_uuid` ou `payload.numero`.
    - Aplica optimistic lock via `payload.version` quando OPT_LOCK_ENABLED.
    - Chama a função para aplicar a mutação.
    - Valida, incrementa version, audita e persiste (com backup rotativo).
    """
    def deco(fn: Callable) -> Callable:
        @wraps(fn)
        def wrapper(*args, **kwargs):
            if not _SHEETS or not _save_all_sheets:
                return {"ok": False, "error": "runtime_refs_missing"}, 500

            payload = kwargs.get("payload")
            if payload is None:
                # tentar achar em args (ex.: frameworks diferentes)
                for a in args:
                    if isinstance(a, dict) and ("sheet" in a or "numero" in a or "task_uuid" in a):
                        payload = a
                        break
            payload = payload or {}

            operator = payload.get("operator") or kwargs.get("operator") or "system"
            sheet = payload.get("sheet") or kwargs.get("sheet")
            task_uuid = payload.get("task_uuid") or kwargs.get("task_uuid")
            numero = payload.get("numero") or kwargs.get("numero")
            version_client = payload.get("version") or kwargs.get("version")

            if not sheet or sheet not in _SHEETS:
                return {"ok": False, "error": "sheet_not_found"}, 400

            df = _SHEETS[sheet]
            ensure_columns(df)
            assign_uuids(df)

            idx = find_row(df, task_uuid=task_uuid, numero=numero)
            if idx is None:
                return {"ok": False, "error": "task_not_found"}, 404

            before = df.loc[idx].to_dict()

            # optimistic lock
            if OPT_LOCK_ENABLED and version_client is not None:
                try:
                    vc = int(version_client)
                except Exception:
                    return {"ok": False, "error": "bad_version"}, 400
                if vc != int(before.get("version", 1)):
                    return {"ok": False, "error": "version_conflict", "current": before}, 409

            # executar mutação real
            out = fn(df=df, idx=idx, before=before, payload=payload, *args, **kwargs)

            # validar after
            after = df.loc[idx].to_dict()
            try:
                validate_row(after)
            except ValidationError as ve:
                df.loc[idx] = before  # rollback de linha
                return {"ok": False, "error": "validation", "details": ve.errors}, 400

            # version++
            df.loc[idx, "version"] = int(df.loc[idx, "version"] or 1) + 1
            after = df.loc[idx].to_dict()

            # audit
            audit_log({
                "action": action_name,
                "operator": operator,
                "sheet": sheet,
                "task_uuid": after.get("task_uuid") or before.get("task_uuid"),
                "before": before,
                "after": after,
            })

            # persistência com backup
            try:
                if _XLSX_PATH:
                    rotate_backups(_XLSX_PATH)
            except Exception:
                pass
            _save_all_sheets()

            return {"ok": True, "task": after, "result": out}, 200

        return wrapper

    return deco

# ------------------------ Restauração a partir do audit ------------------------

def restore_task_from_audit(task_uuid: str, sheet: str, operator: str = "system"):
    """Restaura a última versão 'before' de uma tarefa usando o audit.jsonl."""
    if not task_uuid or not sheet:
        return {"ok": False, "error": "missing_params"}, 400
    if sheet not in _SHEETS:
        return {"ok": False, "error": "sheet_not_found"}, 404

    last_before = None
    if not os.path.exists(AUDIT_FILE):
        return {"ok": False, "error": "audit_empty"}, 404

    with open(AUDIT_FILE, "r", encoding="utf-8") as f:
        for line in f:
            try:
                ev = json.loads(line)
            except Exception:
                continue
            if ev.get("sheet") == sheet and ev.get("task_uuid") == task_uuid and ev.get("before"):
                last_before = ev["before"]

    if not last_before:
        return {"ok": False, "error": "not_found_in_audit"}, 404

    df = _SHEETS[sheet]
    ensure_columns(df)
    assign_uuids(df)
    idx = find_row(df, task_uuid=task_uuid, numero=last_before.get("Número"))
    if idx is None:
        return {"ok": False, "error": "task_not_found"}, 404

    current = df.loc[idx].to_dict()
    df.loc[idx] = {**current, **last_before}
    df.loc[idx, "version"] = int(current.get("version", 1)) + 1
    after = df.loc[idx].to_dict()

    audit_log({
        "action": "restore_line",
        "operator": operator,
        "sheet": sheet,
        "task_uuid": task_uuid,
        "before": current,
        "after": after,
    })

    try:
        if _XLSX_PATH:
            rotate_backups(_XLSX_PATH)
    except Exception:
        pass
    if _save_all_sheets:
        _save_all_sheets()

    return {"ok": True, "task": after}, 200
