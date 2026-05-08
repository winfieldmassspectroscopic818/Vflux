# Vflux 1.0 Linux Adaptation Notes

Vflux 1.0 should support Linux as a first-class target alongside Windows. OSS CAD Suite provides separate Linux packages, so Vflux must not assume Windows-only executable names or `environment.bat`.

## OSS CAD Suite Layout

Supported OSS CAD Suite root markers:

- `environment.bat` for Windows
- `environment` for Linux OSS CAD Suite
- `environment.sh` for shell-oriented Linux installations
- `bin/` directory on all platforms

The selected path should be the OSS CAD Suite root directory, not the `bin` directory.

Example Linux layout:

```text
/opt/oss-cad-suite/
  environment
  bin/
    yosys
    nextpnr-ice40
    nextpnr-ecp5
    icepack
    openFPGALoader
```

## Runtime Changes

- Tool lookup now accepts both `tool.exe` and `tool` forms.
- On Linux, `.exe` names from the renderer are resolved to extensionless OSS CAD Suite binaries.
- `PATH` is assembled using the platform delimiter.
- `PYTHON_EXECUTABLE` uses `python3.exe` on Windows and `python3` on Linux.
- Automatic OSS CAD Suite search checks:
  - `YOSYSHQ_ROOT`
  - `OSS_CAD_SUITE`
  - local `oss-cad-suite`
  - packaged resource `oss-cad-suite`
  - `~/oss-cad-suite`
  - `/opt/oss-cad-suite`

## Linux 1.0 Validation Checklist

1. Install the Linux OSS CAD Suite package.
2. Start Vflux from a terminal and select the OSS CAD Suite root directory.
3. Open the Toolchain page and verify:
   - `yosys`
   - `nextpnr-ice40`
   - `icepack`
   - `openFPGALoader`
   - `iverilog`
   - `vvp`
4. Create the iCESugar blinky example and run one-click validation.
5. Create the multi-file counter example and run one-click validation.
6. Run the counter simulation example and open the generated VCD/FST wave.
7. Export an HTML report.
8. Test AppImage packaging:

```bash
npm install
npm run release:check
npm run pack:linux
```

## Linux Hardware Notes

Linux USB/JTAG access may require udev rules or group permissions. Vflux should show this as a diagnostic hint when programming fails with permission-related errors.

Recommended future 1.0 work:

- Add Linux-specific programming diagnostics for udev and permission errors.
- Add README instructions for OSS CAD Suite Linux installation and USB permissions.
- Verify AppImage behavior on at least Ubuntu LTS and one rolling distribution.
