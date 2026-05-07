# Vflux

Vflux is a small graphical FPGA development tool designed to work with [OSS CAD Suite](https://github.com/YosysHQ/oss-cad-suite-build). It does not reimplement Yosys, nextpnr, icepack, ecppack, openFPGALoader, or other low-level tools. Instead, it organizes the command-line FPGA workflow into a clear visual pipeline.

The current release target is **Vflux 0.9 Windows preview**. It focuses on the iCE40/iCESugar learning workflow, while also providing ECP5 and Gowin project configuration paths.

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

## Built-in Examples

| Example | Target | Purpose |
| --- | --- | --- |
| `iCESugar LED Blinky` | iCE40 / iCESugar | Minimal LED example for basic end-to-end testing |
| `iCESugar Multi-file Counter` | iCE40 / iCESugar | Multi-file Verilog project with an include header and submodules |
| `iCESugar-pro Blinky` | ECP5 / iCESugar-pro | ECP5 blinky flow |
| `Tang Nano 9K Blinky` | Gowin / Tang Nano 9K | Gowin flow example |
| `Verilog Counter Sim` | Simulation only | Icarus Verilog, VVP, and waveform testing |

## Programming

Vflux supports several programming methods:

- `icesprog`
- `openFPGALoader`
- `ecpprog`
- DFU
- JTAG
- Mass-storage drag-and-drop

For iCESugar, if manual drag-and-drop programming works, choose **Mass Storage** in the Programming page. This is currently the most reliable path for the 0.9 preview.

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

## Windows Preview Build

Vflux 0.9 does not include OSS CAD Suite in the packaged app. Users must install OSS CAD Suite separately and select its path inside Vflux.

Build the Windows portable preview:

```powershell
npm run pack:win
```

Output:

```text
dist/
```

## Linux Plan

The Linux AppImage script is already reserved:

```bash
npm run pack:linux
```

Linux packaging should be validated separately before 1.0, especially toolchain path handling, permissions, USB/JTAG access, and AppImage behavior.

## 0.9 Scope

- Windows portable preview.
- iCESugar drag-and-drop programming flow.
- Built-in example creation and acceptance.
- HTML report export.
- Basic custom board package creation.

## 1.0 Goals

- Windows and Linux deliverables.
- More complete board package editor.
- Embedded visual previews in the Report Center.
- More real-board end-to-end examples.
- Better programming diagnostics and toolchain checks.
