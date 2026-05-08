# Vflux 1.0 Release Checklist

This checklist is the release gate for Vflux 1.0. Run it on Windows before publishing. Linux validation is tracked separately in `docs/linux-1.0-adaptation.md`.

## 1. Clean Build Preparation

- [ ] Pull latest source.
- [ ] Remove old `dist/` artifacts.
- [ ] Run `npm install`.
- [ ] Run `npm run release:check`.
- [ ] Confirm `package.json` version is the intended release version.
- [ ] Confirm README files mention that OSS CAD Suite is not bundled.

## 2. First Launch

- [ ] Start development build with `npm start`.
- [ ] Confirm language selection appears on a fresh profile.
- [ ] Confirm the Vflux 1.0 startup wizard appears after language selection.
- [ ] Confirm wizard buttons open:
  - [ ] Toolchain page
  - [ ] Examples page
  - [ ] New project dialog
- [ ] Confirm "do not show again" is remembered.

## 3. Toolchain

- [ ] Select OSS CAD Suite root directory.
- [ ] Confirm the path is remembered after restarting Vflux.
- [ ] Run toolchain environment check.
- [ ] Confirm required iCE40 tools are available:
  - [ ] Yosys
  - [ ] nextpnr-ice40
  - [ ] icepack
  - [ ] selected programmer or drag-and-drop path
- [ ] Confirm optional tools are shown as optional, not blocking.

## 4. Project Workflow

- [ ] Create a new project.
- [ ] Confirm professional skeleton files are generated:
  - [ ] `src/vflux_defs.vh`
  - [ ] `constraints/<top>.sdc`
  - [ ] `scripts/yosys_extra.ys`
  - [ ] nextpnr hook scripts
  - [ ] `formal/<top>.sby`
  - [ ] `mcy/<top>.cfg`
  - [ ] `docs/design-notes.md`
- [ ] Save project.
- [ ] Reopen project.
- [ ] Confirm `project.vflux.yaml` contains `schema_version`.
- [ ] Run project health check.
- [ ] Confirm `output/reports/project-health.json` is generated.

## 5. Examples

- [ ] Create and validate `iCESugar LED Blinky`.
- [ ] Create and validate `iCESugar Multi-file Counter`.
- [ ] Run `Verilog Counter Sim`.
- [ ] Confirm waveform can be opened from simulation or waveform workbench.
- [ ] Confirm example validation generates:
  - [ ] bitstream
  - [ ] acceptance JSON
  - [ ] HTML report

## 6. Reports

- [ ] Open Report Center.
- [ ] Refresh report.
- [ ] Export HTML report.
- [ ] Export diagnostic package.
- [ ] Confirm diagnostic package contains manifest and report artifacts.
- [ ] Confirm diagnostic package does not copy the full RTL source tree by default.

## 7. Programming

- [ ] For iCESugar, confirm board default programming method prefers drag-and-drop mass storage.
- [ ] Select board drive directory.
- [ ] Copy generated `.bin` to the board drive.
- [ ] Confirm board runs the design.
- [ ] Run programming diagnostics and confirm readable feedback.

## 8. UI

- [ ] Switch light/dark theme.
- [ ] Switch Chinese/English UI.
- [ ] Collapse and expand left workflow groups.
- [ ] Confirm full-screen layout does not leave large unused workspace.
- [ ] Confirm top menu items are reachable.

## 9. Packaging

- [ ] Run `npm run pack:win`.
- [ ] Launch the generated portable exe.
- [ ] Confirm app icon appears in the window and taskbar.
- [ ] Repeat toolchain selection and example validation in the packaged app.
- [ ] Upload exe to GitHub Release, not to the source tree.

## 10. Release Notes

- [ ] Summarize major changes.
- [ ] List known limitations.
- [ ] Mention OSS CAD Suite installation requirement.
- [ ] Mention Windows is the validated 1.0 target if Linux is not yet verified.
