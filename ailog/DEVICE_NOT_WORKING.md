# Why Producer_Pal.amxd Doesn't Work (And How to Fix It)

## 🚨 The Problem

The `Producer_Pal.amxd` file you have is **incomplete** and won't work without building it first.

### What's Missing?

The device needs these compiled JavaScript files:

```
max-for-live-device/
├── Producer_Pal.amxd          ✅ (you have this)
├── live-api-adapter.js        ❌ MISSING - Needs build
├── mcp-server.mjs             ❌ MISSING - Needs build
├── portal.mjs                 ❌ MISSING - Needs build
└── chat-ui.html               ❌ MISSING - Needs build
```

**Without these files, the device cannot:**
- Connect to the MCP server
- Access the Live API
- Provide any tools (including browser tools)
- Function at all

---

## ✅ The Solution: Build the Device

### Quick Fix (5-10 minutes)

```bash
# 1. Navigate to the repository
cd C:\Users\akioo\Downloads\producerpalv2\producer-pal-1.3.6

# 2. Install dependencies (first time only)
npm install

# 3. Build everything
npm run build:all
```

### What This Does

The build process:
1. Compiles TypeScript → JavaScript
2. Bundles all tool implementations (including browser tools)
3. Creates the MCP server with browser support
4. Generates the web UI
5. Places all files in `max-for-live-device/`

**After building, the device will work!**

---

## 🔍 Detailed Diagnosis

### Check 1: Do the JavaScript files exist?

**Windows:**
```cmd
dir "C:\Users\akioo\Downloads\producerpalv2\producer-pal-1.3.6\max-for-live-device\*.js"
dir "C:\Users\akioo\Downloads\producerpalv2\producer-pal-1.3.6\max-for-live-device\*.mjs"
```

**Expected:** Should list 3-4 files totaling ~4-5MB

**If files are missing:** You need to build (see solution above)

### Check 2: Are the files recent?

The files should have timestamps **after** you added the browser tools.

**Windows:**
```cmd
dir /T:W "C:\Users\akioo\Downloads\producerpalv2\producer-pal-1.3.6\max-for-live-device"
```

**If files are old:** Re-run `npm run build:all`

### Check 3: Do the files contain browser tools?

**Check if browser tools are in the bundle:**

**Windows (PowerShell):**
```powershell
Select-String -Path "max-for-live-device\mcp-server.mjs" -Pattern "ppal-read-browser"
```

**Expected:** Should find "ppal-read-browser" in the file

**If not found:** The browser tools weren't included in build

---

## 🛠️ Step-by-Step Repair

### Step 1: Install Node.js (if needed)

**Check if you have Node.js:**
```bash
node --version
```

**Expected:** `v24.x.x` or higher

**If command not found:**
1. Download from https://nodejs.org/
2. Install the LTS version (24+)
3. Restart your terminal
4. Try again

### Step 2: Navigate to Repository

```bash
cd C:\Users\akioo\Downloads\producerpalv2\producer-pal-1.3.6
```

### Step 3: Install Dependencies

```bash
npm install
```

**Expected output:**
- Installs ~200-300 packages
- Takes 1-2 minutes
- Creates `node_modules/` folder
- No error messages

**If errors occur:**
```bash
# Clean and retry
rm -rf node_modules package-lock.json
npm install
```

### Step 4: Build the Device

```bash
npm run build:all
```

**Expected output:**
```
> producer-pal@1.3.6 build:all
> ENABLE_RAW_LIVE_API=true npm run build

> producer-pal@1.3.6 build
> npm run parser:build && npm run ui:build && rollup -c ...

✓ built in 30-60 seconds
```

**If errors occur:**
- Check error message
- See troubleshooting section below

### Step 5: Verify Build

**Check files were created:**

**Windows:**
```cmd
dir max-for-live-device\*.js
dir max-for-live-device\*.mjs
dir max-for-live-device\*.html
```

**Expected files:**
- `live-api-adapter.js` (~500KB)
- `mcp-server.mjs` (~3MB)
- `portal.mjs` (~1MB)
- `chat-ui.html` (~500KB)
- `ppal-raw-live-api.mjs` (~100KB) - optional debug tool

**All present?** ✅ Device is ready!

### Step 6: Test in Ableton

1. Open Ableton Live
2. Drag `max-for-live-device/Producer_Pal.amxd` onto a MIDI track
3. Check status indicator shows "Server: Ready"
4. Try a command with browser tools

---

## 🐛 Common Issues & Fixes

### Issue: "npm: command not found"

**Cause:** Node.js not installed or not in PATH

**Fix:**
1. Install Node.js from https://nodejs.org/
2. Choose LTS version (24+)
3. Restart terminal after install
4. Verify: `node --version`

### Issue: "Cannot find module 'X'" during build

**Cause:** Dependencies not properly installed

**Fix:**
```bash
rm -rf node_modules package-lock.json
npm install
npm run build:all
```

### Issue: Build completes but files are tiny (<100KB)

**Cause:** Build process failed silently

**Fix:**
1. Check build output for errors
2. Try verbose mode: `npm run build:all --verbose`
3. Check disk space (need ~500MB free)

### Issue: Device loads but shows "Server: Error"

**Cause:** JavaScript files corrupted or incomplete

**Fix:**
```bash
# Rebuild from scratch
npm run build:all

# If still failing, reinstall everything
rm -rf node_modules package-lock.json
npm install
npm run build:all
```

### Issue: Browser tools don't appear in Claude

**Cause:** Old build without browser tools

**Fix:**
1. Verify you're in the right repository (has `src/tools/browser/`)
2. Rebuild: `npm run build:all`
3. Restart Producer Pal device in Live
4. Reconnect Claude Desktop

### Issue: "ENABLE_RAW_LIVE_API is not defined"

**Cause:** Using `npm run build` instead of `npm run build:all`

**Fix:**
```bash
# Always use build:all
npm run build:all
```

---

## 🔬 Advanced Diagnostics

### Check Build Output in Detail

```bash
npm run build:all 2>&1 | tee build-log.txt
```

This saves all output to `build-log.txt` for review.

### Manually Check Bundle Contents

**Check if browser tools are bundled:**

**Linux/Mac/Git Bash:**
```bash
grep -c "ppal-read-browser" max-for-live-device/mcp-server.mjs
grep -c "ppal-load-item" max-for-live-device/mcp-server.mjs
```

**Expected:** Should find multiple occurrences of each

**PowerShell:**
```powershell
(Select-String -Path "max-for-live-device\mcp-server.mjs" -Pattern "ppal-read-browser").Count
(Select-String -Path "max-for-live-device\mcp-server.mjs" -Pattern "ppal-load-item").Count
```

### Check File Sizes

Correct sizes (approximate):
- `live-api-adapter.js`: 500KB - 800KB
- `mcp-server.mjs`: 3MB - 4MB
- `portal.mjs`: 1MB - 1.5MB
- `chat-ui.html`: 400KB - 600KB

**If files are much smaller:** Build incomplete, rebuild needed

---

## 📋 Pre-Flight Checklist

Before trying to use the device:

- [ ] Node.js 24+ installed (`node --version`)
- [ ] In correct directory (`producer-pal-1.3.6`)
- [ ] Dependencies installed (`node_modules/` exists)
- [ ] Build completed (`npm run build:all`)
- [ ] JavaScript files exist and are large (MB-sized)
- [ ] Browser tools in bundle (`grep "ppal-read-browser"`)
- [ ] Device file saved after build

---

## 🚀 Quick Command Reference

```bash
# Complete setup from scratch
cd producer-pal-1.3.6
npm install
npm run build:all

# Verify build
ls -lh max-for-live-device/*.{js,mjs,html}

# Test that it worked
npm test

# If problems, clean rebuild
rm -rf node_modules package-lock.json max-for-live-device/*.js max-for-live-device/*.mjs
npm install
npm run build:all
```

---

## 💡 Why This Happens

The repository contains **source code** (TypeScript in `src/`), but Max for Live needs **compiled JavaScript**.

Think of it like:
- **Source code** = Recipe (TypeScript)
- **Built files** = Cooked food (JavaScript)
- **Device** = Restaurant (needs the cooked food)

You can't serve the recipe to customers - you need to cook it first!

Similarly, the `.amxd` device can't run TypeScript directly - it needs compiled JavaScript bundles.

---

## ✅ Success Indicators

You'll know the device is ready when:

1. ✅ `npm run build:all` completes without errors
2. ✅ Four JavaScript files appear in `max-for-live-device/`
3. ✅ Files are several hundred KB to several MB each
4. ✅ `grep "ppal-read-browser"` finds matches in `mcp-server.mjs`
5. ✅ Device loads in Ableton Live without errors
6. ✅ Status shows "Server: Ready"
7. ✅ Tools list includes `ppal-read-browser` and `ppal-load-item`

**Once all checks pass, the device works perfectly!** 🎉

---

## 📞 Still Not Working?

If you've tried everything and it still doesn't work:

1. **Check build log for specific errors**
   ```bash
   npm run build:all 2>&1 | tee build-log.txt
   ```

2. **Verify Node.js version**
   ```bash
   node --version  # Must be 24+
   ```

3. **Check disk space**
   - Need ~500MB for build process
   - Check with: `df -h` (Linux/Mac) or File Explorer (Windows)

4. **Try a different terminal**
   - Use Command Prompt instead of PowerShell
   - Or use Git Bash if available

5. **Review the error message carefully**
   - Build errors usually indicate what's wrong
   - Search for the specific error online

**Remember:** The device CANNOT work without building. There's no workaround - you must run `npm run build:all` for the device to function.
