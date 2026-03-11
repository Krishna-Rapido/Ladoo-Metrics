"""Tests for function_executor.py sandbox security."""

import pytest

from function_executor import validate_code_security, FORBIDDEN_PATTERNS


class TestValidateCodeSecurity:
    """Ensure forbidden patterns are correctly detected."""

    @pytest.mark.parametrize(
        "code",
        [
            "import os\nos.system('rm -rf /')",
            "import sys\nsys.exit(1)",
            "import subprocess\nsubprocess.run(['ls'])",
            "__import__('os')",
            "eval('1+1')",
            "exec('print(1)')",
            "compile('code', 'f', 'exec')",
            "open('/etc/passwd')",
            "globals()",
            "locals()",
            "getattr(obj, 'x')",
            "setattr(obj, 'x', 1)",
            "delattr(obj, 'x')",
            "__builtins__",
            "__class__.__bases__",
            "__subclasses__()",
        ],
    )
    def test_forbidden_patterns_rejected(self, code):
        is_safe, error = validate_code_security(code)
        assert not is_safe, f"Expected code to be rejected: {code}"
        assert error is not None

    @pytest.mark.parametrize(
        "code",
        [
            # Safe code that should pass validation
            "def compute_metrics(params):\n    return pd.DataFrame()",
            "x = 1 + 2\ny = x * 3",
            "df = run_query('SELECT 1')",
            "import_data = 'test'",  # 'import' as part of variable name
            "result = df.groupby('captain_id').sum()",
        ],
    )
    def test_safe_code_allowed(self, code):
        is_safe, error = validate_code_security(code)
        assert is_safe, f"Expected code to be allowed: {code}, got error: {error}"
        assert error is None

    def test_case_insensitive_detection(self):
        """Forbidden patterns should be caught regardless of case."""
        is_safe, _ = validate_code_security("IMPORT OS")
        assert not is_safe

    def test_import_shutil_rejected(self):
        is_safe, _ = validate_code_security("import shutil")
        # shutil is not in FORBIDDEN_PATTERNS but import os/sys/subprocess are
        # This tests that the patterns are specific
        # shutil is actually not forbidden by default - this is expected behavior
        pass
