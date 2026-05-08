# Vflux 1.0.0 Windows / 0.9.1 Linux Preview Release Notes

Vflux 1.0.0 is the first Windows-focused release of the Vflux FPGA GUI workflow. Linux AppImage packaging is provided as a 0.9.1 preview because it still requires separate real-machine validation.

## Highlights

- Visual FPGA workflow around OSS CAD Suite.
- Project creation, board selection, toolchain validation, check, synthesis, place-and-route, bitstream generation, programming, simulation, and reports.
- Built-in examples for blinky, multi-file counter, PWM breathing LED, button debounce, UART echo, and pure simulation.
- Stage-separated output folders under `output/`.
- Advanced synthesis, P&R, bitstream, programming, simulation, Verilator, formal, and MCY options.
- Report Center with release readiness card, HTML report export, visual artifact links, and diagnostic package export.
- `1.0 Release Preflight` button for project health check, toolchain validation, one-click build, HTML report export, and readiness refresh.
- Basic GUI custom board package creation with validation.
- Chinese/English UI and light/dark themes.

## Requirements

Vflux does not bundle OSS CAD Suite. Users need to install OSS CAD Suite separately:

<https://github.com/YosysHQ/oss-cad-suite-build/releases>

On Windows, select the OSS CAD Suite root directory in Vflux. The selected directory should contain:

```text
environment.bat
bin/
```

## Recommended Validation Before Publishing Windows 1.0.0

1. Run `npm run release:check`.
2. Start Vflux with `npm start`.
3. Configure OSS CAD Suite in the Toolchain page.
4. Create and run:
   - `iCESugar LED Blinky`
   - `iCESugar Multi-file Counter`
   - `iCESugar PWM Breathing LED`
   - `iCESugar Button Debounce`
   - `iCESugar UART Echo`
   - `Verilog Counter Sim`
5. Open Report Center and run `1.0 Release Preflight`.
6. Confirm the release readiness card has no red blocking items.
7. For iCESugar, verify mass-storage drag-and-drop programming with the generated `.bin`.

## Known Limits

- Windows portable is the primary validated target for 1.0.0.
- Linux AppImage is a 0.9.1 preview and still needs real Linux machine validation.
- OSS CAD Suite is not bundled.
- ECP5 and Gowin flows need broader real-board validation.
- The GUI custom board editor creates a useful basic board package; complex boards may still require manual YAML editing.
- Portable Windows builds are unsigned unless the publisher adds code signing.

## Build Commands

```powershell
npm run release:check
npm run pack:win
```

Linux preview build:

```bash
npm run pack:linux
```
