# Vflux 1.0.0 Windows Hardware Validation Checklist

This checklist is intended for real-board validation before publishing the Windows 1.0.0 build.

## Environment

- Windows version:
- Vflux build:
- OSS CAD Suite path:
- OSS CAD Suite release/date:
- Board:
- USB driver notes:

## Global Checks

- [ ] Vflux starts without showing Electron default icon in the taskbar/window frame.
- [ ] Language selection works.
- [ ] Light and dark themes are readable.
- [ ] Toolchain page automatically detects OSS CAD Suite.
- [ ] Toolchain acceptance writes `output/reports/toolchain-acceptance.json`.
- [ ] Report Center opens without missing-button errors.
- [ ] `1.0 Release Preflight` can run from the Report Center.

## iCESugar LED Blinky

- [ ] Example can be created.
- [ ] Project health check passes or only shows acceptable warnings.
- [ ] Check passes.
- [ ] Synthesis passes.
- [ ] Place-and-route passes.
- [ ] Bitstream generation creates `output/bitstream/top.bin`.
- [ ] HTML report is generated.
- [ ] Mass-storage programming copies the `.bin` to the board drive.
- [ ] LED behavior matches the example.

## iCESugar Multi-file Counter

- [ ] Example can be created.
- [ ] Header/include file is recognized.
- [ ] Multiple Verilog source files are listed.
- [ ] One-click build passes.
- [ ] `output/reports/vflux-acceptance.json` reports success.
- [ ] Mass-storage programming works.
- [ ] LED counter behavior is visible.

## iCESugar PWM Breathing LED

- [ ] Example can be created.
- [ ] One-click build passes.
- [ ] Bitstream is generated.
- [ ] Mass-storage programming works.
- [ ] LED brightness changes smoothly or visibly.

## iCESugar Button Debounce

- [ ] Example can be created.
- [ ] One-click build passes.
- [ ] Bitstream is generated.
- [ ] Mass-storage programming works.
- [ ] Button input changes LED state reliably.

## iCESugar UART Echo

- [ ] Example can be created.
- [ ] One-click build passes.
- [ ] Bitstream is generated.
- [ ] Mass-storage programming works.
- [ ] Serial adapter uses expected TX/RX pins.
- [ ] Serial terminal uses 115200 baud, 8N1.
- [ ] Received byte is echoed back.

## Simulation Examples

- [ ] `Verilog Counter Sim` runs.
- [ ] VCD/FST wave file is generated under `output/simulation`.
- [ ] Waveform viewer opens an existing wave file.
- [ ] `Verilog FSM Simulation` runs.
- [ ] FSM waveform opens.

## Release Decision

- [ ] No red blocking item in Report Center release readiness.
- [ ] Diagnostic package export works.
- [ ] README and release notes match the build version.
- [ ] Windows portable `.exe` launches from `dist/`.
- [ ] ZIP/portable artifact name and version are correct.

## Notes

Record any issue with:

- project name
- exact step
- visible Vflux feedback
- technical details/log excerpt
- generated diagnostic package path
