"""Build the optional engine_native pybind11 extension (Contribution 1 C++ MVP)."""

from __future__ import annotations

import sys
from pathlib import Path

from setuptools import Extension, setup

try:
    import pybind11
except ImportError as e:  # pragma: no cover
    raise RuntimeError("Install pybind11 before building native_ext: pip install pybind11") from e

here = Path(__file__).resolve().parent
src = here / "src"

if sys.platform == "win32":
    compile_args = ["/O2", "/std:c++17", "/EHsc", "/DNDEBUG"]
    link_args: list[str] = []
else:
    compile_args = ["-O3", "-std=c++17", "-fvisibility=hidden", "-DNDEBUG"]
    link_args: list[str] = []

ext = Extension(
    name="engine_native",
    sources=[str(src / "engine_native.cpp")],
    include_dirs=[pybind11.get_include()],
    language="c++",
    extra_compile_args=compile_args,
    extra_link_args=link_args,
)

setup(
    name="engine_native",
    version="0.1.0",
    description="AlphaTest C++ ring-buffer MVP (pybind11)",
    ext_modules=[ext],
    zip_safe=False,
)
