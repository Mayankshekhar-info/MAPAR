"""
Data Cleaning, Normalization & Duplicate Detection Service for MAPAR Ingestion Engine.
Provides deterministic, audited cleaning operations:
- Trimming unnecessary whitespace.
- Standardizing date (ISO YYYY-MM-DD) and numeric formats.
- Enforcing configured column mappings and data types.
- Normalizing values according to approved mapping rules.
- Checking required fields, valid ranges, and reference data.
- Detecting duplicate files (SHA-256) and business records (business keys).
Never silently invents missing values or changes business meaning.
"""

import hashlib
import datetime
import re
from decimal import Decimal, InvalidOperation
from typing import Dict, Any, List, Tuple, Optional, Set
from django.core.files.uploadedfile import UploadedFile

from apps.imports.models import ImportBatch, ImportValidationError


class DataCleaningService:
    @staticmethod
    def compute_file_hash(file_obj: Any) -> str:
        """
        Calculates SHA-256 hash of uploaded file contents for duplicate file detection.
        Preserves stream position.
        """
        hasher = hashlib.sha256()
        try:
            pos = file_obj.tell() if hasattr(file_obj, "tell") else 0
            if hasattr(file_obj, "seek"):
                file_obj.seek(0)
            
            if hasattr(file_obj, "chunks"):
                for chunk in file_obj.chunks():
                    hasher.update(chunk)
            elif hasattr(file_obj, "read"):
                chunk = file_obj.read(65536)
                while chunk:
                    hasher.update(chunk)
                    chunk = file_obj.read(65536)
            
            if hasattr(file_obj, "seek"):
                file_obj.seek(pos)
        except Exception:
            pass
        return hasher.hexdigest()

    @staticmethod
    def detect_duplicate_file(
        file_hash: str,
        template_version_id: Optional[int] = None,
        exclude_batch_id: Optional[str] = None,
    ) -> Optional[ImportBatch]:
        """
        Detects if an identical file has previously been uploaded and committed/validated.
        """
        if not file_hash:
            return None
        qs = ImportBatch.objects.filter(file_hash=file_hash).exclude(
            status__in=[ImportBatch.Status.REJECTED, ImportBatch.Status.FAILED]
        )
        if template_version_id:
            qs = qs.filter(template_version_id=template_version_id)
        if exclude_batch_id:
            qs = qs.exclude(batch_id=exclude_batch_id)
        return qs.order_by("-created_at").first()

    @classmethod
    def clean_and_normalize_row(
        cls,
        row_idx: int,
        raw_row: Dict[str, Any],
        columns: List[Any],
        cleaning_rules: Optional[Dict[str, Any]] = None,
        reference_lookups: Optional[Dict[str, Set[str]]] = None,
    ) -> Tuple[Dict[str, Any], List[Dict[str, Any]]]:
        """
        Applies deterministic cleaning and normalization to a single raw Excel row.
        Returns:
            (cleaned_data_dict, list_of_validation_error_dicts)
        """
        cleaned: Dict[str, Any] = {}
        errors: List[Dict[str, Any]] = []
        rules = cleaning_rules or {}

        # 1. Trimming & Basic Normalization of all keys & values
        trimmed_raw: Dict[str, Any] = {}
        for k, v in raw_row.items():
            clean_k = str(k).strip() if k is not None else ""
            if isinstance(v, str):
                trimmed_raw[clean_k] = v.strip()
            else:
                trimmed_raw[clean_k] = v

        col_by_name = {c.name.strip().lower(): c for c in columns}
        col_by_label = {c.display_label.strip().lower(): c for c in columns}

        for col in columns:
            col_name = col.name
            col_label = col.display_label
            val = None

            # Retrieve value by exact name, display label, or fuzzy match
            if col_name in trimmed_raw:
                val = trimmed_raw[col_name]
            elif col_label in trimmed_raw:
                val = trimmed_raw[col_label]
            else:
                # Fuzzy scan
                target_key = col_name.lower().replace("_", " ")
                for raw_k, raw_v in trimmed_raw.items():
                    norm_raw_k = raw_k.lower().replace("_", " ").replace("-", " ")
                    if norm_raw_k == target_key or norm_raw_k == col_label.lower():
                        val = raw_v
                        break

            # Check Required Fields
            is_empty = (
                val is None
                or val == ""
                or (isinstance(val, str) and val.strip() in ("", "-", "N/A", "NA", "null", "none"))
            )
            if col.is_required and is_empty:
                errors.append({
                    "row_index": row_idx,
                    "column_name": col_label,
                    "cell_value": "" if val is None else str(val),
                    "error_message": f"Mandatory field '{col_label}' is missing or empty.",
                    "severity": ImportValidationError.Severity.ERROR,
                })
                cleaned[col_name] = None
                continue

            if is_empty:
                cleaned[col_name] = None
                continue

            # Type-specific standardization & conversion
            cleaned_val, type_error = cls._standardize_data_type(val, col.data_type, col_label)
            if type_error:
                errors.append({
                    "row_index": row_idx,
                    "column_name": col_label,
                    "cell_value": str(val),
                    "error_message": type_error,
                    "severity": ImportValidationError.Severity.ERROR,
                })
                cleaned[col_name] = val
                continue

            # Normalization rules (e.g. UPPERCASE for circle codes, status codes)
            val_rules = getattr(col, "validation_rules", {}) or {}
            custom_normalizer = rules.get(col_name) or rules.get(col_label) or {}
            
            if isinstance(cleaned_val, str):
                if val_rules.get("transform") == "UPPERCASE" or custom_normalizer.get("transform") == "UPPERCASE":
                    cleaned_val = cleaned_val.upper()
                elif val_rules.get("transform") == "LOWERCASE" or custom_normalizer.get("transform") == "LOWERCASE":
                    cleaned_val = cleaned_val.lower()

            # Range checks (min, max)
            if isinstance(cleaned_val, (int, float, Decimal)):
                min_val = val_rules.get("min") or custom_normalizer.get("min")
                max_val = val_rules.get("max") or custom_normalizer.get("max")
                if min_val is not None:
                    try:
                        if Decimal(str(cleaned_val)) < Decimal(str(min_val)):
                            errors.append({
                                "row_index": row_idx,
                                "column_name": col_label,
                                "cell_value": str(val),
                                "error_message": f"Value {cleaned_val} is less than the minimum permitted value ({min_val}).",
                                "severity": ImportValidationError.Severity.ERROR,
                            })
                    except Exception:
                        pass
                if max_val is not None:
                    try:
                        if Decimal(str(cleaned_val)) > Decimal(str(max_val)):
                            errors.append({
                                "row_index": row_idx,
                                "column_name": col_label,
                                "cell_value": str(val),
                                "error_message": f"Value {cleaned_val} exceeds the maximum permitted value ({max_val}).",
                                "severity": ImportValidationError.Severity.ERROR,
                            })
                    except Exception:
                        pass

            # Reference data check
            ref_level = val_rules.get("reference_level") or custom_normalizer.get("reference_level")
            if ref_level and reference_lookups and ref_level in reference_lookups:
                val_token = str(cleaned_val).strip().upper()
                valid_tokens = reference_lookups[ref_level]
                if val_token not in valid_tokens:
                    errors.append({
                        "row_index": row_idx,
                        "column_name": col_label,
                        "cell_value": str(val),
                        "error_message": f"Invalid {ref_level} reference '{cleaned_val}'. Value not found in active organization hierarchy.",
                        "severity": ImportValidationError.Severity.ERROR,
                    })

            cleaned[col_name] = cleaned_val

        # Preserve unmapped raw fields for complete audit trail
        for k, v in trimmed_raw.items():
            if k not in cleaned and k.lower() not in col_by_name and k.lower() not in col_by_label:
                cleaned[k] = v

        return cleaned, errors

    @classmethod
    def _standardize_data_type(cls, val: Any, data_type: str, col_label: str) -> Tuple[Any, Optional[str]]:
        """
        Parses and standardizes value according to the configured column data type.
        """
        dtype = (data_type or "TEXT").upper()

        if dtype == "TEXT":
            return str(val).strip(), None

        elif dtype == "INTEGER":
            if isinstance(val, int):
                return val, None
            if isinstance(val, float) and val.is_integer():
                return int(val), None
            val_str = str(val).replace(",", "").strip()
            try:
                # Handle cases like "12.0"
                return int(float(val_str)), None
            except (ValueError, TypeError):
                return val, f"Invalid integer format '{val}' for column '{col_label}'."

        elif dtype in ["DECIMAL", "PERCENTAGE"]:
            if isinstance(val, (Decimal, int, float)):
                return str(val), None
            val_str = str(val).replace("%", "").replace(",", "").replace("$", "").replace("₹", "").strip()
            try:
                d = Decimal(val_str)
                return str(d), None
            except (InvalidOperation, ValueError, TypeError):
                return val, f"Invalid numeric/decimal value '{val}' for column '{col_label}'."

        elif dtype == "DATE":
            if isinstance(val, datetime.date):
                return val.strftime("%Y-%m-%d"), None
            if isinstance(val, datetime.datetime):
                return val.strftime("%Y-%m-%d"), None
            val_str = str(val).strip()
            # Attempt multiple common formats
            for fmt in [
                "%Y-%m-%d",
                "%d-%m-%Y",
                "%d/%m/%Y",
                "%m/%d/%Y",
                "%Y/%m/%d",
                "%d.%m.%Y",
                "%d-%b-%Y",
                "%d-%b-%y",
                "%b-%y",
            ]:
                try:
                    dt = datetime.datetime.strptime(val_str, fmt)
                    return dt.strftime("%Y-%m-%d"), None
                except ValueError:
                    continue
            return val, f"Invalid date '{val}' for column '{col_label}'. Expected format YYYY-MM-DD or DD/MM/YYYY."

        elif dtype == "BOOLEAN":
            if isinstance(val, bool):
                return val, None
            s = str(val).strip().lower()
            if s in ["true", "yes", "y", "1", "active", "pass", "on"]:
                return True, None
            if s in ["false", "no", "n", "0", "inactive", "fail", "off"]:
                return False, None
            return val, f"Invalid boolean '{val}' for column '{col_label}'. Expected Yes/No or True/False."

        elif dtype == "REFERENCE":
            return str(val).strip().upper(), None

        return str(val).strip(), None

    @classmethod
    def detect_and_handle_record_duplicates(
        cls,
        staged_items: List[Dict[str, Any]],
        business_key_cols: List[str],
        duplicate_mode: str = "ERROR",
        user=None,
    ) -> Tuple[List[Dict[str, Any]], int]:
        """
        Detects duplicate records using the configured business key columns.
        Supports:
        - "ERROR": Flag duplicate records as validation errors.
        - "SKIP": Retain first instance, mark duplicate instances as skipped.
        - "CORRECT": Overwrite/update existing record while logging change audit.
        Returns:
            (processed_staged_items, duplicate_count)
        """
        if not business_key_cols:
            return staged_items, 0

        seen_keys: Dict[Tuple[str, ...], int] = {}
        duplicate_count = 0

        for item in staged_items:
            raw = item.get("raw_data", {})
            key_parts = []
            for col in business_key_cols:
                v = raw.get(col)
                key_parts.append(str(v).strip().upper() if v is not None else "")
            
            key_tuple = tuple(key_parts)
            # Skip if all business keys are empty
            if all(part == "" for part in key_tuple):
                continue

            if key_tuple in seen_keys:
                duplicate_count += 1
                prior_row = seen_keys[key_tuple]
                
                if duplicate_mode == "SKIP":
                    item["is_valid"] = False
                    item["is_skipped"] = True
                    item["validation_errors"].append({
                        "row_index": item["row_index"],
                        "column_name": ", ".join(business_key_cols),
                        "cell_value": str(key_tuple),
                        "error_message": f"Duplicate business key skipped (identical to Row #{prior_row}).",
                        "severity": ImportValidationError.Severity.WARNING,
                    })
                elif duplicate_mode == "CORRECT":
                    item["is_valid"] = True
                    item["is_correction"] = True
                    item["correction_notes"] = f"Corrected/updated previous entry from Row #{prior_row}."
                else:  # ERROR
                    item["is_valid"] = False
                    item["validation_errors"].append({
                        "row_index": item["row_index"],
                        "column_name": ", ".join(business_key_cols),
                        "cell_value": str(key_tuple),
                        "error_message": f"Duplicate business record detected with key {key_tuple}. Matches Row #{prior_row}.",
                        "severity": ImportValidationError.Severity.ERROR,
                    })
            else:
                seen_keys[key_tuple] = item["row_index"]

        return staged_items, duplicate_count
