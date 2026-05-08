# Vflux

Chinese guide: [README.zh-CN.md](README.zh-CN.md)

Vflux is a small graphical FPGA development tool designed to work with [OSS CAD Suite](https://github.com/YosysHQ/oss-cad-suite-build). It does not reimplement Yosys, nextpnr, icepack, ecppack, openFPGALoader, or other low-level tools. Instead, it organizes the command-line FPGA workflow into a clear visual pipeline.

The current Windows release target is **Vflux 1.0.0**. Linux AppImage packaging is prepared as **0.9.1 Linux preview** and still requires separate real-machine validation.

## Before You Start

Vflux **does not bundle OSS CAD Suite**. Please install OSS CAD Suite separately before using Vflux.

Recommended setup:

1. Download OSS CAD Suite:
   <https://github.com/YosysHQ/oss-cad-suite-build/releases>
2. Extract it to a stable directory, for example:

   ```text
   D:\oss-cad-suite
   ```

3. Open Vflux.
4. Go to the Toolchain page.
5. If auto-detection fails, click Browse and select the OSS CAD Suite root directory, the one containing `environment.bat` and `bin`.
6. Run the environment acceptance check.

## Features

- Create, open, and save Vflux FPGA projects.
- Select built-in board packages or create custom board packages.
- Import existing Verilog/SystemVerilog projects by scanning source and constraint files.
- Run check, synthesis, place-and-route, and bitstream generation.
- Store outputs by stage:
  - `output/synthesis`
  - `output/pnr`
  - `output/bitstream`
  - `output/reports`
  - `output/simulation`
- Configure advanced options for synthesis, P&R, bitstream generation, and programming.
- Show user-friendly feedback while keeping raw command-line details available.
- Run simulation, waveform viewing, formal verification, Verilator, and MCY workflows.
- Export HTML build reports.
- Switch between Chinese and English UI.
- Switch between dark and light themes.

## Basic Workflow

1. Open Vflux.
2. Open the Toolchain page. Vflux automatically starts environment detection.
3. Create a new project, open an existing project, or create a built-in example.
4. Select a target board.
5. Write Verilog/SystemVerilog in VS Code or another editor.
6. Return to Vflux and run:
   - Check
   - Synthesis
   - Place and route
   - Bitstream generation
7. Open the Report Center to review artifacts, timing, resources, and acceptance results.
8. Program the board using the Programming workbench.

For a first run, the recommended path is:

1. Install and extract OSS CAD Suite.
2. Open Vflux and choose language/theme.
3. Validate the OSS CAD Suite environment on the Toolchain page.
4. Create `iCESugar LED Blinky` or `iCESugar Multi-file Counter` from Examples.
5. Run One-click Build or use `1.0 Release Preflight` in the Report Center.
6. Review the readiness card and generated HTML report.

## Built-in Examples

| Example | Target | Purpose |
| --- | --- | --- |
| `iCESugar LED Blinky` | iCE40 / iCESugar | Minimal LED example for basic end-to-end testing |
| `iCESugar Multi-file Counter` | iCE40 / iCESugar | Multi-file Verilog project with an include header and submodules |
| `iCESugar PWM Breathing LED` | iCE40 / iCESugar | PWM duty-cycle ramp and register logic example |
| `iCESugar Button Debounce` | iCE40 / iCESugar | Button synchronization, debounce, and edge detection |
| `iCESugar UART Echo` | iCE40 / iCESugar | Multi-module UART RX/TX echo template |
| `iCESugar-pro Blinky` | ECP5 / iCESugar-pro | ECP5 blinky flow |
| `Tang Nano 9K Blinky` | Gowin / Tang Nano 9K | Gowin flow example |
| `Verilog Counter Sim` | Simulation only | Icarus Verilog, VVP, and waveform testing |
| `Verilog FSM Simulation` | Simulation only | FSM testbench and VCD waveform example |

## Programming

Vflux supports several programming methods:

- `icesprog`
- `openFPGALoader`
- `ecpprog`
- DFU
- JTAG
- Mass-storage drag-and-drop

For iCESugar, if manual drag-and-drop programming works, choose **Mass Storage** in the Programming page. Vflux now prefers this path for iCESugar when the board default method is selected.

## Board Configuration

Board packages are stored as YAML files under `boards/*.yaml`. A board package usually contains:

- Board name
- FPGA family, device, package, and speed grade
- Clock, LEDs, buttons, UART, and other resources
- Constraint type
- Synthesis, P&R, packing, and programming tools

Vflux currently supports:

1. Built-in board packages.
2. Custom board templates.
3. Exporting a board package draft.
4. Creating a basic custom board package from the GUI.

The GUI custom board editor can create a usable basic board package in the current project under `boards/*.yaml`. For complex boards, you can continue editing the generated YAML manually. More validation and peripheral editing should be completed before 1.0.

## Project File

Vflux project settings are saved in:

```text
project.vflux.yaml
```

This file records the project name, top module, source files, constraints, target board, toolchain path, and flow options.

## Report Center

The Report Center summarizes:

- Project acceptance result
- Toolchain acceptance result
- Release readiness
- FPGA device information
- Synthesis, P&R, bitstream, timing, and report artifacts
- Visual artifact links
- HTML report export
- Diagnostic package export

Before packaging or sharing a preview build, click:

```text
1.0 Release Preflight
```

It runs project health check, toolchain acceptance, one-click build, HTML report export, and then refreshes the release readiness card.

## FAQ

### Vflux cannot find OSS CAD Suite

Select the OSS CAD Suite root directory, not the `bin` directory. The correct directory should contain `environment.bat` and `bin`.

### The Toolchain page stays red

First make sure OSS CAD Suite can run outside Vflux. Then reselect the root path in Vflux and run the environment acceptance check again.

### iCESugar DFU or FTDI detection fails

If mass-storage drag-and-drop programming works, choose **Mass Storage**. DFU/FTDI can depend on drivers, permissions, and board boot mode.

### Simulation succeeds but no waveform opens

Check whether the testbench contains `$dumpfile` and `$dumpvars`. Vflux only enables waveform viewing after it finds a real `.vcd` or `.fst` file under `output/simulation`.

### Some report artifacts are missing

The Report Center only shows real files. SDF, gate-level Verilog, SVG, or Floorplan HTML must be enabled in the corresponding workbench and regenerated.

### Windows warns about an unknown publisher

The portable RC build is unsigned by default. Windows may show an unknown publisher warning.

## Development

Install dependencies:

```powershell
npm install
```

Run in development mode:

```powershell
npm start
```

Validate built-in examples:

```powershell
npm run validate:examples
```

## Windows 1.0.0 Build

Vflux does not include OSS CAD Suite in the packaged app. Users must install OSS CAD Suite separately and select its path inside Vflux.

Build the Windows 1.0.0 portable release:

```powershell
npm run pack:win
```

Output:

```text
dist/
```

## Linux 0.9.1 Preview

Build the Linux 0.9.1 AppImage preview:

```bash
npm run pack:linux
```

Linux packaging should be validated separately, especially toolchain path handling, permissions, USB/JTAG access, and AppImage behavior.

## Release Scope

- Windows 1.0.0 portable release.
- Linux 0.9.1 AppImage preview.
- iCESugar drag-and-drop programming flow.
- Built-in example creation and acceptance.
- HTML report export.
- Basic custom board package creation.
- Release readiness card and release preflight flow.

## 1.0 Goals

- Windows and Linux deliverables.
- More complete board package editor.
- Embedded visual previews in the Report Center.
- More real-board end-to-end examples.
- Better programming diagnostics and toolchain checks.
