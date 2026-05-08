# Vflux 1.0 Roadmap

Vflux 1.0 focuses on release quality rather than adding every possible FPGA feature. The goal is that a new user can download Vflux, install OSS CAD Suite separately, run an example, understand failures, and produce a reproducible project report.

## Core 1.0 Goals

- Stable project file schema with `schema_version`.
- First-launch guidance for language, theme, toolchain setup, and examples.
- Reliable OSS CAD Suite path persistence.
- Project health check before users run the full flow.
- Clear GUI-first feedback with optional technical details.
- Diagnostic package export for bug reports.
- iCESugar drag-and-drop programming as the recommended beginner path.
- Windows portable release as the primary validated package.

## Nice-to-Have Before 1.0

- More examples: PWM breathing LED, button debounce, UART echo, FSM simulation.
- More board package validation before saving custom boards.
- More precise error diagnosis for Yosys, nextpnr, icepack, openFPGALoader, Icarus Verilog, and Verilator.
- Linux AppImage validation when Linux hardware is available.

## Not Required For 1.0

- Bundling OSS CAD Suite.
- Complete replacement for every CLI option.
- Full graphical board package editor for all possible peripherals.
- Full Linux hardware programming validation without a Linux test machine.
