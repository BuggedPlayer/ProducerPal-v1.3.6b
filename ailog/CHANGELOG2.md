# ⚠️ READ THIS FIRST - Producer Pal Export

## 🚨 CRITICAL: The Device Won't Work Without Building!

The `Producer_Pal.amxd` file in this export **WILL NOT WORK** until you build it.

### Why?

The device needs compiled JavaScript bundles that don't exist yet. You have the source code, but Max for Live needs the built files.

---

## ✅ Quick Start (10 minutes)

### 1. Extract Archive

```bash
tar -xzf producer-pal-browser-implementation.tar.gz
cd producer-pal-1.3.6
```

### 2. Install Node.js (if needed)

- Download from: https://nodejs.org/
- Need version 24 or higher
- Verify: `node --version`

### 3. Build the Device

```bash
# Install dependencies (first time only, ~2 minutes)
npm install

# Build everything (~1 minute)
npm run build:all
```

### 4. Use in Ableton Live

1. Open Ableton Live
2. Drag `max-for-live-device/Producer_Pal.amxd` onto a MIDI track
3. Device should show "Server: Ready"
4. Configure AI provider and start using!

---

## 📚 Documentation Files

Choose based on your situation:

### **→ Device Not Working?**
Read: `DEVICE_NOT_WORKING.md`
- Detailed troubleshooting
- Common issues and fixes
- Step-by-step repair guide

### **→ Need Build Instructions?**
Read: `BUILD_INSTRUCTIONS.md`
- Complete build process
- Development workflow
- Quality checks and testing

### **→ Want Feature Overview?**
Read: `EXPORT_README.md`
- Complete export documentation
- API reference
- Usage examples

### **→ Quick Examples?**
Read: `QUICK_START.md`
- 5-minute guide
- Usage examples
- Tips and tricks

### **→ Technical Details?**
Read (in repository): `BROWSER_IMPLEMENTATION_SUMMARY.md`
- Implementation details
- Architecture decisions
- API references

---

## 🎯 What This Export Contains

### New Features (Browser & Library Management)

✅ **Browse Ableton's Library**
```javascript
// Browse instruments
{ "category": "instruments", "search": "bass" }
```

✅ **Load Presets, Samples, Devices**
```javascript
// Load a preset
{ "uri": "browser://instruments/analog/bass/sub_bass_1" }
```

### What You Get

1. **Complete Source Code** with browser implementation
2. **Git Repository** with full history
3. **Comprehensive Tests** for all features
4. **Documentation** (5 guides included)
5. **Build System** ready to compile

### What You Need to Do

1. **Install Node.js 24+**
2. **Run `npm install`**
3. **Run `npm run build:all`**
4. **Load device in Ableton**

**That's it!** After building, everything works.

---

## ⚡ Super Quick Reference

```bash
# Complete setup
cd producer-pal-1.3.6
npm install
npm run build:all

# Verify it worked
ls -lh max-for-live-device/*.{js,mjs,html}

# Should see:
# - live-api-adapter.js (~500KB)
# - mcp-server.mjs (~3MB)
# - portal.mjs (~1MB)
# - chat-ui.html (~500KB)
```

---

## 🚫 Common Mistakes

### ❌ Mistake #1: Skipping the Build
**Problem:** Trying to use `Producer_Pal.amxd` directly
**Fix:** You MUST run `npm run build:all` first

### ❌ Mistake #2: Using `npm run build`
**Problem:** Missing browser tools
**Fix:** Always use `npm run build:all` (with "all")

### ❌ Mistake #3: Old Node.js
**Problem:** Build fails with errors
**Fix:** Update to Node.js 24+ from nodejs.org

### ❌ Mistake #4: Not Installing Dependencies
**Problem:** Build says "module not found"
**Fix:** Run `npm install` before building

### ❌ Mistake #5: Building on One Computer, Using on Another
**Problem:** Files missing when you copy just the .amxd
**Fix:** Copy the entire `max-for-live-device/` folder OR rebuild on target computer

---

## 📂 Export File Structure

```
producerpalv2/
├── producer-pal-browser-implementation.tar.gz (29MB)
│   └── Complete repository - Extract this first!
│
├── 📄 README_FIRST.md (this file)
├── 📄 DEVICE_NOT_WORKING.md - Troubleshooting guide
├── 📄 BUILD_INSTRUCTIONS.md - Complete build guide
├── 📄 EXPORT_README.md - Full documentation
├── 📄 QUICK_START.md - 5-minute guide
├── 📄 EXPORT_MANIFEST.txt - Change summary
├── 📄 EXPORT_STRUCTURE.txt - File tree
└── 📄 CHANGELOG.txt - Git history
```

---

## 🎬 Start Here

### If you just extracted the archive:

1. **Read this file** (you're doing it!)
2. **Install Node.js** if you don't have it
3. **Open terminal** in `producer-pal-1.3.6/`
4. **Run:** `npm install && npm run build:all`
5. **Load** `Producer_Pal.amxd` in Ableton Live
6. **Done!** 🎉

### If the device doesn't work:

1. **Read:** `DEVICE_NOT_WORKING.md`
2. **Check:** Did you run `npm run build:all`?
3. **Verify:** Do JavaScript files exist in `max-for-live-device/`?
4. **Sizes:** Are the files MB-sized (not KB)?

### If you want to understand what's new:

1. **Read:** `EXPORT_README.md` - Complete overview
2. **Read:** `QUICK_START.md` - Usage examples
3. **Read:** In repository: `BROWSER_IMPLEMENTATION_SUMMARY.md`

---

## 💡 Key Points

1. **Source code ≠ Working device**
   - You have source code (TypeScript)
   - Device needs built files (JavaScript)
   - Build process converts source → built files

2. **Building is required**
   - No way around it
   - Takes ~5-10 minutes first time
   - Only needs to be done once (unless you change code)

3. **Build creates these files:**
   - `live-api-adapter.js` - Runs in Max V8
   - `mcp-server.mjs` - MCP server with tools
   - `portal.mjs` - Communication bridge
   - `chat-ui.html` - Web interface

4. **Without these files:**
   - Device won't load
   - Or loads but shows errors
   - Tools don't work
   - Browser features unavailable

5. **After building once:**
   - Device works perfectly
   - All tools available
   - Browser features enabled
   - Ready for production use

---

## ✅ Success Checklist

Before using the device, verify:

- [ ] Extracted the tar.gz archive
- [ ] Node.js 24+ installed (`node --version`)
- [ ] Ran `npm install` (creates `node_modules/`)
- [ ] Ran `npm run build:all` (creates .js/.mjs files)
- [ ] Files exist in `max-for-live-device/`:
  - [ ] `live-api-adapter.js` (~500KB)
  - [ ] `mcp-server.mjs` (~3MB)
  - [ ] `portal.mjs` (~1MB)
  - [ ] `chat-ui.html` (~500KB)
- [ ] Device loads in Ableton without errors
- [ ] Status shows "Server: Ready"

**All checked?** You're ready to use Producer Pal! 🚀

---

## 🆘 Need Help?

### Quick Fixes

**Device won't load:** Did you build? Run `npm run build:all`

**Build errors:** Check Node.js version - need 24+

**Tools missing:** Use `build:all` not just `build`

**Still broken:** Read `DEVICE_NOT_WORKING.md`

### Documentation Index

- `README_FIRST.md` ← You are here
- `DEVICE_NOT_WORKING.md` ← Device troubleshooting
- `BUILD_INSTRUCTIONS.md` ← Detailed build guide
- `EXPORT_README.md` ← Complete documentation
- `QUICK_START.md` ← 5-minute guide

---

## 🎯 Bottom Line

**The device requires building. There's no shortcut.**

1. Install Node.js 24+
2. Run `npm install`
3. Run `npm run build:all`
4. Use device in Ableton

**That's the only way to make it work.** But once you do, you'll have a fully functional Producer Pal with complete browser and library management! 🎉

---

**Ready to build? Open a terminal and run:**

```bash
cd producer-pal-1.3.6
npm install && npm run build:all
```

**Then load `Producer_Pal.amxd` in Ableton Live!**
