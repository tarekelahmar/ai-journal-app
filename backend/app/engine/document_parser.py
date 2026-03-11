"""
Document text extraction for journal chat context.

Supports: PDF (.pdf), DOCX (.docx), plain text (.txt)
Truncates at MAX_DOCUMENT_CHARS to fit within context window budget.
"""
import io
import os
import logging
from typing import Tuple

logger = logging.getLogger(__name__)

MAX_DOCUMENT_CHARS = 15_000  # ~4k tokens, leaving room for other context
ALLOWED_EXTENSIONS = {".pdf", ".docx", ".txt"}
MAX_FILE_SIZE = 5 * 1024 * 1024  # 5 MB


def extract_text(filename: str, file_bytes: bytes) -> Tuple[str, str]:
    """
    Extract text from an uploaded file.

    Returns: (extracted_text, original_filename)
    Raises: ValueError for unsupported types, oversized files, or extraction failures.
    """
    ext = os.path.splitext(filename)[1].lower()

    if ext not in ALLOWED_EXTENSIONS:
        raise ValueError(
            f"Unsupported file type: {ext}. Supported: PDF, DOCX, TXT"
        )

    if len(file_bytes) > MAX_FILE_SIZE:
        size_mb = len(file_bytes) / (1024 * 1024)
        raise ValueError(f"File too large ({size_mb:.1f}MB). Maximum: 5MB")

    if ext == ".txt":
        text = _extract_txt(file_bytes)
    elif ext == ".pdf":
        text = _extract_pdf(file_bytes)
    elif ext == ".docx":
        text = _extract_docx(file_bytes)
    else:
        raise ValueError(f"Unsupported file type: {ext}")

    text = text.strip()
    if not text:
        raise ValueError("No text could be extracted from this file.")

    truncated = False
    if len(text) > MAX_DOCUMENT_CHARS:
        text = text[:MAX_DOCUMENT_CHARS] + "\n\n[Document truncated — showing first ~15,000 characters]"
        truncated = True

    logger.info(
        f"Extracted {len(text)} chars from '{filename}' (truncated={truncated})"
    )
    return text, filename


def _extract_txt(file_bytes: bytes) -> str:
    """Extract text from a plain text file."""
    # Try UTF-8 first, fall back to latin-1
    try:
        return file_bytes.decode("utf-8")
    except UnicodeDecodeError:
        return file_bytes.decode("latin-1", errors="replace")


def _extract_pdf(file_bytes: bytes) -> str:
    """Extract text from a PDF file using PyPDF2 (pure Python, no C deps)."""
    try:
        from PyPDF2 import PdfReader
    except ImportError:
        raise ValueError("PDF support is not available (PyPDF2 not installed)")

    text_parts = []
    try:
        reader = PdfReader(io.BytesIO(file_bytes))
        for page in reader.pages:
            page_text = page.extract_text()
            if page_text:
                text_parts.append(page_text)
    except Exception as e:
        logger.error(f"PDF extraction failed: {e}")
        raise ValueError(f"Could not read PDF file: {e}")

    return "\n\n".join(text_parts)


def _extract_docx(file_bytes: bytes) -> str:
    """Extract text from a DOCX file using stdlib (zipfile + xml parser).

    DOCX is a ZIP archive containing XML. The main content is in
    word/document.xml. This avoids needing python-docx/lxml C deps.
    """
    import zipfile
    import xml.etree.ElementTree as ET

    try:
        with zipfile.ZipFile(io.BytesIO(file_bytes)) as zf:
            if "word/document.xml" not in zf.namelist():
                raise ValueError("Invalid DOCX file (missing word/document.xml)")

            with zf.open("word/document.xml") as doc_xml:
                tree = ET.parse(doc_xml)

        # Word XML namespace
        ns = "{http://schemas.openxmlformats.org/wordprocessingml/2006/main}"
        paragraphs = []
        for para in tree.iter(f"{ns}p"):
            texts = [node.text for node in para.iter(f"{ns}t") if node.text]
            if texts:
                paragraphs.append("".join(texts))

        return "\n\n".join(paragraphs)
    except zipfile.BadZipFile:
        raise ValueError("Could not read DOCX file: invalid or corrupted file")
    except ValueError:
        raise
    except Exception as e:
        logger.error(f"DOCX extraction failed: {e}")
        raise ValueError(f"Could not read DOCX file: {e}")
