# GitHub Upload and Release Checklist

## Repository Prep

1. Confirm the package is ready:

   ```powershell
   npm run release:check
   ```

2. Confirm OSS CAD Suite is **not** bundled:

   - `package.json` should not contain `extraResources` pointing to `oss-cad-suite`.
   - Users install OSS CAD Suite separately.

3. Confirm key files exist:

   ```text
   README.md
   README.en.md
   docs/release-0.9-windows-checklist.md
   assets/icon.ico
   assets/icon.png
   ```

## Initialize Git

If this folder is not already a Git repository:

```powershell
git init
git add .
git commit -m "Prepare Vflux 0.9 preview"
```

If the repository already exists:

```powershell
git status
git add .
git commit -m "Prepare Vflux 0.9 preview"
```

## Push to GitHub

Create an empty GitHub repository first, then run:

```powershell
git remote add origin https://github.com/<your-name>/<your-repo>.git
git branch -M main
git push -u origin main
```

## Build Windows Portable

```powershell
npm run pack:win
```

Output will be under:

```text
dist/
```

## Suggested 0.9 Release Notes

Title:

```text
Vflux 0.9 Windows Preview
```

Summary:

```text
Vflux 0.9 is a Windows portable preview for FPGA learning and OSS CAD Suite workflows.

Highlights:
- iCESugar drag-and-drop programming workflow
- Built-in iCE40/ECP5/Gowin examples
- Multi-file Verilog example with include header
- Toolchain environment acceptance check
- HTML report export
- Basic GUI custom board package creation
- Chinese and English UI

OSS CAD Suite is not bundled. Please install it separately and select its path in Vflux.
```

Attach the generated Windows portable artifact from `dist/`.
