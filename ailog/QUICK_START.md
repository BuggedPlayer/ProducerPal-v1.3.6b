# Quick Start Guide - Browser Implementation

## 🚀 Setup (5 minutes)

```bash
# 1. Extract archive
tar -xzf producer-pal-browser-implementation.tar.gz
cd producer-pal-1.3.6

# 2. Install dependencies
npm install

# 3. Build everything
npm run build:all

# 4. Run tests
npm test
```

## 📖 Usage Examples

### Browse User Library

```javascript
// List all items in user library
await callTool("ppal-read-browser", {});

// Browse drums
await callTool("ppal-read-browser", {
  category: "drums",
  maxDepth: 1
});

// Search for kicks
await callTool("ppal-read-browser", {
  category: "samples",
  search: "kick"
});
```

### Load Items

```javascript
// Load preset into selected track
await callTool("ppal-load-item", {
  uri: "browser://instruments/analog/bass/sub_bass_1"
});

// Load into specific track
await callTool("ppal-load-item", {
  uri: "browser://audio_effects/reverb/large_hall",
  trackId: "id 2"
});

// Replace current device
await callTool("ppal-load-item", {
  uri: "browser://instruments/wavetable/leads/square_lead",
  position: "replace"
});
```

## 🎯 What You Can Do Now

✅ Browse all library categories programmatically
✅ Search for presets by name
✅ Load devices, presets, and samples into tracks
✅ Navigate complex library hierarchies
✅ Filter results by category and depth

## 📁 Key Files

```
src/tools/browser/
├── read-browser.ts      - Browse implementation
├── load-item.ts         - Load implementation
└── *.test.ts            - Unit tests

Modified:
├── src/types/live-api.d.ts                - Browser types
├── src/mcp-server/create-mcp-server.ts    - Tool registration
└── src/live-api-adapter/live-api-adapter.ts - Dispatch
```

## 🧪 Testing

```bash
npm test                    # Run all tests
npm run test:coverage       # With coverage report
npm run check               # Full quality checks
```

## 📚 Documentation

- `BROWSER_IMPLEMENTATION_SUMMARY.md` - Complete technical details
- `EXPORT_README.md` - Full export documentation
- `todo.txt` - Updated limitations (now includes browser access!)

## 💡 Tips

1. **Search first** - Use `search` parameter to narrow results
2. **Control depth** - Set `maxDepth: 0` for top-level only
3. **Check URIs** - Save URIs from `ppal-read-browser` to load items later
4. **1000-item limit** - Use `path` or `search` if you hit the limit

## 🐛 Troubleshooting

**Browser not available?**
- Check Live version supports Browser API (Live 9+)

**Item not loadable?**
- Verify `isLoadable: true` in browse results

**Track not found?**
- Omit `trackId` to use selected track
- Check track ID format: `"id 1"`, `"id 2"`, etc.

## 🎉 Ready to Go!

Your Producer Pal now has full browser and library management capabilities. Start browsing and loading!
