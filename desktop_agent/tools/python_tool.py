"""
Python Tool for Universal Agent
Executes Python code safely on the local machine with timeout, output capture, and error handling.
"""

import sys
import subprocess
import tempfile
import os

class PythonTool:
    def __init__(self):
        self.timeout = 15

    def execute_code(self, code: str) -> dict:
        """
        Execute arbitrary Python code in a safe subprocess and return stdout/stderr.
        """
        code_clean = code.strip()
        # Remove markdown code fences if present
        if code_clean.startswith("```"):
            lines = code_clean.splitlines()
            if lines[0].startswith("```"):
                lines = lines[1:]
            if lines and lines[-1].startswith("```"):
                lines = lines[:-1]
            code_clean = "\n".join(lines).strip()

        # Prepend UTF-8 output setup for Windows
        script_content = (
            "import sys\n"
            "if sys.platform == 'win32':\n"
            "    try:\n"
            "        sys.stdout.reconfigure(encoding='utf-8')\n"
            "        sys.stderr.reconfigure(encoding='utf-8')\n"
            "    except Exception:\n"
            "        pass\n"
            + code_clean
        )

        with tempfile.NamedTemporaryFile("w", suffix=".py", delete=False, encoding="utf-8") as f:
            f.write(script_content)
            temp_path = f.name

        try:
            res = subprocess.run(
                [sys.executable, temp_path],
                capture_output=True,
                text=True,
                timeout=self.timeout,
                encoding="utf-8",
                errors="replace"
            )

            stdout = res.stdout.strip()
            stderr = res.stderr.strip()

            if res.returncode == 0:
                output = stdout if stdout else "Code executed successfully (no output)."
                return {
                    "success": True,
                    "output": output,
                    "message": f"🐍 **Python Output:**\n```\n{output}\n```"
                }
            else:
                err_msg = stderr if stderr else stdout
                return {
                    "success": False,
                    "error": err_msg,
                    "message": f"⚠️ **Python Error:**\n```\n{err_msg}\n```"
                }

        except subprocess.TimeoutExpired:
            return {
                "success": False,
                "error": "Execution timed out (15 seconds limit exceeded).",
                "message": "⏱️ Python code timed out after 15 seconds."
            }
        except Exception as e:
            return {
                "success": False,
                "error": str(e),
                "message": f"⚠️ Python execution failed: {str(e)}"
            }
        finally:
            try:
                os.remove(temp_path)
            except Exception:
                pass

    def evaluate_expression(self, expr: str) -> dict:
        """Evaluate a mathematical or Python expression."""
        code = f"print({expr})"
        return self.execute_code(code)

python_tool = PythonTool()
