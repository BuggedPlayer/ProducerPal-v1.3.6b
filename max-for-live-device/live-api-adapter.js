/*
# The MIT License (MIT)

Copyright (c) 2026 Adam Murray (https://adammurray.link)

Permission is hereby granted, free of charge, to any person obtaining a copy of
this software and associated documentation files (the “Software”), to deal in
the Software without restriction, including without limitation the rights to
use, copy, modify, merge, publish, distribute, sublicense, and/or sell copies of
the Software, and to permit persons to whom the Software is furnished to do so,
subject to the following conditions:

The above copyright notice and this permission notice shall be included in all
copies or substantial portions of the Software.

THE SOFTWARE IS PROVIDED “AS IS”, WITHOUT WARRANTY OF ANY KIND, EXPRESS OR
IMPLIED, INCLUDING BUT NOT LIMITED TO THE WARRANTIES OF MERCHANTABILITY, FITNESS
FOR A PARTICULAR PURPOSE AND NONINFRINGEMENT. IN NO EVENT SHALL THE AUTHORS OR
COPYRIGHT HOLDERS BE LIABLE FOR ANY CLAIM, DAMAGES OR OTHER LIABILITY, WHETHER
IN AN ACTION OF CONTRACT, TORT OR OTHERWISE, ARISING FROM, OUT OF OR IN
CONNECTION WITH THE SOFTWARE OR THE USE OR OTHER DEALINGS IN THE SOFTWARE.

*/

function parseIdOrPath(idOrPath) {
  if (Array.isArray(idOrPath)) {
    if (idOrPath.length === 2 && idOrPath[0] === "id") {
      return `id ${String(idOrPath[1])}`;
    }
    throw new Error(`Invalid array format for LiveAPI.from(): expected ["id", value], got [${String(idOrPath)}]`);
  }
  if (typeof idOrPath === "number") {
    return `id ${idOrPath}`;
  }
  const pathString = idOrPath;
  if (/^\d+$/.test(pathString)) {
    return `id ${pathString}`;
  }
  return pathString;
}

if (typeof LiveAPI !== "undefined") {
  LiveAPI.from = function(idOrPath) {
    return new LiveAPI(parseIdOrPath(idOrPath));
  };
  LiveAPI.prototype.exists = function() {
    const id = this.id;
    return id !== "id 0" && id !== "0" && id !== 0;
  };
  LiveAPI.prototype.getProperty = function(property) {
    switch (property) {
     case "scale_intervals":
     case "available_warp_modes":
      return this.get(property);

     case "available_input_routing_channels":
     case "available_input_routing_types":
     case "available_output_routing_channels":
     case "available_output_routing_types":
     case "input_routing_channel":
     case "input_routing_type":
     case "output_routing_channel":
     case "output_routing_type":
      {
        const rawValue = this.get(property);
        if (rawValue?.[0]) {
          try {
            const parsed = JSON.parse(rawValue[0]);
            return parsed[property];
          } catch {
            return null;
          }
        }
        return null;
      }

     default:
      {
        const result = this.get(property);
        return result?.[0];
      }
    }
  };
  LiveAPI.prototype.setProperty = function(property, value) {
    const val = value;
    switch (property) {
     case "input_routing_type":
     case "input_routing_channel":
     case "output_routing_type":
     case "output_routing_channel":
      {
        const jsonValue = JSON.stringify({
          [property]: val
        });
        return this.set(property, jsonValue);
      }

     case "selected_track":
     case "selected_scene":
     case "detail_clip":
     case "highlighted_clip_slot":
      {
        const formattedValue = typeof val === "string" && !val.startsWith("id ") && /^\d+$/.test(val) ? `id ${val}` : val;
        return this.set(property, formattedValue);
      }

     default:
      return this.set(property, val);
    }
  };
  LiveAPI.prototype.getChildIds = function(name) {
    const idArray = this.get(name);
    if (!Array.isArray(idArray)) {
      return [];
    }
    const children = [];
    for (let i = 0; i < idArray.length; i += 2) {
      if (idArray[i] === "id") {
        children.push(`id ${String(idArray[i + 1])}`);
      }
    }
    return children;
  };
  LiveAPI.prototype.getChildren = function(name) {
    return this.getChildIds(name).map(id => new LiveAPI(id));
  };
  LiveAPI.prototype.getColor = function() {
    const colorValue = this.getProperty("color");
    if (colorValue === void 0) {
      return null;
    }
    const r = colorValue >> 16 & 255;
    const g = colorValue >> 8 & 255;
    const b = colorValue & 255;
    return "#" + r.toString(16).padStart(2, "0").toUpperCase() + g.toString(16).padStart(2, "0").toUpperCase() + b.toString(16).padStart(2, "0").toUpperCase();
  };
  LiveAPI.prototype.setColor = function(cssColor) {
    if (!cssColor.startsWith("#") || cssColor.length !== 7) {
      throw new Error(`Invalid color format: must be "#RRGGBB"`);
    }
    const r = Number.parseInt(cssColor.substring(1, 3), 16);
    const g = Number.parseInt(cssColor.substring(3, 5), 16);
    const b = Number.parseInt(cssColor.substring(5, 7), 16);
    if (Number.isNaN(r) || Number.isNaN(g) || Number.isNaN(b)) {
      throw new Error(`Invalid hex values in color: ${cssColor}`);
    }
    this.set("color", r << 16 | g << 8 | b);
  };
  LiveAPI.prototype.setAll = function(properties) {
    for (const [property, value] of Object.entries(properties)) {
      if (value != null) {
        if (property === "color") {
          this.setColor(value);
        } else {
          this.set(property, value);
        }
      }
    }
  };
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "trackIndex")) {
    Object.defineProperty(LiveAPI.prototype, "trackIndex", {
      get: function() {
        const match = this.path.match(/live_set tracks (\d+)/);
        return match ? Number(match[1]) : null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "returnTrackIndex")) {
    Object.defineProperty(LiveAPI.prototype, "returnTrackIndex", {
      get: function() {
        const match = this.path.match(/live_set return_tracks (\d+)/);
        return match ? Number(match[1]) : null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "category")) {
    Object.defineProperty(LiveAPI.prototype, "category", {
      get: function() {
        if (this.path.includes("live_set tracks")) {
          return "regular";
        } else if (this.path.includes("live_set return_tracks")) {
          return "return";
        } else if (this.path.includes("live_set master_track")) {
          return "master";
        }
        return null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "sceneIndex")) {
    Object.defineProperty(LiveAPI.prototype, "sceneIndex", {
      get: function() {
        let match = this.path.match(/live_set scenes (\d+)/);
        if (match) {
          return Number(match[1]);
        }
        match = this.path.match(/live_set tracks \d+ clip_slots (\d+)/);
        return match ? Number(match[1]) : null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "clipSlotIndex")) {
    Object.defineProperty(LiveAPI.prototype, "clipSlotIndex", {
      get: function() {
        let match = this.path.match(/live_set tracks \d+ clip_slots (\d+)/);
        if (match) {
          return Number(match[1]);
        }
        match = this.path.match(/live_set scenes (\d+)/);
        return match ? Number(match[1]) : null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "deviceIndex")) {
    Object.defineProperty(LiveAPI.prototype, "deviceIndex", {
      get: function() {
        const matches = this.path.match(/devices (\d+)/g);
        if (!matches || matches.length === 0) return null;
        const lastMatch = matches.at(-1).match(/devices (\d+)/);
        return lastMatch ? Number(lastMatch[1]) : null;
      }
    });
  }
  if (!Object.prototype.hasOwnProperty.call(LiveAPI.prototype, "timeSignature")) {
    Object.defineProperty(LiveAPI.prototype, "timeSignature", {
      get: function() {
        const objectType = this.type;
        let numeratorProp, denominatorProp;
        switch (objectType) {
         case "Scene":
          numeratorProp = "time_signature_numerator";
          denominatorProp = "time_signature_denominator";
          break;

         default:
          numeratorProp = "signature_numerator";
          denominatorProp = "signature_denominator";
          break;
        }
        const numerator = this.getProperty(numeratorProp);
        const denominator = this.getProperty(denominatorProp);
        if (numerator != null && denominator != null) {
          return `${String(numerator)}/${String(denominator)}`;
        }
        return null;
      }
    });
  }
}

function polyfillToSorted(arr, compareFn) {
  return [ ...arr ].sort(compareFn);
}

function polyfillToReversed(arr) {
  return [ ...arr ].reverse();
}

function polyfillToSpliced(arr, start, deleteCount, ...items) {
  const copy = [ ...arr ];
  copy.splice(start, deleteCount ?? copy.length - start, ...items);
  return copy;
}

function polyfillWith(arr, index, value) {
  const copy = [ ...arr ];
  const actualIndex = index < 0 ? copy.length + index : index;
  if (actualIndex < 0 || actualIndex >= copy.length) {
    throw new RangeError(`Invalid index: ${index}`);
  }
  copy[actualIndex] = value;
  return copy;
}

if (!Array.prototype.toSorted) {
  Array.prototype.toSorted = function(compareFn) {
    return polyfillToSorted(this, compareFn);
  };
}

if (!Array.prototype.toReversed) {
  Array.prototype.toReversed = function() {
    return polyfillToReversed(this);
  };
}

if (!Array.prototype.toSpliced) {
  Array.prototype.toSpliced = function(start, deleteCount, ...items) {
    return polyfillToSpliced(this, start, deleteCount, ...items);
  };
}

if (!Array.prototype.with) {
  Array.prototype.with = function(index, value) {
    return polyfillWith(this, index, value);
  };
}

function toCompactJSLiteral(obj) {
  function convert(val) {
    if (val === null) {
      return "null";
    }
    if (Array.isArray(val)) {
      const items = val.map(convert).filter(v => v !== void 0);
      return "[" + items.join(",") + "]";
    }
    if (typeof val === "object") {
      const pairs = [];
      for (const [key, value] of Object.entries(val)) {
        const converted = convert(value);
        if (converted === void 0) {
          continue;
        }
        pairs.push(key + ":" + converted);
      }
      return "{" + pairs.join(",") + "}";
    }
    return JSON.stringify(val);
  }
  const result = convert(obj);
  return result ?? "";
}

const MAX_ERROR_DELIMITER = "$$___MAX_ERRORS___$$";

const MAX_CHUNK_SIZE = 3e4;

const MAX_CHUNKS = 100;

function formatSuccessResponse(result) {
  return {
    content: [ {
      type: "text",
      text: typeof result === "string" ? result : JSON.stringify(result)
    } ]
  };
}

function formatErrorResponse(errorMessage) {
  return {
    content: [ {
      type: "text",
      text: errorMessage
    } ],
    isError: true
  };
}

const str = value => {
  const val = value;
  switch (Object.getPrototypeOf(value ?? Object.prototype)) {
   case Array.prototype:
    return `[${val.map(str).join(", ")}]`;

   case Set.prototype:
    return `Set(${[ ...val ].map(str).join(", ")})`;

   case Object.prototype:
    return `{${Object.entries(val).map(([k, v]) => `${str(k)}: ${str(v)}`).join(", ")}}`;

   case Map.prototype:
    {
      const entries = [ ...val.entries() ].map(([k, v]) => `${str(k)} → ${str(v)}`).join(", ");
      return `Map(${entries})`;
    }

   case typeof Dict !== "undefined" ? Dict.prototype : null:
    return `Dict("${val.name}") ${val.stringify?.().replaceAll("\n", " ")}`;
  }
  const s = String(val);
  return s === "[object Object]" ? (val.constructor?.name ?? "Object") + JSON.stringify(val) : s;
};

const log = (...args) => {
  if (typeof post === "function") {
    post(...args.map(str), "\n");
  } else {
    console.log(...args.map(str));
  }
};

const warn = (...args) => {
  const parts = args.map(str);
  if (typeof outlet === "function") {
    outlet(1, parts.join(" "));
  } else if (typeof console !== "undefined" && typeof console.warn === "function") {
    console.warn(...parts);
  }
};

const VERSION = "1.3.6";

function applyV0Deletions(notes) {
  return notes.reduce((result, note) => {
    if (note.velocity === 0) {
      return result.filter(existingNote => existingNote.pitch !== note.pitch || Math.abs(existingNote.start_time - note.start_time) >= .001);
    }
    return [ ...result, note ];
  }, []);
}

const DEFAULT_VELOCITY = 100;

const DEFAULT_DURATION = 1;

const DEFAULT_TIME = {
  bar: 1,
  beat: 1
};

const DEFAULT_BEATS_PER_BAR = 4;

const DEFAULT_PROBABILITY = 1;

const DEFAULT_VELOCITY_DEVIATION = 0;

const PITCH_CLASS_VALUES$2 = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

let peg$SyntaxError$1 = class peg$SyntaxError extends SyntaxError {
  constructor(message, expected, found, location) {
    super(message);
    this.expected = expected;
    this.found = found;
    this.location = location;
    this.name = "SyntaxError";
  }
  format(sources) {
    let str = "Error: " + this.message;
    if (this.location) {
      let src = null;
      const st = sources.find(s2 => s2.source === this.location.source);
      if (st) {
        src = st.text.split(/\r\n|\n|\r/g);
      }
      const s = this.location.start;
      const offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      const loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        const e = this.location.end;
        const filler = "".padEnd(offset_s.line.toString().length, " ");
        const line = src[s.line - 1];
        const last = s.line === e.line ? e.column : line.length + 1;
        const hatLen = last - s.column || 1;
        str += "\n --\x3e " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + "".padEnd(s.column - 1, " ") + "".padEnd(hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  }
  static buildMessage(expected, found) {
    function hex(ch) {
      return ch.codePointAt(0).toString(16).toUpperCase();
    }
    const nonPrintable = Object.prototype.hasOwnProperty.call(RegExp.prototype, "unicode") ? new RegExp("[\\p{C}\\p{Mn}\\p{Mc}]", "gu") : null;
    function unicodeEscape(s) {
      if (nonPrintable) {
        return s.replace(nonPrintable, ch => "\\u{" + hex(ch) + "}");
      }
      return s;
    }
    function literalEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch)));
    }
    function classEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch)));
    }
    const DESCRIBE_EXPECTATION_FNS = {
      literal(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class(expectation) {
        const escapedParts = expectation.parts.map(part => Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part));
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]" + (expectation.unicode ? "u" : "");
      },
      any() {
        return "any character";
      },
      end() {
        return "end of input";
      },
      other(expectation) {
        return expectation.description;
      }
    };
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      const descriptions = expected2.map(describeExpectation);
      descriptions.sort();
      if (descriptions.length > 0) {
        let j = 1;
        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
       case 1:
        return descriptions[0];

       case 2:
        return descriptions[0] + " or " + descriptions[1];

       default:
        return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  }
};

function peg$parse$1(input, options) {
  options = options !== void 0 ? options : {};
  const peg$FAILED = {};
  const peg$source = options.grammarSource;
  const peg$startRuleFunctions = {
    start: peg$parsestart
  };
  let peg$startRuleFunction = peg$parsestart;
  const peg$c0 = "@";
  const peg$c1 = "clear";
  const peg$c2 = "=";
  const peg$c3 = "-";
  const peg$c4 = "|";
  const peg$c5 = ",";
  const peg$c6 = "x";
  const peg$c7 = "p";
  const peg$c8 = "v";
  const peg$c9 = "t";
  const peg$c10 = ":";
  const peg$c11 = "C#";
  const peg$c12 = "Db";
  const peg$c13 = "D#";
  const peg$c14 = "Eb";
  const peg$c15 = "F#";
  const peg$c16 = "Gb";
  const peg$c17 = "G#";
  const peg$c18 = "Ab";
  const peg$c19 = "A#";
  const peg$c20 = "Bb";
  const peg$c21 = "+";
  const peg$c22 = "/";
  const peg$c23 = ".";
  const peg$c24 = "//";
  const peg$c25 = "#";
  const peg$c26 = "/*";
  const peg$c27 = "*/";
  const peg$r0 = /^[A-G]/;
  const peg$r1 = /^[1-9]/;
  const peg$r2 = /^[0-9]/;
  const peg$r3 = /^[^\r\n]/;
  const peg$r4 = /^[ \t\r\n]/;
  const peg$e0 = peg$literalExpectation("@", false);
  const peg$e1 = peg$literalExpectation("clear", false);
  const peg$e2 = peg$literalExpectation("=", false);
  const peg$e3 = peg$literalExpectation("-", false);
  const peg$e4 = peg$literalExpectation("|", false);
  const peg$e5 = peg$literalExpectation(",", false);
  const peg$e6 = peg$literalExpectation("x", false);
  const peg$e7 = peg$literalExpectation("p", false);
  const peg$e8 = peg$literalExpectation("v", false);
  const peg$e9 = peg$literalExpectation("t", false);
  const peg$e10 = peg$literalExpectation(":", false);
  const peg$e11 = peg$literalExpectation("C#", false);
  const peg$e12 = peg$literalExpectation("Db", false);
  const peg$e13 = peg$literalExpectation("D#", false);
  const peg$e14 = peg$literalExpectation("Eb", false);
  const peg$e15 = peg$literalExpectation("F#", false);
  const peg$e16 = peg$literalExpectation("Gb", false);
  const peg$e17 = peg$literalExpectation("G#", false);
  const peg$e18 = peg$literalExpectation("Ab", false);
  const peg$e19 = peg$literalExpectation("A#", false);
  const peg$e20 = peg$literalExpectation("Bb", false);
  const peg$e21 = peg$classExpectation([ [ "A", "G" ] ], false, false, false);
  const peg$e22 = peg$literalExpectation("+", false);
  const peg$e23 = peg$classExpectation([ [ "1", "9" ] ], false, false, false);
  const peg$e24 = peg$classExpectation([ [ "0", "9" ] ], false, false, false);
  const peg$e25 = peg$literalExpectation("/", false);
  const peg$e26 = peg$literalExpectation(".", false);
  const peg$e27 = peg$literalExpectation("//", false);
  const peg$e28 = peg$classExpectation([ "\r", "\n" ], true, false, false);
  const peg$e29 = peg$literalExpectation("#", false);
  const peg$e30 = peg$literalExpectation("/*", false);
  const peg$e31 = peg$literalExpectation("*/", false);
  const peg$e32 = peg$anyExpectation();
  const peg$e33 = peg$classExpectation([ " ", "\t", "\r", "\n" ], false, false, false);
  function peg$f0(head, tail) {
    const elements = [ head, ...tail.map(t => t[1]) ].filter(Boolean);
    return elements.flat();
  }
  function peg$f1() {
    return {
      clearBuffer: true
    };
  }
  function peg$f2(dest, source) {
    return {
      destination: dest,
      source: source ?? "previous"
    };
  }
  function peg$f3(start, end) {
    return {
      range: [ start, end ]
    };
  }
  function peg$f4(bar) {
    return {
      bar: bar
    };
  }
  function peg$f5(bar, beats) {
    return beats.map(beat => ({
      bar: bar,
      beat: beat
    }));
  }
  function peg$f6(beats) {
    return beats.map(beat => ({
      bar: null,
      beat: beat
    }));
  }
  function peg$f7(head, tail) {
    return [ head, ...tail.map(t => t[1]) ];
  }
  function peg$f8(start, times, step) {
    const stepValue = step ? step[1] : null;
    if (stepValue === 0) {
      throw new Error("Repeat step size must be greater than 0");
    }
    return {
      start: start,
      times: times,
      step: stepValue
    };
  }
  function peg$f9(val) {
    if (val >= 0 && val <= 1) {
      return {
        probability: val
      };
    } else throw new Error(`Note probability ${val} outside valid range 0.0-1.0`);
  }
  function peg$f10(start, end) {
    if (start >= 0 && start <= 127 && end >= 0 && end <= 127) {
      return {
        velocityMin: Math.min(start, end),
        velocityMax: Math.max(start, end)
      };
    } else throw new Error(`Invalid velocity range ${start}-${end}`);
  }
  function peg$f11(val) {
    if (val >= 0 && val <= 127) {
      return {
        velocity: val
      };
    } else throw new Error(`MIDI velocity ${val} outside valid range 0-127`);
  }
  function peg$f12(bars, beats) {
    return {
      duration: `${bars}:${beats}`
    };
  }
  function peg$f13(val) {
    return {
      duration: val
    };
  }
  function peg$f14(pitchClass, octave) {
    const name = `${pitchClass.name}${octave}`;
    const pitch = (octave + 2) * 12 + pitchClass.value;
    if (pitch >= 0 && pitch <= 127) {
      return {
        pitch: pitch
      };
    } else throw new Error(`MIDI pitch ${pitch} (${name}) outside valid range 0-127`);
  }
  function peg$f15(pc) {
    return {
      name: pc,
      value: PITCH_CLASS_VALUES$2[pc]
    };
  }
  function peg$f16(wholeNumber, fraction) {
    return wholeNumber + fraction;
  }
  function peg$f17() {
    const [num, den] = text().split("/");
    const result = Number.parseInt(num) / Number.parseInt(den);
    if (result < 1) {
      throw new Error(`Beat position must be 1 or greater (got ${text()})`);
    }
    return result;
  }
  function peg$f18(wholeNumber, fraction) {
    return wholeNumber + fraction;
  }
  function peg$f19(num, den) {
    const parts = text().split("/");
    const numerator = parts[0] === "" ? 1 : Number.parseInt(parts[0]);
    const denominator = Number.parseInt(parts[1]);
    return numerator / denominator;
  }
  function peg$f20() {
    return Number.parseFloat(text());
  }
  function peg$f21() {
    return Number.parseFloat(text());
  }
  function peg$f22() {
    return Number.parseInt(text());
  }
  function peg$f23(sign, value) {
    return sign ? -value : value;
  }
  function peg$f24() {
    return Number.parseInt(text());
  }
  let peg$currPos = options.peg$currPos | 0;
  let peg$savedPos = peg$currPos;
  const peg$posDetailsCache = [ {
    line: 1,
    column: 1
  } ];
  let peg$maxFailPos = peg$currPos;
  let peg$maxFailExpected = options.peg$maxFailExpected || [];
  let peg$silentFails = options.peg$silentFails | 0;
  let peg$result;
  if (options.startRule) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
    }
    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }
  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }
  function peg$getUnicode(pos = peg$currPos) {
    const cp = input.codePointAt(pos);
    if (cp === void 0) {
      return "";
    }
    return String.fromCodePoint(cp);
  }
  function peg$literalExpectation(text2, ignoreCase) {
    return {
      type: "literal",
      text: text2,
      ignoreCase: ignoreCase
    };
  }
  function peg$classExpectation(parts, inverted, ignoreCase, unicode) {
    return {
      type: "class",
      parts: parts,
      inverted: inverted,
      ignoreCase: ignoreCase,
      unicode: unicode
    };
  }
  function peg$anyExpectation() {
    return {
      type: "any"
    };
  }
  function peg$endExpectation() {
    return {
      type: "end"
    };
  }
  function peg$computePosDetails(pos) {
    let details = peg$posDetailsCache[pos];
    let p;
    if (details) {
      return details;
    } else {
      if (pos >= peg$posDetailsCache.length) {
        p = peg$posDetailsCache.length - 1;
      } else {
        p = pos;
        while (!peg$posDetailsCache[--p]) {}
      }
      details = peg$posDetailsCache[p];
      details = {
        line: details.line,
        column: details.column
      };
      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }
        p++;
      }
      peg$posDetailsCache[pos] = details;
      return details;
    }
  }
  function peg$computeLocation(startPos, endPos, offset2) {
    const startPosDetails = peg$computePosDetails(startPos);
    const endPosDetails = peg$computePosDetails(endPos);
    const res = {
      source: peg$source,
      start: {
        offset: startPos,
        line: startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line: endPosDetails.line,
        column: endPosDetails.column
      }
    };
    return res;
  }
  function peg$fail(expected2) {
    if (peg$currPos < peg$maxFailPos) {
      return;
    }
    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }
    peg$maxFailExpected.push(expected2);
  }
  function peg$buildStructuredError(expected2, found, location2) {
    return new peg$SyntaxError$1(peg$SyntaxError$1.buildMessage(expected2, found), expected2, found, location2);
  }
  function peg$parsestart() {
    let s0, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    peg$parse_();
    s2 = peg$parseelement();
    if (s2 === peg$FAILED) {
      s2 = null;
    }
    s3 = [];
    s4 = peg$currPos;
    s5 = peg$parseWS();
    if (s5 !== peg$FAILED) {
      s6 = peg$parseelement();
      if (s6 !== peg$FAILED) {
        s5 = [ s5, s6 ];
        s4 = s5;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
    } else {
      peg$currPos = s4;
      s4 = peg$FAILED;
    }
    while (s4 !== peg$FAILED) {
      s3.push(s4);
      s4 = peg$currPos;
      s5 = peg$parseWS();
      if (s5 !== peg$FAILED) {
        s6 = peg$parseelement();
        if (s6 !== peg$FAILED) {
          s5 = [ s5, s6 ];
          s4 = s5;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
    }
    s4 = peg$parse_();
    peg$savedPos = s0;
    s0 = peg$f0(s2, s3);
    return s0;
  }
  function peg$parseelement() {
    let s0;
    s0 = peg$parsebarCopy();
    if (s0 === peg$FAILED) {
      s0 = peg$parsetimePoints();
      if (s0 === peg$FAILED) {
        s0 = peg$parseprobability();
        if (s0 === peg$FAILED) {
          s0 = peg$parsevelocity();
          if (s0 === peg$FAILED) {
            s0 = peg$parseduration();
            if (s0 === peg$FAILED) {
              s0 = peg$parsepitch();
            }
          }
        }
      }
    }
    return s0;
  }
  function peg$parsebarCopy() {
    let s0, s1, s2, s3, s4;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 64) {
      s1 = peg$c0;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    if (s1 !== peg$FAILED) {
      if (input.substr(peg$currPos, 5) === peg$c1) {
        s2 = peg$c1;
        peg$currPos += 5;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e1);
        }
      }
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f1();
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 64) {
        s1 = peg$c0;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e0);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsebarOrRange();
        if (s2 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 61) {
            s3 = peg$c2;
            peg$currPos++;
          } else {
            s3 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e2);
            }
          }
          if (s3 !== peg$FAILED) {
            s4 = peg$parsebarOrRange();
            if (s4 === peg$FAILED) {
              s4 = null;
            }
            peg$savedPos = s0;
            s0 = peg$f2(s2, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    return s0;
  }
  function peg$parsebarOrRange() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c3;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e3);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseoneOrMoreInt();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f3(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseoneOrMoreInt();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f4(s1);
      }
      s0 = s1;
    }
    return s0;
  }
  function peg$parsetimePoints() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 124) {
        s2 = peg$c4;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsebeatList();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f5(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 124) {
        s1 = peg$c4;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e4);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parsebeatList();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f6(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    return s0;
  }
  function peg$parsebeatList() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = peg$parsebeatSpec();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 44) {
        s4 = peg$c5;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e5);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = peg$parsebeatSpec();
        if (s5 !== peg$FAILED) {
          s4 = [ s4, s5 ];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        if (input.charCodeAt(peg$currPos) === 44) {
          s4 = peg$c5;
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e5);
          }
        }
        if (s4 !== peg$FAILED) {
          s5 = peg$parsebeatSpec();
          if (s5 !== peg$FAILED) {
            s4 = [ s4, s5 ];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      peg$savedPos = s0;
      s0 = peg$f7(s1, s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsebeatSpec() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreFloat();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 120) {
        s2 = peg$c6;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e6);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseoneOrMoreInt();
        if (s3 !== peg$FAILED) {
          s4 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 64) {
            s5 = peg$c0;
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e0);
            }
          }
          if (s5 !== peg$FAILED) {
            s6 = peg$parseunsignedFloat();
            if (s6 !== peg$FAILED) {
              s5 = [ s5, s6 ];
              s4 = s5;
            } else {
              peg$currPos = s4;
              s4 = peg$FAILED;
            }
          } else {
            peg$currPos = s4;
            s4 = peg$FAILED;
          }
          if (s4 === peg$FAILED) {
            s4 = null;
          }
          peg$savedPos = s0;
          s0 = peg$f8(s1, s3, s4);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$parseoneOrMoreFloat();
    }
    return s0;
  }
  function peg$parseprobability() {
    let s0, s1, s2;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 112) {
      s1 = peg$c7;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e7);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseunsignedDecimal();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f9(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsevelocity() {
    let s0, s1, s2, s3, s4;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 118) {
      s1 = peg$c8;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e8);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseunsignedInt();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 45) {
          s3 = peg$c3;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e3);
          }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseunsignedInt();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f10(s2, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 118) {
        s1 = peg$c8;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e8);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseunsignedInt();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f11(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    return s0;
  }
  function peg$parseduration() {
    let s0, s1, s2, s3, s4;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 116) {
      s1 = peg$c9;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e9);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parseunsignedInt();
      if (s2 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 58) {
          s3 = peg$c10;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e10);
          }
        }
        if (s3 !== peg$FAILED) {
          s4 = peg$parseunsignedFloat();
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f12(s2, s4);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 116) {
        s1 = peg$c9;
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e9);
        }
      }
      if (s1 !== peg$FAILED) {
        s2 = peg$parseunsignedFloat();
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f13(s2);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    return s0;
  }
  function peg$parsepitch() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parsepitchClass();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesignedInt();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f14(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsepitchClass() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c11) {
      s1 = peg$c11;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e11);
      }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c12) {
        s1 = peg$c12;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e12);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c13) {
          s1 = peg$c13;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e13);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c14) {
            s1 = peg$c14;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e14);
            }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c15) {
              s1 = peg$c15;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e15);
              }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c16) {
                s1 = peg$c16;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e16);
                }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 2) === peg$c17) {
                  s1 = peg$c17;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$e17);
                  }
                }
                if (s1 === peg$FAILED) {
                  if (input.substr(peg$currPos, 2) === peg$c18) {
                    s1 = peg$c18;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$e18);
                    }
                  }
                  if (s1 === peg$FAILED) {
                    if (input.substr(peg$currPos, 2) === peg$c19) {
                      s1 = peg$c19;
                      peg$currPos += 2;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$e19);
                      }
                    }
                    if (s1 === peg$FAILED) {
                      if (input.substr(peg$currPos, 2) === peg$c20) {
                        s1 = peg$c20;
                        peg$currPos += 2;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$e20);
                        }
                      }
                      if (s1 === peg$FAILED) {
                        s1 = input.charAt(peg$currPos);
                        if (peg$r0.test(s1)) {
                          peg$currPos++;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$e21);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f15(s1);
    }
    s0 = s1;
    return s0;
  }
  function peg$parseoneOrMoreFloat() {
    let s0;
    s0 = peg$parseoneOrMoreMixedNumber();
    if (s0 === peg$FAILED) {
      s0 = peg$parseoneOrMoreFraction();
      if (s0 === peg$FAILED) {
        s0 = peg$parseoneOrMoreDecimal();
      }
    }
    return s0;
  }
  function peg$parseoneOrMoreMixedNumber() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c21;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseunsignedFraction();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f16(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseoneOrMoreFraction() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
      }
      if (input.charCodeAt(peg$currPos) === 47) {
        s3 = peg$c22;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e25);
        }
      }
      if (s3 !== peg$FAILED) {
        s4 = input.charAt(peg$currPos);
        if (peg$r1.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e23);
          }
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e24);
            }
          }
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = input.charAt(peg$currPos);
            if (peg$r2.test(s6)) {
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e24);
              }
            }
          }
          peg$savedPos = s0;
          s0 = peg$f17();
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedFloat() {
    let s0;
    s0 = peg$parseunsignedMixedNumber();
    if (s0 === peg$FAILED) {
      s0 = peg$parseunsignedFraction();
      if (s0 === peg$FAILED) {
        s0 = peg$parseunsignedDecimal();
      }
    }
    return s0;
  }
  function peg$parseunsignedMixedNumber() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseunsignedInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c21;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseunsignedFraction();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f18(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedFraction() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
    }
    if (input.charCodeAt(peg$currPos) === 47) {
      s2 = peg$c22;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e25);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = input.charAt(peg$currPos);
      if (peg$r1.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e23);
        }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r2.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r2.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e24);
            }
          }
        }
        peg$savedPos = s0;
        s0 = peg$f19();
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseoneOrMoreDecimal() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
      }
      s3 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s4 = peg$c23;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = input.charAt(peg$currPos);
        if (peg$r2.test(s6)) {
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e24);
            }
          }
        }
        s4 = [ s4, s5 ];
        s3 = s4;
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      peg$savedPos = s0;
      s0 = peg$f20();
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedDecimal() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    s3 = input.charAt(peg$currPos);
    if (peg$r2.test(s3)) {
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    if (s3 !== peg$FAILED) {
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
      }
    } else {
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s4 = peg$c23;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = input.charAt(peg$currPos);
        if (peg$r2.test(s6)) {
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e24);
            }
          }
        }
        s4 = [ s4, s5 ];
        s3 = s4;
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s2 = [ s2, s3 ];
      s1 = s2;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 === peg$FAILED) {
      s1 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c23;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e26);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r2.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = input.charAt(peg$currPos);
            if (peg$r2.test(s4)) {
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e24);
              }
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s2 = [ s2, s3 ];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f21();
    }
    s0 = s1;
    return s0;
  }
  function peg$parseoneOrMoreInt() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e23);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e24);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
      }
      peg$savedPos = s0;
      s0 = peg$f22();
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsesignedInt() {
    let s0, s1, s2;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c3;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e3);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = peg$parseunsignedInt();
    if (s2 !== peg$FAILED) {
      peg$savedPos = s0;
      s0 = peg$f23(s1, s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedInt() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r2.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e24);
          }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f24();
    }
    s0 = s1;
    return s0;
  }
  function peg$parselineComment() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c24) {
      s1 = peg$c24;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e27);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r3.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r3.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e28);
          }
        }
      }
      s1 = [ s1, s2 ];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsehashComment() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 35) {
      s1 = peg$c25;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e29);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r3.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e28);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r3.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e28);
          }
        }
      }
      s1 = [ s1, s2 ];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseblockComment() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c26) {
      s1 = peg$c26;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e30);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 2) === peg$c27) {
        s5 = peg$c27;
        peg$currPos += 2;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e31);
        }
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e32);
          }
        }
        if (s5 !== peg$FAILED) {
          s4 = [ s4, s5 ];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c27) {
          s5 = peg$c27;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e31);
          }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e32);
            }
          }
          if (s5 !== peg$FAILED) {
            s4 = [ s4, s5 ];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (input.substr(peg$currPos, 2) === peg$c27) {
        s3 = peg$c27;
        peg$currPos += 2;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e31);
        }
      }
      if (s3 !== peg$FAILED) {
        s1 = [ s1, s2, s3 ];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsecomment() {
    let s0;
    s0 = peg$parselineComment();
    if (s0 === peg$FAILED) {
      s0 = peg$parsehashComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parseblockComment();
      }
    }
    return s0;
  }
  function peg$parseWS() {
    let s0, s1;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r4.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e33);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    if (s1 !== peg$FAILED) {
      while (s1 !== peg$FAILED) {
        s0.push(s1);
        s1 = input.charAt(peg$currPos);
        if (peg$r4.test(s1)) {
          peg$currPos++;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e33);
          }
        }
        if (s1 === peg$FAILED) {
          s1 = peg$parsecomment();
        }
      }
    } else {
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parse_() {
    let s0, s1;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r4.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e33);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = input.charAt(peg$currPos);
      if (peg$r4.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e33);
        }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$parsecomment();
      }
    }
    return s0;
  }
  peg$result = peg$startRuleFunction();
  const peg$success = peg$result !== peg$FAILED && peg$currPos === input.length;
  function peg$throw() {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }
    throw peg$buildStructuredError(peg$maxFailExpected, peg$maxFailPos < input.length ? peg$getUnicode(peg$maxFailPos) : null, peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos));
  }
  if (options.peg$library) {
    return {
      peg$result: peg$result,
      peg$currPos: peg$currPos,
      peg$FAILED: peg$FAILED,
      peg$maxFailExpected: peg$maxFailExpected,
      peg$maxFailPos: peg$maxFailPos,
      peg$success: peg$success,
      peg$throw: peg$success ? void 0 : peg$throw
    };
  }
  if (peg$success) {
    return peg$result;
  } else {
    peg$throw();
  }
}

function parseBeatsPerBar(options = {}) {
  const {beatsPerBar: beatsPerBarOption, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator} = options;
  if (timeSigNumerator != null && timeSigDenominator == null || timeSigDenominator != null && timeSigNumerator == null) {
    throw new Error("Time signature must be specified with both numerator and denominator");
  }
  return timeSigNumerator ?? beatsPerBarOption ?? DEFAULT_BEATS_PER_BAR;
}

function beatsToBarBeat(beats, beatsPerBar) {
  const bar = Math.floor(beats / beatsPerBar) + 1;
  const beat = beats % beatsPerBar + 1;
  const beatFormatted = beat % 1 === 0 ? beat.toString() : beat.toFixed(3).replace(/\.?0+$/, "");
  return `${bar}|${beatFormatted}`;
}

function barBeatToBeats(barBeat, beatsPerBar) {
  const match = barBeat.match(/^(-?\d+)\|((-?\d+)(?:\+\d+\/\d+|\.\d+|\/\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid bar|beat format: "${barBeat}". Expected "{int}|{float}" like "1|2" or "2|3.5" or "{int}|{int}/{int}" like "1|4/3" or "{int}|{int}+{int}/{int}" like "1|2+1/3"`);
  }
  const bar = Number.parseInt(match[1]);
  const beatStr = match[2];
  const beat = parseBeatValue(beatStr, barBeat, "bar|beat");
  if (bar < 1) {
    throw new Error(`Bar number must be 1 or greater, got: ${bar}`);
  }
  if (beat < 1) {
    throw new Error(`Beat must be 1 or greater, got: ${beat}`);
  }
  return (bar - 1) * beatsPerBar + (beat - 1);
}

function timeSigToAbletonBeatsPerBar(timeSigNumerator, timeSigDenominator) {
  return timeSigNumerator * 4 / timeSigDenominator;
}

function abletonBeatsToBarBeat(abletonBeats, timeSigNumerator, timeSigDenominator) {
  const musicalBeatsPerBar = timeSigNumerator;
  const musicalBeats = abletonBeats * (timeSigDenominator / 4);
  return beatsToBarBeat(musicalBeats, musicalBeatsPerBar);
}

function barBeatToAbletonBeats(barBeat, timeSigNumerator, timeSigDenominator) {
  const musicalBeatsPerBar = timeSigNumerator;
  const musicalBeats = barBeatToBeats(barBeat, musicalBeatsPerBar);
  return musicalBeats * (4 / timeSigDenominator);
}

function abletonBeatsToBarBeatDuration(abletonBeats, timeSigNumerator, timeSigDenominator) {
  if (abletonBeats < 0) {
    throw new Error(`Duration cannot be negative, got: ${abletonBeats}`);
  }
  const musicalBeats = abletonBeats * (timeSigDenominator / 4);
  const musicalBeatsPerBar = timeSigNumerator;
  const bars = Math.floor(musicalBeats / musicalBeatsPerBar);
  const remainingBeats = musicalBeats % musicalBeatsPerBar;
  const beatsFormatted = remainingBeats % 1 === 0 ? remainingBeats.toString() : remainingBeats.toFixed(3).replace(/\.?0+$/, "");
  return `${bars}:${beatsFormatted}`;
}

function parseBeatValue(beatsStr, context, formatType = "duration") {
  if (beatsStr.includes("+")) {
    const plusParts = beatsStr.split("+");
    const intPart = plusParts[0];
    const fracPart = plusParts[1];
    const num = Number.parseInt(intPart);
    if (Number.isNaN(num)) {
      throw new Error(`Invalid ${formatType} format: "${context}"`);
    }
    const slashParts = fracPart.split("/");
    const numerator = slashParts[0];
    const denominator = slashParts[1];
    const fracNum = Number.parseInt(numerator);
    const fracDen = Number.parseInt(denominator);
    if (fracDen === 0) {
      throw new Error(`Invalid ${formatType} format: division by zero in "${context}"`);
    }
    if (Number.isNaN(fracNum) || Number.isNaN(fracDen)) {
      throw new Error(`Invalid ${formatType} format: "${context}"`);
    }
    return num + fracNum / fracDen;
  }
  if (beatsStr.includes("/")) {
    const parts = beatsStr.split("/");
    const numerator = parts[0];
    const denominator = parts[1];
    const num = Number.parseInt(numerator);
    const den = Number.parseInt(denominator);
    if (den === 0) {
      throw new Error(`Invalid ${formatType} format: division by zero in "${context}"`);
    }
    if (Number.isNaN(num) || Number.isNaN(den)) {
      throw new Error(`Invalid ${formatType} format: "${context}"`);
    }
    return num / den;
  }
  const beats = Number.parseFloat(beatsStr);
  if (Number.isNaN(beats)) {
    throw new Error(`Invalid ${formatType} format: "${context}"`);
  }
  return beats;
}

function parseBarBeatFormat(barBeatDuration, timeSigNumerator) {
  const match = barBeatDuration.match(/^(-?\d+):((-?\d+)(?:\+\d+\/\d+|\.\d+|\/\d+)?)$/);
  if (!match) {
    throw new Error(`Invalid bar:beat duration format: "${barBeatDuration}". Expected "{int}:{float}" like "1:2" or "2:1.5" or "{int}:{int}/{int}" like "0:4/3" or "{int}:{int}+{int}/{int}" like "1:2+1/3"`);
  }
  const bars = Number.parseInt(match[1]);
  const beatsStr = match[2];
  const beats = parseBeatValue(beatsStr, barBeatDuration);
  if (bars < 0) {
    throw new Error(`Bars in duration must be 0 or greater, got: ${bars}`);
  }
  if (beats < 0) {
    throw new Error(`Beats in duration must be 0 or greater, got: ${beats}`);
  }
  const musicalBeatsPerBar = timeSigNumerator;
  return bars * musicalBeatsPerBar + beats;
}

function barBeatDurationToMusicalBeats(barBeatDuration, timeSigNumerator) {
  if (barBeatDuration.includes(":")) {
    if (timeSigNumerator == null) {
      throw new Error(`Time signature numerator required for bar:beat duration format: "${barBeatDuration}"`);
    }
    return parseBarBeatFormat(barBeatDuration, timeSigNumerator);
  }
  if (barBeatDuration.includes("|")) {
    throw new Error(`Invalid duration format: "${barBeatDuration}". Use ":" for bar:beat format, not "|"`);
  }
  const beats = parseBeatValue(barBeatDuration, barBeatDuration);
  if (beats < 0) {
    throw new Error(`Beats in duration must be 0 or greater, got: ${beats}`);
  }
  return beats;
}

function barBeatDurationToAbletonBeats(barBeatDuration, timeSigNumerator, timeSigDenominator) {
  const musicalBeats = barBeatDurationToMusicalBeats(barBeatDuration, timeSigNumerator);
  return musicalBeats * (4 / timeSigDenominator);
}

function validateBufferedState(state, operationType) {
  if (state.currentPitches.length > 0 && !state.pitchesEmitted) {
    warn(`${state.currentPitches.length} pitch(es) buffered but not emitted before ${operationType}`);
  }
  if (state.stateChangedSinceLastPitch && state.pitchGroupStarted || state.stateChangedAfterEmission) {
    warn(`state change won't affect anything before ${operationType}`);
  }
}

function handlePropertyUpdate(state, pitchUpdater) {
  if (state.pitchGroupStarted && state.currentPitches.length > 0) {
    state.stateChangedSinceLastPitch = true;
  }
  if (!state.pitchGroupStarted && state.currentPitches.length > 0) {
    for (const pitchState of state.currentPitches) {
      pitchUpdater(pitchState);
    }
    state.stateChangedAfterEmission = true;
  }
  if (!state.pitchGroupStarted && state.currentPitches.length === 0) {
    state.stateChangedAfterEmission = true;
  }
}

function extractBufferState(state) {
  return {
    currentPitches: state.currentPitches,
    pitchesEmitted: state.pitchesEmitted,
    stateChangedSinceLastPitch: state.stateChangedSinceLastPitch,
    pitchGroupStarted: state.pitchGroupStarted,
    stateChangedAfterEmission: state.stateChangedAfterEmission
  };
}

function applyBarCopyResult(state, result) {
  if (result.currentTime) {
    state.currentTime = result.currentTime;
    state.hasExplicitBarNumber = result.hasExplicitBarNumber;
  }
}

function copyNoteToDestination(sourceNote, destBar, destinationBarStart, events, notesByBar) {
  const copiedNote = {
    pitch: sourceNote.pitch,
    start_time: destinationBarStart + sourceNote.relativeTime,
    duration: sourceNote.duration,
    velocity: sourceNote.velocity,
    probability: sourceNote.probability,
    velocity_deviation: sourceNote.velocity_deviation
  };
  events.push(copiedNote);
  if (!notesByBar.has(destBar)) {
    notesByBar.set(destBar, []);
  }
  const destBarNotes = notesByBar.get(destBar);
  if (destBarNotes) {
    destBarNotes.push({
      ...copiedNote,
      relativeTime: sourceNote.relativeTime,
      originalBar: destBar
    });
  }
}

function copyBarToBar(sourceBar, destinationBar, notesByBar, events, barDuration) {
  if (sourceBar === destinationBar) {
    warn(`Cannot copy bar ${sourceBar} to itself (would cause infinite loop)`);
    return false;
  }
  const sourceNotes = notesByBar.get(sourceBar);
  if (sourceNotes == null || sourceNotes.length === 0) {
    warn(`Bar ${sourceBar} is empty, nothing to copy`);
    return false;
  }
  const destinationBarStart = (destinationBar - 1) * barDuration;
  for (const sourceNote of sourceNotes) {
    copyNoteToDestination(sourceNote, destinationBar, destinationBarStart, events, notesByBar);
  }
  return true;
}

function determineSourceBarsForCopy(element) {
  if (element.source === "previous") {
    if (element.destination.bar === void 0) {
      return null;
    }
    const previousBar = element.destination.bar - 1;
    if (previousBar <= 0) {
      warn("Cannot copy from previous bar when at bar 1 or earlier");
      return null;
    }
    return [ previousBar ];
  }
  if (element.source.bar !== void 0) {
    if (element.source.bar <= 0) {
      warn(`Cannot copy from bar ${element.source.bar} (no such bar)`);
      return null;
    }
    return [ element.source.bar ];
  }
  if (element.source.range !== void 0) {
    const [start, end] = element.source.range;
    if (start <= 0 || end <= 0) {
      warn(`Cannot copy from range ${start}-${end} (invalid bar numbers)`);
      return null;
    }
    if (start > end) {
      warn(`Invalid source range ${start}-${end} (start > end)`);
      return null;
    }
    const sourceBars = [];
    for (let bar = start; bar <= end; bar++) {
      sourceBars.push(bar);
    }
    return sourceBars;
  }
  return null;
}

function handleMultiBarSourceRangeCopy(element, destStart, destEnd, beatsPerBar, timeSigDenominator, notesByBar, events, bufferState) {
  const source = element.source;
  const [sourceStart, sourceEnd] = source.range;
  if (sourceStart <= 0 || sourceEnd <= 0) {
    warn(`Invalid source range @${destStart}-${destEnd}=${sourceStart}-${sourceEnd} (invalid bar numbers)`);
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  if (sourceStart > sourceEnd) {
    warn(`Invalid source range @${destStart}-${destEnd}=${sourceStart}-${sourceEnd} (start > end)`);
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  validateBufferedState(bufferState, "bar copy");
  const sourceCount = sourceEnd - sourceStart + 1;
  const barDuration = timeSigDenominator != null ? beatsPerBar * (4 / timeSigDenominator) : beatsPerBar;
  let destBar = destStart;
  let sourceOffset = 0;
  let copiedAny = false;
  while (destBar <= destEnd) {
    const sourceBar = sourceStart + sourceOffset % sourceCount;
    if (sourceBar === destBar) {
      warn(`Skipping copy of bar ${sourceBar} to itself`);
      destBar++;
      sourceOffset++;
      continue;
    }
    const sourceNotes = notesByBar.get(sourceBar);
    if (sourceNotes == null || sourceNotes.length === 0) {
      warn(`Bar ${sourceBar} is empty, nothing to copy`);
      destBar++;
      sourceOffset++;
      continue;
    }
    const destinationBarStart = (destBar - 1) * barDuration;
    for (const sourceNote of sourceNotes) {
      copyNoteToDestination(sourceNote, destBar, destinationBarStart, events, notesByBar);
    }
    copiedAny = true;
    destBar++;
    sourceOffset++;
  }
  if (copiedAny) {
    return {
      currentTime: {
        bar: destStart,
        beat: 1
      },
      hasExplicitBarNumber: true
    };
  }
  return {
    currentTime: null,
    hasExplicitBarNumber: false
  };
}

function handleBarCopyRangeDestination(element, beatsPerBar, timeSigDenominator, notesByBar, events, bufferState) {
  const destRange = element.destination.range;
  const [destStart, destEnd] = destRange;
  if (destStart <= 0 || destEnd <= 0) {
    warn(`Invalid destination range @${destStart}-${destEnd}= (invalid bar numbers)`);
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  if (destStart > destEnd) {
    warn(`Invalid destination range @${destStart}-${destEnd}= (start > end)`);
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  if (element.source !== "previous" && element.source.range !== void 0) {
    return handleMultiBarSourceRangeCopy(element, destStart, destEnd, beatsPerBar, timeSigDenominator, notesByBar, events, bufferState);
  }
  let sourceBar;
  if (element.source === "previous") {
    sourceBar = destStart - 1;
    if (sourceBar <= 0) {
      warn(`Cannot copy from previous bar when destination starts at bar ${destStart}`);
      return {
        currentTime: null,
        hasExplicitBarNumber: false
      };
    }
  } else {
    sourceBar = element.source.bar;
    if (sourceBar <= 0) {
      warn(`Cannot copy from bar ${sourceBar} (no such bar)`);
      return {
        currentTime: null,
        hasExplicitBarNumber: false
      };
    }
  }
  validateBufferedState(bufferState, "bar copy");
  const sourceNotes = notesByBar.get(sourceBar);
  if (sourceNotes == null || sourceNotes.length === 0) {
    warn(`Bar ${sourceBar} is empty, nothing to copy`);
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  const barDuration = timeSigDenominator != null ? beatsPerBar * (4 / timeSigDenominator) : beatsPerBar;
  let copiedAny = false;
  for (let destBar = destStart; destBar <= destEnd; destBar++) {
    if (sourceBar === destBar) {
      warn(`Skipping copy of bar ${sourceBar} to itself`);
      continue;
    }
    const destinationBarStart = (destBar - 1) * barDuration;
    for (const sourceNote of sourceNotes) {
      copyNoteToDestination(sourceNote, destBar, destinationBarStart, events, notesByBar);
    }
    copiedAny = true;
  }
  if (copiedAny) {
    return {
      currentTime: {
        bar: destStart,
        beat: 1
      },
      hasExplicitBarNumber: true
    };
  }
  return {
    currentTime: null,
    hasExplicitBarNumber: false
  };
}

function handleBarCopySingleDestination(element, beatsPerBar, timeSigDenominator, notesByBar, events, bufferState) {
  const sourceBars = determineSourceBarsForCopy(element);
  if (sourceBars === null) {
    return {
      currentTime: null,
      hasExplicitBarNumber: false
    };
  }
  validateBufferedState(bufferState, "bar copy");
  const destBar = element.destination.bar;
  const barDuration = timeSigDenominator != null ? beatsPerBar * (4 / timeSigDenominator) : beatsPerBar;
  let destinationBar = destBar;
  let copiedAny = false;
  for (const sourceBar of sourceBars) {
    const copySucceeded = copyBarToBar(sourceBar, destinationBar, notesByBar, events, barDuration);
    if (copySucceeded) {
      copiedAny = true;
    }
    destinationBar++;
  }
  if (copiedAny) {
    return {
      currentTime: {
        bar: destBar,
        beat: 1
      },
      hasExplicitBarNumber: true
    };
  }
  return {
    currentTime: null,
    hasExplicitBarNumber: false
  };
}

function handleClearBuffer(notesByBar) {
  notesByBar.clear();
}

function parseCommaSeparatedIds(ids) {
  if (ids == null) return [];
  return ids.split(",").map(id => id.trim()).filter(id => id.length > 0);
}

function parseCommaSeparatedIndices(indices) {
  if (indices == null) return [];
  return indices.split(",").map(index => index.trim()).filter(index => index.length > 0).map(index => {
    const parsed = Number.parseInt(index);
    if (Number.isNaN(parsed)) {
      throw new Error(`Invalid index "${index}" - must be a valid integer`);
    }
    return parsed;
  });
}

function parseCommaSeparatedFloats(values) {
  if (values == null) return [];
  return values.split(",").map(v => Number.parseFloat(v.trim())).filter(v => !Number.isNaN(v));
}

function buildIndexedName(baseName, count, index) {
  if (baseName == null) return;
  if (count === 1) return baseName;
  if (index === 0) return baseName;
  return `${baseName} ${index + 1}`;
}

function unwrapSingleResult(array) {
  return array.length === 1 ? array[0] : array;
}

function parseTimeSignature(timeSignature) {
  const match = timeSignature.match(/^(\d+)\/(\d+)$/);
  if (!match) {
    throw new Error('Time signature must be in format "n/m" (e.g. "4/4")');
  }
  return {
    numerator: Number.parseInt(match[1]),
    denominator: Number.parseInt(match[2])
  };
}

function toLiveApiView(view) {
  const normalized = view.toLowerCase();
  switch (normalized) {
   case "session":
    return "Session";

   case "arrangement":
    return "Arranger";

   default:
    throw new Error(`Unknown view: ${view}`);
  }
}

function fromLiveApiView(liveApiView) {
  switch (liveApiView) {
   case "Session":
    return "session";

   case "Arranger":
    return "arrangement";

   default:
    throw new Error(`Unknown Live API view: ${liveApiView}`);
  }
}

function assertDefined(value, msg) {
  if (value == null) {
    throw new Error(`Bug: ${msg}`);
  }
  return value;
}

function expandRepeatPattern(pattern, currentBar, beatsPerBar, currentDuration) {
  const {start: start, times: times, step: stepValue} = pattern;
  const step = stepValue ?? currentDuration;
  if (times > 100) {
    warn(`Repeat pattern generates ${times} notes, which may be excessive`);
  }
  const positions = [];
  const startBeats = (currentBar - 1) * beatsPerBar + (start - 1);
  for (let i = 0; i < times; i++) {
    const absoluteBeats = startBeats + i * step;
    const bar = Math.floor(absoluteBeats / beatsPerBar) + 1;
    const beat = absoluteBeats % beatsPerBar + 1;
    positions.push({
      bar: bar,
      beat: beat
    });
  }
  return positions;
}

function emitPitchAtPosition(pitchState, position, beatsPerBar, timeSigDenominator, events, notesByBar) {
  const absoluteBeats = (position.bar - 1) * beatsPerBar + (position.beat - 1);
  const abletonBeats = timeSigDenominator != null ? absoluteBeats * (4 / timeSigDenominator) : absoluteBeats;
  const abletonDuration = timeSigDenominator != null ? pitchState.duration * (4 / timeSigDenominator) : pitchState.duration;
  const noteEvent = {
    pitch: pitchState.pitch,
    start_time: abletonBeats,
    duration: abletonDuration,
    velocity: pitchState.velocity,
    probability: pitchState.probability,
    velocity_deviation: pitchState.velocityDeviation
  };
  events.push(noteEvent);
  const barDuration = timeSigDenominator != null ? beatsPerBar * (4 / timeSigDenominator) : beatsPerBar;
  const actualBar = Math.floor(abletonBeats / barDuration) + 1;
  const barStartAbletonBeats = (actualBar - 1) * barDuration;
  const relativeAbletonBeats = abletonBeats - barStartAbletonBeats;
  if (!notesByBar.has(actualBar)) {
    notesByBar.set(actualBar, []);
  }
  const barNotes = notesByBar.get(actualBar);
  if (barNotes) {
    barNotes.push({
      ...noteEvent,
      relativeTime: relativeAbletonBeats,
      originalBar: actualBar
    });
  }
}

function emitPitchesAtPositions(positions, currentPitches, element, beatsPerBar, timeSigDenominator, events, notesByBar) {
  let currentTime = null;
  let hasExplicitBarNumber = false;
  for (const position of positions) {
    currentTime = position;
    if (element.bar !== null) {
      hasExplicitBarNumber = true;
    }
    for (const pitchState of currentPitches) {
      emitPitchAtPosition(pitchState, currentTime, beatsPerBar, timeSigDenominator, events, notesByBar);
    }
  }
  return {
    currentTime: currentTime,
    hasExplicitBarNumber: hasExplicitBarNumber
  };
}

function calculatePositions(element, state, beatsPerBar) {
  if (typeof element.beat === "object") {
    const currentBar = element.bar ?? (state.hasExplicitBarNumber ? state.currentTime.bar : 1);
    return expandRepeatPattern(element.beat, currentBar, beatsPerBar, state.currentDuration);
  }
  const bar = element.bar ?? (state.hasExplicitBarNumber ? state.currentTime.bar : 1);
  const beat = element.beat;
  return [ {
    bar: bar,
    beat: beat
  } ];
}

function handlePitchEmission(positions, state, element, beatsPerBar, timeSigDenominator, events, notesByBar) {
  if (state.currentPitches.length === 0) {
    if (positions.length === 1) {
      const pos = assertDefined(positions[0], "single position");
      warn(`Time position ${pos.bar}|${pos.beat} has no pitches`);
    } else if (positions.length > 0) {
      const pos = assertDefined(positions[0], "first position");
      warn(`Time position has no pitches (first position: ${pos.bar}|${pos.beat})`);
    }
    return;
  }
  if (state.stateChangedSinceLastPitch) {
    warn("state change after pitch(es) but before time position won't affect this group");
  }
  const emitResult = emitPitchesAtPositions(positions, state.currentPitches, element, beatsPerBar, timeSigDenominator, events, notesByBar);
  if (emitResult.currentTime != null) {
    state.currentTime = emitResult.currentTime;
  }
  if (emitResult.hasExplicitBarNumber) {
    state.hasExplicitBarNumber = true;
  }
  state.pitchesEmitted = true;
}

function processVelocityUpdate(element, state) {
  state.currentVelocity = element.velocity ?? null;
  state.currentVelocityMin = null;
  state.currentVelocityMax = null;
  handlePropertyUpdate(state, pitchState => {
    pitchState.velocity = element.velocity;
    pitchState.velocityDeviation = DEFAULT_VELOCITY_DEVIATION;
  });
}

function processVelocityRangeUpdate(element, state) {
  state.currentVelocityMin = element.velocityMin ?? null;
  state.currentVelocityMax = element.velocityMax ?? null;
  state.currentVelocity = null;
  const velocityMin = element.velocityMin ?? 0;
  const velocityMax = element.velocityMax ?? 0;
  handlePropertyUpdate(state, pitchState => {
    pitchState.velocity = velocityMin;
    pitchState.velocityDeviation = velocityMax - velocityMin;
  });
}

function processDurationUpdate(element, state, timeSigNumerator) {
  if (typeof element.duration === "string") {
    state.currentDuration = barBeatDurationToMusicalBeats(element.duration, timeSigNumerator);
  } else {
    state.currentDuration = element.duration;
  }
  handlePropertyUpdate(state, pitchState => {
    pitchState.duration = state.currentDuration;
  });
}

function processProbabilityUpdate(element, state) {
  state.currentProbability = element.probability;
  handlePropertyUpdate(state, pitchState => {
    pitchState.probability = element.probability;
  });
}

function processPitchElement(element, state) {
  if (!state.pitchGroupStarted) {
    state.currentPitches = [];
    state.pitchGroupStarted = true;
    state.pitchesEmitted = false;
    state.stateChangedAfterEmission = false;
  }
  let velocity;
  let velocityDeviation;
  if (state.currentVelocityMin != null && state.currentVelocityMax != null) {
    velocity = state.currentVelocityMin;
    velocityDeviation = state.currentVelocityMax - state.currentVelocityMin;
  } else {
    velocity = state.currentVelocity ?? DEFAULT_VELOCITY;
    velocityDeviation = DEFAULT_VELOCITY_DEVIATION;
  }
  state.currentPitches.push({
    pitch: element.pitch,
    velocity: velocity,
    velocityDeviation: velocityDeviation,
    duration: state.currentDuration,
    probability: state.currentProbability
  });
  state.stateChangedSinceLastPitch = false;
}

function resetPitchBufferState(state) {
  state.currentPitches = [];
  state.pitchGroupStarted = false;
  state.pitchesEmitted = false;
  state.stateChangedSinceLastPitch = false;
  state.stateChangedAfterEmission = false;
}

function processTimePosition(element, state, beatsPerBar, timeSigDenominator, events, notesByBar) {
  const positions = calculatePositions(element, state, beatsPerBar);
  handlePitchEmission(positions, state, element, beatsPerBar, timeSigDenominator, events, notesByBar);
  state.pitchGroupStarted = false;
  state.stateChangedSinceLastPitch = false;
  state.stateChangedAfterEmission = false;
}

function processElementInLoop(element, state, beatsPerBar, timeSigNumerator, timeSigDenominator, notesByBar, events) {
  if (element.destination?.range !== void 0) {
    const result = handleBarCopyRangeDestination(element, beatsPerBar, timeSigDenominator, notesByBar, events, extractBufferState(state));
    applyBarCopyResult(state, result);
    resetPitchBufferState(state);
  } else if (element.destination?.bar !== void 0) {
    const result = handleBarCopySingleDestination(element, beatsPerBar, timeSigDenominator, notesByBar, events, extractBufferState(state));
    applyBarCopyResult(state, result);
    resetPitchBufferState(state);
  } else if (element.clearBuffer) {
    validateBufferedState(extractBufferState(state), "@clear");
    handleClearBuffer(notesByBar);
    resetPitchBufferState(state);
  } else if (element.bar !== void 0 && element.beat !== void 0) {
    processTimePosition(element, state, beatsPerBar, timeSigDenominator, events, notesByBar);
  } else if (element.pitch !== void 0) {
    processPitchElement(element, state);
  } else if (element.velocity !== void 0) {
    processVelocityUpdate(element, state);
  } else if (element.velocityMin !== void 0 && element.velocityMax !== void 0) {
    processVelocityRangeUpdate(element, state);
  } else if (element.duration !== void 0) {
    processDurationUpdate(element, state, timeSigNumerator);
  } else if (element.probability !== void 0) {
    processProbabilityUpdate(element, state);
  }
}

function interpretNotation(barBeatExpression, options = {}) {
  if (!barBeatExpression) {
    return [];
  }
  const {timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator} = options;
  const beatsPerBar = parseBeatsPerBar(options);
  try {
    const ast = peg$parse$1(barBeatExpression);
    const notesByBar = new Map;
    const events = [];
    const state = {
      currentTime: DEFAULT_TIME,
      currentVelocity: DEFAULT_VELOCITY,
      currentDuration: DEFAULT_DURATION,
      currentProbability: DEFAULT_PROBABILITY,
      currentVelocityMin: null,
      currentVelocityMax: null,
      hasExplicitBarNumber: false,
      currentPitches: [],
      pitchGroupStarted: false,
      pitchesEmitted: false,
      stateChangedSinceLastPitch: false,
      stateChangedAfterEmission: false
    };
    for (const element of ast) {
      processElementInLoop(element, state, beatsPerBar, timeSigNumerator, timeSigDenominator, notesByBar, events);
    }
    if (state.currentPitches.length > 0 && !state.pitchesEmitted) {
      warn(`${state.currentPitches.length} pitch(es) buffered but no time position to emit them`);
    }
    return applyV0Deletions(events);
  } catch (error) {
    if (error instanceof Error && error.name === "SyntaxError") {
      const parserError = error;
      const location = parserError.location ?? {};
      const position = location.start ? `at position ${location.start.offset} (line ${location.start.line}, column ${location.start.column})` : "at unknown position";
      throw new Error(`bar|beat syntax error ${position}: ${error.message}`);
    }
    throw error;
  }
}

function errorMessage(err) {
  return err instanceof Error ? err.message : String(err);
}

function parseFrequency(periodObj, timeSigNumerator) {
  if (periodObj.type !== "period") {
    throw new Error(`Invalid period object: expected type "period", got "${periodObj.type}"`);
  }
  const barBeatString = `${periodObj.bars}:${periodObj.beats}`;
  const periodInBeats = barBeatDurationToMusicalBeats(barBeatString, timeSigNumerator);
  if (periodInBeats <= 0) {
    throw new Error(`Period must be positive, got: ${periodInBeats} beats (from ${barBeatString}t)`);
  }
  return periodInBeats;
}

function cos(phase) {
  const normalizedPhase = phase % 1;
  return Math.cos(normalizedPhase * 2 * Math.PI);
}

function tri(phase) {
  const normalizedPhase = phase % 1;
  if (normalizedPhase <= .5) {
    return 1 - 4 * normalizedPhase;
  }
  return -3 + 4 * normalizedPhase;
}

function saw(phase) {
  const normalizedPhase = phase % 1;
  return 1 - 2 * normalizedPhase;
}

function square(phase, pulseWidth = .5) {
  const normalizedPhase = phase % 1;
  return normalizedPhase < pulseWidth ? 1 : -1;
}

function noise() {
  return Math.random() * 2 - 1;
}

function ramp(phase, start, end, speed = 1) {
  const scaledPhase = phase * speed % 1;
  return start + (end - start) * scaledPhase;
}

function evaluateFunction(name, args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression) {
  if (name === "noise") {
    return noise();
  }
  if (name === "ramp") {
    return evaluateRamp(args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression);
  }
  return evaluateWaveform(name, args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression);
}

function evaluateRamp(args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression) {
  if (args.length < 2) {
    throw new Error(`Function ramp() requires start and end arguments: ramp(start, end, speed?)`);
  }
  const start = evaluateExpression(args[0], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
  const end = evaluateExpression(args[1], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
  let speed = 1;
  if (args.length >= 3) {
    speed = evaluateExpression(args[2], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
    if (speed <= 0) {
      throw new Error(`Function ramp() speed must be > 0, got ${speed}`);
    }
  }
  const timeRangeDuration = timeRange.end - timeRange.start;
  const phase = timeRangeDuration > 0 ? (position - timeRange.start) / timeRangeDuration : 0;
  return ramp(phase, start, end, speed);
}

function evaluateWaveform(name, args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression) {
  if (args.length === 0) {
    throw new Error(`Function ${name}() requires at least a period argument`);
  }
  const period = parsePeriod(args[0], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression, name);
  const basePhase = position / period % 1;
  let phaseOffset = 0;
  if (args.length >= 2) {
    phaseOffset = evaluateExpression(args[1], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
  }
  const phase = basePhase + phaseOffset;
  switch (name) {
   case "cos":
    return cos(phase);

   case "tri":
    return tri(phase);

   case "saw":
    return saw(phase);

   case "square":
    {
      let pulseWidth = .5;
      if (args.length >= 3) {
        pulseWidth = evaluateExpression(args[2], position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
      }
      return square(phase, pulseWidth);
    }

   default:
    throw new Error(`Unknown waveform function: ${name}()`);
  }
}

function parsePeriod(periodArg, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression, name) {
  let period;
  if (typeof periodArg === "object" && "type" in periodArg && periodArg.type === "period") {
    period = parseFrequency(periodArg, timeSigNumerator);
  } else {
    period = evaluateExpression(periodArg, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
    if (period <= 0) {
      throw new Error(`Function ${name}() period must be > 0, got ${period}`);
    }
  }
  return period;
}

function evaluateModulationAST(ast, noteContext, noteProperties = {}) {
  const {position: position, pitch: pitch, bar: bar, beat: beat, timeSig: timeSig, clipTimeRange: clipTimeRange} = noteContext;
  const {numerator: numerator, denominator: denominator} = timeSig;
  const result = {};
  let currentPitchRange = null;
  for (const assignment of ast) {
    const assignmentResult = processAssignment(assignment, position, pitch, bar, beat, numerator, denominator, clipTimeRange, noteProperties, currentPitchRange);
    if (assignmentResult.skip) {
      continue;
    }
    if (assignmentResult.pitchRange != null) {
      currentPitchRange = assignmentResult.pitchRange;
    }
    result[assignment.parameter] = {
      operator: assignment.operator,
      value: assignmentResult.value
    };
  }
  return result;
}

function processAssignment(assignment, position, pitch, bar, beat, numerator, denominator, clipTimeRange, noteProperties, currentPitchRange) {
  try {
    let pitchRange = null;
    if (assignment.pitchRange != null) {
      pitchRange = assignment.pitchRange;
      currentPitchRange = pitchRange;
    }
    if (currentPitchRange != null && pitch != null) {
      const {startPitch: startPitch, endPitch: endPitch} = currentPitchRange;
      if (pitch < startPitch || pitch > endPitch) {
        return {
          skip: true
        };
      }
    }
    const activeTimeRange = calculateActiveTimeRange(assignment, bar, beat, numerator, denominator, clipTimeRange, position);
    if (activeTimeRange.skip) {
      return {
        skip: true
      };
    }
    const value = evaluateExpression(assignment.expression, position, numerator, denominator, activeTimeRange.timeRange, noteProperties);
    return {
      value: value,
      pitchRange: pitchRange
    };
  } catch (error) {
    warn(`Failed to evaluate modulation for parameter "${assignment.parameter}": ${errorMessage(error)}`);
    return {
      skip: true
    };
  }
}

function calculateActiveTimeRange(assignment, bar, beat, numerator, denominator, clipTimeRange, position) {
  if (assignment.timeRange && bar != null && beat != null) {
    const {startBar: startBar, startBeat: startBeat, endBar: endBar, endBeat: endBeat} = assignment.timeRange;
    const afterStart = bar > startBar || bar === startBar && beat >= startBeat;
    const beforeEnd = bar < endBar || bar === endBar && beat <= endBeat;
    if (!(afterStart && beforeEnd)) {
      return {
        skip: true
      };
    }
    const musicalBeatsPerBar = numerator * (4 / denominator);
    const startBeats = barBeatToBeats(`${startBar}|${startBeat}`, musicalBeatsPerBar);
    const endBeats = barBeatToBeats(`${endBar}|${endBeat}`, musicalBeatsPerBar);
    return {
      timeRange: {
        start: startBeats,
        end: endBeats
      }
    };
  }
  return {
    timeRange: clipTimeRange ?? {
      start: 0,
      end: position
    }
  };
}

function evaluateBinaryOp(node, ctx) {
  const {position: position, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator, timeRange: timeRange, noteProperties: noteProperties} = ctx;
  const left = evaluateExpression(node.left, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
  const right = evaluateExpression(node.right, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties);
  switch (node.type) {
   case "add":
    return left + right;

   case "subtract":
    return left - right;

   case "multiply":
    return left * right;

   case "divide":
    return right === 0 ? 0 : left / right;
  }
}

function evaluateExpression(node, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties = {}) {
  if (typeof node === "number") {
    return node;
  }
  if (node.type === "variable") {
    if (noteProperties[node.name] == null) {
      throw new Error(`Variable "note.${node.name}" is not available in this context`);
    }
    return noteProperties[node.name];
  }
  if (node.type === "add" || node.type === "subtract" || node.type === "multiply" || node.type === "divide") {
    return evaluateBinaryOp(node, {
      position: position,
      timeSigNumerator: timeSigNumerator,
      timeSigDenominator: timeSigDenominator,
      timeRange: timeRange,
      noteProperties: noteProperties
    });
  }
  if (node.type === "function") {
    return evaluateFunction(node.name, node.args, position, timeSigNumerator, timeSigDenominator, timeRange, noteProperties, evaluateExpression);
  }
  throw new Error(`Unknown expression node type: ${node.type}`);
}

const PITCH_CLASS_VALUES$1 = {
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
};

class peg$SyntaxError extends SyntaxError {
  constructor(message, expected, found, location) {
    super(message);
    this.expected = expected;
    this.found = found;
    this.location = location;
    this.name = "SyntaxError";
  }
  format(sources) {
    let str = "Error: " + this.message;
    if (this.location) {
      let src = null;
      const st = sources.find(s2 => s2.source === this.location.source);
      if (st) {
        src = st.text.split(/\r\n|\n|\r/g);
      }
      const s = this.location.start;
      const offset_s = this.location.source && typeof this.location.source.offset === "function" ? this.location.source.offset(s) : s;
      const loc = this.location.source + ":" + offset_s.line + ":" + offset_s.column;
      if (src) {
        const e = this.location.end;
        const filler = "".padEnd(offset_s.line.toString().length, " ");
        const line = src[s.line - 1];
        const last = s.line === e.line ? e.column : line.length + 1;
        const hatLen = last - s.column || 1;
        str += "\n --\x3e " + loc + "\n" + filler + " |\n" + offset_s.line + " | " + line + "\n" + filler + " | " + "".padEnd(s.column - 1, " ") + "".padEnd(hatLen, "^");
      } else {
        str += "\n at " + loc;
      }
    }
    return str;
  }
  static buildMessage(expected, found) {
    function hex(ch) {
      return ch.codePointAt(0).toString(16).toUpperCase();
    }
    const nonPrintable = Object.prototype.hasOwnProperty.call(RegExp.prototype, "unicode") ? new RegExp("[\\p{C}\\p{Mn}\\p{Mc}]", "gu") : null;
    function unicodeEscape(s) {
      if (nonPrintable) {
        return s.replace(nonPrintable, ch => "\\u{" + hex(ch) + "}");
      }
      return s;
    }
    function literalEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/"/g, '\\"').replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch)));
    }
    function classEscape(s) {
      return unicodeEscape(s.replace(/\\/g, "\\\\").replace(/\]/g, "\\]").replace(/\^/g, "\\^").replace(/-/g, "\\-").replace(/\0/g, "\\0").replace(/\t/g, "\\t").replace(/\n/g, "\\n").replace(/\r/g, "\\r").replace(/[\x00-\x0F]/g, ch => "\\x0" + hex(ch)).replace(/[\x10-\x1F\x7F-\x9F]/g, ch => "\\x" + hex(ch)));
    }
    const DESCRIBE_EXPECTATION_FNS = {
      literal(expectation) {
        return '"' + literalEscape(expectation.text) + '"';
      },
      class(expectation) {
        const escapedParts = expectation.parts.map(part => Array.isArray(part) ? classEscape(part[0]) + "-" + classEscape(part[1]) : classEscape(part));
        return "[" + (expectation.inverted ? "^" : "") + escapedParts.join("") + "]" + (expectation.unicode ? "u" : "");
      },
      any() {
        return "any character";
      },
      end() {
        return "end of input";
      },
      other(expectation) {
        return expectation.description;
      }
    };
    function describeExpectation(expectation) {
      return DESCRIBE_EXPECTATION_FNS[expectation.type](expectation);
    }
    function describeExpected(expected2) {
      const descriptions = expected2.map(describeExpectation);
      descriptions.sort();
      if (descriptions.length > 0) {
        let j = 1;
        for (let i = 1; i < descriptions.length; i++) {
          if (descriptions[i - 1] !== descriptions[i]) {
            descriptions[j] = descriptions[i];
            j++;
          }
        }
        descriptions.length = j;
      }
      switch (descriptions.length) {
       case 1:
        return descriptions[0];

       case 2:
        return descriptions[0] + " or " + descriptions[1];

       default:
        return descriptions.slice(0, -1).join(", ") + ", or " + descriptions[descriptions.length - 1];
      }
    }
    function describeFound(found2) {
      return found2 ? '"' + literalEscape(found2) + '"' : "end of input";
    }
    return "Expected " + describeExpected(expected) + " but " + describeFound(found) + " found.";
  }
}

function peg$parse(input, options) {
  options = options !== void 0 ? options : {};
  const peg$FAILED = {};
  const peg$source = options.grammarSource;
  const peg$startRuleFunctions = {
    start: peg$parsestart
  };
  let peg$startRuleFunction = peg$parsestart;
  const peg$c0 = "-";
  const peg$c1 = "C#";
  const peg$c2 = "Db";
  const peg$c3 = "D#";
  const peg$c4 = "Eb";
  const peg$c5 = "F#";
  const peg$c6 = "Gb";
  const peg$c7 = "G#";
  const peg$c8 = "Ab";
  const peg$c9 = "A#";
  const peg$c10 = "Bb";
  const peg$c11 = "|";
  const peg$c12 = "=";
  const peg$c13 = "+=";
  const peg$c14 = "velocity";
  const peg$c15 = "timing";
  const peg$c16 = "duration";
  const peg$c17 = "probability";
  const peg$c18 = "+";
  const peg$c19 = "*";
  const peg$c20 = "/";
  const peg$c21 = "(";
  const peg$c22 = ")";
  const peg$c23 = "note.";
  const peg$c24 = "velocityDeviation";
  const peg$c25 = "pitch";
  const peg$c26 = "start";
  const peg$c27 = "cos";
  const peg$c28 = "tri";
  const peg$c29 = "saw";
  const peg$c30 = "square";
  const peg$c31 = "noise";
  const peg$c32 = "ramp";
  const peg$c33 = ",";
  const peg$c34 = ":";
  const peg$c35 = "t";
  const peg$c36 = ".";
  const peg$c37 = "//";
  const peg$c38 = "#";
  const peg$c39 = "/*";
  const peg$c40 = "*/";
  const peg$r0 = /^[A-G]/;
  const peg$r1 = /^[1-9]/;
  const peg$r2 = /^[0-9]/;
  const peg$r3 = /^[^\r\n]/;
  const peg$r4 = /^[\r\n]/;
  const peg$r5 = /^[ \t]/;
  const peg$e0 = peg$literalExpectation("-", false);
  const peg$e1 = peg$literalExpectation("C#", false);
  const peg$e2 = peg$literalExpectation("Db", false);
  const peg$e3 = peg$literalExpectation("D#", false);
  const peg$e4 = peg$literalExpectation("Eb", false);
  const peg$e5 = peg$literalExpectation("F#", false);
  const peg$e6 = peg$literalExpectation("Gb", false);
  const peg$e7 = peg$literalExpectation("G#", false);
  const peg$e8 = peg$literalExpectation("Ab", false);
  const peg$e9 = peg$literalExpectation("A#", false);
  const peg$e10 = peg$literalExpectation("Bb", false);
  const peg$e11 = peg$classExpectation([ [ "A", "G" ] ], false, false, false);
  const peg$e12 = peg$literalExpectation("|", false);
  const peg$e13 = peg$literalExpectation("=", false);
  const peg$e14 = peg$literalExpectation("+=", false);
  const peg$e15 = peg$literalExpectation("velocity", false);
  const peg$e16 = peg$literalExpectation("timing", false);
  const peg$e17 = peg$literalExpectation("duration", false);
  const peg$e18 = peg$literalExpectation("probability", false);
  const peg$e19 = peg$literalExpectation("+", false);
  const peg$e20 = peg$literalExpectation("*", false);
  const peg$e21 = peg$literalExpectation("/", false);
  const peg$e22 = peg$literalExpectation("(", false);
  const peg$e23 = peg$literalExpectation(")", false);
  const peg$e24 = peg$literalExpectation("note.", false);
  const peg$e25 = peg$literalExpectation("velocityDeviation", false);
  const peg$e26 = peg$literalExpectation("pitch", false);
  const peg$e27 = peg$literalExpectation("start", false);
  const peg$e28 = peg$literalExpectation("cos", false);
  const peg$e29 = peg$literalExpectation("tri", false);
  const peg$e30 = peg$literalExpectation("saw", false);
  const peg$e31 = peg$literalExpectation("square", false);
  const peg$e32 = peg$literalExpectation("noise", false);
  const peg$e33 = peg$literalExpectation("ramp", false);
  const peg$e34 = peg$literalExpectation(",", false);
  const peg$e35 = peg$literalExpectation(":", false);
  const peg$e36 = peg$literalExpectation("t", false);
  const peg$e37 = peg$classExpectation([ [ "1", "9" ] ], false, false, false);
  const peg$e38 = peg$classExpectation([ [ "0", "9" ] ], false, false, false);
  const peg$e39 = peg$literalExpectation(".", false);
  const peg$e40 = peg$literalExpectation("//", false);
  const peg$e41 = peg$classExpectation([ "\r", "\n" ], true, false, false);
  const peg$e42 = peg$literalExpectation("#", false);
  const peg$e43 = peg$literalExpectation("/*", false);
  const peg$e44 = peg$literalExpectation("*/", false);
  const peg$e45 = peg$anyExpectation();
  const peg$e46 = peg$classExpectation([ "\r", "\n" ], false, false, false);
  const peg$e47 = peg$classExpectation([ " ", "\t" ], false, false, false);
  function peg$f0(head, tail) {
    const assignments = [ head, ...tail.map(t => t[1]) ].filter(Boolean);
    return assignments;
  }
  function peg$f1(pitchRange, timeRange, parameter, operator, expression) {
    return {
      pitchRange: pitchRange,
      timeRange: timeRange,
      parameter: parameter,
      operator: operator,
      expression: expression
    };
  }
  function peg$f2(startPitch, endPitch) {
    if (endPitch < startPitch) {
      throw new Error(`Invalid pitch range: end pitch ${endPitch} is lower than start pitch ${startPitch}`);
    }
    return {
      startPitch: startPitch,
      endPitch: endPitch
    };
  }
  function peg$f3(singlePitch) {
    return {
      startPitch: singlePitch,
      endPitch: singlePitch
    };
  }
  function peg$f4(pitchClass, octave) {
    const pitch = (octave + 2) * 12 + pitchClass.value;
    if (pitch >= 0 && pitch <= 127) {
      return pitch;
    }
    throw new Error(`MIDI pitch ${pitch} (${pitchClass.name}${octave}) outside valid range 0-127`);
  }
  function peg$f5(pc) {
    return {
      name: pc,
      value: PITCH_CLASS_VALUES$1[pc]
    };
  }
  function peg$f6(startBar, startBeat, endBar, endBeat) {
    return {
      startBar: startBar,
      startBeat: startBeat,
      endBar: endBar,
      endBeat: endBeat
    };
  }
  function peg$f7() {
    return "set";
  }
  function peg$f8() {
    return "add";
  }
  function peg$f9() {
    return "velocity";
  }
  function peg$f10() {
    return "timing";
  }
  function peg$f11() {
    return "duration";
  }
  function peg$f12() {
    return "probability";
  }
  function peg$f13(left, right) {
    return {
      type: "add",
      left: left,
      right: right
    };
  }
  function peg$f14(left, right) {
    return {
      type: "subtract",
      left: left,
      right: right
    };
  }
  function peg$f15(left, right) {
    return {
      type: "multiply",
      left: left,
      right: right
    };
  }
  function peg$f16(left, right) {
    return {
      type: "divide",
      left: left,
      right: right
    };
  }
  function peg$f17(expr) {
    return expr;
  }
  function peg$f18(name) {
    return {
      type: "variable",
      name: name
    };
  }
  function peg$f19() {
    return "velocityDeviation";
  }
  function peg$f20() {
    return "velocity";
  }
  function peg$f21() {
    return "probability";
  }
  function peg$f22() {
    return "duration";
  }
  function peg$f23() {
    return "pitch";
  }
  function peg$f24() {
    return "start";
  }
  function peg$f25(name, args) {
    return {
      type: "function",
      name: name,
      args: args || []
    };
  }
  function peg$f26() {
    return "cos";
  }
  function peg$f27() {
    return "tri";
  }
  function peg$f28() {
    return "saw";
  }
  function peg$f29() {
    return "square";
  }
  function peg$f30() {
    return "noise";
  }
  function peg$f31() {
    return "ramp";
  }
  function peg$f32(head, tail) {
    return [ head, ...tail.map(t => t[3]) ];
  }
  function peg$f33(bars, beats) {
    return {
      type: "period",
      bars: bars,
      beats: beats
    };
  }
  function peg$f34(beats) {
    return {
      type: "period",
      bars: 0,
      beats: beats
    };
  }
  function peg$f35(wholeNumber, fraction) {
    return wholeNumber + fraction;
  }
  function peg$f36() {
    const [num, den] = text().split("/");
    const result = Number.parseInt(num) / Number.parseInt(den);
    if (result < 1) {
      throw new Error(`Value must be 1 or greater (got ${text()})`);
    }
    return result;
  }
  function peg$f37() {
    return Number.parseFloat(text());
  }
  function peg$f38(wholeNumber, fraction) {
    return wholeNumber + fraction;
  }
  function peg$f39(num, den) {
    const parts = text().split("/");
    const numerator = parts[0] === "" ? 1 : Number.parseInt(parts[0]);
    const denominator = Number.parseInt(parts[1]);
    return numerator / denominator;
  }
  function peg$f40(sign, value) {
    return sign ? -value : value;
  }
  function peg$f41() {
    return Number.parseFloat(text());
  }
  function peg$f42() {
    return Number.parseInt(text());
  }
  function peg$f43() {
    return Number.parseInt(text());
  }
  function peg$f44(sign, value) {
    return sign ? -value : value;
  }
  let peg$currPos = options.peg$currPos | 0;
  let peg$savedPos = peg$currPos;
  const peg$posDetailsCache = [ {
    line: 1,
    column: 1
  } ];
  let peg$maxFailPos = peg$currPos;
  let peg$maxFailExpected = options.peg$maxFailExpected || [];
  let peg$silentFails = options.peg$silentFails | 0;
  let peg$result;
  if (options.startRule) {
    if (!(options.startRule in peg$startRuleFunctions)) {
      throw new Error(`Can't start parsing from rule "` + options.startRule + '".');
    }
    peg$startRuleFunction = peg$startRuleFunctions[options.startRule];
  }
  function text() {
    return input.substring(peg$savedPos, peg$currPos);
  }
  function peg$getUnicode(pos = peg$currPos) {
    const cp = input.codePointAt(pos);
    if (cp === void 0) {
      return "";
    }
    return String.fromCodePoint(cp);
  }
  function peg$literalExpectation(text2, ignoreCase) {
    return {
      type: "literal",
      text: text2,
      ignoreCase: ignoreCase
    };
  }
  function peg$classExpectation(parts, inverted, ignoreCase, unicode) {
    return {
      type: "class",
      parts: parts,
      inverted: inverted,
      ignoreCase: ignoreCase,
      unicode: unicode
    };
  }
  function peg$anyExpectation() {
    return {
      type: "any"
    };
  }
  function peg$endExpectation() {
    return {
      type: "end"
    };
  }
  function peg$computePosDetails(pos) {
    let details = peg$posDetailsCache[pos];
    let p;
    if (details) {
      return details;
    } else {
      if (pos >= peg$posDetailsCache.length) {
        p = peg$posDetailsCache.length - 1;
      } else {
        p = pos;
        while (!peg$posDetailsCache[--p]) {}
      }
      details = peg$posDetailsCache[p];
      details = {
        line: details.line,
        column: details.column
      };
      while (p < pos) {
        if (input.charCodeAt(p) === 10) {
          details.line++;
          details.column = 1;
        } else {
          details.column++;
        }
        p++;
      }
      peg$posDetailsCache[pos] = details;
      return details;
    }
  }
  function peg$computeLocation(startPos, endPos, offset2) {
    const startPosDetails = peg$computePosDetails(startPos);
    const endPosDetails = peg$computePosDetails(endPos);
    const res = {
      source: peg$source,
      start: {
        offset: startPos,
        line: startPosDetails.line,
        column: startPosDetails.column
      },
      end: {
        offset: endPos,
        line: endPosDetails.line,
        column: endPosDetails.column
      }
    };
    return res;
  }
  function peg$fail(expected2) {
    if (peg$currPos < peg$maxFailPos) {
      return;
    }
    if (peg$currPos > peg$maxFailPos) {
      peg$maxFailPos = peg$currPos;
      peg$maxFailExpected = [];
    }
    peg$maxFailExpected.push(expected2);
  }
  function peg$buildStructuredError(expected2, found, location2) {
    return new peg$SyntaxError(peg$SyntaxError.buildMessage(expected2, found), expected2, found, location2);
  }
  function peg$parsestart() {
    let s0, s2, s3, s4, s5, s6, s7, s8, s9;
    s0 = peg$currPos;
    peg$parse_();
    s2 = peg$parseassignment();
    if (s2 === peg$FAILED) {
      s2 = null;
    }
    s3 = [];
    s4 = peg$currPos;
    s5 = [];
    s6 = peg$currPos;
    s7 = peg$parse_();
    s8 = peg$parsenl();
    if (s8 !== peg$FAILED) {
      s9 = peg$parse_();
      s7 = [ s7, s8, s9 ];
      s6 = s7;
    } else {
      peg$currPos = s6;
      s6 = peg$FAILED;
    }
    if (s6 !== peg$FAILED) {
      while (s6 !== peg$FAILED) {
        s5.push(s6);
        s6 = peg$currPos;
        s7 = peg$parse_();
        s8 = peg$parsenl();
        if (s8 !== peg$FAILED) {
          s9 = peg$parse_();
          s7 = [ s7, s8, s9 ];
          s6 = s7;
        } else {
          peg$currPos = s6;
          s6 = peg$FAILED;
        }
      }
    } else {
      s5 = peg$FAILED;
    }
    if (s5 !== peg$FAILED) {
      s6 = peg$parseassignment();
      if (s6 !== peg$FAILED) {
        s5 = [ s5, s6 ];
        s4 = s5;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
    } else {
      peg$currPos = s4;
      s4 = peg$FAILED;
    }
    while (s4 !== peg$FAILED) {
      s3.push(s4);
      s4 = peg$currPos;
      s5 = [];
      s6 = peg$currPos;
      s7 = peg$parse_();
      s8 = peg$parsenl();
      if (s8 !== peg$FAILED) {
        s9 = peg$parse_();
        s7 = [ s7, s8, s9 ];
        s6 = s7;
      } else {
        peg$currPos = s6;
        s6 = peg$FAILED;
      }
      if (s6 !== peg$FAILED) {
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = peg$currPos;
          s7 = peg$parse_();
          s8 = peg$parsenl();
          if (s8 !== peg$FAILED) {
            s9 = peg$parse_();
            s7 = [ s7, s8, s9 ];
            s6 = s7;
          } else {
            peg$currPos = s6;
            s6 = peg$FAILED;
          }
        }
      } else {
        s5 = peg$FAILED;
      }
      if (s5 !== peg$FAILED) {
        s6 = peg$parseassignment();
        if (s6 !== peg$FAILED) {
          s5 = [ s5, s6 ];
          s4 = s5;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
    }
    s4 = peg$parse_();
    peg$savedPos = s0;
    s0 = peg$f0(s2, s3);
    return s0;
  }
  function peg$parseassignment() {
    let s0, s1, s3, s5, s7, s9;
    s0 = peg$currPos;
    s1 = peg$parsepitchRange();
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    peg$parse_();
    s3 = peg$parsetimeRange();
    if (s3 === peg$FAILED) {
      s3 = null;
    }
    peg$parse_();
    s5 = peg$parseparameter();
    if (s5 !== peg$FAILED) {
      peg$parse_();
      s7 = peg$parseoperator();
      if (s7 !== peg$FAILED) {
        peg$parse_();
        s9 = peg$parseadditive();
        if (s9 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f1(s1, s3, s5, s7, s9);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsepitchRange() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parsepitch();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 45) {
        s2 = peg$c0;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e0);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parsepitch();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f2(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsepitch();
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f3(s1);
      }
      s0 = s1;
    }
    return s0;
  }
  function peg$parsepitch() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = peg$parsepitchClass();
    if (s1 !== peg$FAILED) {
      s2 = peg$parsesignedInt();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f4(s1, s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsepitchClass() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c1) {
      s1 = peg$c1;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e1);
      }
    }
    if (s1 === peg$FAILED) {
      if (input.substr(peg$currPos, 2) === peg$c2) {
        s1 = peg$c2;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e2);
        }
      }
      if (s1 === peg$FAILED) {
        if (input.substr(peg$currPos, 2) === peg$c3) {
          s1 = peg$c3;
          peg$currPos += 2;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e3);
          }
        }
        if (s1 === peg$FAILED) {
          if (input.substr(peg$currPos, 2) === peg$c4) {
            s1 = peg$c4;
            peg$currPos += 2;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e4);
            }
          }
          if (s1 === peg$FAILED) {
            if (input.substr(peg$currPos, 2) === peg$c5) {
              s1 = peg$c5;
              peg$currPos += 2;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e5);
              }
            }
            if (s1 === peg$FAILED) {
              if (input.substr(peg$currPos, 2) === peg$c6) {
                s1 = peg$c6;
                peg$currPos += 2;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e6);
                }
              }
              if (s1 === peg$FAILED) {
                if (input.substr(peg$currPos, 2) === peg$c7) {
                  s1 = peg$c7;
                  peg$currPos += 2;
                } else {
                  s1 = peg$FAILED;
                  if (peg$silentFails === 0) {
                    peg$fail(peg$e7);
                  }
                }
                if (s1 === peg$FAILED) {
                  if (input.substr(peg$currPos, 2) === peg$c8) {
                    s1 = peg$c8;
                    peg$currPos += 2;
                  } else {
                    s1 = peg$FAILED;
                    if (peg$silentFails === 0) {
                      peg$fail(peg$e8);
                    }
                  }
                  if (s1 === peg$FAILED) {
                    if (input.substr(peg$currPos, 2) === peg$c9) {
                      s1 = peg$c9;
                      peg$currPos += 2;
                    } else {
                      s1 = peg$FAILED;
                      if (peg$silentFails === 0) {
                        peg$fail(peg$e9);
                      }
                    }
                    if (s1 === peg$FAILED) {
                      if (input.substr(peg$currPos, 2) === peg$c10) {
                        s1 = peg$c10;
                        peg$currPos += 2;
                      } else {
                        s1 = peg$FAILED;
                        if (peg$silentFails === 0) {
                          peg$fail(peg$e10);
                        }
                      }
                      if (s1 === peg$FAILED) {
                        s1 = input.charAt(peg$currPos);
                        if (peg$r0.test(s1)) {
                          peg$currPos++;
                        } else {
                          s1 = peg$FAILED;
                          if (peg$silentFails === 0) {
                            peg$fail(peg$e11);
                          }
                        }
                      }
                    }
                  }
                }
              }
            }
          }
        }
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f5(s1);
    }
    s0 = s1;
    return s0;
  }
  function peg$parsetimeRange() {
    let s0, s1, s2, s3, s4, s5, s6, s7;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 124) {
        s2 = peg$c11;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e12);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseoneOrMoreFloat();
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 45) {
            s4 = peg$c0;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e0);
            }
          }
          if (s4 !== peg$FAILED) {
            s5 = peg$parseoneOrMoreInt();
            if (s5 !== peg$FAILED) {
              if (input.charCodeAt(peg$currPos) === 124) {
                s6 = peg$c11;
                peg$currPos++;
              } else {
                s6 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e12);
                }
              }
              if (s6 !== peg$FAILED) {
                s7 = peg$parseoneOrMoreFloat();
                if (s7 !== peg$FAILED) {
                  peg$savedPos = s0;
                  s0 = peg$f6(s1, s3, s5, s7);
                } else {
                  peg$currPos = s0;
                  s0 = peg$FAILED;
                }
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseoperator() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 61) {
      s1 = peg$c12;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e13);
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f7();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 2) === peg$c13) {
        s1 = peg$c13;
        peg$currPos += 2;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e14);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f8();
      }
      s0 = s1;
    }
    return s0;
  }
  function peg$parseparameter() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 8) === peg$c14) {
      s1 = peg$c14;
      peg$currPos += 8;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e15);
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f9();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 6) === peg$c15) {
        s1 = peg$c15;
        peg$currPos += 6;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e16);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f10();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 8) === peg$c16) {
          s1 = peg$c16;
          peg$currPos += 8;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e17);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f11();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 11) === peg$c17) {
            s1 = peg$c17;
            peg$currPos += 11;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e18);
            }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$f12();
          }
          s0 = s1;
        }
      }
    }
    return s0;
  }
  function peg$parseadditive() {
    let s0, s1, s3, s5;
    s0 = peg$currPos;
    s1 = peg$parsemultiplicative();
    if (s1 !== peg$FAILED) {
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 43) {
        s3 = peg$c18;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      if (s3 !== peg$FAILED) {
        peg$parse_();
        s5 = peg$parseadditive();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f13(s1, s5);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parsemultiplicative();
      if (s1 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 45) {
          s3 = peg$c0;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e0);
          }
        }
        if (s3 !== peg$FAILED) {
          peg$parse_();
          s5 = peg$parseadditive();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f14(s1, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parsemultiplicative();
      }
    }
    return s0;
  }
  function peg$parsemultiplicative() {
    let s0, s1, s3, s5;
    s0 = peg$currPos;
    s1 = peg$parseprimary();
    if (s1 !== peg$FAILED) {
      peg$parse_();
      if (input.charCodeAt(peg$currPos) === 42) {
        s3 = peg$c19;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e20);
        }
      }
      if (s3 !== peg$FAILED) {
        peg$parse_();
        s5 = peg$parsemultiplicative();
        if (s5 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f15(s1, s5);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseprimary();
      if (s1 !== peg$FAILED) {
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 47) {
          s3 = peg$c20;
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e21);
          }
        }
        if (s3 !== peg$FAILED) {
          peg$parse_();
          s5 = peg$parsemultiplicative();
          if (s5 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f16(s1, s5);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
      if (s0 === peg$FAILED) {
        s0 = peg$parseprimary();
      }
    }
    return s0;
  }
  function peg$parseprimary() {
    let s0, s1, s3, s5;
    s0 = peg$parsefunctionCall();
    if (s0 === peg$FAILED) {
      s0 = peg$parsevariable();
      if (s0 === peg$FAILED) {
        s0 = peg$parsesignedDecimal();
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.charCodeAt(peg$currPos) === 40) {
            s1 = peg$c21;
            peg$currPos++;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e22);
            }
          }
          if (s1 !== peg$FAILED) {
            peg$parse_();
            s3 = peg$parseadditive();
            if (s3 !== peg$FAILED) {
              peg$parse_();
              if (input.charCodeAt(peg$currPos) === 41) {
                s5 = peg$c22;
                peg$currPos++;
              } else {
                s5 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e23);
                }
              }
              if (s5 !== peg$FAILED) {
                peg$savedPos = s0;
                s0 = peg$f17(s3);
              } else {
                peg$currPos = s0;
                s0 = peg$FAILED;
              }
            } else {
              peg$currPos = s0;
              s0 = peg$FAILED;
            }
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        }
      }
    }
    return s0;
  }
  function peg$parsevariable() {
    let s0, s1, s2;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 5) === peg$c23) {
      s1 = peg$c23;
      peg$currPos += 5;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e24);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = peg$parsepropertyName();
      if (s2 !== peg$FAILED) {
        peg$savedPos = s0;
        s0 = peg$f18(s2);
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsepropertyName() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 17) === peg$c24) {
      s1 = peg$c24;
      peg$currPos += 17;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e25);
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f19();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 8) === peg$c14) {
        s1 = peg$c14;
        peg$currPos += 8;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e15);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f20();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 11) === peg$c17) {
          s1 = peg$c17;
          peg$currPos += 11;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e18);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f21();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 8) === peg$c16) {
            s1 = peg$c16;
            peg$currPos += 8;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e17);
            }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$f22();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 5) === peg$c25) {
              s1 = peg$c25;
              peg$currPos += 5;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e26);
              }
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f23();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 5) === peg$c26) {
                s1 = peg$c26;
                peg$currPos += 5;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e27);
                }
              }
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$f24();
              }
              s0 = s1;
            }
          }
        }
      }
    }
    return s0;
  }
  function peg$parsefunctionCall() {
    let s0, s1, s2, s4, s6;
    s0 = peg$currPos;
    s1 = peg$parsefunctionName();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 40) {
        s2 = peg$c21;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e22);
        }
      }
      if (s2 !== peg$FAILED) {
        peg$parse_();
        s4 = peg$parseargumentList();
        if (s4 === peg$FAILED) {
          s4 = null;
        }
        peg$parse_();
        if (input.charCodeAt(peg$currPos) === 41) {
          s6 = peg$c22;
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e23);
          }
        }
        if (s6 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f25(s1, s4);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsefunctionName() {
    let s0, s1;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 3) === peg$c27) {
      s1 = peg$c27;
      peg$currPos += 3;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e28);
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f26();
    }
    s0 = s1;
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      if (input.substr(peg$currPos, 3) === peg$c28) {
        s1 = peg$c28;
        peg$currPos += 3;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e29);
        }
      }
      if (s1 !== peg$FAILED) {
        peg$savedPos = s0;
        s1 = peg$f27();
      }
      s0 = s1;
      if (s0 === peg$FAILED) {
        s0 = peg$currPos;
        if (input.substr(peg$currPos, 3) === peg$c29) {
          s1 = peg$c29;
          peg$currPos += 3;
        } else {
          s1 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e30);
          }
        }
        if (s1 !== peg$FAILED) {
          peg$savedPos = s0;
          s1 = peg$f28();
        }
        s0 = s1;
        if (s0 === peg$FAILED) {
          s0 = peg$currPos;
          if (input.substr(peg$currPos, 6) === peg$c30) {
            s1 = peg$c30;
            peg$currPos += 6;
          } else {
            s1 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e31);
            }
          }
          if (s1 !== peg$FAILED) {
            peg$savedPos = s0;
            s1 = peg$f29();
          }
          s0 = s1;
          if (s0 === peg$FAILED) {
            s0 = peg$currPos;
            if (input.substr(peg$currPos, 5) === peg$c31) {
              s1 = peg$c31;
              peg$currPos += 5;
            } else {
              s1 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e32);
              }
            }
            if (s1 !== peg$FAILED) {
              peg$savedPos = s0;
              s1 = peg$f30();
            }
            s0 = s1;
            if (s0 === peg$FAILED) {
              s0 = peg$currPos;
              if (input.substr(peg$currPos, 4) === peg$c32) {
                s1 = peg$c32;
                peg$currPos += 4;
              } else {
                s1 = peg$FAILED;
                if (peg$silentFails === 0) {
                  peg$fail(peg$e33);
                }
              }
              if (s1 !== peg$FAILED) {
                peg$savedPos = s0;
                s1 = peg$f31();
              }
              s0 = s1;
            }
          }
        }
      }
    }
    return s0;
  }
  function peg$parseargumentList() {
    let s0, s1, s2, s3, s4, s5, s6, s7;
    s0 = peg$currPos;
    s1 = peg$parseargument();
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$parse_();
      if (input.charCodeAt(peg$currPos) === 44) {
        s5 = peg$c33;
        peg$currPos++;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e34);
        }
      }
      if (s5 !== peg$FAILED) {
        s6 = peg$parse_();
        s7 = peg$parseargument();
        if (s7 !== peg$FAILED) {
          s4 = [ s4, s5, s6, s7 ];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$parse_();
        if (input.charCodeAt(peg$currPos) === 44) {
          s5 = peg$c33;
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e34);
          }
        }
        if (s5 !== peg$FAILED) {
          s6 = peg$parse_();
          s7 = peg$parseargument();
          if (s7 !== peg$FAILED) {
            s4 = [ s4, s5, s6, s7 ];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      peg$savedPos = s0;
      s0 = peg$f32(s1, s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseargument() {
    let s0;
    s0 = peg$parseperiod();
    if (s0 === peg$FAILED) {
      s0 = peg$parseadditive();
    }
    return s0;
  }
  function peg$parseperiod() {
    let s0, s1, s2, s3, s4;
    s0 = peg$currPos;
    s1 = peg$parseunsignedInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 58) {
        s2 = peg$c34;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e35);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseunsignedFloat();
        if (s3 !== peg$FAILED) {
          if (input.charCodeAt(peg$currPos) === 116) {
            s4 = peg$c35;
            peg$currPos++;
          } else {
            s4 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e36);
            }
          }
          if (s4 !== peg$FAILED) {
            peg$savedPos = s0;
            s0 = peg$f33(s1, s3);
          } else {
            peg$currPos = s0;
            s0 = peg$FAILED;
          }
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    if (s0 === peg$FAILED) {
      s0 = peg$currPos;
      s1 = peg$parseunsignedFloat();
      if (s1 !== peg$FAILED) {
        if (input.charCodeAt(peg$currPos) === 116) {
          s2 = peg$c35;
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e36);
          }
        }
        if (s2 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f34(s1);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    }
    return s0;
  }
  function peg$parseoneOrMoreFloat() {
    let s0;
    s0 = peg$parseoneOrMoreMixedNumber();
    if (s0 === peg$FAILED) {
      s0 = peg$parseoneOrMoreFraction();
      if (s0 === peg$FAILED) {
        s0 = peg$parseoneOrMoreDecimal();
      }
    }
    return s0;
  }
  function peg$parseoneOrMoreMixedNumber() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseoneOrMoreInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c18;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseunsignedFraction();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f35(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseoneOrMoreFraction() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e37);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e38);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
      }
      if (input.charCodeAt(peg$currPos) === 47) {
        s3 = peg$c20;
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e21);
        }
      }
      if (s3 !== peg$FAILED) {
        s4 = input.charAt(peg$currPos);
        if (peg$r1.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e37);
          }
        }
        if (s4 !== peg$FAILED) {
          s5 = [];
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e38);
            }
          }
          while (s6 !== peg$FAILED) {
            s5.push(s6);
            s6 = input.charAt(peg$currPos);
            if (peg$r2.test(s6)) {
              peg$currPos++;
            } else {
              s6 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e38);
              }
            }
          }
          peg$savedPos = s0;
          s0 = peg$f36();
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseoneOrMoreDecimal() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e37);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e38);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
      }
      s3 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s4 = peg$c36;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = input.charAt(peg$currPos);
        if (peg$r2.test(s6)) {
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e38);
            }
          }
        }
        s4 = [ s4, s5 ];
        s3 = s4;
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      peg$savedPos = s0;
      s0 = peg$f37();
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedFloat() {
    let s0;
    s0 = peg$parseunsignedMixedNumber();
    if (s0 === peg$FAILED) {
      s0 = peg$parseunsignedFraction();
      if (s0 === peg$FAILED) {
        s0 = peg$parseunsignedDecimal();
      }
    }
    return s0;
  }
  function peg$parseunsignedMixedNumber() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = peg$parseunsignedInt();
    if (s1 !== peg$FAILED) {
      if (input.charCodeAt(peg$currPos) === 43) {
        s2 = peg$c18;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e19);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = peg$parseunsignedFraction();
        if (s3 !== peg$FAILED) {
          peg$savedPos = s0;
          s0 = peg$f38(s1, s3);
        } else {
          peg$currPos = s0;
          s0 = peg$FAILED;
        }
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedFraction() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
    }
    while (s2 !== peg$FAILED) {
      s1.push(s2);
      s2 = input.charAt(peg$currPos);
      if (peg$r2.test(s2)) {
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e38);
        }
      }
    }
    if (input.charCodeAt(peg$currPos) === 47) {
      s2 = peg$c20;
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e21);
      }
    }
    if (s2 !== peg$FAILED) {
      s3 = input.charAt(peg$currPos);
      if (peg$r1.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e37);
        }
      }
      if (s3 !== peg$FAILED) {
        s4 = [];
        s5 = input.charAt(peg$currPos);
        if (peg$r2.test(s5)) {
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
        while (s5 !== peg$FAILED) {
          s4.push(s5);
          s5 = input.charAt(peg$currPos);
          if (peg$r2.test(s5)) {
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e38);
            }
          }
        }
        peg$savedPos = s0;
        s0 = peg$f39();
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsesignedDecimal() {
    let s0, s1, s2;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c0;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = peg$parseunsignedDecimal();
    if (s2 !== peg$FAILED) {
      peg$savedPos = s0;
      s0 = peg$f40(s1, s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedDecimal() {
    let s0, s1, s2, s3, s4, s5, s6;
    s0 = peg$currPos;
    s1 = peg$currPos;
    s2 = [];
    s3 = input.charAt(peg$currPos);
    if (peg$r2.test(s3)) {
      peg$currPos++;
    } else {
      s3 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
    }
    if (s3 !== peg$FAILED) {
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
      }
    } else {
      s2 = peg$FAILED;
    }
    if (s2 !== peg$FAILED) {
      s3 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s4 = peg$c36;
        peg$currPos++;
      } else {
        s4 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      if (s4 !== peg$FAILED) {
        s5 = [];
        s6 = input.charAt(peg$currPos);
        if (peg$r2.test(s6)) {
          peg$currPos++;
        } else {
          s6 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
        while (s6 !== peg$FAILED) {
          s5.push(s6);
          s6 = input.charAt(peg$currPos);
          if (peg$r2.test(s6)) {
            peg$currPos++;
          } else {
            s6 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e38);
            }
          }
        }
        s4 = [ s4, s5 ];
        s3 = s4;
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      if (s3 === peg$FAILED) {
        s3 = null;
      }
      s2 = [ s2, s3 ];
      s1 = s2;
    } else {
      peg$currPos = s1;
      s1 = peg$FAILED;
    }
    if (s1 === peg$FAILED) {
      s1 = peg$currPos;
      if (input.charCodeAt(peg$currPos) === 46) {
        s2 = peg$c36;
        peg$currPos++;
      } else {
        s2 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e39);
        }
      }
      if (s2 !== peg$FAILED) {
        s3 = [];
        s4 = input.charAt(peg$currPos);
        if (peg$r2.test(s4)) {
          peg$currPos++;
        } else {
          s4 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
        if (s4 !== peg$FAILED) {
          while (s4 !== peg$FAILED) {
            s3.push(s4);
            s4 = input.charAt(peg$currPos);
            if (peg$r2.test(s4)) {
              peg$currPos++;
            } else {
              s4 = peg$FAILED;
              if (peg$silentFails === 0) {
                peg$fail(peg$e38);
              }
            }
          }
        } else {
          s3 = peg$FAILED;
        }
        if (s3 !== peg$FAILED) {
          s2 = [ s2, s3 ];
          s1 = s2;
        } else {
          peg$currPos = s1;
          s1 = peg$FAILED;
        }
      } else {
        peg$currPos = s1;
        s1 = peg$FAILED;
      }
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f41();
    }
    s0 = s1;
    return s0;
  }
  function peg$parseoneOrMoreInt() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    s1 = input.charAt(peg$currPos);
    if (peg$r1.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e37);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r2.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e38);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r2.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
      }
      peg$savedPos = s0;
      s0 = peg$f42();
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseunsignedInt() {
    let s0, s1, s2;
    s0 = peg$currPos;
    s1 = [];
    s2 = input.charAt(peg$currPos);
    if (peg$r2.test(s2)) {
      peg$currPos++;
    } else {
      s2 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e38);
      }
    }
    if (s2 !== peg$FAILED) {
      while (s2 !== peg$FAILED) {
        s1.push(s2);
        s2 = input.charAt(peg$currPos);
        if (peg$r2.test(s2)) {
          peg$currPos++;
        } else {
          s2 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e38);
          }
        }
      }
    } else {
      s1 = peg$FAILED;
    }
    if (s1 !== peg$FAILED) {
      peg$savedPos = s0;
      s1 = peg$f43();
    }
    s0 = s1;
    return s0;
  }
  function peg$parsesignedInt() {
    let s0, s1, s2;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 45) {
      s1 = peg$c0;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e0);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = null;
    }
    s2 = peg$parseunsignedInt();
    if (s2 !== peg$FAILED) {
      peg$savedPos = s0;
      s0 = peg$f44(s1, s2);
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parselineComment() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c37) {
      s1 = peg$c37;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e40);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r3.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e41);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r3.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e41);
          }
        }
      }
      s1 = [ s1, s2 ];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsehashComment() {
    let s0, s1, s2, s3;
    s0 = peg$currPos;
    if (input.charCodeAt(peg$currPos) === 35) {
      s1 = peg$c38;
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e42);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = input.charAt(peg$currPos);
      if (peg$r3.test(s3)) {
        peg$currPos++;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e41);
        }
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = input.charAt(peg$currPos);
        if (peg$r3.test(s3)) {
          peg$currPos++;
        } else {
          s3 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e41);
          }
        }
      }
      s1 = [ s1, s2 ];
      s0 = s1;
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parseblockComment() {
    let s0, s1, s2, s3, s4, s5;
    s0 = peg$currPos;
    if (input.substr(peg$currPos, 2) === peg$c39) {
      s1 = peg$c39;
      peg$currPos += 2;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e43);
      }
    }
    if (s1 !== peg$FAILED) {
      s2 = [];
      s3 = peg$currPos;
      s4 = peg$currPos;
      peg$silentFails++;
      if (input.substr(peg$currPos, 2) === peg$c40) {
        s5 = peg$c40;
        peg$currPos += 2;
      } else {
        s5 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e44);
        }
      }
      peg$silentFails--;
      if (s5 === peg$FAILED) {
        s4 = void 0;
      } else {
        peg$currPos = s4;
        s4 = peg$FAILED;
      }
      if (s4 !== peg$FAILED) {
        if (input.length > peg$currPos) {
          s5 = input.charAt(peg$currPos);
          peg$currPos++;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e45);
          }
        }
        if (s5 !== peg$FAILED) {
          s4 = [ s4, s5 ];
          s3 = s4;
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      } else {
        peg$currPos = s3;
        s3 = peg$FAILED;
      }
      while (s3 !== peg$FAILED) {
        s2.push(s3);
        s3 = peg$currPos;
        s4 = peg$currPos;
        peg$silentFails++;
        if (input.substr(peg$currPos, 2) === peg$c40) {
          s5 = peg$c40;
          peg$currPos += 2;
        } else {
          s5 = peg$FAILED;
          if (peg$silentFails === 0) {
            peg$fail(peg$e44);
          }
        }
        peg$silentFails--;
        if (s5 === peg$FAILED) {
          s4 = void 0;
        } else {
          peg$currPos = s4;
          s4 = peg$FAILED;
        }
        if (s4 !== peg$FAILED) {
          if (input.length > peg$currPos) {
            s5 = input.charAt(peg$currPos);
            peg$currPos++;
          } else {
            s5 = peg$FAILED;
            if (peg$silentFails === 0) {
              peg$fail(peg$e45);
            }
          }
          if (s5 !== peg$FAILED) {
            s4 = [ s4, s5 ];
            s3 = s4;
          } else {
            peg$currPos = s3;
            s3 = peg$FAILED;
          }
        } else {
          peg$currPos = s3;
          s3 = peg$FAILED;
        }
      }
      if (input.substr(peg$currPos, 2) === peg$c40) {
        s3 = peg$c40;
        peg$currPos += 2;
      } else {
        s3 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e44);
        }
      }
      if (s3 !== peg$FAILED) {
        s1 = [ s1, s2, s3 ];
        s0 = s1;
      } else {
        peg$currPos = s0;
        s0 = peg$FAILED;
      }
    } else {
      peg$currPos = s0;
      s0 = peg$FAILED;
    }
    return s0;
  }
  function peg$parsecomment() {
    let s0;
    s0 = peg$parselineComment();
    if (s0 === peg$FAILED) {
      s0 = peg$parsehashComment();
      if (s0 === peg$FAILED) {
        s0 = peg$parseblockComment();
      }
    }
    return s0;
  }
  function peg$parsenl() {
    let s0;
    s0 = input.charAt(peg$currPos);
    if (peg$r4.test(s0)) {
      peg$currPos++;
    } else {
      s0 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e46);
      }
    }
    return s0;
  }
  function peg$parse_() {
    let s0, s1;
    s0 = [];
    s1 = input.charAt(peg$currPos);
    if (peg$r5.test(s1)) {
      peg$currPos++;
    } else {
      s1 = peg$FAILED;
      if (peg$silentFails === 0) {
        peg$fail(peg$e47);
      }
    }
    if (s1 === peg$FAILED) {
      s1 = peg$parsecomment();
    }
    while (s1 !== peg$FAILED) {
      s0.push(s1);
      s1 = input.charAt(peg$currPos);
      if (peg$r5.test(s1)) {
        peg$currPos++;
      } else {
        s1 = peg$FAILED;
        if (peg$silentFails === 0) {
          peg$fail(peg$e47);
        }
      }
      if (s1 === peg$FAILED) {
        s1 = peg$parsecomment();
      }
    }
    return s0;
  }
  peg$result = peg$startRuleFunction();
  const peg$success = peg$result !== peg$FAILED && peg$currPos === input.length;
  function peg$throw() {
    if (peg$result !== peg$FAILED && peg$currPos < input.length) {
      peg$fail(peg$endExpectation());
    }
    throw peg$buildStructuredError(peg$maxFailExpected, peg$maxFailPos < input.length ? peg$getUnicode(peg$maxFailPos) : null, peg$maxFailPos < input.length ? peg$computeLocation(peg$maxFailPos, peg$maxFailPos + 1) : peg$computeLocation(peg$maxFailPos, peg$maxFailPos));
  }
  if (options.peg$library) {
    return {
      peg$result: peg$result,
      peg$currPos: peg$currPos,
      peg$FAILED: peg$FAILED,
      peg$maxFailExpected: peg$maxFailExpected,
      peg$maxFailPos: peg$maxFailPos,
      peg$success: peg$success,
      peg$throw: peg$success ? void 0 : peg$throw
    };
  }
  if (peg$success) {
    return peg$result;
  } else {
    peg$throw();
  }
}

function applyModulations(notes, modulationString, timeSigNumerator, timeSigDenominator) {
  if (!modulationString || notes.length === 0) {
    return;
  }
  let ast;
  try {
    ast = peg$parse(modulationString);
  } catch (error) {
    warn(`Failed to parse modulation string: ${errorMessage(error)}`);
    return;
  }
  const firstNote = notes[0];
  const clipStartTime = firstNote.start_time * (timeSigDenominator / 4);
  const lastNote = notes.at(-1);
  const clipEndTime = (lastNote.start_time + lastNote.duration) * (timeSigDenominator / 4);
  for (const note of notes) {
    const noteContext = buildNoteContext(note, timeSigNumerator, timeSigDenominator, clipStartTime, clipEndTime);
    const noteProperties = buildNoteProperties(note, timeSigDenominator);
    const modulations = evaluateModulationAST(ast, noteContext, noteProperties);
    applyVelocityModulation(note, modulations);
    applyTimingModulation(note, modulations);
    applyDurationModulation(note, modulations);
    applyProbabilityModulation(note, modulations);
  }
}

function buildNoteContext(note, timeSigNumerator, timeSigDenominator, clipStartTime, clipEndTime) {
  const musicalBeats = note.start_time * (timeSigDenominator / 4);
  const barBeatStr = abletonBeatsToBarBeat(note.start_time, timeSigNumerator, timeSigDenominator);
  const barBeatMatch = barBeatStr.match(/^(\d+)\|(\d+(?:\.\d+)?)$/);
  const bar = barBeatMatch ? Number.parseInt(barBeatMatch[1]) : void 0;
  const beat = barBeatMatch ? Number.parseFloat(barBeatMatch[2]) : void 0;
  return {
    position: musicalBeats,
    pitch: note.pitch,
    bar: bar,
    beat: beat,
    timeSig: {
      numerator: timeSigNumerator,
      denominator: timeSigDenominator
    },
    clipTimeRange: {
      start: clipStartTime,
      end: clipEndTime
    }
  };
}

function buildNoteProperties(note, timeSigDenominator) {
  return {
    pitch: note.pitch,
    start: note.start_time * (timeSigDenominator / 4),
    velocity: note.velocity,
    velocityDeviation: note.velocity_deviation ?? 0,
    duration: note.duration,
    probability: note.probability
  };
}

function applyVelocityModulation(note, modulations) {
  if (modulations.velocity == null) {
    return;
  }
  if (modulations.velocity.operator === "set") {
    note.velocity = Math.max(1, Math.min(127, modulations.velocity.value));
  } else {
    note.velocity = Math.max(1, Math.min(127, note.velocity + modulations.velocity.value));
  }
}

function applyTimingModulation(note, modulations) {
  if (modulations.timing == null) {
    return;
  }
  if (modulations.timing.operator === "set") {
    note.start_time = modulations.timing.value;
  } else {
    note.start_time += modulations.timing.value;
  }
}

function applyDurationModulation(note, modulations) {
  if (modulations.duration == null) {
    return;
  }
  note.duration = modulations.duration.operator === "set" ? Math.max(.001, modulations.duration.value) : Math.max(.001, note.duration + modulations.duration.value);
}

function applyProbabilityModulation(note, modulations) {
  if (modulations.probability == null) {
    return;
  }
  if (modulations.probability.operator === "set") {
    note.probability = Math.max(0, Math.min(1, modulations.probability.value));
  } else {
    note.probability = Math.max(0, Math.min(1, (note.probability ?? 1) + modulations.probability.value));
  }
}

const MAX_AUTO_CREATED_TRACKS = 100;

const MAX_AUTO_CREATED_SCENES = 1e3;

const MAX_CLIP_BEATS = 1e6;

const MAX_ARRANGEMENT_POSITION_BEATS = 1576800;

const MAX_SLICES = 64;

const STATE = {
  ACTIVE: "active",
  MUTED: "muted",
  MUTED_VIA_SOLO: "muted-via-solo",
  MUTED_ALSO_VIA_SOLO: "muted-also-via-solo",
  MUTED_AND_SOLOED: "muted-and-soloed",
  SOLOED: "soloed"
};

const LIVE_API_DEVICE_TYPE_INSTRUMENT = 1;

const LIVE_API_DEVICE_TYPE_AUDIO_EFFECT = 2;

const LIVE_API_DEVICE_TYPE_MIDI_EFFECT = 4;

const DEVICE_TYPE = {
  INSTRUMENT: "instrument",
  INSTRUMENT_RACK: "instrument-rack",
  DRUM_RACK: "drum-rack",
  AUDIO_EFFECT: "audio-effect",
  AUDIO_EFFECT_RACK: "audio-effect-rack",
  MIDI_EFFECT: "midi-effect",
  MIDI_EFFECT_RACK: "midi-effect-rack"
};

const MONITORING_STATE = {
  IN: "in",
  AUTO: "auto",
  OFF: "off"
};

const LIVE_API_MONITORING_STATE_IN = 0;

const LIVE_API_MONITORING_STATE_AUTO = 1;

const LIVE_API_MONITORING_STATE_OFF = 2;

const WARP_MODE = {
  BEATS: "beats",
  TONES: "tones",
  TEXTURE: "texture",
  REPITCH: "repitch",
  COMPLEX: "complex",
  REX: "rex",
  PRO: "pro"
};

const LIVE_API_WARP_MODE_BEATS = 0;

const LIVE_API_WARP_MODE_TONES = 1;

const LIVE_API_WARP_MODE_TEXTURE = 2;

const LIVE_API_WARP_MODE_REPITCH = 3;

const LIVE_API_WARP_MODE_COMPLEX = 4;

const LIVE_API_WARP_MODE_REX = 5;

const LIVE_API_WARP_MODE_PRO = 6;

const LIVE_API_VIEW_NAMES = {
  BROWSER: "Browser",
  DETAIL: "Detail",
  DETAIL_CLIP: "Detail/Clip",
  DETAIL_DEVICE_CHAIN: "Detail/DeviceChain"
};

const VALID_SCALE_NAMES = [ "Major", "Minor", "Dorian", "Mixolydian", "Lydian", "Phrygian", "Locrian", "Whole Tone", "Half-whole Dim.", "Whole-half Dim.", "Minor Blues", "Minor Pentatonic", "Major Pentatonic", "Harmonic Minor", "Harmonic Major", "Dorian #4", "Phrygian Dominant", "Melodic Minor", "Lydian Augmented", "Lydian Dominant", "Super Locrian", "8-Tone Spanish", "Bhairav", "Hungarian Minor", "Hirajoshi", "In-Sen", "Iwato", "Kumoi", "Pelog Selisir", "Pelog Tembung", "Messiaen 3", "Messiaen 4", "Messiaen 5", "Messiaen 6", "Messiaen 7" ];

const VALID_DEVICES = {
  instruments: [ "Analog", "Collision", "Drift", "Drum Rack", "DrumSampler", "Electric", "External Instrument", "Impulse", "Instrument Rack", "Meld", "Operator", "Sampler", "Simpler", "Tension", "Wavetable" ],
  midiEffects: [ "Arpeggiator", "CC Control", "Chord", "MIDI Effect Rack", "Note Length", "Pitch", "Random", "Scale", "Velocity" ],
  audioEffects: [ "Amp", "Audio Effect Rack", "Auto Filter", "Auto Pan-Tremolo", "Auto Shift", "Beat Repeat", "Cabinet", "Channel EQ", "Chorus-Ensemble", "Compressor", "Corpus", "Delay", "Drum Buss", "Dynamic Tube", "Echo", "EQ Eight", "EQ Three", "Erosion", "External Audio Effect", "Filter Delay", "Gate", "Glue Compressor", "Grain Delay", "Hybrid Reverb", "Limiter", "Looper", "Multiband Dynamics", "Overdrive", "Pedal", "Phaser-Flanger", "Redux", "Resonators", "Reverb", "Roar", "Saturator", "Shifter", "Spectral Resonator", "Spectral Time", "Spectrum", "Tuner", "Utility", "Vinyl Distortion", "Vocoder" ]
};

const ALL_VALID_DEVICES = [ ...VALID_DEVICES.instruments, ...VALID_DEVICES.midiEffects, ...VALID_DEVICES.audioEffects ];

const DEVICE_CLASS = {
  SIMPLER: "Simpler"
};

function validateIdType(id, expectedType, toolName) {
  const object = LiveAPI.from(id);
  if (!object.exists()) {
    throw new Error(`${toolName} failed: id "${id}" does not exist`);
  }
  if (!isTypeMatch(object.type, expectedType)) {
    throw new Error(`${toolName} failed: id "${id}" is not a ${expectedType} (found ${object.type})`);
  }
  return object;
}

function validateIdTypes(ids, expectedType, toolName, {skipInvalid: skipInvalid = false} = {}) {
  const validObjects = [];
  for (const id of ids) {
    const object = LiveAPI.from(id);
    if (!object.exists()) {
      if (skipInvalid) {
        warn(`${toolName}: id "${id}" does not exist`);
        continue;
      } else {
        throw new Error(`${toolName} failed: id "${id}" does not exist`);
      }
    }
    if (!isTypeMatch(object.type, expectedType)) {
      if (skipInvalid) {
        warn(`${toolName}: id "${id}" is not a ${expectedType} (found ${object.type})`);
        continue;
      } else {
        throw new Error(`${toolName} failed: id "${id}" is not a ${expectedType} (found ${object.type})`);
      }
    }
    validObjects.push(object);
  }
  return validObjects;
}

function validateExclusiveParams(param1, param2, name1, name2) {
  if (!param1 && !param2) {
    throw new Error(`Either ${name1} or ${name2} must be provided`);
  }
  if (param1 && param2) {
    throw new Error(`Provide either ${name1} or ${name2}, not both`);
  }
}

function isTypeMatch(actualType, expectedType) {
  const actual = actualType.toLowerCase();
  const expected = expectedType.toLowerCase();
  if (actual === expected) return true;
  if (expected === "device" && actual.endsWith("device")) return true;
  if (expected === "drum-pad" && (actual === "drumpad" || actual === "drumchain")) return true;
  return false;
}

const MASTER_TRACK_PATH = "live_set master_track";

function buildTrackPath(category, trackIndex) {
  const finalCategory = category ?? "regular";
  if (finalCategory === "regular") {
    return `live_set tracks ${trackIndex}`;
  }
  if (finalCategory === "return") {
    return `live_set return_tracks ${trackIndex}`;
  }
  if (finalCategory === "master") {
    return MASTER_TRACK_PATH;
  }
  return null;
}

function validateParameters({trackId: trackId, category: category, trackIndex: trackIndex, sceneId: sceneId, sceneIndex: sceneIndex, deviceId: deviceId, instrument: instrument, clipSlot: _clipSlot}) {
  if (category === "master" && trackIndex != null) {
    throw new Error("trackIndex should not be provided when category is 'master'");
  }
  if (deviceId != null && instrument != null) {
    throw new Error("cannot specify both deviceId and instrument");
  }
  if (trackId != null && trackIndex != null) {
    const trackPath = buildTrackPath(category, trackIndex);
    if (trackPath) {
      const trackAPI = LiveAPI.from(trackPath);
      if (trackAPI.exists() && trackAPI.id !== trackId) {
        throw new Error("trackId and trackIndex refer to different tracks");
      }
    }
  }
  if (sceneId != null && sceneIndex != null) {
    const sceneAPI = LiveAPI.from(`live_set scenes ${sceneIndex}`);
    if (sceneAPI.exists() && sceneAPI.id !== sceneId) {
      throw new Error("sceneId and sceneIndex refer to different scenes");
    }
  }
}

function updateTrackSelection({songView: songView, trackId: trackId, category: category, trackIndex: trackIndex}) {
  const result = {};
  let trackAPI = null;
  let finalTrackId = trackId;
  if (trackId != null) {
    trackAPI = validateIdType(trackId, "track", "select");
    songView.setProperty("selected_track", trackAPI.id);
    result.selectedTrackId = trackId;
    if (category != null) {
      result.selectedCategory = category;
    }
    if (trackIndex != null) {
      result.selectedTrackIndex = trackIndex;
    }
  } else if (category != null || trackIndex != null) {
    const finalCategory = category ?? "regular";
    const trackPath = buildTrackPath(category, trackIndex);
    if (trackPath) {
      trackAPI = LiveAPI.from(trackPath);
      if (trackAPI.exists()) {
        finalTrackId = trackAPI.id;
        songView.setProperty("selected_track", trackAPI.id);
        result.selectedTrackId = finalTrackId;
        result.selectedCategory = finalCategory;
        if (finalCategory !== "master" && trackIndex != null) {
          result.selectedTrackIndex = trackIndex;
        }
      }
    }
  }
  return result;
}

function updateSceneSelection({songView: songView, sceneId: sceneId, sceneIndex: sceneIndex}) {
  const result = {};
  if (sceneId != null) {
    const sceneAPI = validateIdType(sceneId, "scene", "select");
    songView.setProperty("selected_scene", sceneAPI.id);
    result.selectedSceneId = sceneId;
    if (sceneIndex != null) {
      result.selectedSceneIndex = sceneIndex;
    }
  } else if (sceneIndex != null) {
    const sceneAPI = LiveAPI.from(`live_set scenes ${sceneIndex}`);
    if (sceneAPI.exists()) {
      const finalSceneId = sceneAPI.id;
      songView.setProperty("selected_scene", sceneAPI.id);
      result.selectedSceneId = finalSceneId;
      result.selectedSceneIndex = sceneIndex;
    }
  }
  return result;
}

function updateDeviceSelection({deviceId: deviceId, instrument: instrument, trackSelectionResult: trackSelectionResult}) {
  if (deviceId != null) {
    validateIdType(deviceId, "device", "select");
    const songView = LiveAPI.from("live_set view");
    const deviceIdStr = deviceId.toString();
    const deviceIdForApi = deviceIdStr.startsWith("id ") ? deviceIdStr : `id ${deviceIdStr}`;
    songView.call("select_device", deviceIdForApi);
  } else if (instrument === true) {
    let trackPath = buildTrackPath(trackSelectionResult.selectedCategory, trackSelectionResult.selectedTrackIndex);
    if (!trackPath) {
      const selectedTrackAPI = LiveAPI.from("live_set view selected_track");
      if (selectedTrackAPI.exists()) {
        const category = selectedTrackAPI.category;
        const trackIndex = category === "return" ? selectedTrackAPI.returnTrackIndex : selectedTrackAPI.trackIndex;
        trackPath = buildTrackPath(category, trackIndex);
      }
    }
    if (trackPath) {
      const trackView = LiveAPI.from(`${trackPath} view`);
      if (trackView.exists()) {
        trackView.call("select_instrument");
      }
    }
  }
}

function updateHighlightedClipSlot({songView: songView, clipSlot: clipSlot}) {
  if (clipSlot != null) {
    const {trackIndex: trackIndex, sceneIndex: sceneIndex} = clipSlot;
    const clipSlotAPI = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
    if (clipSlotAPI.exists()) {
      songView.setProperty("highlighted_clip_slot", clipSlotAPI.id);
    }
  }
}

function updateClipSelection({appView: appView, songView: songView, clipId: clipId, requestedView: requestedView}) {
  const clipAPI = validateIdType(clipId, "clip", "select");
  const isSessionClip = clipAPI.trackIndex != null && clipAPI.clipSlotIndex != null;
  const requiredView = isSessionClip ? "session" : "arrangement";
  if (requestedView != null && requestedView !== requiredView) {
    warn(`Warning: ignoring view="${requestedView}" - clip ${clipId} requires ${requiredView} view`);
  }
  appView.call("show_view", toLiveApiView(requiredView));
  songView.setProperty("detail_clip", clipAPI.id);
  if (isSessionClip) {
    updateHighlightedClipSlot({
      songView: songView,
      clipSlot: {
        trackIndex: clipAPI.trackIndex,
        sceneIndex: clipAPI.clipSlotIndex
      }
    });
  }
}

function select({view: view, trackId: trackId, category: category, trackIndex: trackIndex, sceneId: sceneId, sceneIndex: sceneIndex, clipId: clipId, deviceId: deviceId, instrument: instrument, clipSlot: clipSlot, detailView: detailView, showLoop: showLoop, showBrowser: showBrowser} = {}, _context = {}) {
  validateParameters({
    trackId: trackId,
    category: category,
    trackIndex: trackIndex,
    sceneId: sceneId,
    sceneIndex: sceneIndex,
    deviceId: deviceId,
    instrument: instrument,
    clipSlot: clipSlot
  });
  const appView = LiveAPI.from("live_app view");
  const songView = LiveAPI.from("live_set view");
  if (view != null) {
    appView.call("show_view", toLiveApiView(view));
  }
  const trackSelectionResult = updateTrackSelection({
    songView: songView,
    trackId: trackId,
    category: category,
    trackIndex: trackIndex
  });
  updateSceneSelection({
    songView: songView,
    sceneId: sceneId,
    sceneIndex: sceneIndex
  });
  if (clipId !== void 0) {
    updateClipSelection({
      appView: appView,
      songView: songView,
      clipId: clipId,
      requestedView: view
    });
  }
  updateDeviceSelection({
    deviceId: deviceId,
    instrument: instrument,
    trackSelectionResult: trackSelectionResult
  });
  updateHighlightedClipSlot({
    songView: songView,
    clipSlot: clipSlot
  });
  if (detailView !== void 0) {
    if (detailView === "clip") {
      appView.call("focus_view", LIVE_API_VIEW_NAMES.DETAIL_CLIP);
    } else if (detailView === "device") {
      appView.call("focus_view", LIVE_API_VIEW_NAMES.DETAIL_DEVICE_CHAIN);
    } else {
      appView.call("hide_view", LIVE_API_VIEW_NAMES.DETAIL);
    }
  }
  if (showLoop === true && clipId) {
    appView.call("focus_view", LIVE_API_VIEW_NAMES.DETAIL_CLIP);
  }
  if (showBrowser !== void 0) {
    if (showBrowser) {
      appView.call("focus_view", LIVE_API_VIEW_NAMES.BROWSER);
    } else {
      appView.call("hide_view", LIVE_API_VIEW_NAMES.BROWSER);
    }
  }
  return readViewState();
}

function readViewState() {
  const appView = LiveAPI.from("live_app view");
  const selectedTrack = LiveAPI.from("live_set view selected_track");
  const selectedScene = LiveAPI.from("live_set view selected_scene");
  const detailClip = LiveAPI.from("live_set view detail_clip");
  const highlightedClipSlotAPI = LiveAPI.from("live_set view highlighted_clip_slot");
  const selectedTrackId = selectedTrack.exists() ? selectedTrack.id : null;
  const category = selectedTrack.exists() ? selectedTrack.category : null;
  const selectedSceneIndex = selectedScene.exists() ? selectedScene.sceneIndex : null;
  const selectedSceneId = selectedScene.exists() ? selectedScene.id : null;
  const selectedClipId = detailClip.exists() ? detailClip.id : null;
  let selectedDeviceId = null;
  if (selectedTrack.exists()) {
    const trackView = LiveAPI.from(`${selectedTrack.path} view`);
    if (trackView.exists()) {
      const deviceResult = trackView.get("selected_device");
      if (deviceResult?.[1]) {
        selectedDeviceId = String(deviceResult[1]);
      }
    }
  }
  const highlightedSlot = highlightedClipSlotAPI.exists() && highlightedClipSlotAPI.trackIndex != null && highlightedClipSlotAPI.sceneIndex != null ? {
    trackIndex: highlightedClipSlotAPI.trackIndex,
    sceneIndex: highlightedClipSlotAPI.sceneIndex
  } : null;
  let detailView = null;
  if (appView.call("is_view_visible", LIVE_API_VIEW_NAMES.DETAIL_CLIP)) {
    detailView = "clip";
  } else if (appView.call("is_view_visible", LIVE_API_VIEW_NAMES.DETAIL_DEVICE_CHAIN)) {
    detailView = "device";
  }
  const showBrowser = Boolean(appView.call("is_view_visible", LIVE_API_VIEW_NAMES.BROWSER));
  const selectedTrackObject = {
    trackId: selectedTrackId,
    category: category
  };
  if (category === "regular" && selectedTrack.exists()) {
    selectedTrackObject.trackIndex = selectedTrack.trackIndex;
  } else if (category === "return" && selectedTrack.exists()) {
    selectedTrackObject.returnTrackIndex = selectedTrack.returnTrackIndex;
  }
  return {
    view: fromLiveApiView(appView.getProperty("focused_document_view")),
    detailView: detailView,
    showBrowser: showBrowser,
    selectedTrack: selectedTrackObject,
    selectedClipId: selectedClipId,
    selectedDeviceId: selectedDeviceId,
    selectedScene: {
      sceneId: selectedSceneId,
      sceneIndex: selectedSceneIndex
    },
    selectedClipSlot: highlightedSlot
  };
}

function parseSongTimeSignature() {
  const liveSet = LiveAPI.from("live_set");
  return {
    numerator: liveSet.getProperty("signature_numerator"),
    denominator: liveSet.getProperty("signature_denominator")
  };
}

function validateAndParseArrangementParams(arrangementStart, arrangementLength) {
  const result = {
    songTimeSigNumerator: null,
    songTimeSigDenominator: null,
    arrangementStartBeats: null,
    arrangementLengthBeats: null
  };
  if (arrangementStart == null && arrangementLength == null) {
    return result;
  }
  const songTimeSig = parseSongTimeSignature();
  const {numerator: numerator, denominator: denominator} = songTimeSig;
  result.songTimeSigNumerator = numerator;
  result.songTimeSigDenominator = denominator;
  if (arrangementStart != null) {
    result.arrangementStartBeats = barBeatToAbletonBeats(arrangementStart, numerator, denominator);
  }
  if (arrangementLength != null) {
    const lengthBeats = barBeatDurationToAbletonBeats(arrangementLength, numerator, denominator);
    if (lengthBeats <= 0) {
      throw new Error("arrangementLength must be greater than 0");
    }
    result.arrangementLengthBeats = lengthBeats;
  }
  return result;
}

function buildClipResultObject(clipId, noteCount) {
  const result = {
    id: clipId
  };
  if (noteCount != null) {
    result.noteCount = noteCount;
  }
  return result;
}

function emitArrangementWarnings(arrangementStartBeats, tracksWithMovedClips) {
  if (arrangementStartBeats == null) {
    return;
  }
  for (const [trackIndex, count] of tracksWithMovedClips.entries()) {
    if (count > 1) {
      warn(`${count} clips on track ${trackIndex} moved to the same position - later clips will overwrite earlier ones`);
    }
  }
}

function prepareSessionClipSlot(trackIndex, sceneIndex, liveSet, maxAutoCreatedScenes) {
  if (sceneIndex >= maxAutoCreatedScenes) {
    throw new Error(`sceneIndex ${sceneIndex} exceeds the maximum allowed value of ${MAX_AUTO_CREATED_SCENES - 1}`);
  }
  const currentSceneCount = liveSet.getChildIds("scenes").length;
  if (sceneIndex >= currentSceneCount) {
    const scenesToCreate = sceneIndex - currentSceneCount + 1;
    for (let j = 0; j < scenesToCreate; j++) {
      liveSet.call("create_scene", -1);
    }
  }
  const clipSlot = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
  if (clipSlot.getProperty("has_clip")) {
    throw new Error(`a clip already exists at track ${trackIndex}, clip slot ${sceneIndex}`);
  }
  return clipSlot;
}

function parseSceneIndexList$1(input) {
  const indices = parseCommaSeparatedIndices(input);
  for (const num of indices) {
    if (num < 0) {
      throw new Error(`invalid sceneIndex "${num}" - must be a non-negative integer`);
    }
  }
  return indices;
}

function parseArrangementStartList(input) {
  return parseCommaSeparatedIds(input);
}

function createAudioSessionClip(trackIndex, sceneIndex, sampleFile, liveSet, maxAutoCreatedScenes) {
  const clipSlot = prepareSessionClipSlot(trackIndex, sceneIndex, liveSet, maxAutoCreatedScenes);
  clipSlot.call("create_audio_clip", sampleFile);
  return {
    clip: LiveAPI.from(`${clipSlot.path} clip`),
    sceneIndex: sceneIndex
  };
}

function createAudioArrangementClip(trackIndex, arrangementStartBeats, sampleFile) {
  if (arrangementStartBeats != null && arrangementStartBeats > MAX_ARRANGEMENT_POSITION_BEATS) {
    throw new Error(`arrangement position ${arrangementStartBeats} exceeds maximum allowed value of ${MAX_ARRANGEMENT_POSITION_BEATS}`);
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  const newClipResult = track.call("create_audio_clip", sampleFile, arrangementStartBeats);
  const clip = LiveAPI.from(newClipResult);
  if (!clip.exists()) {
    throw new Error("failed to create audio Arrangement clip");
  }
  return {
    clip: clip,
    arrangementStartBeats: arrangementStartBeats
  };
}

function buildClipProperties(startBeats, endBeats, firstStartBeats, looping, clipName, color, timeSigNumerator, timeSigDenominator, clipLength) {
  const propsToSet = {
    start_marker: startBeats ?? 0,
    loop_start: startBeats ?? 0,
    loop_end: 0,
    end_marker: 0
  };
  const effectiveEnd = endBeats ?? clipLength;
  propsToSet.loop_end = effectiveEnd;
  propsToSet.end_marker = effectiveEnd;
  if (looping && firstStartBeats != null) {
    propsToSet.playing_position = firstStartBeats;
  }
  if (clipName) {
    propsToSet.name = clipName;
  }
  if (color != null) {
    propsToSet.color = color;
  }
  if (looping != null) {
    propsToSet.looping = looping ? 1 : 0;
  }
  propsToSet.signature_numerator = timeSigNumerator;
  propsToSet.signature_denominator = timeSigDenominator;
  return propsToSet;
}

function buildClipResult(clip, trackIndex, view, sceneIndex, arrangementStart, notationString, notes, length, timeSigNumerator, timeSigDenominator, sampleFile) {
  const clipResult = {
    id: clip.id,
    trackIndex: trackIndex
  };
  if (view === "session") {
    clipResult.sceneIndex = sceneIndex;
  } else {
    clipResult.arrangementStart = arrangementStart;
  }
  if (notationString != null) {
    clipResult.noteCount = notes.length;
    if (length == null) {
      const actualClipLength = clip.getProperty("length");
      clipResult.length = abletonBeatsToBarBeatDuration(actualClipLength, timeSigNumerator, timeSigDenominator);
    }
  }
  if (sampleFile) {
    const actualClipLength = clip.getProperty("length");
    clipResult.length = abletonBeatsToBarBeatDuration(actualClipLength, timeSigNumerator, timeSigDenominator);
  }
  return clipResult;
}

function parseSceneIndexList(input) {
  try {
    return parseSceneIndexList$1(input);
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    throw new Error(`createClip failed: ${message}`);
  }
}

function buildClipName(name, count, i) {
  return buildIndexedName(name, count, i);
}

function convertTimingParameters(arrangementStart, start, firstStart, length, looping, timeSigNumerator, timeSigDenominator, songTimeSigNumerator, songTimeSigDenominator) {
  const arrangementStartBeats = null;
  const startBeats = start != null ? barBeatToAbletonBeats(start, timeSigNumerator, timeSigDenominator) : null;
  const firstStartBeats = firstStart != null ? barBeatToAbletonBeats(firstStart, timeSigNumerator, timeSigDenominator) : null;
  if (firstStart != null && looping === false) {
    warn("firstStart parameter ignored for non-looping clips");
  }
  let endBeats = null;
  if (length != null) {
    const lengthBeats = barBeatDurationToAbletonBeats(length, timeSigNumerator, timeSigDenominator);
    const startOffsetBeats = startBeats ?? 0;
    endBeats = startOffsetBeats + lengthBeats;
  }
  return {
    arrangementStartBeats: arrangementStartBeats,
    startBeats: startBeats,
    firstStartBeats: firstStartBeats,
    endBeats: endBeats
  };
}

function createSessionClip(trackIndex, sceneIndex, clipLength, liveSet, maxAutoCreatedScenes) {
  const clipSlot = prepareSessionClipSlot(trackIndex, sceneIndex, liveSet, maxAutoCreatedScenes);
  clipSlot.call("create_clip", clipLength);
  return {
    clip: LiveAPI.from(`${clipSlot.path} clip`),
    sceneIndex: sceneIndex
  };
}

function createArrangementClip(trackIndex, arrangementStartBeats, clipLength) {
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  const newClipResult = track.call("create_midi_clip", arrangementStartBeats, clipLength);
  const clip = LiveAPI.from(newClipResult);
  if (!clip.exists()) {
    throw new Error("failed to create Arrangement clip");
  }
  return {
    clip: clip,
    arrangementStartBeats: arrangementStartBeats
  };
}

function processClipIteration(view, trackIndex, sceneIndex, arrangementStartBeats, arrangementStart, clipLength, liveSet, startBeats, endBeats, firstStartBeats, looping, clipName, color, timeSigNumerator, timeSigDenominator, notationString, notes, length, sampleFile) {
  let clip;
  let currentSceneIndex;
  if (sampleFile) {
    if (view === "session") {
      const validSceneIndex = sceneIndex;
      const result = createAudioSessionClip(trackIndex, validSceneIndex, sampleFile, liveSet, MAX_AUTO_CREATED_SCENES);
      clip = result.clip;
      currentSceneIndex = result.sceneIndex;
    } else {
      const result = createAudioArrangementClip(trackIndex, arrangementStartBeats, sampleFile);
      clip = result.clip;
    }
    const propsToSet = {};
    if (clipName) propsToSet.name = clipName;
    if (color != null) propsToSet.color = color;
    if (Object.keys(propsToSet).length > 0) {
      clip.setAll(propsToSet);
    }
  } else {
    if (view === "session") {
      const validSceneIndex = sceneIndex;
      const result = createSessionClip(trackIndex, validSceneIndex, clipLength, liveSet, MAX_AUTO_CREATED_SCENES);
      clip = result.clip;
      currentSceneIndex = result.sceneIndex;
    } else {
      const result = createArrangementClip(trackIndex, arrangementStartBeats, clipLength);
      clip = result.clip;
    }
    const propsToSet = buildClipProperties(startBeats, endBeats, firstStartBeats, looping, clipName, color, timeSigNumerator, timeSigDenominator, clipLength);
    clip.setAll(propsToSet);
    if (notes.length > 0) {
      clip.call("add_new_notes", {
        notes: notes
      });
    }
  }
  return buildClipResult(clip, trackIndex, view, currentSceneIndex, arrangementStart, notationString, notes, length, timeSigNumerator, timeSigDenominator, sampleFile);
}

function validateCreateClipParams(view, sceneIndices, arrangementStarts, notes, sampleFile) {
  if (!view) {
    throw new Error("createClip failed: view parameter is required");
  }
  if (view === "session" && sceneIndices.length === 0) {
    throw new Error("createClip failed: sceneIndex is required when view is 'session'");
  }
  if (view === "arrangement" && arrangementStarts.length === 0) {
    throw new Error("createClip failed: arrangementStart is required when view is 'arrangement'");
  }
  if (sampleFile && notes) {
    throw new Error("createClip failed: cannot specify both sampleFile and notes - audio clips cannot contain MIDI notes");
  }
}

function calculateClipLength(endBeats, notes, timeSigNumerator, timeSigDenominator) {
  if (endBeats != null) {
    return endBeats;
  } else if (notes.length > 0) {
    const lastNoteStartTimeAbletonBeats = Math.max(...notes.map(note => note.start_time));
    const abletonBeatsPerBar = timeSigToAbletonBeatsPerBar(timeSigNumerator, timeSigDenominator);
    return Math.ceil((lastNoteStartTimeAbletonBeats + 1e-4) / abletonBeatsPerBar) * abletonBeatsPerBar;
  }
  return timeSigToAbletonBeatsPerBar(timeSigNumerator, timeSigDenominator);
}

function handleAutoPlayback(auto, view, sceneIndices, trackIndex) {
  if (!auto || view !== "session" || sceneIndices.length === 0) {
    return;
  }
  switch (auto) {
   case "play-scene":
    {
      const firstSceneIndex = sceneIndices[0];
      const scene = LiveAPI.from(`live_set scenes ${firstSceneIndex}`);
      if (!scene.exists()) {
        throw new Error(`createClip auto="play-scene" failed: scene at sceneIndex=${firstSceneIndex} does not exist`);
      }
      scene.call("fire");
      break;
    }

   case "play-clip":
    for (const sceneIndex of sceneIndices) {
      const clipSlot = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
      clipSlot.call("fire");
    }
    break;

   default:
    throw new Error(`createClip failed: unknown auto value "${auto}". Expected "play-scene" or "play-clip"`);
  }
}

function createClip({view: view, trackIndex: trackIndex, sceneIndex: sceneIndex = null, arrangementStart: arrangementStart = null, notes: notationString = null, modulations: modulationString = null, sampleFile: sampleFile = null, name: name = null, color: color = null, timeSignature: timeSignature = null, start: start = null, length: length = null, firstStart: firstStart = null, looping: looping = null, auto: auto = null, switchView: switchView}, _context = {}) {
  const sceneIndices = parseSceneIndexList(sceneIndex);
  const arrangementStarts = parseArrangementStartList(arrangementStart);
  validateCreateClipParams(view, sceneIndices, arrangementStarts, notationString, sampleFile);
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  if (!track.exists()) {
    throw new Error(`createClip failed: track ${trackIndex} does not exist`);
  }
  const liveSet = LiveAPI.from("live_set");
  const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
  const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
  let timeSigNumerator, timeSigDenominator;
  if (timeSignature != null) {
    const parsed = parseTimeSignature(timeSignature);
    timeSigNumerator = parsed.numerator;
    timeSigDenominator = parsed.denominator;
  } else {
    timeSigNumerator = songTimeSigNumerator;
    timeSigDenominator = songTimeSigDenominator;
  }
  const {startBeats: startBeats, firstStartBeats: firstStartBeats, endBeats: endBeats} = convertTimingParameters(null, start, firstStart, length, looping, timeSigNumerator, timeSigDenominator);
  const {notes: notes, clipLength: initialClipLength} = prepareClipData(sampleFile, notationString, modulationString, endBeats, timeSigNumerator, timeSigDenominator);
  const createdClips = createClips(view, trackIndex, sceneIndices, arrangementStarts, name, initialClipLength, liveSet, startBeats, endBeats, firstStartBeats, looping, color, timeSigNumerator, timeSigDenominator, notationString, notes, songTimeSigNumerator, songTimeSigDenominator, length, sampleFile);
  handleAutoPlayback(auto, view, sceneIndices, trackIndex);
  if (switchView) {
    select({
      view: view
    });
  }
  return unwrapSingleResult(createdClips);
}

function createClips(view, trackIndex, sceneIndices, arrangementStarts, name, initialClipLength, liveSet, startBeats, endBeats, firstStartBeats, looping, color, timeSigNumerator, timeSigDenominator, notationString, notes, songTimeSigNumerator, songTimeSigDenominator, length, sampleFile) {
  const createdClips = [];
  const positions = view === "session" ? sceneIndices : arrangementStarts;
  const count = positions.length;
  const clipLength = initialClipLength;
  for (let i = 0; i < count; i++) {
    const clipName = buildClipName(name, count, i);
    let currentSceneIndex = null;
    let currentArrangementStartBeats = null;
    let currentArrangementStart = null;
    if (view === "session") {
      currentSceneIndex = sceneIndices[i];
    } else {
      currentArrangementStart = arrangementStarts[i];
      currentArrangementStartBeats = barBeatToAbletonBeats(currentArrangementStart, songTimeSigNumerator, songTimeSigDenominator);
    }
    try {
      const clipResult = processClipIteration(view, trackIndex, currentSceneIndex, currentArrangementStartBeats, currentArrangementStart, clipLength, liveSet, startBeats, endBeats, firstStartBeats, looping, clipName, color, timeSigNumerator, timeSigDenominator, notationString, notes, length, sampleFile);
      createdClips.push(clipResult);
    } catch (error) {
      const position = view === "session" ? `trackIndex=${trackIndex}, sceneIndex=${currentSceneIndex}` : `trackIndex=${trackIndex}, arrangementStart=${currentArrangementStart}`;
      warn(`Failed to create clip at ${position}: ${errorMessage(error)}`);
    }
  }
  return createdClips;
}

function prepareClipData(sampleFile, notationString, modulationString, endBeats, timeSigNumerator, timeSigDenominator) {
  const notes = notationString != null ? interpretNotation(notationString, {
    timeSigNumerator: timeSigNumerator,
    timeSigDenominator: timeSigDenominator
  }) : [];
  applyModulations(notes, modulationString ?? void 0, timeSigNumerator, timeSigDenominator);
  let clipLength;
  if (sampleFile) {
    clipLength = 1;
  } else {
    clipLength = calculateClipLength(endBeats, notes, timeSigNumerator, timeSigDenominator);
  }
  return {
    notes: notes,
    clipLength: clipLength
  };
}

const PITCH_CLASS_NAMES = Object.freeze([ "C", "Db", "D", "Eb", "E", "F", "Gb", "G", "Ab", "A", "Bb", "B" ]);

const PITCH_CLASS_VALUES = Object.freeze({
  C: 0,
  "C#": 1,
  Db: 1,
  D: 2,
  "D#": 3,
  Eb: 3,
  E: 4,
  F: 5,
  "F#": 6,
  Gb: 6,
  G: 7,
  "G#": 8,
  Ab: 8,
  A: 9,
  "A#": 10,
  Bb: 10,
  B: 11
});

const PITCH_CLASS_VALUES_LOWERCASE = Object.freeze(Object.fromEntries(Object.entries(PITCH_CLASS_VALUES).map(([key, value]) => [ key.toLowerCase(), value ])));

const VALID_PITCH_CLASS_NAMES = Object.freeze(Object.keys(PITCH_CLASS_VALUES));

function isValidMidi(midi) {
  return typeof midi === "number" && Number.isInteger(midi) && midi >= 0 && midi <= 127;
}

function isValidNoteName(name) {
  if (typeof name !== "string") return false;
  const match = name.match(/^([A-Ga-g][#Bb]?)(-?\d+)$/);
  if (!match) return false;
  const pitchClass = match[1].toLowerCase();
  return pitchClass in PITCH_CLASS_VALUES_LOWERCASE;
}

function pitchClassToNumber(name) {
  if (typeof name !== "string") {
    return null;
  }
  const value = PITCH_CLASS_VALUES_LOWERCASE[name.toLowerCase()];
  return value ?? null;
}

function midiToNoteName(midi) {
  if (!isValidMidi(midi)) {
    return null;
  }
  const pitchClass = midi % 12;
  const octave = Math.floor(midi / 12) - 2;
  return `${PITCH_CLASS_NAMES[pitchClass]}${octave}`;
}

function noteNameToMidi(name) {
  if (typeof name !== "string" || name.length < 2) {
    return null;
  }
  const match = name.match(/^([A-Ga-g][#Bb]?)(-?\d+)$/);
  if (!match) {
    return null;
  }
  const pitchClassName = match[1];
  const octaveStr = match[2];
  const pitchClass = pitchClassToNumber(pitchClassName);
  const octave = Number.parseInt(octaveStr);
  const midi = (octave + 2) * 12 + pitchClass;
  if (midi < 0 || midi > 127) {
    return null;
  }
  return midi;
}

function intervalsToPitchClasses(intervals, rootNote) {
  return intervals.map(interval => {
    const pitchClass = (rootNote + interval) % 12;
    return PITCH_CLASS_NAMES[pitchClass];
  });
}

function formatNumberWithoutTrailingZeros(value) {
  return value % 1 === 0 ? value.toString() : value.toFixed(3).replace(/\.?0+$/, "");
}

function calculateBarBeat(startTime, beatsPerBar, timeSigDenominator) {
  let adjustedTime = Math.round(startTime * 1e3) / 1e3;
  if (timeSigDenominator != null) {
    adjustedTime = adjustedTime * (timeSigDenominator / 4);
  }
  const bar = Math.floor(adjustedTime / beatsPerBar) + 1;
  const beat = adjustedTime % beatsPerBar + 1;
  return {
    bar: bar,
    beat: beat
  };
}

function isSameTimePosition(bar1, beat1, bar2, beat2) {
  return bar1 === bar2 && Math.abs(beat1 - beat2) <= .001;
}

function groupNotesByTime(sortedNotes, beatsPerBar, timeSigDenominator) {
  const timeGroups = [];
  let currentGroup = null;
  for (const note of sortedNotes) {
    const {bar: bar, beat: beat} = calculateBarBeat(note.start_time, beatsPerBar, timeSigDenominator);
    if (!currentGroup || !isSameTimePosition(currentGroup.bar, currentGroup.beat, bar, beat)) {
      currentGroup = {
        bar: bar,
        beat: beat,
        notes: []
      };
      timeGroups.push(currentGroup);
    }
    currentGroup.notes.push(note);
  }
  return timeGroups;
}

function handleVelocityChange(noteVelocity, noteVelocityDeviation, currentVelocity, currentVelocityDeviation, elements) {
  if (noteVelocityDeviation > 0) {
    const velocityMin = noteVelocity;
    const velocityMax = noteVelocity + noteVelocityDeviation;
    const currentVelocityMin = currentVelocity;
    const currentVelocityMax = currentVelocity + currentVelocityDeviation;
    if (velocityMin !== currentVelocityMin || velocityMax !== currentVelocityMax) {
      elements.push(`v${velocityMin}-${velocityMax}`);
      return {
        velocity: velocityMin,
        velocityDeviation: noteVelocityDeviation
      };
    }
  } else if (noteVelocity !== currentVelocity || currentVelocityDeviation > 0) {
    elements.push(`v${noteVelocity}`);
    return {
      velocity: noteVelocity,
      velocityDeviation: 0
    };
  }
  return {
    velocity: currentVelocity,
    velocityDeviation: currentVelocityDeviation
  };
}

function handleDurationChange(noteDuration, currentDuration, elements) {
  if (Math.abs(noteDuration - currentDuration) > .001) {
    const durationFormatted = formatNumberWithoutTrailingZeros(noteDuration);
    elements.push(`t${durationFormatted}`);
    return noteDuration;
  }
  return currentDuration;
}

function handleProbabilityChange(noteProbability, currentProbability, elements) {
  if (Math.abs(noteProbability - currentProbability) > .001) {
    const probabilityFormatted = formatNumberWithoutTrailingZeros(noteProbability);
    elements.push(`p${probabilityFormatted}`);
    return noteProbability;
  }
  return currentProbability;
}

function formatBeat(beat) {
  return formatNumberWithoutTrailingZeros(beat);
}

function formatNotation(clipNotes, options = {}) {
  if (!clipNotes || clipNotes.length === 0) {
    return "";
  }
  const {timeSigDenominator: timeSigDenominator} = options;
  const beatsPerBar = parseBeatsPerBar(options);
  const sortedNotes = [ ...clipNotes ].sort((a, b) => {
    if (a.start_time !== b.start_time) {
      return a.start_time - b.start_time;
    }
    return a.pitch - b.pitch;
  });
  const timeGroups = groupNotesByTime(sortedNotes, beatsPerBar, timeSigDenominator);
  const elements = [];
  let currentVelocity = DEFAULT_VELOCITY;
  let currentDuration = DEFAULT_DURATION;
  let currentProbability = DEFAULT_PROBABILITY;
  let currentVelocityDeviation = DEFAULT_VELOCITY_DEVIATION;
  for (const group of timeGroups) {
    for (const note of group.notes) {
      const noteVelocity = Math.round(note.velocity);
      const noteVelocityDeviation = Math.round(note.velocity_deviation ?? DEFAULT_VELOCITY_DEVIATION);
      const velocityState = handleVelocityChange(noteVelocity, noteVelocityDeviation, currentVelocity, currentVelocityDeviation, elements);
      currentVelocity = velocityState.velocity;
      currentVelocityDeviation = velocityState.velocityDeviation;
      const noteDuration = note.duration;
      currentDuration = handleDurationChange(noteDuration, currentDuration, elements);
      const noteProbability = note.probability ?? DEFAULT_PROBABILITY;
      currentProbability = handleProbabilityChange(noteProbability, currentProbability, elements);
      const noteName = midiToNoteName(note.pitch);
      if (noteName == null) {
        throw new Error(`Invalid MIDI pitch: ${note.pitch}`);
      }
      elements.push(noteName);
    }
    const beatFormatted = formatBeat(group.beat);
    elements.push(`${group.bar}|${beatFormatted}`);
  }
  return elements.join(" ");
}

const LOOKUP_TABLE = [ {
  gain: 0,
  dB: null
}, {
  gain: .001953125,
  dB: -65.7
}, {
  gain: .00390625,
  dB: -62.9
}, {
  gain: .005859375,
  dB: -60.7
}, {
  gain: .0078125,
  dB: -59
}, {
  gain: .009765625,
  dB: -57.6
}, {
  gain: .01171875,
  dB: -55
}, {
  gain: .013671875,
  dB: -52.9
}, {
  gain: .015625,
  dB: -51.3
}, {
  gain: .017578125,
  dB: -49.9
}, {
  gain: .01953125,
  dB: -48.6
}, {
  gain: .021484375,
  dB: -47.3
}, {
  gain: .0234375,
  dB: -46.1
}, {
  gain: .025390625,
  dB: -45
}, {
  gain: .02734375,
  dB: -44.1
}, {
  gain: .029296875,
  dB: -43.2
}, {
  gain: .03125,
  dB: -42.7
}, {
  gain: .033203125,
  dB: -42.3
}, {
  gain: .03515625,
  dB: -41.9
}, {
  gain: .037109375,
  dB: -41.5
}, {
  gain: .0390625,
  dB: -41.2
}, {
  gain: .041015625,
  dB: -40.8
}, {
  gain: .04296875,
  dB: -40.5
}, {
  gain: .044921875,
  dB: -40.1
}, {
  gain: .046875,
  dB: -39.7
}, {
  gain: .048828125,
  dB: -39.4
}, {
  gain: .05078125,
  dB: -39
}, {
  gain: .052734375,
  dB: -38.7
}, {
  gain: .0546875,
  dB: -38.3
}, {
  gain: .056640625,
  dB: -38
}, {
  gain: .05859375,
  dB: -37.6
}, {
  gain: .060546875,
  dB: -37.3
}, {
  gain: .0625,
  dB: -36.9
}, {
  gain: .064453125,
  dB: -36.6
}, {
  gain: .06640625,
  dB: -36.2
}, {
  gain: .068359375,
  dB: -35.9
}, {
  gain: .0703125,
  dB: -35.6
}, {
  gain: .072265625,
  dB: -35.2
}, {
  gain: .07421875,
  dB: -34.9
}, {
  gain: .076171875,
  dB: -34.5
}, {
  gain: .078125,
  dB: -34.2
}, {
  gain: .080078125,
  dB: -33.9
}, {
  gain: .08203125,
  dB: -33.6
}, {
  gain: .083984375,
  dB: -33.2
}, {
  gain: .0859375,
  dB: -32.9
}, {
  gain: .087890625,
  dB: -32.6
}, {
  gain: .08984375,
  dB: -32.3
}, {
  gain: .091796875,
  dB: -31.9
}, {
  gain: .09375,
  dB: -31.6
}, {
  gain: .095703125,
  dB: -31.3
}, {
  gain: .09765625,
  dB: -31
}, {
  gain: .099609375,
  dB: -30.7
}, {
  gain: .1015625,
  dB: -30.3
}, {
  gain: .103515625,
  dB: -30
}, {
  gain: .10546875,
  dB: -29.7
}, {
  gain: .107421875,
  dB: -29.4
}, {
  gain: .109375,
  dB: -29.1
}, {
  gain: .111328125,
  dB: -28.8
}, {
  gain: .11328125,
  dB: -28.5
}, {
  gain: .115234375,
  dB: -28.1
}, {
  gain: .1171875,
  dB: -27.9
}, {
  gain: .119140625,
  dB: -27.6
}, {
  gain: .12109375,
  dB: -27.3
}, {
  gain: .123046875,
  dB: -26.9
}, {
  gain: .125,
  dB: -26.6
}, {
  gain: .126953125,
  dB: -26.4
}, {
  gain: .12890625,
  dB: -26.1
}, {
  gain: .130859375,
  dB: -25.8
}, {
  gain: .1328125,
  dB: -25.5
}, {
  gain: .134765625,
  dB: -25.2
}, {
  gain: .13671875,
  dB: -24.9
}, {
  gain: .138671875,
  dB: -24.6
}, {
  gain: .140625,
  dB: -24.3
}, {
  gain: .142578125,
  dB: -24
}, {
  gain: .14453125,
  dB: -23.8
}, {
  gain: .146484375,
  dB: -23.5
}, {
  gain: .1484375,
  dB: -23.2
}, {
  gain: .150390625,
  dB: -22.9
}, {
  gain: .15234375,
  dB: -22.7
}, {
  gain: .154296875,
  dB: -22.4
}, {
  gain: .15625,
  dB: -22.1
}, {
  gain: .158203125,
  dB: -21.8
}, {
  gain: .16015625,
  dB: -21.6
}, {
  gain: .162109375,
  dB: -21.3
}, {
  gain: .1640625,
  dB: -21
}, {
  gain: .166015625,
  dB: -20.8
}, {
  gain: .16796875,
  dB: -20.5
}, {
  gain: .169921875,
  dB: -20.2
}, {
  gain: .171875,
  dB: -20
}, {
  gain: .173828125,
  dB: -19.7
}, {
  gain: .17578125,
  dB: -19.5
}, {
  gain: .177734375,
  dB: -19.2
}, {
  gain: .1796875,
  dB: -19
}, {
  gain: .181640625,
  dB: -18.7
}, {
  gain: .18359375,
  dB: -18.4
}, {
  gain: .185546875,
  dB: -18.2
}, {
  gain: .1875,
  dB: -17.9
}, {
  gain: .189453125,
  dB: -17.7
}, {
  gain: .19140625,
  dB: -17.5
}, {
  gain: .193359375,
  dB: -17.2
}, {
  gain: .1953125,
  dB: -17
}, {
  gain: .197265625,
  dB: -16.7
}, {
  gain: .19921875,
  dB: -16.5
}, {
  gain: .201171875,
  dB: -16.3
}, {
  gain: .203125,
  dB: -16
}, {
  gain: .205078125,
  dB: -15.8
}, {
  gain: .20703125,
  dB: -15.5
}, {
  gain: .208984375,
  dB: -15.3
}, {
  gain: .2109375,
  dB: -15.1
}, {
  gain: .212890625,
  dB: -14.8
}, {
  gain: .21484375,
  dB: -14.6
}, {
  gain: .216796875,
  dB: -14.4
}, {
  gain: .21875,
  dB: -14.2
}, {
  gain: .220703125,
  dB: -14
}, {
  gain: .22265625,
  dB: -13.7
}, {
  gain: .224609375,
  dB: -13.5
}, {
  gain: .2265625,
  dB: -13.3
}, {
  gain: .228515625,
  dB: -13.1
}, {
  gain: .23046875,
  dB: -12.9
}, {
  gain: .232421875,
  dB: -12.6
}, {
  gain: .234375,
  dB: -12.4
}, {
  gain: .236328125,
  dB: -12.2
}, {
  gain: .23828125,
  dB: -12
}, {
  gain: .240234375,
  dB: -11.8
}, {
  gain: .2421875,
  dB: -11.6
}, {
  gain: .244140625,
  dB: -11.4
}, {
  gain: .24609375,
  dB: -11.2
}, {
  gain: .248046875,
  dB: -11
}, {
  gain: .25,
  dB: -10.8
}, {
  gain: .251953125,
  dB: -10.6
}, {
  gain: .25390625,
  dB: -10.4
}, {
  gain: .255859375,
  dB: -10.2
}, {
  gain: .2578125,
  dB: -10
}, {
  gain: .259765625,
  dB: -9.82
}, {
  gain: .26171875,
  dB: -9.63
}, {
  gain: .263671875,
  dB: -9.44
}, {
  gain: .265625,
  dB: -9.25
}, {
  gain: .267578125,
  dB: -9.06
}, {
  gain: .26953125,
  dB: -8.88
}, {
  gain: .271484375,
  dB: -8.7
}, {
  gain: .2734375,
  dB: -8.51
}, {
  gain: .275390625,
  dB: -8.33
}, {
  gain: .27734375,
  dB: -8.16
}, {
  gain: .279296875,
  dB: -7.98
}, {
  gain: .28125,
  dB: -7.8
}, {
  gain: .283203125,
  dB: -7.63
}, {
  gain: .28515625,
  dB: -7.46
}, {
  gain: .287109375,
  dB: -7.29
}, {
  gain: .2890625,
  dB: -7.12
}, {
  gain: .291015625,
  dB: -6.95
}, {
  gain: .29296875,
  dB: -6.78
}, {
  gain: .294921875,
  dB: -6.62
}, {
  gain: .296875,
  dB: -6.45
}, {
  gain: .298828125,
  dB: -6.29
}, {
  gain: .30078125,
  dB: -6.13
}, {
  gain: .302734375,
  dB: -5.97
}, {
  gain: .3046875,
  dB: -5.82
}, {
  gain: .306640625,
  dB: -5.66
}, {
  gain: .30859375,
  dB: -5.51
}, {
  gain: .310546875,
  dB: -5.36
}, {
  gain: .3125,
  dB: -5.2
}, {
  gain: .314453125,
  dB: -5.05
}, {
  gain: .31640625,
  dB: -4.91
}, {
  gain: .318359375,
  dB: -4.76
}, {
  gain: .3203125,
  dB: -4.62
}, {
  gain: .322265625,
  dB: -4.47
}, {
  gain: .32421875,
  dB: -4.33
}, {
  gain: .326171875,
  dB: -4.19
}, {
  gain: .328125,
  dB: -4.05
}, {
  gain: .330078125,
  dB: -3.91
}, {
  gain: .33203125,
  dB: -3.78
}, {
  gain: .333984375,
  dB: -3.64
}, {
  gain: .3359375,
  dB: -3.51
}, {
  gain: .337890625,
  dB: -3.38
}, {
  gain: .33984375,
  dB: -3.25
}, {
  gain: .341796875,
  dB: -3.12
}, {
  gain: .34375,
  dB: -2.99
}, {
  gain: .345703125,
  dB: -2.87
}, {
  gain: .34765625,
  dB: -2.75
}, {
  gain: .349609375,
  dB: -2.62
}, {
  gain: .3515625,
  dB: -2.5
}, {
  gain: .353515625,
  dB: -2.38
}, {
  gain: .35546875,
  dB: -2.27
}, {
  gain: .357421875,
  dB: -2.15
}, {
  gain: .359375,
  dB: -2.04
}, {
  gain: .361328125,
  dB: -1.92
}, {
  gain: .36328125,
  dB: -1.81
}, {
  gain: .365234375,
  dB: -1.7
}, {
  gain: .3671875,
  dB: -1.59
}, {
  gain: .369140625,
  dB: -1.49
}, {
  gain: .37109375,
  dB: -1.38
}, {
  gain: .373046875,
  dB: -1.28
}, {
  gain: .375,
  dB: -1.18
}, {
  gain: .376953125,
  dB: -1.08
}, {
  gain: .37890625,
  dB: -.98
}, {
  gain: .380859375,
  dB: -.88
}, {
  gain: .3828125,
  dB: -.78
}, {
  gain: .384765625,
  dB: -.69
}, {
  gain: .38671875,
  dB: -.59
}, {
  gain: .388671875,
  dB: -.5
}, {
  gain: .390625,
  dB: -.41
}, {
  gain: .392578125,
  dB: -.32
}, {
  gain: .39453125,
  dB: -.24
}, {
  gain: .396484375,
  dB: -.15
}, {
  gain: .3984375,
  dB: -.07
}, {
  gain: .400390625,
  dB: .02
}, {
  gain: .40234375,
  dB: .1
}, {
  gain: .404296875,
  dB: .17
}, {
  gain: .40625,
  dB: .25
}, {
  gain: .408203125,
  dB: .33
}, {
  gain: .41015625,
  dB: .41
}, {
  gain: .412109375,
  dB: .49
}, {
  gain: .4140625,
  dB: .56
}, {
  gain: .416015625,
  dB: .64
}, {
  gain: .41796875,
  dB: .72
}, {
  gain: .419921875,
  dB: .8
}, {
  gain: .421875,
  dB: .88
}, {
  gain: .423828125,
  dB: .96
}, {
  gain: .42578125,
  dB: 1.03
}, {
  gain: .427734375,
  dB: 1.11
}, {
  gain: .4296875,
  dB: 1.19
}, {
  gain: .431640625,
  dB: 1.27
}, {
  gain: .43359375,
  dB: 1.35
}, {
  gain: .435546875,
  dB: 1.42
}, {
  gain: .4375,
  dB: 1.5
}, {
  gain: .439453125,
  dB: 1.58
}, {
  gain: .44140625,
  dB: 1.66
}, {
  gain: .443359375,
  dB: 1.74
}, {
  gain: .4453125,
  dB: 1.81
}, {
  gain: .447265625,
  dB: 1.89
}, {
  gain: .44921875,
  dB: 1.97
}, {
  gain: .451171875,
  dB: 2.05
}, {
  gain: .453125,
  dB: 2.13
}, {
  gain: .455078125,
  dB: 2.21
}, {
  gain: .45703125,
  dB: 2.28
}, {
  gain: .458984375,
  dB: 2.36
}, {
  gain: .4609375,
  dB: 2.44
}, {
  gain: .462890625,
  dB: 2.52
}, {
  gain: .46484375,
  dB: 2.6
}, {
  gain: .466796875,
  dB: 2.67
}, {
  gain: .46875,
  dB: 2.75
}, {
  gain: .470703125,
  dB: 2.83
}, {
  gain: .47265625,
  dB: 2.91
}, {
  gain: .474609375,
  dB: 2.99
}, {
  gain: .4765625,
  dB: 3.06
}, {
  gain: .478515625,
  dB: 3.14
}, {
  gain: .48046875,
  dB: 3.22
}, {
  gain: .482421875,
  dB: 3.3
}, {
  gain: .484375,
  dB: 3.38
}, {
  gain: .486328125,
  dB: 3.46
}, {
  gain: .48828125,
  dB: 3.53
}, {
  gain: .490234375,
  dB: 3.61
}, {
  gain: .4921875,
  dB: 3.69
}, {
  gain: .494140625,
  dB: 3.77
}, {
  gain: .49609375,
  dB: 3.85
}, {
  gain: .498046875,
  dB: 3.92
}, {
  gain: .5,
  dB: 4
}, {
  gain: .501953125,
  dB: 4.08
}, {
  gain: .50390625,
  dB: 4.16
}, {
  gain: .505859375,
  dB: 4.24
}, {
  gain: .5078125,
  dB: 4.31
}, {
  gain: .509765625,
  dB: 4.39
}, {
  gain: .51171875,
  dB: 4.47
}, {
  gain: .513671875,
  dB: 4.55
}, {
  gain: .515625,
  dB: 4.63
}, {
  gain: .517578125,
  dB: 4.7
}, {
  gain: .51953125,
  dB: 4.78
}, {
  gain: .521484375,
  dB: 4.86
}, {
  gain: .5234375,
  dB: 4.94
}, {
  gain: .525390625,
  dB: 5.02
}, {
  gain: .52734375,
  dB: 5.1
}, {
  gain: .529296875,
  dB: 5.17
}, {
  gain: .53125,
  dB: 5.25
}, {
  gain: .533203125,
  dB: 5.33
}, {
  gain: .53515625,
  dB: 5.41
}, {
  gain: .537109375,
  dB: 5.49
}, {
  gain: .5390625,
  dB: 5.56
}, {
  gain: .541015625,
  dB: 5.64
}, {
  gain: .54296875,
  dB: 5.72
}, {
  gain: .544921875,
  dB: 5.8
}, {
  gain: .546875,
  dB: 5.88
}, {
  gain: .548828125,
  dB: 5.95
}, {
  gain: .55078125,
  dB: 6.03
}, {
  gain: .552734375,
  dB: 6.11
}, {
  gain: .5546875,
  dB: 6.19
}, {
  gain: .556640625,
  dB: 6.27
}, {
  gain: .55859375,
  dB: 6.34
}, {
  gain: .560546875,
  dB: 6.42
}, {
  gain: .5625,
  dB: 6.5
}, {
  gain: .564453125,
  dB: 6.58
}, {
  gain: .56640625,
  dB: 6.66
}, {
  gain: .568359375,
  dB: 6.74
}, {
  gain: .5703125,
  dB: 6.81
}, {
  gain: .572265625,
  dB: 6.89
}, {
  gain: .57421875,
  dB: 6.97
}, {
  gain: .576171875,
  dB: 7.05
}, {
  gain: .578125,
  dB: 7.13
}, {
  gain: .580078125,
  dB: 7.2
}, {
  gain: .58203125,
  dB: 7.28
}, {
  gain: .583984375,
  dB: 7.36
}, {
  gain: .5859375,
  dB: 7.44
}, {
  gain: .587890625,
  dB: 7.52
}, {
  gain: .58984375,
  dB: 7.59
}, {
  gain: .591796875,
  dB: 7.67
}, {
  gain: .59375,
  dB: 7.75
}, {
  gain: .595703125,
  dB: 7.83
}, {
  gain: .59765625,
  dB: 7.91
}, {
  gain: .599609375,
  dB: 7.98
}, {
  gain: .6015625,
  dB: 8.06
}, {
  gain: .603515625,
  dB: 8.14
}, {
  gain: .60546875,
  dB: 8.22
}, {
  gain: .607421875,
  dB: 8.3
}, {
  gain: .609375,
  dB: 8.38
}, {
  gain: .611328125,
  dB: 8.45
}, {
  gain: .61328125,
  dB: 8.53
}, {
  gain: .615234375,
  dB: 8.61
}, {
  gain: .6171875,
  dB: 8.69
}, {
  gain: .619140625,
  dB: 8.77
}, {
  gain: .62109375,
  dB: 8.84
}, {
  gain: .623046875,
  dB: 8.92
}, {
  gain: .625,
  dB: 9
}, {
  gain: .626953125,
  dB: 9.08
}, {
  gain: .62890625,
  dB: 9.16
}, {
  gain: .630859375,
  dB: 9.24
}, {
  gain: .6328125,
  dB: 9.31
}, {
  gain: .634765625,
  dB: 9.39
}, {
  gain: .63671875,
  dB: 9.47
}, {
  gain: .638671875,
  dB: 9.55
}, {
  gain: .640625,
  dB: 9.63
}, {
  gain: .642578125,
  dB: 9.7
}, {
  gain: .64453125,
  dB: 9.78
}, {
  gain: .646484375,
  dB: 9.86
}, {
  gain: .6484375,
  dB: 9.94
}, {
  gain: .650390625,
  dB: 10
}, {
  gain: .65234375,
  dB: 10.1
}, {
  gain: .654296875,
  dB: 10.2
}, {
  gain: .65625,
  dB: 10.3
}, {
  gain: .658203125,
  dB: 10.3
}, {
  gain: .66015625,
  dB: 10.4
}, {
  gain: .662109375,
  dB: 10.5
}, {
  gain: .6640625,
  dB: 10.6
}, {
  gain: .666015625,
  dB: 10.6
}, {
  gain: .66796875,
  dB: 10.7
}, {
  gain: .669921875,
  dB: 10.8
}, {
  gain: .671875,
  dB: 10.9
}, {
  gain: .673828125,
  dB: 11
}, {
  gain: .67578125,
  dB: 11
}, {
  gain: .677734375,
  dB: 11.1
}, {
  gain: .6796875,
  dB: 11.2
}, {
  gain: .681640625,
  dB: 11.3
}, {
  gain: .68359375,
  dB: 11.3
}, {
  gain: .685546875,
  dB: 11.4
}, {
  gain: .6875,
  dB: 11.5
}, {
  gain: .689453125,
  dB: 11.6
}, {
  gain: .69140625,
  dB: 11.7
}, {
  gain: .693359375,
  dB: 11.7
}, {
  gain: .6953125,
  dB: 11.8
}, {
  gain: .697265625,
  dB: 11.9
}, {
  gain: .69921875,
  dB: 12
}, {
  gain: .701171875,
  dB: 12
}, {
  gain: .703125,
  dB: 12.1
}, {
  gain: .705078125,
  dB: 12.2
}, {
  gain: .70703125,
  dB: 12.3
}, {
  gain: .708984375,
  dB: 12.4
}, {
  gain: .7109375,
  dB: 12.4
}, {
  gain: .712890625,
  dB: 12.5
}, {
  gain: .71484375,
  dB: 12.6
}, {
  gain: .716796875,
  dB: 12.7
}, {
  gain: .71875,
  dB: 12.8
}, {
  gain: .720703125,
  dB: 12.8
}, {
  gain: .72265625,
  dB: 12.9
}, {
  gain: .724609375,
  dB: 13
}, {
  gain: .7265625,
  dB: 13.1
}, {
  gain: .728515625,
  dB: 13.1
}, {
  gain: .73046875,
  dB: 13.2
}, {
  gain: .732421875,
  dB: 13.3
}, {
  gain: .734375,
  dB: 13.4
}, {
  gain: .736328125,
  dB: 13.5
}, {
  gain: .73828125,
  dB: 13.5
}, {
  gain: .740234375,
  dB: 13.6
}, {
  gain: .7421875,
  dB: 13.7
}, {
  gain: .744140625,
  dB: 13.8
}, {
  gain: .74609375,
  dB: 13.8
}, {
  gain: .748046875,
  dB: 13.9
}, {
  gain: .75,
  dB: 14
}, {
  gain: .751953125,
  dB: 14.1
}, {
  gain: .75390625,
  dB: 14.2
}, {
  gain: .755859375,
  dB: 14.2
}, {
  gain: .7578125,
  dB: 14.3
}, {
  gain: .759765625,
  dB: 14.4
}, {
  gain: .76171875,
  dB: 14.5
}, {
  gain: .763671875,
  dB: 14.5
}, {
  gain: .765625,
  dB: 14.6
}, {
  gain: .767578125,
  dB: 14.7
}, {
  gain: .76953125,
  dB: 14.8
}, {
  gain: .771484375,
  dB: 14.9
}, {
  gain: .7734375,
  dB: 14.9
}, {
  gain: .775390625,
  dB: 15
}, {
  gain: .77734375,
  dB: 15.1
}, {
  gain: .779296875,
  dB: 15.2
}, {
  gain: .78125,
  dB: 15.3
}, {
  gain: .783203125,
  dB: 15.3
}, {
  gain: .78515625,
  dB: 15.4
}, {
  gain: .787109375,
  dB: 15.5
}, {
  gain: .7890625,
  dB: 15.6
}, {
  gain: .791015625,
  dB: 15.6
}, {
  gain: .79296875,
  dB: 15.7
}, {
  gain: .794921875,
  dB: 15.8
}, {
  gain: .796875,
  dB: 15.9
}, {
  gain: .798828125,
  dB: 16
}, {
  gain: .80078125,
  dB: 16
}, {
  gain: .802734375,
  dB: 16.1
}, {
  gain: .8046875,
  dB: 16.2
}, {
  gain: .806640625,
  dB: 16.3
}, {
  gain: .80859375,
  dB: 16.3
}, {
  gain: .810546875,
  dB: 16.4
}, {
  gain: .8125,
  dB: 16.5
}, {
  gain: .814453125,
  dB: 16.6
}, {
  gain: .81640625,
  dB: 16.7
}, {
  gain: .818359375,
  dB: 16.7
}, {
  gain: .8203125,
  dB: 16.8
}, {
  gain: .822265625,
  dB: 16.9
}, {
  gain: .82421875,
  dB: 17
}, {
  gain: .826171875,
  dB: 17
}, {
  gain: .828125,
  dB: 17.1
}, {
  gain: .830078125,
  dB: 17.2
}, {
  gain: .83203125,
  dB: 17.3
}, {
  gain: .833984375,
  dB: 17.4
}, {
  gain: .8359375,
  dB: 17.4
}, {
  gain: .837890625,
  dB: 17.5
}, {
  gain: .83984375,
  dB: 17.6
}, {
  gain: .841796875,
  dB: 17.7
}, {
  gain: .84375,
  dB: 17.8
}, {
  gain: .845703125,
  dB: 17.8
}, {
  gain: .84765625,
  dB: 17.9
}, {
  gain: .849609375,
  dB: 18
}, {
  gain: .8515625,
  dB: 18.1
}, {
  gain: .853515625,
  dB: 18.1
}, {
  gain: .85546875,
  dB: 18.2
}, {
  gain: .857421875,
  dB: 18.3
}, {
  gain: .859375,
  dB: 18.4
}, {
  gain: .861328125,
  dB: 18.5
}, {
  gain: .86328125,
  dB: 18.5
}, {
  gain: .865234375,
  dB: 18.6
}, {
  gain: .8671875,
  dB: 18.7
}, {
  gain: .869140625,
  dB: 18.8
}, {
  gain: .87109375,
  dB: 18.8
}, {
  gain: .873046875,
  dB: 18.9
}, {
  gain: .875,
  dB: 19
}, {
  gain: .876953125,
  dB: 19.1
}, {
  gain: .87890625,
  dB: 19.2
}, {
  gain: .880859375,
  dB: 19.2
}, {
  gain: .8828125,
  dB: 19.3
}, {
  gain: .884765625,
  dB: 19.4
}, {
  gain: .88671875,
  dB: 19.5
}, {
  gain: .888671875,
  dB: 19.5
}, {
  gain: .890625,
  dB: 19.6
}, {
  gain: .892578125,
  dB: 19.7
}, {
  gain: .89453125,
  dB: 19.8
}, {
  gain: .896484375,
  dB: 19.9
}, {
  gain: .8984375,
  dB: 19.9
}, {
  gain: .900390625,
  dB: 20
}, {
  gain: .90234375,
  dB: 20.1
}, {
  gain: .904296875,
  dB: 20.2
}, {
  gain: .90625,
  dB: 20.3
}, {
  gain: .908203125,
  dB: 20.3
}, {
  gain: .91015625,
  dB: 20.4
}, {
  gain: .912109375,
  dB: 20.5
}, {
  gain: .9140625,
  dB: 20.6
}, {
  gain: .916015625,
  dB: 20.6
}, {
  gain: .91796875,
  dB: 20.7
}, {
  gain: .919921875,
  dB: 20.8
}, {
  gain: .921875,
  dB: 20.9
}, {
  gain: .923828125,
  dB: 21
}, {
  gain: .92578125,
  dB: 21
}, {
  gain: .927734375,
  dB: 21.1
}, {
  gain: .9296875,
  dB: 21.2
}, {
  gain: .931640625,
  dB: 21.3
}, {
  gain: .93359375,
  dB: 21.3
}, {
  gain: .935546875,
  dB: 21.4
}, {
  gain: .9375,
  dB: 21.5
}, {
  gain: .939453125,
  dB: 21.6
}, {
  gain: .94140625,
  dB: 21.7
}, {
  gain: .943359375,
  dB: 21.7
}, {
  gain: .9453125,
  dB: 21.8
}, {
  gain: .947265625,
  dB: 21.9
}, {
  gain: .94921875,
  dB: 22
}, {
  gain: .951171875,
  dB: 22
}, {
  gain: .953125,
  dB: 22.1
}, {
  gain: .955078125,
  dB: 22.2
}, {
  gain: .95703125,
  dB: 22.3
}, {
  gain: .958984375,
  dB: 22.4
}, {
  gain: .9609375,
  dB: 22.4
}, {
  gain: .962890625,
  dB: 22.5
}, {
  gain: .96484375,
  dB: 22.6
}, {
  gain: .966796875,
  dB: 22.7
}, {
  gain: .96875,
  dB: 22.8
}, {
  gain: .970703125,
  dB: 22.8
}, {
  gain: .97265625,
  dB: 22.9
}, {
  gain: .974609375,
  dB: 23
}, {
  gain: .9765625,
  dB: 23.1
}, {
  gain: .978515625,
  dB: 23.1
}, {
  gain: .98046875,
  dB: 23.2
}, {
  gain: .982421875,
  dB: 23.3
}, {
  gain: .984375,
  dB: 23.4
}, {
  gain: .986328125,
  dB: 23.5
}, {
  gain: .98828125,
  dB: 23.5
}, {
  gain: .990234375,
  dB: 23.6
}, {
  gain: .9921875,
  dB: 23.7
}, {
  gain: .994140625,
  dB: 23.8
}, {
  gain: .99609375,
  dB: 23.8
}, {
  gain: .998046875,
  dB: 23.9
}, {
  gain: 1,
  dB: 24
} ];

function liveGainToDb(gain) {
  if (gain <= 0) {
    return -Infinity;
  }
  if (gain >= 1) {
    return 24;
  }
  let lowerIndex = 0;
  let upperIndex = LOOKUP_TABLE.length - 1;
  while (upperIndex - lowerIndex > 1) {
    const mid = Math.floor((lowerIndex + upperIndex) / 2);
    const midEntry = LOOKUP_TABLE[mid];
    if (midEntry.gain <= gain) {
      lowerIndex = mid;
    } else {
      upperIndex = mid;
    }
  }
  const lower = LOOKUP_TABLE[lowerIndex];
  const upper = LOOKUP_TABLE[upperIndex];
  if (lower.dB === null || lower.dB === -Infinity) {
    if (upper.dB === null || upper.dB === -Infinity) {
      return -Infinity;
    }
    return upper.dB;
  }
  if (upper.dB === null || upper.dB === -Infinity) {
    return lower.dB;
  }
  const t = (gain - lower.gain) / (upper.gain - lower.gain);
  const dB = lower.dB + t * (upper.dB - lower.dB);
  return Number.parseFloat(dB.toFixed(2));
}

function dbToLiveGain(dB) {
  if (dB === -Infinity || dB < -70) {
    return 0;
  }
  if (dB >= 24) {
    return 1;
  }
  let lowerIndex = -1;
  let upperIndex = -1;
  for (let i = 0; i < LOOKUP_TABLE.length; i++) {
    const entry = LOOKUP_TABLE[i];
    if (entry.dB === null || entry.dB === -Infinity) {
      continue;
    }
    if (entry.dB <= dB) {
      lowerIndex = i;
    } else if (upperIndex === -1) {
      upperIndex = i;
      break;
    }
  }
  if (lowerIndex === -1) {
    return 0;
  }
  if (upperIndex === -1) {
    return LOOKUP_TABLE[lowerIndex].gain;
  }
  const lower = LOOKUP_TABLE[lowerIndex];
  const upper = LOOKUP_TABLE[upperIndex];
  const lowerDb = lower.dB;
  const upperDb = upper.dB;
  const t = (dB - lowerDb) / (upperDb - lowerDb);
  const gain = lower.gain + t * (upper.gain - lower.gain);
  return Math.max(0, Math.min(1, gain));
}

const DRUM_PADS = "drum-pads";

const DRUM_MAPS = "drum-maps";

const CLIP_NOTES = "clip-notes";

const CHAINS = "chains";

const RETURN_CHAINS = "return-chains";

const MIDI_EFFECTS = "midi-effects";

const INSTRUMENTS = "instruments";

const AUDIO_EFFECTS = "audio-effects";

const SESSION_CLIPS = "session-clips";

const ARRANGEMENT_CLIPS = "arrangement-clips";

const REGULAR_TRACKS = "regular-tracks";

const RETURN_TRACKS = "return-tracks";

const MASTER_TRACK = "master-track";

const WARP_MARKERS = "warp-markers";

const AVAILABLE_ROUTINGS = "available-routings";

const COLOR = "color";

const CLIPS = "clips";

const MIXER = "mixer";

const LOCATORS = "locators";

const ALL_INCLUDE_OPTIONS = {
  song: [ DRUM_PADS, DRUM_MAPS, CLIP_NOTES, CHAINS, RETURN_CHAINS, "scenes", MIDI_EFFECTS, INSTRUMENTS, AUDIO_EFFECTS, "routings", SESSION_CLIPS, ARRANGEMENT_CLIPS, REGULAR_TRACKS, RETURN_TRACKS, MASTER_TRACK, "all-tracks", "all-devices", "all-clips", COLOR, WARP_MARKERS, MIXER, LOCATORS ],
  track: [ DRUM_PADS, DRUM_MAPS, CLIP_NOTES, CHAINS, RETURN_CHAINS, MIDI_EFFECTS, INSTRUMENTS, AUDIO_EFFECTS, "routings", AVAILABLE_ROUTINGS, SESSION_CLIPS, ARRANGEMENT_CLIPS, "all-devices", "all-routings", "all-clips", COLOR, WARP_MARKERS, MIXER ],
  scene: [ CLIPS, CLIP_NOTES, COLOR, WARP_MARKERS ],
  clip: [ CLIP_NOTES, COLOR, WARP_MARKERS ]
};

const SHORTCUT_MAPPINGS = {
  "all-tracks": [ "regular-tracks", "return-tracks", "master-track" ],
  "all-devices": [ "midi-effects", "instruments", "audio-effects" ],
  "all-routings": [ "routings", "available-routings" ],
  "all-clips": [ "session-clips", "arrangement-clips" ]
};

function parseIncludeArray(includeArray, defaults = {}) {
  if (includeArray === void 0) {
    return {
      includeDrumPads: Boolean(defaults.includeDrumPads),
      includeDrumMaps: Boolean(defaults.includeDrumMaps),
      includeClipNotes: Boolean(defaults.includeClipNotes),
      includeRackChains: Boolean(defaults.includeRackChains),
      includeReturnChains: Boolean(defaults.includeReturnChains),
      includeScenes: Boolean(defaults.includeScenes),
      includeMidiEffects: Boolean(defaults.includeMidiEffects),
      includeInstruments: Boolean(defaults.includeInstruments),
      includeAudioEffects: Boolean(defaults.includeAudioEffects),
      includeRoutings: Boolean(defaults.includeRoutings),
      includeAvailableRoutings: Boolean(defaults.includeAvailableRoutings),
      includeSessionClips: Boolean(defaults.includeSessionClips),
      includeArrangementClips: Boolean(defaults.includeArrangementClips),
      includeClips: Boolean(defaults.includeClips),
      includeRegularTracks: Boolean(defaults.includeRegularTracks),
      includeReturnTracks: Boolean(defaults.includeReturnTracks),
      includeMasterTrack: Boolean(defaults.includeMasterTrack),
      includeColor: Boolean(defaults.includeColor),
      includeWarpMarkers: Boolean(defaults.includeWarpMarkers),
      includeMixer: Boolean(defaults.includeMixer),
      includeLocators: Boolean(defaults.includeLocators)
    };
  }
  const expandedIncludes = expandWildcardIncludes(includeArray, defaults);
  const includeSet = new Set(expandedIncludes);
  const hasScenes = includeSet.has("scenes");
  if (includeArray.length === 0) {
    return {
      includeDrumPads: false,
      includeDrumMaps: false,
      includeClipNotes: false,
      includeRackChains: false,
      includeReturnChains: false,
      includeScenes: false,
      includeMidiEffects: false,
      includeInstruments: false,
      includeAudioEffects: false,
      includeRoutings: false,
      includeAvailableRoutings: false,
      includeSessionClips: false,
      includeArrangementClips: false,
      includeClips: false,
      includeRegularTracks: false,
      includeReturnTracks: false,
      includeMasterTrack: false,
      includeColor: false,
      includeWarpMarkers: false,
      includeMixer: false,
      includeLocators: false
    };
  }
  return {
    includeDrumPads: includeSet.has(DRUM_PADS),
    includeDrumMaps: includeSet.has(DRUM_MAPS),
    includeClipNotes: includeSet.has(CLIP_NOTES),
    includeRackChains: includeSet.has(CHAINS),
    includeReturnChains: includeSet.has(RETURN_CHAINS),
    includeScenes: hasScenes,
    includeMidiEffects: includeSet.has(MIDI_EFFECTS),
    includeInstruments: includeSet.has(INSTRUMENTS),
    includeAudioEffects: includeSet.has(AUDIO_EFFECTS),
    includeRoutings: includeSet.has("routings"),
    includeAvailableRoutings: includeSet.has(AVAILABLE_ROUTINGS),
    includeSessionClips: includeSet.has(SESSION_CLIPS),
    includeArrangementClips: includeSet.has(ARRANGEMENT_CLIPS),
    includeClips: includeSet.has(CLIPS),
    includeRegularTracks: includeSet.has(REGULAR_TRACKS),
    includeReturnTracks: includeSet.has(RETURN_TRACKS),
    includeMasterTrack: includeSet.has(MASTER_TRACK),
    includeColor: includeSet.has(COLOR),
    includeWarpMarkers: includeSet.has(WARP_MARKERS),
    includeMixer: includeSet.has(MIXER),
    includeLocators: includeSet.has(LOCATORS)
  };
}

const FLAG_TO_OPTION = [ [ "includeDrumPads", DRUM_PADS ], [ "includeDrumMaps", DRUM_MAPS ], [ "includeClipNotes", CLIP_NOTES ], [ "includeRackChains", CHAINS ], [ "includeReturnChains", RETURN_CHAINS ], [ "includeScenes", "scenes" ], [ "includeMidiEffects", MIDI_EFFECTS ], [ "includeInstruments", INSTRUMENTS ], [ "includeAudioEffects", AUDIO_EFFECTS ], [ "includeRoutings", "routings" ], [ "includeAvailableRoutings", AVAILABLE_ROUTINGS ], [ "includeSessionClips", SESSION_CLIPS ], [ "includeArrangementClips", ARRANGEMENT_CLIPS ], [ "includeClips", CLIPS ], [ "includeRegularTracks", REGULAR_TRACKS ], [ "includeReturnTracks", RETURN_TRACKS ], [ "includeMasterTrack", MASTER_TRACK ], [ "includeColor", COLOR ], [ "includeWarpMarkers", WARP_MARKERS ], [ "includeMixer", MIXER ], [ "includeLocators", LOCATORS ] ];

function includeArrayFromFlags(includeFlags) {
  const flagsRecord = includeFlags;
  return FLAG_TO_OPTION.filter(([flag]) => flagsRecord[flag]).map(([, option]) => option);
}

const READ_SONG_DEFAULTS = {
  includeDrumPads: false,
  includeDrumMaps: true,
  includeClipNotes: false,
  includeRackChains: false,
  includeReturnChains: false,
  includeScenes: false,
  includeMidiEffects: false,
  includeInstruments: true,
  includeAudioEffects: false,
  includeRoutings: false,
  includeSessionClips: false,
  includeArrangementClips: false,
  includeRegularTracks: true,
  includeReturnTracks: false,
  includeMasterTrack: false,
  includeColor: false,
  includeWarpMarkers: false,
  includeMixer: false,
  includeLocators: false
};

const READ_TRACK_DEFAULTS = {
  includeDrumPads: false,
  includeDrumMaps: true,
  includeClipNotes: true,
  includeRackChains: false,
  includeReturnChains: false,
  includeMidiEffects: false,
  includeInstruments: true,
  includeAudioEffects: false,
  includeRoutings: false,
  includeAvailableRoutings: false,
  includeSessionClips: true,
  includeArrangementClips: true,
  includeColor: false,
  includeWarpMarkers: false,
  includeMixer: false
};

const READ_SCENE_DEFAULTS = {
  includeClips: false,
  includeClipNotes: false,
  includeColor: false,
  includeWarpMarkers: false
};

const READ_CLIP_DEFAULTS = {
  includeClipNotes: true,
  includeColor: false,
  includeWarpMarkers: false
};

function expandWildcardIncludes(includeArray, defaults) {
  const expandedArray = [];
  for (const option of includeArray) {
    if (SHORTCUT_MAPPINGS[option]) {
      expandedArray.push(...SHORTCUT_MAPPINGS[option]);
    } else {
      expandedArray.push(option);
    }
  }
  if (!expandedArray.includes("*")) {
    return expandedArray;
  }
  let toolType;
  if (Object.keys(defaults).length === 1 && defaults.includeClipNotes !== void 0) {
    toolType = "clip";
  } else if (defaults.includeClips !== void 0) {
    toolType = "scene";
  } else if (defaults.includeRegularTracks !== void 0) {
    toolType = "song";
  } else if (defaults.includeSessionClips !== void 0) {
    toolType = "track";
  } else {
    toolType = "song";
  }
  const allOptions = ALL_INCLUDE_OPTIONS[toolType] ?? [];
  const expandedSet = new Set(expandedArray.filter(option => option !== "*"));
  for (const option of allOptions) expandedSet.add(option);
  return Array.from(expandedSet);
}

function resolveClip(clipId, trackIndex, sceneIndex) {
  if (clipId != null) {
    return {
      found: true,
      clip: validateIdType(clipId, "clip", "readClip")
    };
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  if (!track.exists()) {
    throw new Error(`trackIndex ${trackIndex} does not exist`);
  }
  const scene = LiveAPI.from(`live_set scenes ${sceneIndex}`);
  if (!scene.exists()) {
    throw new Error(`sceneIndex ${sceneIndex} does not exist`);
  }
  const clip = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex} clip`);
  if (!clip.exists()) {
    warn(`no clip at trackIndex ${trackIndex}, sceneIndex ${sceneIndex}`);
    return {
      found: false,
      emptySlotResponse: {
        id: null,
        type: null,
        name: null,
        trackIndex: trackIndex,
        sceneIndex: sceneIndex
      }
    };
  }
  return {
    found: true,
    clip: clip
  };
}

const WARP_MODE_MAPPING = {
  [LIVE_API_WARP_MODE_BEATS]: WARP_MODE.BEATS,
  [LIVE_API_WARP_MODE_TONES]: WARP_MODE.TONES,
  [LIVE_API_WARP_MODE_TEXTURE]: WARP_MODE.TEXTURE,
  [LIVE_API_WARP_MODE_REPITCH]: WARP_MODE.REPITCH,
  [LIVE_API_WARP_MODE_COMPLEX]: WARP_MODE.COMPLEX,
  [LIVE_API_WARP_MODE_REX]: WARP_MODE.REX,
  [LIVE_API_WARP_MODE_PRO]: WARP_MODE.PRO
};

function processWarpMarkers(clip) {
  try {
    const warpMarkersJson = clip.getProperty("warp_markers");
    if (!warpMarkersJson || warpMarkersJson === "") {
      return;
    }
    const warpMarkersData = JSON.parse(warpMarkersJson);
    const mapMarker = marker => ({
      sampleTime: marker.sample_time,
      beatTime: marker.beat_time
    });
    if (Array.isArray(warpMarkersData)) {
      return warpMarkersData.map(mapMarker);
    }
    if (warpMarkersData.warp_markers && Array.isArray(warpMarkersData.warp_markers)) {
      return warpMarkersData.warp_markers.map(mapMarker);
    }
  } catch (error) {
    warn(`Failed to read warp markers for clip ${clip.id}: ${errorMessage(error)}`);
  }
}

function readClip(args = {}, _context = {}) {
  const {trackIndex: trackIndex = null, sceneIndex: sceneIndex = null, clipId: clipId = null} = args;
  const {includeClipNotes: includeClipNotes, includeColor: includeColor, includeWarpMarkers: includeWarpMarkers} = parseIncludeArray(args.include, READ_CLIP_DEFAULTS);
  if (clipId === null && (trackIndex === null || sceneIndex === null)) {
    throw new Error("Either clipId or both trackIndex and sceneIndex must be provided");
  }
  const resolved = resolveClip(clipId, trackIndex, sceneIndex);
  if (!resolved.found) {
    return resolved.emptySlotResponse;
  }
  const clip = resolved.clip;
  const isArrangementClip = clip.getProperty("is_arrangement_clip") > 0;
  const timeSigNumerator = clip.getProperty("signature_numerator");
  const timeSigDenominator = clip.getProperty("signature_denominator");
  const isLooping = clip.getProperty("looping") > 0;
  const isMidiClip = clip.getProperty("is_midi_clip") > 0;
  const lengthBeats = clip.getProperty("length");
  const clipName = clip.getProperty("name");
  const startMarkerBeats = clip.getProperty("start_marker");
  const loopStartBeats = clip.getProperty("loop_start");
  const loopEndBeats = clip.getProperty("loop_end");
  const endMarkerBeats = clip.getProperty("end_marker");
  const {startBeats: startBeats, endBeats: endBeats} = getActiveClipBounds(isLooping, isMidiClip, startMarkerBeats, loopStartBeats, endMarkerBeats, loopEndBeats, lengthBeats);
  const start = abletonBeatsToBarBeat(startBeats, timeSigNumerator, timeSigDenominator);
  const end = abletonBeatsToBarBeat(endBeats, timeSigNumerator, timeSigDenominator);
  const length = abletonBeatsToBarBeatDuration(endBeats - startBeats, timeSigNumerator, timeSigDenominator);
  const firstStart = Math.abs(startMarkerBeats - startBeats) > .001 ? abletonBeatsToBarBeat(startMarkerBeats, timeSigNumerator, timeSigDenominator) : null;
  const result = {
    id: clip.id,
    type: isMidiClip ? "midi" : "audio",
    ...clipName && {
      name: clipName
    },
    view: isArrangementClip ? "arrangement" : "session",
    ...includeColor && {
      color: clip.getColor()
    },
    timeSignature: clip.timeSignature,
    looping: isLooping,
    start: start,
    end: end,
    length: length,
    ...firstStart != null && {
      firstStart: firstStart
    }
  };
  addBooleanStateProperties(result, clip);
  addClipLocationProperties(result, clip, isArrangementClip);
  if (result.type === "midi") {
    processMidiClip(result, clip, includeClipNotes, lengthBeats, timeSigNumerator, timeSigDenominator);
  }
  if (result.type === "audio") {
    processAudioClip(result, clip, includeWarpMarkers);
  }
  return result;
}

function addBooleanStateProperties(result, clip) {
  if (clip.getProperty("is_playing") > 0) {
    result.playing = true;
  }
  if (clip.getProperty("is_triggered") > 0) {
    result.triggered = true;
  }
  if (clip.getProperty("is_recording") > 0) {
    result.recording = true;
  }
  if (clip.getProperty("is_overdubbing") > 0) {
    result.overdubbing = true;
  }
  if (clip.getProperty("muted") > 0) {
    result.muted = true;
  }
}

function processMidiClip(result, clip, includeClipNotes, lengthBeats, timeSigNumerator, timeSigDenominator) {
  const notesDictionary = clip.call("get_notes_extended", 0, 128, 0, lengthBeats);
  const notes = JSON.parse(notesDictionary).notes;
  result.noteCount = notes.length;
  if (includeClipNotes) {
    result.notes = formatNotation(notes, {
      timeSigNumerator: timeSigNumerator,
      timeSigDenominator: timeSigDenominator
    });
  }
}

function processAudioClip(result, clip, includeWarpMarkers) {
  const liveGain = clip.getProperty("gain");
  result.gainDb = liveGainToDb(liveGain);
  const filePath = clip.getProperty("file_path");
  if (filePath) {
    result.sampleFile = filePath;
  }
  const pitchCoarse = clip.getProperty("pitch_coarse");
  const pitchFine = clip.getProperty("pitch_fine");
  result.pitchShift = pitchCoarse + pitchFine / 100;
  result.sampleLength = clip.getProperty("sample_length");
  result.sampleRate = clip.getProperty("sample_rate");
  result.warping = clip.getProperty("warping") > 0;
  const warpModeValue = clip.getProperty("warp_mode");
  result.warpMode = WARP_MODE_MAPPING[warpModeValue] ?? "unknown";
  if (includeWarpMarkers) {
    const warpMarkers = processWarpMarkers(clip);
    if (warpMarkers !== void 0) {
      result.warpMarkers = warpMarkers;
    }
  }
}

function addClipLocationProperties(result, clip, isArrangementClip) {
  if (isArrangementClip) {
    const liveSet = LiveAPI.from("live_set");
    const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
    const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
    result.trackIndex = clip.trackIndex;
    const startTimeBeats = clip.getProperty("start_time");
    const endTimeBeats = clip.getProperty("end_time");
    result.arrangementStart = abletonBeatsToBarBeat(startTimeBeats, songTimeSigNumerator, songTimeSigDenominator);
    result.arrangementLength = abletonBeatsToBarBeatDuration(endTimeBeats - startTimeBeats, songTimeSigNumerator, songTimeSigDenominator);
  } else {
    result.trackIndex = clip.trackIndex;
    result.sceneIndex = clip.sceneIndex;
  }
}

function getActiveClipBounds(isLooping, isMidiClip, startMarkerBeats, loopStartBeats, endMarkerBeats, loopEndBeats, lengthBeats) {
  const startBeats = isLooping ? loopStartBeats : startMarkerBeats;
  const endBeats = isLooping ? loopEndBeats : endMarkerBeats;
  if (!isLooping && isMidiClip) {
    const derivedStart = endBeats - lengthBeats;
    if (Math.abs(derivedStart - startBeats) > .001) {
      warn(`Derived start (${derivedStart}) differs from start_marker (${startBeats})`);
    }
  }
  return {
    startBeats: startBeats,
    endBeats: endBeats
  };
}

function verifyColorQuantization(object, requestedColor) {
  try {
    const actualColor = object.getColor();
    if (actualColor?.toUpperCase() !== requestedColor.toUpperCase()) {
      const objectType = object.type;
      warn(`Requested ${objectType.toLowerCase()} color ${requestedColor} was mapped to nearest palette color ${actualColor}. Live uses a fixed color palette.`);
    }
  } catch (error) {
    warn(`Could not verify color quantization: ${errorMessage(error)}`);
  }
}

function createAudioClipInSession(track, targetLength, audioFilePath) {
  const liveSet = LiveAPI.from("live_set");
  let sceneIds = liveSet.getChildIds("scenes");
  const lastSceneId = assertDefined(sceneIds.at(-1), "last scene ID");
  const lastScene = LiveAPI.from(lastSceneId);
  const isEmpty = lastScene.getProperty("is_empty") === 1;
  let workingSceneId = lastSceneId;
  if (!isEmpty) {
    const newSceneResult = liveSet.call("create_scene", sceneIds.length);
    workingSceneId = Array.isArray(newSceneResult) ? newSceneResult.join(" ") : newSceneResult;
    sceneIds = liveSet.getChildIds("scenes");
  }
  const trackIndex = track.trackIndex;
  const sceneIndex = sceneIds.indexOf(workingSceneId);
  const slot = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
  slot.call("create_audio_clip", audioFilePath);
  const clip = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex} clip`);
  clip.set("warping", 1);
  clip.set("looping", 1);
  clip.set("loop_end", targetLength);
  return {
    clip: clip,
    slot: slot
  };
}

function createShortenedClipInHolding(sourceClip, track, targetLength, holdingAreaStart, isMidiClip, context) {
  const sourceClipId = sourceClip.id;
  const holdingResult = track.call("duplicate_clip_to_arrangement", `id ${sourceClipId}`, holdingAreaStart);
  const holdingClip = LiveAPI.from(holdingResult);
  const holdingClipEnd = holdingClip.getProperty("end_time");
  const newHoldingEnd = holdingAreaStart + targetLength;
  const tempLength = holdingClipEnd - newHoldingEnd;
  const EPSILON = .001;
  if (tempLength > EPSILON) {
    if (isMidiClip) {
      const tempResult = track.call("create_midi_clip", newHoldingEnd, tempLength);
      const tempClip = LiveAPI.from(tempResult);
      track.call("delete_clip", `id ${tempClip.id}`);
    } else {
      const {clip: sessionClip, slot: slot} = createAudioClipInSession(track, tempLength, context.silenceWavPath);
      const tempResult = track.call("duplicate_clip_to_arrangement", `id ${sessionClip.id}`, newHoldingEnd);
      const tempClip = LiveAPI.from(tempResult);
      slot.call("delete_clip");
      track.call("delete_clip", `id ${tempClip.id}`);
    }
  }
  return {
    holdingClipId: holdingClip.id,
    holdingClip: holdingClip
  };
}

function moveClipFromHolding(holdingClipId, track, targetPosition) {
  const finalResult = track.call("duplicate_clip_to_arrangement", `id ${holdingClipId}`, targetPosition);
  const movedClip = LiveAPI.from(finalResult);
  track.call("delete_clip", `id ${holdingClipId}`);
  return movedClip;
}

function adjustClipPreRoll(clip, track, isMidiClip, context) {
  const startMarker = clip.getProperty("start_marker");
  const loopStart = clip.getProperty("loop_start");
  if (startMarker < loopStart) {
    clip.set("start_marker", loopStart);
    const preRollLength = loopStart - startMarker;
    const clipEnd = clip.getProperty("end_time");
    const newClipEnd = clipEnd - preRollLength;
    const tempClipLength = clipEnd - newClipEnd;
    if (isMidiClip) {
      const tempClipPath = track.call("create_midi_clip", newClipEnd, tempClipLength);
      const tempClip = LiveAPI.from(tempClipPath);
      track.call("delete_clip", `id ${tempClip.id}`);
    } else {
      const {clip: sessionClip, slot: slot} = createAudioClipInSession(track, tempClipLength, context.silenceWavPath);
      const tempResult = track.call("duplicate_clip_to_arrangement", `id ${sessionClip.id}`, newClipEnd);
      const tempClip = LiveAPI.from(tempResult);
      slot.call("delete_clip");
      track.call("delete_clip", `id ${tempClip.id}`);
    }
  }
}

function createPartialTile(sourceClip, track, targetPosition, partialLength, holdingAreaStart, isMidiClip, context, adjustPreRoll = true, contentOffset = 0) {
  const {holdingClipId: holdingClipId} = createShortenedClipInHolding(sourceClip, track, partialLength, holdingAreaStart, isMidiClip, context);
  const partialTile = moveClipFromHolding(holdingClipId, track, targetPosition);
  const clipLoopStart = sourceClip.getProperty("loop_start");
  const clipLoopEnd = sourceClip.getProperty("loop_end");
  const clipLength = clipLoopEnd - clipLoopStart;
  const tileStartMarker = clipLoopStart + contentOffset % clipLength;
  partialTile.set("start_marker", tileStartMarker);
  if (adjustPreRoll) {
    adjustClipPreRoll(partialTile, track, isMidiClip, context);
  }
  return partialTile;
}

function tileClipToRange(sourceClip, track, startPosition, totalLength, holdingAreaStart, context, {adjustPreRoll: adjustPreRoll = true, startOffset: startOffset = 0, tileLength: tileLength = null} = {}) {
  const createdClips = [];
  const sourceClipId = sourceClip.id;
  const trackIndex = sourceClip.trackIndex;
  const isMidiClip = sourceClip.getProperty("is_midi_clip") === 1;
  const clipLoopStart = sourceClip.getProperty("loop_start");
  const clipLoopEnd = sourceClip.getProperty("loop_end");
  const clipLength = clipLoopEnd - clipLoopStart;
  const currentEndMarker = sourceClip.getProperty("end_marker");
  if (currentEndMarker !== clipLoopEnd) {
    sourceClip.set("end_marker", clipLoopEnd);
  }
  const arrangementTileLength = tileLength ?? clipLength;
  const fullTiles = Math.floor(totalLength / arrangementTileLength);
  const remainder = totalLength % arrangementTileLength;
  let currentContentOffset = startOffset;
  let currentPosition = startPosition;
  for (let i = 0; i < fullTiles; i++) {
    const freshTrack = LiveAPI.from(`live_set tracks ${trackIndex}`);
    const result = freshTrack.call("duplicate_clip_to_arrangement", `id ${sourceClipId}`, currentPosition);
    const tileClip = LiveAPI.from(result);
    const clipId = tileClip.id;
    const freshClip = LiveAPI.from(`id ${clipId}`);
    let tileStartMarker = clipLoopStart + currentContentOffset % clipLength;
    if (tileStartMarker >= clipLoopEnd) {
      tileStartMarker = clipLoopStart;
    }
    freshClip.set("start_marker", tileStartMarker);
    if (adjustPreRoll) {
      adjustClipPreRoll(freshClip, freshTrack, isMidiClip, context);
    }
    createdClips.push({
      id: clipId
    });
    currentPosition += arrangementTileLength;
    currentContentOffset += arrangementTileLength;
  }
  if (remainder > .001) {
    const partialTile = createPartialTile(sourceClip, track, currentPosition, remainder, holdingAreaStart, isMidiClip, context, adjustPreRoll, currentContentOffset);
    createdClips.push({
      id: partialTile.id
    });
  }
  return createdClips;
}

function setClipMarkersWithLoopingWorkaround(clip, {loopStart: loopStart, loopEnd: loopEnd, startMarker: startMarker, endMarker: endMarker}) {
  clip.set("looping", 1);
  if (loopEnd != null) {
    clip.set("loop_end", loopEnd);
  }
  if (loopStart != null) {
    clip.set("loop_start", loopStart);
  }
  clip.set("end_marker", endMarker);
  clip.set("start_marker", startMarker);
  clip.set("looping", 0);
}

function revealUnwarpedAudioContent(sourceClip, track, newStartMarker, newEndMarker, targetPosition, _context) {
  const filePath = sourceClip.getProperty("file_path");
  warn(`Extending unwarped audio clip requires recreating the extended portion due to Live API limitations. Envelopes will be lost in the revealed section.`);
  const {clip: tempClip, slot: tempSlot} = createAudioClipInSession(track, newEndMarker, filePath);
  tempClip.set("loop_end", newEndMarker);
  tempClip.set("loop_start", newStartMarker);
  tempClip.set("end_marker", newEndMarker);
  tempClip.set("start_marker", newStartMarker);
  const result = track.call("duplicate_clip_to_arrangement", `id ${tempClip.id}`, targetPosition);
  const revealedClip = LiveAPI.from(result);
  revealedClip.set("warping", 0);
  revealedClip.set("looping", 0);
  const revealedClipEndTime = revealedClip.getProperty("end_time");
  const targetLengthBeats = newEndMarker - newStartMarker;
  const expectedEndTime = targetPosition + targetLengthBeats;
  const EPSILON = .001;
  if (revealedClipEndTime > expectedEndTime + EPSILON) {
    const {clip: tempShortenerClip, slot: tempShortenerSlot} = createAudioClipInSession(track, targetLengthBeats, sourceClip.getProperty("file_path"));
    const tempShortenerResult = track.call("duplicate_clip_to_arrangement", `id ${tempShortenerClip.id}`, revealedClipEndTime);
    const tempShortener = LiveAPI.from(tempShortenerResult);
    tempShortenerSlot.call("delete_clip");
    track.call("delete_clip", `id ${tempShortener.id}`);
  }
  tempSlot.call("delete_clip");
  return revealedClip;
}

function revealAudioContentAtPosition(sourceClip, track, newStartMarker, newEndMarker, targetPosition, _context) {
  const isWarped = sourceClip.getProperty("warping") === 1;
  if (isWarped) {
    const duplicateResult = track.call("duplicate_clip_to_arrangement", sourceClip.id, targetPosition);
    const revealedClip = LiveAPI.from(duplicateResult);
    if (!revealedClip.exists()) {
      throw new Error(`Failed to duplicate clip ${sourceClip.id} for audio content reveal`);
    }
    setClipMarkersWithLoopingWorkaround(revealedClip, {
      loopStart: newStartMarker,
      loopEnd: newEndMarker,
      startMarker: newStartMarker,
      endMarker: newEndMarker
    });
    return revealedClip;
  }
  return revealUnwarpedAudioContent(sourceClip, track, newStartMarker, newEndMarker, targetPosition);
}

function setAudioParameters(clip, {gainDb: gainDb, pitchShift: pitchShift, warpMode: warpMode, warping: warping}) {
  if (gainDb !== void 0) {
    const liveGain = dbToLiveGain(gainDb);
    clip.set("gain", liveGain);
  }
  if (pitchShift !== void 0) {
    const pitchCoarse = Math.floor(pitchShift);
    const pitchFine = Math.round((pitchShift - pitchCoarse) * 100);
    clip.set("pitch_coarse", pitchCoarse);
    clip.set("pitch_fine", pitchFine);
  }
  if (warpMode !== void 0) {
    const warpModeValue = {
      [WARP_MODE.BEATS]: LIVE_API_WARP_MODE_BEATS,
      [WARP_MODE.TONES]: LIVE_API_WARP_MODE_TONES,
      [WARP_MODE.TEXTURE]: LIVE_API_WARP_MODE_TEXTURE,
      [WARP_MODE.REPITCH]: LIVE_API_WARP_MODE_REPITCH,
      [WARP_MODE.COMPLEX]: LIVE_API_WARP_MODE_COMPLEX,
      [WARP_MODE.REX]: LIVE_API_WARP_MODE_REX,
      [WARP_MODE.PRO]: LIVE_API_WARP_MODE_PRO
    };
    if (warpModeValue[warpMode] !== void 0) {
      clip.set("warp_mode", warpModeValue[warpMode]);
    }
  }
  if (warping !== void 0) {
    clip.set("warping", warping ? 1 : 0);
  }
}

function handleWarpMarkerOperation(clip, warpOp, warpBeatTime, warpSampleTime, warpDistance) {
  const hasAudioFile = clip.getProperty("file_path") != null;
  if (!hasAudioFile) {
    warn(`warp markers only available on audio clips (clip ${clip.id} is MIDI or empty)`);
    return;
  }
  if (warpBeatTime == null) {
    warn(`warpBeatTime required for ${warpOp} operation`);
    return;
  }
  switch (warpOp) {
   case "add":
    {
      const args = warpSampleTime != null ? {
        beat_time: warpBeatTime,
        sample_time: warpSampleTime
      } : {
        beat_time: warpBeatTime
      };
      clip.call("add_warp_marker", args);
      break;
    }

   case "move":
    {
      if (warpDistance == null) {
        warn("warpDistance required for move operation");
        return;
      }
      clip.call("move_warp_marker", warpBeatTime, warpDistance);
      break;
    }

   case "remove":
    {
      clip.call("remove_warp_marker", warpBeatTime);
      break;
    }
  }
}

const EPSILON = .001;

function handleUnloopedLengthening({clip: clip, isAudioClip: isAudioClip, arrangementLengthBeats: arrangementLengthBeats, currentArrangementLength: currentArrangementLength, currentEndTime: currentEndTime, clipStartMarker: clipStartMarker, track: track, context: context}) {
  const updatedClips = [];
  if (!isAudioClip) {
    const tileSize = currentArrangementLength;
    const targetEndMarker2 = clipStartMarker + arrangementLengthBeats;
    clip.set("end_marker", targetEndMarker2);
    updatedClips.push({
      id: clip.id
    });
    let currentPosition = currentEndTime;
    let currentContentOffset = clipStartMarker + currentArrangementLength;
    const holdingAreaStart = context.holdingAreaStartBeats;
    while (currentPosition < currentEndTime + (arrangementLengthBeats - currentArrangementLength) - EPSILON) {
      const remainingSpace = currentEndTime + (arrangementLengthBeats - currentArrangementLength) - currentPosition;
      const tileLengthNeeded = Math.min(tileSize, remainingSpace);
      const isPartialTile = tileSize - tileLengthNeeded > EPSILON;
      const tileStartMarker = currentContentOffset;
      const tileEndMarker = tileStartMarker + tileLengthNeeded;
      let tileClip;
      if (isPartialTile) {
        const {holdingClipId: holdingClipId} = createShortenedClipInHolding(clip, track, tileLengthNeeded, holdingAreaStart, true, context);
        tileClip = moveClipFromHolding(holdingClipId, track, currentPosition);
      } else {
        const duplicateResult = track.call("duplicate_clip_to_arrangement", `id ${clip.id}`, currentPosition);
        tileClip = LiveAPI.from(duplicateResult);
      }
      setClipMarkersWithLoopingWorkaround(tileClip, {
        loopStart: tileStartMarker,
        loopEnd: tileEndMarker,
        startMarker: tileStartMarker,
        endMarker: tileEndMarker
      });
      updatedClips.push({
        id: tileClip.id
      });
      currentPosition += tileLengthNeeded;
      currentContentOffset += tileLengthNeeded;
    }
    return updatedClips;
  }
  const isWarped = clip.getProperty("warping") === 1;
  let clipStartMarkerBeats;
  if (isWarped) {
    clipStartMarkerBeats = clipStartMarker;
  } else {
    const liveSet = LiveAPI.from("live_set");
    const tempo = liveSet.getProperty("tempo");
    clipStartMarkerBeats = clipStartMarker * (tempo / 60);
  }
  const visibleContentEnd = clipStartMarkerBeats + currentArrangementLength;
  const targetEndMarker = clipStartMarkerBeats + arrangementLengthBeats;
  const remainingToReveal = arrangementLengthBeats - currentArrangementLength;
  const newStartMarker = visibleContentEnd;
  const newEndMarker = newStartMarker + remainingToReveal;
  if (isWarped) {
    clip.set("end_marker", targetEndMarker);
  }
  const revealedClip = revealAudioContentAtPosition(clip, track, newStartMarker, newEndMarker, currentEndTime);
  updatedClips.push({
    id: clip.id
  });
  updatedClips.push({
    id: revealedClip.id
  });
  return updatedClips;
}

function tileWithContext(clip, track, position, length, ctx, options) {
  return tileClipToRange(clip, track, position, length, ctx.holdingAreaStartBeats, ctx, options);
}

function handleArrangementLengthening({clip: clip, isAudioClip: isAudioClip, arrangementLengthBeats: arrangementLengthBeats, currentArrangementLength: currentArrangementLength, currentStartTime: currentStartTime, currentEndTime: currentEndTime, context: context}) {
  const updatedClips = [];
  const isLooping = clip.getProperty("looping") > 0;
  const clipLoopStart = clip.getProperty("loop_start");
  const clipLoopEnd = clip.getProperty("loop_end");
  const clipStartMarker = clip.getProperty("start_marker");
  const clipEndMarker = clip.getProperty("end_marker");
  const clipLength = isLooping ? clipLoopEnd - clipLoopStart : clipEndMarker - clipStartMarker;
  const trackIndex = clip.trackIndex;
  if (trackIndex == null) {
    throw new Error(`updateClip failed: could not determine trackIndex for clip ${clip.id}`);
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  if (!isLooping) {
    return handleUnloopedLengthening({
      clip: clip,
      isAudioClip: isAudioClip,
      arrangementLengthBeats: arrangementLengthBeats,
      currentArrangementLength: currentArrangementLength,
      currentEndTime: currentEndTime,
      clipStartMarker: clipStartMarker,
      track: track,
      context: context
    });
  }
  if (arrangementLengthBeats < clipLength) {
    const currentOffset = clipStartMarker - clipLoopStart;
    const remainingLength = arrangementLengthBeats - currentArrangementLength;
    const tiledClips = tileWithContext(clip, track, currentEndTime, remainingLength, context, {
      adjustPreRoll: false,
      startOffset: currentOffset + currentArrangementLength,
      tileLength: currentArrangementLength
    });
    updatedClips.push({
      id: clip.id
    });
    updatedClips.push(...tiledClips);
  } else {
    const currentOffset = clipStartMarker - clipLoopStart;
    const totalContentLength = clipLoopEnd - clipStartMarker;
    const tiledClips = createLoopeClipTiles({
      clip: clip,
      isAudioClip: isAudioClip,
      arrangementLengthBeats: arrangementLengthBeats,
      currentArrangementLength: currentArrangementLength,
      currentStartTime: currentStartTime,
      currentEndTime: currentEndTime,
      totalContentLength: totalContentLength,
      currentOffset: currentOffset,
      track: track,
      context: context
    });
    updatedClips.push({
      id: clip.id
    });
    updatedClips.push(...tiledClips);
  }
  return updatedClips;
}

function createLoopeClipTiles({clip: clip, isAudioClip: isAudioClip, arrangementLengthBeats: arrangementLengthBeats, currentArrangementLength: currentArrangementLength, currentStartTime: currentStartTime, currentEndTime: currentEndTime, totalContentLength: totalContentLength, currentOffset: currentOffset, track: track, context: context}) {
  const updatedClips = [];
  if (currentArrangementLength < totalContentLength) {
    const remainingLength = arrangementLengthBeats - currentArrangementLength;
    const tiledClips2 = tileWithContext(clip, track, currentEndTime, remainingLength, context, {
      adjustPreRoll: true,
      startOffset: currentOffset + currentArrangementLength,
      tileLength: currentArrangementLength
    });
    updatedClips.push(...tiledClips2);
    return updatedClips;
  }
  if (currentArrangementLength > totalContentLength) {
    let newEndTime = currentStartTime + totalContentLength;
    const tempClipLength = currentEndTime - newEndTime;
    if (newEndTime + tempClipLength !== currentEndTime) {
      throw new Error(`Shortening validation failed: calculation error in temp clip bounds`);
    }
    truncateWithTempClip({
      track: track,
      isAudioClip: isAudioClip,
      position: newEndTime,
      length: tempClipLength,
      silenceWavPath: context.silenceWavPath
    });
    newEndTime = currentStartTime + totalContentLength;
    const firstTileLength2 = newEndTime - currentStartTime;
    const remainingSpace2 = arrangementLengthBeats - firstTileLength2;
    const tiledClips2 = tileWithContext(clip, track, newEndTime, remainingSpace2, context, {
      adjustPreRoll: true,
      tileLength: firstTileLength2
    });
    updatedClips.push(...tiledClips2);
    return updatedClips;
  }
  const firstTileLength = currentEndTime - currentStartTime;
  const remainingSpace = arrangementLengthBeats - firstTileLength;
  const tiledClips = tileWithContext(clip, track, currentEndTime, remainingSpace, context, {
    adjustPreRoll: true,
    tileLength: firstTileLength
  });
  updatedClips.push(...tiledClips);
  return updatedClips;
}

function handleArrangementShortening({clip: clip, isAudioClip: isAudioClip, arrangementLengthBeats: arrangementLengthBeats, currentStartTime: currentStartTime, currentEndTime: currentEndTime, context: context}) {
  const newEndTime = currentStartTime + arrangementLengthBeats;
  const tempClipLength = currentEndTime - newEndTime;
  if (newEndTime + tempClipLength !== currentEndTime) {
    throw new Error(`Internal error: temp clip boundary calculation failed for clip ${clip.id}`);
  }
  const trackIndex = clip.trackIndex;
  if (trackIndex == null) {
    throw new Error(`updateClip failed: could not determine trackIndex for clip ${clip.id}`);
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  truncateWithTempClip({
    track: track,
    isAudioClip: isAudioClip,
    position: newEndTime,
    length: tempClipLength,
    silenceWavPath: context.silenceWavPath,
    setupAudioClip: tempClip => {
      tempClip.set("warping", 1);
      tempClip.set("looping", 1);
      tempClip.set("loop_end", tempClipLength);
    }
  });
}

function truncateWithTempClip({track: track, isAudioClip: isAudioClip, position: position, length: length, silenceWavPath: silenceWavPath, setupAudioClip: setupAudioClip = null}) {
  if (isAudioClip) {
    const {clip: sessionClip, slot: slot} = createAudioClipInSession(track, length, silenceWavPath);
    const tempResult = track.call("duplicate_clip_to_arrangement", `id ${sessionClip.id}`, position);
    const tempClip = LiveAPI.from(tempResult);
    if (setupAudioClip) {
      setupAudioClip(tempClip);
    }
    slot.call("delete_clip");
    track.call("delete_clip", `id ${tempClip.id}`);
  } else {
    const tempClipResult = track.call("create_midi_clip", position, length);
    const tempClip = LiveAPI.from(tempClipResult);
    track.call("delete_clip", `id ${tempClip.id}`);
  }
}

function handleArrangementLengthOperation({clip: clip, isAudioClip: isAudioClip, arrangementLengthBeats: arrangementLengthBeats, context: context}) {
  const updatedClips = [];
  const isArrangementClip = clip.getProperty("is_arrangement_clip") > 0;
  if (!isArrangementClip) {
    warn(`arrangementLength parameter ignored for session clip (id ${clip.id})`);
    return updatedClips;
  }
  const currentStartTime = clip.getProperty("start_time");
  const currentEndTime = clip.getProperty("end_time");
  const currentArrangementLength = currentEndTime - currentStartTime;
  if (arrangementLengthBeats > currentArrangementLength) {
    const result = handleArrangementLengthening({
      clip: clip,
      isAudioClip: isAudioClip,
      arrangementLengthBeats: arrangementLengthBeats,
      currentArrangementLength: currentArrangementLength,
      currentStartTime: currentStartTime,
      currentEndTime: currentEndTime,
      context: context
    });
    updatedClips.push(...result);
  } else if (arrangementLengthBeats < currentArrangementLength) {
    handleArrangementShortening({
      clip: clip,
      isAudioClip: isAudioClip,
      arrangementLengthBeats: arrangementLengthBeats,
      currentStartTime: currentStartTime,
      currentEndTime: currentEndTime,
      context: context
    });
  }
  return updatedClips;
}

function handleArrangementStartOperation({clip: clip, arrangementStartBeats: arrangementStartBeats, tracksWithMovedClips: tracksWithMovedClips}) {
  const isArrangementClip = clip.getProperty("is_arrangement_clip") > 0;
  if (!isArrangementClip) {
    warn(`arrangementStart parameter ignored for session clip (id ${clip.id})`);
    return clip.id;
  }
  const trackIndex = clip.trackIndex;
  if (trackIndex == null) {
    warn(`could not determine trackIndex for clip ${clip.id}`);
    return clip.id;
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  const moveCount = (tracksWithMovedClips.get(trackIndex) ?? 0) + 1;
  tracksWithMovedClips.set(trackIndex, moveCount);
  const formattedClipId = clip.id.startsWith("id ") ? clip.id : `id ${clip.id}`;
  const newClipResult = track.call("duplicate_clip_to_arrangement", formattedClipId, arrangementStartBeats);
  const newClip = LiveAPI.from(newClipResult);
  if (!newClip.exists()) {
    warn(`failed to duplicate clip ${clip.id} - original preserved`);
    return clip.id;
  }
  track.call("delete_clip", formattedClipId);
  return newClip.id;
}

function handleArrangementOperations({clip: clip, isAudioClip: isAudioClip, arrangementStartBeats: arrangementStartBeats, arrangementLengthBeats: arrangementLengthBeats, tracksWithMovedClips: tracksWithMovedClips, context: context, updatedClips: updatedClips, finalNoteCount: finalNoteCount}) {
  let finalClipId = clip.id;
  let currentClip = clip;
  if (arrangementStartBeats != null) {
    finalClipId = handleArrangementStartOperation({
      clip: clip,
      arrangementStartBeats: arrangementStartBeats,
      tracksWithMovedClips: tracksWithMovedClips
    });
    currentClip = LiveAPI.from(finalClipId);
  }
  let hasArrangementLengthResults = false;
  if (arrangementLengthBeats != null) {
    const results = handleArrangementLengthOperation({
      clip: currentClip,
      isAudioClip: isAudioClip,
      arrangementLengthBeats: arrangementLengthBeats,
      context: context
    });
    if (results.length > 0) {
      updatedClips.push(...results);
      hasArrangementLengthResults = true;
    }
  }
  if (!hasArrangementLengthResults) {
    updatedClips.push(buildClipResultObject(finalClipId, finalNoteCount));
  }
}

const QUANTIZE_GRID = {
  "1/4": 1,
  "1/8": 2,
  "1/8T": 3,
  "1/8+1/8T": 4,
  "1/16": 5,
  "1/16T": 6,
  "1/16+1/16T": 7,
  "1/32": 8
};

function handleQuantization(clip, {quantize: quantize, quantizeGrid: quantizeGrid, quantizeSwing: quantizeSwing, quantizePitch: quantizePitch}) {
  if (quantize == null) {
    return;
  }
  if (clip.getProperty("is_midi_clip") <= 0) {
    warn(`quantize parameter ignored for audio clip (id ${clip.id})`);
    return;
  }
  if (quantizeGrid == null) {
    warn("quantize parameter ignored - quantizeGrid is required");
    return;
  }
  const gridValue = QUANTIZE_GRID[quantizeGrid];
  const swingToUse = quantizeSwing ?? 0;
  const liveSet = LiveAPI.from("live_set");
  const originalSwing = liveSet.getProperty("swing_amount");
  liveSet.set("swing_amount", swingToUse);
  try {
    if (quantizePitch != null) {
      const midiPitch = noteNameToMidi(quantizePitch);
      if (midiPitch == null) {
        warn(`invalid note name "${quantizePitch}" for quantizePitch, ignoring`);
        return;
      }
      clip.call("quantize_pitch", midiPitch, gridValue, quantize);
    } else {
      clip.call("quantize", gridValue, quantize);
    }
  } finally {
    liveSet.set("swing_amount", originalSwing);
  }
}

function determineStartMarker(firstStartBeats, startBeats, endMarker) {
  if (firstStartBeats != null) {
    if (firstStartBeats < endMarker) {
      return firstStartBeats;
    }
    warn(`firstStart parameter ignored - exceeds clip content boundary (${firstStartBeats} >= ${endMarker})`);
    return null;
  }
  if (startBeats != null && startBeats < endMarker) {
    return startBeats;
  }
  return null;
}

function calculateBeatPositions({start: start, length: length, firstStart: firstStart, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator, clip: clip, isLooping: isLooping}) {
  let startBeats = null;
  let endBeats = null;
  let firstStartBeats = null;
  if (start != null) {
    startBeats = barBeatToAbletonBeats(start, timeSigNumerator, timeSigDenominator);
  }
  if (length != null) {
    const lengthBeats = barBeatDurationToAbletonBeats(length, timeSigNumerator, timeSigDenominator);
    if (startBeats == null) {
      if (isLooping) {
        startBeats = clip.getProperty("loop_start");
      } else {
        const currentEndMarker = clip.getProperty("end_marker");
        const currentStartMarker = clip.getProperty("start_marker");
        const isMidiClip = clip.getProperty("is_midi_clip") > 0;
        startBeats = currentEndMarker - lengthBeats;
        if (isMidiClip && Math.abs(startBeats - currentStartMarker) > .001) {
          warn(`Derived start (${startBeats}) differs from current start_marker (${currentStartMarker})`);
        }
      }
    }
    endBeats = startBeats + lengthBeats;
  }
  if (firstStart != null && isLooping) {
    firstStartBeats = barBeatToAbletonBeats(firstStart, timeSigNumerator, timeSigDenominator);
  }
  const endMarker = clip.getProperty("end_marker");
  const startMarkerBeats = determineStartMarker(firstStartBeats, startBeats, endMarker);
  return {
    startBeats: startBeats,
    endBeats: endBeats,
    firstStartBeats: firstStartBeats,
    startMarkerBeats: startMarkerBeats
  };
}

function getTimeSignature(timeSignature, clip) {
  if (timeSignature != null) {
    const parsed = parseTimeSignature(timeSignature);
    return {
      timeSigNumerator: parsed.numerator,
      timeSigDenominator: parsed.denominator
    };
  }
  return {
    timeSigNumerator: clip.getProperty("signature_numerator"),
    timeSigDenominator: clip.getProperty("signature_denominator")
  };
}

function addLoopProperties(propsToSet, setEndFirst, startBeats, endBeats, startMarkerBeats, looping) {
  if (setEndFirst && endBeats != null && looping !== false) {
    propsToSet.loop_end = endBeats;
  }
  if (startBeats != null && looping !== false) {
    propsToSet.loop_start = startBeats;
  }
  if (startMarkerBeats != null) {
    propsToSet.start_marker = startMarkerBeats;
  }
  if (!setEndFirst && endBeats != null && looping !== false) {
    propsToSet.loop_end = endBeats;
  }
}

function buildClipPropertiesToSet({name: name, color: color, timeSignature: timeSignature, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator, startMarkerBeats: startMarkerBeats, looping: looping, isLooping: isLooping, startBeats: startBeats, endBeats: endBeats, currentLoopEnd: currentLoopEnd}) {
  const setEndFirst = isLooping && startBeats != null && endBeats != null && currentLoopEnd != null ? startBeats >= currentLoopEnd : false;
  const propsToSet = {
    name: name,
    color: color,
    signature_numerator: timeSignature != null ? timeSigNumerator : null,
    signature_denominator: timeSignature != null ? timeSigDenominator : null,
    looping: looping
  };
  if (isLooping || looping == null) {
    addLoopProperties(propsToSet, setEndFirst, startBeats, endBeats, startMarkerBeats, looping);
  } else if (startMarkerBeats != null) {
    propsToSet.start_marker = startMarkerBeats;
  }
  if ((!isLooping || looping === false) && endBeats != null) {
    propsToSet.end_marker = endBeats;
  }
  return propsToSet;
}

function handleNoteUpdates(clip, notationString, modulationString, noteUpdateMode, timeSigNumerator, timeSigDenominator) {
  if (notationString == null) {
    return null;
  }
  let combinedNotationString = notationString;
  if (noteUpdateMode === "merge") {
    const existingNotesResult = JSON.parse(clip.call("get_notes_extended", 0, 128, 0, MAX_CLIP_BEATS));
    const existingNotes = existingNotesResult?.notes ?? [];
    if (existingNotes.length > 0) {
      const existingNotationString = formatNotation(existingNotes, {
        timeSigNumerator: timeSigNumerator,
        timeSigDenominator: timeSigDenominator
      });
      combinedNotationString = `${existingNotationString} ${notationString}`;
    }
  }
  const notes = interpretNotation(combinedNotationString, {
    timeSigNumerator: timeSigNumerator,
    timeSigDenominator: timeSigDenominator
  });
  applyModulations(notes, modulationString, timeSigNumerator, timeSigDenominator);
  clip.call("remove_notes_extended", 0, 128, 0, MAX_CLIP_BEATS);
  if (notes.length > 0) {
    clip.call("add_new_notes", {
      notes: notes
    });
  }
  const lengthBeats = clip.getProperty("length");
  const actualNotesResult = JSON.parse(clip.call("get_notes_extended", 0, 128, 0, lengthBeats));
  return actualNotesResult?.notes?.length ?? 0;
}

function processSingleClipUpdate(params) {
  const {clip: clip, notationString: notationString, modulationString: modulationString, noteUpdateMode: noteUpdateMode, name: name, color: color, timeSignature: timeSignature, start: start, length: length, firstStart: firstStart, looping: looping, gainDb: gainDb, pitchShift: pitchShift, warpMode: warpMode, warping: warping, warpOp: warpOp, warpBeatTime: warpBeatTime, warpSampleTime: warpSampleTime, warpDistance: warpDistance, quantize: quantize, quantizeGrid: quantizeGrid, quantizeSwing: quantizeSwing, quantizePitch: quantizePitch, arrangementLengthBeats: arrangementLengthBeats, arrangementStartBeats: arrangementStartBeats, context: context, updatedClips: updatedClips, tracksWithMovedClips: tracksWithMovedClips} = params;
  const {timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator} = getTimeSignature(timeSignature, clip);
  let finalNoteCount = null;
  const isLooping = looping ?? clip.getProperty("looping") > 0;
  if (firstStart != null && !isLooping) {
    warn("firstStart parameter ignored for non-looping clips");
  }
  const {startBeats: startBeats, endBeats: endBeats, startMarkerBeats: startMarkerBeats} = calculateBeatPositions({
    start: start,
    length: length,
    firstStart: firstStart,
    timeSigNumerator: timeSigNumerator,
    timeSigDenominator: timeSigDenominator,
    clip: clip,
    isLooping: isLooping
  });
  const currentLoopEnd = isLooping ? clip.getProperty("loop_end") : null;
  const propsToSet = buildClipPropertiesToSet({
    name: name,
    color: color,
    timeSignature: timeSignature,
    timeSigNumerator: timeSigNumerator,
    timeSigDenominator: timeSigDenominator,
    startMarkerBeats: startMarkerBeats,
    looping: looping,
    isLooping: isLooping,
    startBeats: startBeats,
    endBeats: endBeats,
    currentLoopEnd: currentLoopEnd
  });
  clip.setAll(propsToSet);
  if (color != null) {
    verifyColorQuantization(clip, color);
  }
  const isAudioClip = clip.getProperty("is_audio_clip") > 0;
  if (isAudioClip) {
    setAudioParameters(clip, {
      gainDb: gainDb,
      pitchShift: pitchShift,
      warpMode: warpMode,
      warping: warping
    });
  }
  finalNoteCount = handleNoteUpdates(clip, notationString, modulationString, noteUpdateMode, timeSigNumerator, timeSigDenominator);
  handleQuantization(clip, {
    quantize: quantize,
    quantizeGrid: quantizeGrid,
    quantizeSwing: quantizeSwing,
    quantizePitch: quantizePitch
  });
  if (warpOp != null) {
    handleWarpMarkerOperation(clip, warpOp, warpBeatTime, warpSampleTime, warpDistance);
  }
  handleArrangementOperations({
    clip: clip,
    isAudioClip: isAudioClip,
    arrangementStartBeats: arrangementStartBeats,
    arrangementLengthBeats: arrangementLengthBeats,
    tracksWithMovedClips: tracksWithMovedClips,
    context: context,
    updatedClips: updatedClips,
    finalNoteCount: finalNoteCount
  });
}

function updateClip({ids: ids, notes: notationString, modulations: modulationString, noteUpdateMode: noteUpdateMode = "merge", name: name, color: color, timeSignature: timeSignature, start: start, length: length, firstStart: firstStart, looping: looping, arrangementStart: arrangementStart, arrangementLength: arrangementLength, gainDb: gainDb, pitchShift: pitchShift, warpMode: warpMode, warping: warping, warpOp: warpOp, warpBeatTime: warpBeatTime, warpSampleTime: warpSampleTime, warpDistance: warpDistance, quantize: quantize, quantizeGrid: quantizeGrid, quantizeSwing: quantizeSwing, quantizePitch: quantizePitch} = {}, context = {}) {
  if (!ids) {
    throw new Error("updateClip failed: ids is required");
  }
  const clipIds = parseCommaSeparatedIds(ids);
  const clips = validateIdTypes(clipIds, "clip", "updateClip", {
    skipInvalid: true
  });
  const {arrangementStartBeats: arrangementStartBeats, arrangementLengthBeats: arrangementLengthBeats} = validateAndParseArrangementParams(arrangementStart, arrangementLength);
  const updatedClips = [];
  const tracksWithMovedClips = new Map;
  for (const clip of clips) {
    processSingleClipUpdate({
      clip: clip,
      notationString: notationString,
      modulationString: modulationString,
      noteUpdateMode: noteUpdateMode,
      name: name,
      color: color,
      timeSignature: timeSignature,
      start: start,
      length: length,
      firstStart: firstStart,
      looping: looping,
      gainDb: gainDb,
      pitchShift: pitchShift,
      warpMode: warpMode,
      warping: warping,
      warpOp: warpOp,
      warpBeatTime: warpBeatTime,
      warpSampleTime: warpSampleTime,
      warpDistance: warpDistance,
      quantize: quantize,
      quantizeGrid: quantizeGrid,
      quantizeSwing: quantizeSwing,
      quantizePitch: quantizePitch,
      arrangementLengthBeats: arrangementLengthBeats,
      arrangementStartBeats: arrangementStartBeats,
      context: context,
      updatedClips: updatedClips,
      tracksWithMovedClips: tracksWithMovedClips
    });
  }
  emitArrangementWarnings(arrangementStartBeats, tracksWithMovedClips);
  return unwrapSingleResult(updatedClips);
}

function getLocatorId(locatorIndex) {
  return `locator-${locatorIndex}`;
}

function readLocators(liveSet, timeSigNumerator, timeSigDenominator) {
  const locatorIds = liveSet.getChildIds("cue_points");
  const locators = [];
  for (let i = 0; i < locatorIds.length; i++) {
    const locator = LiveAPI.from(assertDefined(locatorIds[i], `locator id at index ${i}`));
    const name = locator.getProperty("name");
    const timeInBeats = locator.getProperty("time");
    const timeFormatted = abletonBeatsToBarBeat(timeInBeats, timeSigNumerator, timeSigDenominator);
    locators.push({
      id: getLocatorId(i),
      name: name,
      time: timeFormatted
    });
  }
  return locators;
}

function findLocator(liveSet, {locatorId: locatorId, timeInBeats: timeInBeats}) {
  const locatorIds = liveSet.getChildIds("cue_points");
  for (let i = 0; i < locatorIds.length; i++) {
    const locator = LiveAPI.from(assertDefined(locatorIds[i], `locator id at index ${i}`));
    if (locatorId != null && getLocatorId(i) === locatorId) {
      return {
        locator: locator,
        index: i
      };
    }
    if (timeInBeats != null) {
      const locatorTime = locator.getProperty("time");
      if (Math.abs(locatorTime - timeInBeats) < .001) {
        return {
          locator: locator,
          index: i
        };
      }
    }
  }
  return null;
}

function findLocatorsByName(liveSet, locatorName) {
  const locatorIds = liveSet.getChildIds("cue_points");
  const matches = [];
  for (let i = 0; i < locatorIds.length; i++) {
    const locator = LiveAPI.from(assertDefined(locatorIds[i], `locator id at index ${i}`));
    const name = locator.getProperty("name");
    if (name === locatorName) {
      const time = locator.getProperty("time");
      matches.push({
        locator: locator,
        index: i,
        time: time
      });
    }
  }
  return matches;
}

function resolveLocatorToBeats$1(liveSet, {locatorId: locatorId, locatorName: locatorName}, toolName, context) {
  const contextSuffix = context ? ` ${context}` : "";
  if (locatorId != null) {
    const found = findLocator(liveSet, {
      locatorId: locatorId
    });
    if (!found) {
      throw new Error(`${toolName} failed: locator not found: ${locatorId}`);
    }
    return found.locator.getProperty("time");
  }
  if (locatorName != null) {
    const matches = findLocatorsByName(liveSet, locatorName);
    if (matches.length === 0) {
      throw new Error(`${toolName} failed: no locator found with name "${locatorName}"${contextSuffix}`);
    }
    return assertDefined(matches[0], "first matching locator").time;
  }
  throw new Error(`${toolName} failed: locatorId or locatorName is required`);
}

function getCurrentLoopState(liveSet, timeSigNumerator, timeSigDenominator) {
  const startBeats = liveSet.getProperty("loop_start");
  const lengthBeats = liveSet.getProperty("loop_length");
  const start = abletonBeatsToBarBeat(startBeats, timeSigNumerator, timeSigDenominator);
  const end = abletonBeatsToBarBeat(startBeats + lengthBeats, timeSigNumerator, timeSigDenominator);
  return {
    startBeats: startBeats,
    start: start,
    end: end
  };
}

function resolveLocatorToBeats(liveSet, {locatorId: locatorId, locatorName: locatorName}, paramName) {
  if (locatorId == null && locatorName == null) {
    return;
  }
  return resolveLocatorToBeats$1(liveSet, {
    locatorId: locatorId,
    locatorName: locatorName
  }, "playback", `for ${paramName}`);
}

function validateLocatorOrTime(timeParam, locatorIdParam, locatorNameParam, paramName) {
  const hasTime = timeParam != null;
  const hasLocatorId = locatorIdParam != null;
  const hasLocatorName = locatorNameParam != null;
  const locatorParamBase = paramName.replace(/Time$/, "");
  if (hasTime && (hasLocatorId || hasLocatorName)) {
    throw new Error(`playback failed: ${paramName} cannot be used with ${locatorParamBase}LocatorId or ${locatorParamBase}LocatorName`);
  }
  if (hasLocatorId && hasLocatorName) {
    throw new Error(`playback failed: ${locatorParamBase}LocatorId and ${locatorParamBase}LocatorName are mutually exclusive`);
  }
}

function resolveStartTime(liveSet, {startTime: startTime, startLocatorId: startLocatorId, startLocatorName: startLocatorName}, timeSigNumerator, timeSigDenominator) {
  const useLocatorStart = startLocatorId != null || startLocatorName != null;
  let startTimeBeats;
  if (startTime != null) {
    startTimeBeats = barBeatToAbletonBeats(startTime, timeSigNumerator, timeSigDenominator);
    liveSet.set("start_time", startTimeBeats);
  } else if (useLocatorStart) {
    startTimeBeats = resolveLocatorToBeats(liveSet, {
      locatorId: startLocatorId,
      locatorName: startLocatorName
    }, "start");
    liveSet.set("start_time", startTimeBeats);
  }
  return {
    startTimeBeats: startTimeBeats,
    useLocatorStart: useLocatorStart
  };
}

function resolveLoopStart(liveSet, {loopStart: loopStart, loopStartLocatorId: loopStartLocatorId, loopStartLocatorName: loopStartLocatorName}, timeSigNumerator, timeSigDenominator) {
  let loopStartBeats;
  if (loopStart != null) {
    loopStartBeats = barBeatToAbletonBeats(loopStart, timeSigNumerator, timeSigDenominator);
    liveSet.set("loop_start", loopStartBeats);
  } else if (loopStartLocatorId != null || loopStartLocatorName != null) {
    loopStartBeats = resolveLocatorToBeats(liveSet, {
      locatorId: loopStartLocatorId,
      locatorName: loopStartLocatorName
    }, "loopStart");
    liveSet.set("loop_start", loopStartBeats);
  }
  return loopStartBeats;
}

function resolveLoopEnd(liveSet, {loopEnd: loopEnd, loopEndLocatorId: loopEndLocatorId, loopEndLocatorName: loopEndLocatorName}, loopStartBeats, timeSigNumerator, timeSigDenominator) {
  let loopEndBeats;
  if (loopEnd != null) {
    loopEndBeats = barBeatToAbletonBeats(loopEnd, timeSigNumerator, timeSigDenominator);
  } else if (loopEndLocatorId != null || loopEndLocatorName != null) {
    loopEndBeats = resolveLocatorToBeats(liveSet, {
      locatorId: loopEndLocatorId,
      locatorName: loopEndLocatorName
    }, "loopEnd");
  }
  if (loopEndBeats != null) {
    const actualLoopStartBeats = loopStartBeats ?? liveSet.getProperty("loop_start");
    const loopLengthBeats = loopEndBeats - actualLoopStartBeats;
    liveSet.set("loop_length", loopLengthBeats);
  }
}

function getArrangementFollowerTrackIds(liveSet) {
  const trackIds = liveSet.getChildIds("tracks");
  return trackIds.filter(trackId => {
    const track = LiveAPI.from(trackId);
    return track.exists() && track.getProperty("back_to_arranger") === 0;
  }).map(trackId => trackId.replace("id ", "")).join(",");
}

function handlePlayArrangement(liveSet, startTime, startTimeBeats, useLocatorStart, autoFollow, _state) {
  let resolvedStartTimeBeats = startTimeBeats;
  if (startTime == null && !useLocatorStart) {
    liveSet.set("start_time", 0);
    resolvedStartTimeBeats = 0;
  }
  if (autoFollow) {
    liveSet.set("back_to_arranger", 0);
  }
  liveSet.call("start_playing");
  return {
    isPlaying: true,
    currentTimeBeats: resolvedStartTimeBeats ?? 0
  };
}

function handlePlayScene(sceneIndex, state) {
  if (sceneIndex == null) {
    throw new Error(`playback failed: sceneIndex is required for action "play-scene"`);
  }
  const scene = LiveAPI.from(`live_set scenes ${sceneIndex}`);
  if (!scene.exists()) {
    throw new Error(`playback failed: scene at index ${sceneIndex} does not exist`);
  }
  scene.call("fire");
  return {
    isPlaying: true,
    currentTimeBeats: state.currentTimeBeats
  };
}

function playback({action: action, startTime: startTime, startLocatorId: startLocatorId, startLocatorName: startLocatorName, loop: loop, loopStart: loopStart, loopStartLocatorId: loopStartLocatorId, loopStartLocatorName: loopStartLocatorName, loopEnd: loopEnd, loopEndLocatorId: loopEndLocatorId, loopEndLocatorName: loopEndLocatorName, autoFollow: autoFollow = true, sceneIndex: sceneIndex, clipIds: clipIds, switchView: switchView} = {}, _context = {}) {
  if (!action) {
    throw new Error("playback failed: action is required");
  }
  validateLocatorOrTime(startTime, startLocatorId, startLocatorName, "startTime");
  validateLocatorOrTime(loopStart, loopStartLocatorId, loopStartLocatorName, "loopStart");
  validateLocatorOrTime(loopEnd, loopEndLocatorId, loopEndLocatorName, "loopEnd");
  const liveSet = LiveAPI.from("live_set");
  const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
  const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
  const {startTimeBeats: startTimeBeats, useLocatorStart: useLocatorStart} = resolveStartTime(liveSet, {
    startTime: startTime,
    startLocatorId: startLocatorId,
    startLocatorName: startLocatorName
  }, songTimeSigNumerator, songTimeSigDenominator);
  if (loop != null) {
    liveSet.set("loop", loop);
  }
  const loopStartBeats = resolveLoopStart(liveSet, {
    loopStart: loopStart,
    loopStartLocatorId: loopStartLocatorId,
    loopStartLocatorName: loopStartLocatorName
  }, songTimeSigNumerator, songTimeSigDenominator);
  resolveLoopEnd(liveSet, {
    loopEnd: loopEnd,
    loopEndLocatorId: loopEndLocatorId,
    loopEndLocatorName: loopEndLocatorName
  }, loopStartBeats, songTimeSigNumerator, songTimeSigDenominator);
  let isPlaying = liveSet.getProperty("is_playing") > 0;
  let currentTimeBeats = liveSet.getProperty("current_song_time");
  const playbackState = handlePlaybackAction(action, liveSet, {
    startTime: startTime,
    startTimeBeats: startTimeBeats,
    useLocatorStart: useLocatorStart,
    autoFollow: autoFollow,
    sceneIndex: sceneIndex,
    clipIds: clipIds
  }, {
    isPlaying: isPlaying,
    currentTimeBeats: currentTimeBeats
  });
  isPlaying = playbackState.isPlaying;
  currentTimeBeats = playbackState.currentTimeBeats;
  const currentTime = abletonBeatsToBarBeat(currentTimeBeats, songTimeSigNumerator, songTimeSigDenominator);
  const currentLoop = getCurrentLoopState(liveSet, songTimeSigNumerator, songTimeSigDenominator);
  handleViewSwitch(action, switchView);
  const arrangementFollowerTrackIds = getArrangementFollowerTrackIds(liveSet);
  return buildPlaybackResult({
    isPlaying: isPlaying,
    currentTime: currentTime,
    loop: loop,
    loopStart: loopStart,
    loopEnd: loopEnd,
    currentLoopStart: currentLoop.start,
    currentLoopEnd: currentLoop.end,
    liveSet: liveSet,
    arrangementFollowerTrackIds: arrangementFollowerTrackIds
  });
}

function handleViewSwitch(action, switchView) {
  if (!switchView) return;
  if (action === "play-arrangement") {
    select({
      view: "arrangement"
    });
  } else if (action === "play-scene" || action === "play-session-clips") {
    select({
      view: "session"
    });
  }
}

function buildPlaybackResult({isPlaying: isPlaying, currentTime: currentTime, loop: loop, loopStart: loopStart, loopEnd: loopEnd, currentLoopStart: currentLoopStart, currentLoopEnd: currentLoopEnd, liveSet: liveSet, arrangementFollowerTrackIds: arrangementFollowerTrackIds}) {
  const result = {
    playing: isPlaying,
    currentTime: currentTime
  };
  const loopEnabled = loop ?? liveSet.getProperty("loop") > 0;
  if (loopEnabled) {
    result.arrangementLoop = {
      start: loopStart ?? currentLoopStart,
      end: loopEnd ?? currentLoopEnd
    };
  }
  result.arrangementFollowerTrackIds = arrangementFollowerTrackIds;
  return result;
}

function handlePlaySessionClips(liveSet, clipIds, state) {
  if (!clipIds) {
    throw new Error(`playback failed: clipIds is required for action "play-session-clips"`);
  }
  const clipIdList = parseCommaSeparatedIds(clipIds);
  const clips = validateIdTypes(clipIdList, "clip", "playback", {
    skipInvalid: true
  });
  for (const clip of clips) {
    const trackIndex = clip.trackIndex;
    const sceneIndex = clip.sceneIndex;
    if (trackIndex == null || sceneIndex == null) {
      throw new Error(`playback play-session-clips action failed: could not determine track/scene for clipId=${clip.id}`);
    }
    const clipSlot = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
    if (!clipSlot.exists()) {
      throw new Error(`playback play-session-clips action failed: clip slot for clipId=${clip.id.replace(/^id /, "")} does not exist`);
    }
    clipSlot.call("fire");
  }
  if (clips.length > 1) {
    liveSet.call("stop_playing");
    liveSet.call("start_playing");
  }
  return {
    isPlaying: true,
    currentTimeBeats: state.currentTimeBeats
  };
}

function handleStopSessionClips(clipIds, state) {
  if (!clipIds) {
    throw new Error(`playback failed: clipIds is required for action "stop-session-clips"`);
  }
  const stopClipIdList = parseCommaSeparatedIds(clipIds);
  const stopClips = validateIdTypes(stopClipIdList, "clip", "playback", {
    skipInvalid: true
  });
  const tracksToStop = new Set;
  for (const clip of stopClips) {
    const trackIndex = clip.trackIndex;
    if (trackIndex == null) {
      throw new Error(`playback stop-session-clips action failed: could not determine track for clipId=${clip.id}`);
    }
    const trackPath = `live_set tracks ${trackIndex}`;
    tracksToStop.add(trackPath);
  }
  for (const trackPath of tracksToStop) {
    const track = LiveAPI.from(trackPath);
    if (!track.exists()) {
      throw new Error(`playback stop-session-clips action failed: track for clip path does not exist`);
    }
    track.call("stop_all_clips");
  }
  return state;
}

function handlePlaybackAction(action, liveSet, params, state) {
  const {startTime: startTime, startTimeBeats: startTimeBeats, useLocatorStart: useLocatorStart, autoFollow: autoFollow, sceneIndex: sceneIndex, clipIds: clipIds} = params;
  switch (action) {
   case "play-arrangement":
    return handlePlayArrangement(liveSet, startTime, startTimeBeats, useLocatorStart, autoFollow);

   case "update-arrangement":
    return state;

   case "play-scene":
    return handlePlayScene(sceneIndex, state);

   case "play-session-clips":
    return handlePlaySessionClips(liveSet, clipIds, state);

   case "stop-session-clips":
    return handleStopSessionClips(clipIds, state);

   case "stop-all-session-clips":
    liveSet.call("stop_all_clips");
    return state;

   case "stop":
    liveSet.call("stop_playing");
    liveSet.set("start_time", 0);
    return {
      isPlaying: false,
      currentTimeBeats: 0
    };

   default:
    throw new Error(`playback failed: unknown action "${action}"`);
  }
}

const MAX_OPERATIONS = 50;

const OPERATION_REQUIREMENTS = {
  get_property: {
    property: true
  },
  set_property: {
    property: true,
    valueDefined: true
  },
  call_method: {
    method: true
  },
  get: {
    property: true
  },
  set: {
    property: true,
    valueDefined: true
  },
  call: {
    method: true
  },
  goto: {
    valueTruthy: true
  },
  info: {},
  getProperty: {
    property: true
  },
  getChildIds: {
    property: true
  },
  exists: {},
  getColor: {},
  setColor: {
    valueTruthy: true
  }
};

const OPERATION_ERROR_MESSAGES = {
  get_property: {
    property: "get_property operation requires property"
  },
  set_property: {
    property: "set_property operation requires property",
    value: "set_property operation requires value"
  },
  call_method: {
    method: "call_method operation requires method"
  },
  get: {
    property: "get operation requires property"
  },
  set: {
    property: "set operation requires property",
    value: "set operation requires value"
  },
  call: {
    method: "call operation requires method"
  },
  goto: {
    value: "goto operation requires value (path)"
  },
  info: {},
  getProperty: {
    property: "getProperty operation requires property"
  },
  getChildIds: {
    property: "getChildIds operation requires property (child type)"
  },
  exists: {},
  getColor: {},
  setColor: {
    value: "setColor operation requires value (color)"
  }
};

function validateOperationParameters(operation) {
  const {type: type, property: property, method: method, value: value} = operation;
  if (!(type in OPERATION_REQUIREMENTS)) {
    throw new Error(`Unknown operation type: ${type}. Valid types: get_property, set_property, call_method, get, set, call, goto, info, getProperty, getChildIds, exists, getColor, setColor`);
  }
  const requirements = OPERATION_REQUIREMENTS[type];
  const messages = OPERATION_ERROR_MESSAGES[type];
  if (requirements.property && !property) {
    throw new Error(messages.property);
  }
  if (requirements.method && !method) {
    throw new Error(messages.method);
  }
  if (requirements.valueDefined && value === void 0) {
    throw new Error(messages.value);
  }
  if (requirements.valueTruthy && !value) {
    throw new Error(messages.value);
  }
}

function executeOperation(api, operation) {
  const {type: type} = operation;
  const property = operation.property;
  const method = operation.method;
  switch (type) {
   case "get_property":
    return api[property];

   case "set_property":
    api.set(property, operation.value);
    return operation.value;

   case "call_method":
    {
      const args = operation.args ?? [];
      const methodFn = api[method];
      if (typeof methodFn !== "function") {
        throw new Error(`Method "${method}" not found on LiveAPI object`);
      }
      return methodFn.apply(api, args);
    }

   case "get":
    return api.get(property);

   case "set":
    return api.set(property, operation.value);

   case "call":
    {
      const callArgs = operation.args ?? [];
      return api.call(method, ...callArgs);
    }

   case "goto":
    return api.goto(operation.value);

   case "info":
    return api.info;

   case "getProperty":
    return api.getProperty(property);

   case "getChildIds":
    return api.getChildIds(property);

   case "exists":
    return api.exists();

   case "getColor":
    return api.getColor();

   case "setColor":
    return api.setColor(operation.value);

   default:
    throw new Error(`Unknown operation type: ${type}`);
  }
}

function rawLiveApi({path: path, operations: operations}, _context = {}) {
  if (!Array.isArray(operations)) {
    throw new Error("operations must be an array");
  }
  if (operations.length > MAX_OPERATIONS) {
    throw new Error(`operations array cannot exceed ${MAX_OPERATIONS} operations`);
  }
  const defaultPath = "live_set";
  const api = LiveAPI.from(path ?? defaultPath);
  const results = [];
  for (const operation of operations) {
    let result;
    try {
      validateOperationParameters(operation);
      result = executeOperation(api, operation);
    } catch (error) {
      throw new Error(`Operation failed: ${errorMessage(error)}`);
    }
    results.push({
      operation: operation,
      result: result
    });
  }
  const pathChanged = api.path !== defaultPath;
  const includePath = path != null || pathChanged;
  return {
    ...includePath ? {
      path: api.path
    } : {},
    id: api.id,
    results: results
  };
}

const MAX_AUTO_CREATE_CHAINS = 16;

function resolveContainerWithAutoCreate(segments, path) {
  let currentPath = resolveTrackPath(assertDefined(segments[0], "track segment"));
  let current = LiveAPI.from(currentPath);
  if (!current.exists()) {
    throw new Error(`Track in path "${path}" does not exist`);
  }
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith("d")) {
      const deviceIndex = segment.slice(1);
      current = navigateToDevice(currentPath, deviceIndex, path);
      currentPath += ` devices ${deviceIndex}`;
    } else if (segment.startsWith("c") || segment.startsWith("rc")) {
      current = navigateToChain(current, currentPath, segment, path);
      currentPath = current.path;
    }
  }
  return current;
}

function resolveTrackPath(segment) {
  if (segment === "mt") {
    return "live_set master_track";
  }
  if (segment.startsWith("rt")) {
    return `live_set return_tracks ${segment.slice(2)}`;
  }
  if (segment.startsWith("t")) {
    return `live_set tracks ${segment.slice(1)}`;
  }
  throw new Error(`Invalid track segment: ${segment}`);
}

function navigateToDevice(currentPath, segment, fullPath) {
  const devicePath = `${currentPath} devices ${segment}`;
  const device = LiveAPI.from(devicePath);
  if (!device.exists()) {
    throw new Error(`Device in path "${fullPath}" does not exist`);
  }
  return device;
}

function navigateToChain(parentDevice, currentPath, segment, fullPath) {
  if (segment.startsWith("rc")) {
    const returnIndex = Number.parseInt(segment.slice(2));
    const chainPath2 = `${currentPath} return_chains ${returnIndex}`;
    const chain = LiveAPI.from(chainPath2);
    if (!chain.exists()) {
      throw new Error(`Return chain in path "${fullPath}" does not exist`);
    }
    return chain;
  }
  const chainIndex = Number.parseInt(segment.slice(1));
  const chains = parentDevice.getChildren("chains");
  if (chainIndex >= chains.length) {
    autoCreateChains(parentDevice, chainIndex, fullPath);
  }
  const chainPath = `${currentPath} chains ${chainIndex}`;
  return LiveAPI.from(chainPath);
}

function autoCreateChains(device, targetIndex, fullPath) {
  if (!device.getProperty("can_have_chains")) {
    throw new Error(`Device at path "${fullPath}" does not support chains`);
  }
  if (device.getProperty("can_have_drum_pads") > 0) {
    throw new Error(`Auto-creating chains in Drum Racks is not supported (path: "${fullPath}")`);
  }
  const chainsToCreate = targetIndex + 1 - device.getChildren("chains").length;
  if (chainsToCreate > MAX_AUTO_CREATE_CHAINS) {
    throw new Error(`Cannot auto-create ${chainsToCreate} chains (max: ${MAX_AUTO_CREATE_CHAINS}) in path "${fullPath}"`);
  }
  for (let i = 0; i < chainsToCreate; i++) {
    const result = device.call("insert_chain");
    if (!Array.isArray(result) || result[0] !== "id") {
      throw new Error(`Failed to create chain ${i + 1}/${chainsToCreate} in path "${fullPath}"`);
    }
  }
}

function autoCreateDrumPadChains(device, targetInNote, targetIndex, existingCount) {
  const chainsToCreate = targetIndex + 1 - existingCount;
  if (chainsToCreate > MAX_AUTO_CREATE_CHAINS) {
    throw new Error(`Cannot auto-create ${chainsToCreate} drum pad chains (max: ${MAX_AUTO_CREATE_CHAINS})`);
  }
  for (let i = 0; i < chainsToCreate; i++) {
    device.call("insert_chain");
    const chains = device.getChildren("chains");
    const newChain = chains.at(-1);
    if (newChain) {
      newChain.set("in_note", targetInNote);
    }
  }
}

function getChildAtIndex(parent, childType, index) {
  if (Number.isNaN(index)) return null;
  const c = parent.getChildren(childType);
  return index >= 0 && index < c.length ? c[index] ?? null : null;
}

function navigateRemainingSegments(startDevice, segments) {
  let current = startDevice;
  let currentType = "device";
  for (let i = 0; i < segments.length; i++) {
    const seg = assertDefined(segments[i], `segment at index ${i}`);
    if (seg.startsWith("p")) {
      const n = seg.slice(1);
      return n ? resolveDrumPadFromPath(current.path, n, segments.slice(i + 1)) : {
        target: null,
        targetType: "chain"
      };
    }
    const isRc = seg.startsWith("rc");
    if (isRc || seg.startsWith("c")) {
      const c = getChildAtIndex(current, isRc ? "return_chains" : "chains", Number.parseInt(seg.slice(isRc ? 2 : 1)));
      if (!c) return {
        target: null,
        targetType: "chain"
      };
      current = c;
      currentType = "chain";
    } else if (seg.startsWith("d")) {
      const c = getChildAtIndex(current, "devices", Number.parseInt(seg.slice(1)));
      if (!c) return {
        target: null,
        targetType: "device"
      };
      current = c;
      currentType = "device";
    } else {
      return {
        target: null,
        targetType: currentType
      };
    }
  }
  return {
    target: current,
    targetType: currentType
  };
}

function resolveDrumPadFromPath(liveApiPath, drumPadNote, remainingSegments) {
  const device = LiveAPI.from(liveApiPath);
  if (!device.exists()) {
    return {
      target: null,
      targetType: "chain"
    };
  }
  const allChains = device.getChildren("chains");
  const targetInNote = drumPadNote === "*" ? -1 : noteNameToMidi(drumPadNote);
  if (targetInNote == null) {
    return {
      target: null,
      targetType: "chain"
    };
  }
  let chainIndexWithinNote = 0;
  let nextSegmentStart = 0;
  if (remainingSegments.length > 0) {
    const firstSegment = assertDefined(remainingSegments[0], "first segment");
    if (firstSegment.startsWith("c")) {
      chainIndexWithinNote = Number.parseInt(firstSegment.slice(1));
      if (Number.isNaN(chainIndexWithinNote)) {
        return {
          target: null,
          targetType: "chain"
        };
      }
      nextSegmentStart = 1;
    }
  }
  const matchingChains = allChains.filter(c => c.getProperty("in_note") === targetInNote);
  if (chainIndexWithinNote < 0 || chainIndexWithinNote >= matchingChains.length) {
    return {
      target: null,
      targetType: "chain"
    };
  }
  const chain = assertDefined(matchingChains[chainIndexWithinNote], `chain at index ${chainIndexWithinNote}`);
  const nextSegments = remainingSegments.slice(nextSegmentStart);
  if (nextSegments.length === 0) {
    return {
      target: chain,
      targetType: "chain"
    };
  }
  const deviceSegment = assertDefined(nextSegments[0], "device segment");
  if (!deviceSegment.startsWith("d")) {
    return {
      target: null,
      targetType: "device"
    };
  }
  const deviceIndex = Number.parseInt(deviceSegment.slice(1));
  const devices = chain.getChildren("devices");
  if (Number.isNaN(deviceIndex) || deviceIndex < 0 || deviceIndex >= devices.length) {
    return {
      target: null,
      targetType: "device"
    };
  }
  const targetDevice = assertDefined(devices[deviceIndex], `device at index ${deviceIndex}`);
  const afterDeviceSegments = nextSegments.slice(1);
  if (afterDeviceSegments.length === 0) {
    return {
      target: targetDevice,
      targetType: "device"
    };
  }
  return navigateRemainingSegments(targetDevice, afterDeviceSegments);
}

function parseTrackSegment(trackSegment, path) {
  if (trackSegment === "mt") return "live_set master_track";
  if (trackSegment.startsWith("rt")) {
    const index = Number.parseInt(trackSegment.slice(2));
    if (Number.isNaN(index)) throw new Error(`Invalid return track index in path: ${path}`);
    return `live_set return_tracks ${index}`;
  }
  if (trackSegment.startsWith("t")) {
    const index = Number.parseInt(trackSegment.slice(1));
    if (Number.isNaN(index)) throw new Error(`Invalid track index in path: ${path}`);
    return `live_set tracks ${index}`;
  }
  throw new Error(`Invalid track segment in path: ${path}`);
}

function parseChainSegment(segment, path, liveApiPath, segments, index) {
  if (segment.startsWith("p")) {
    const noteName = segment.slice(1);
    if (!noteName) {
      throw new Error(`Invalid drum pad note in path: ${path}`);
    }
    return {
      earlyReturn: {
        liveApiPath: liveApiPath,
        targetType: "drum-pad",
        drumPadNote: noteName,
        remainingSegments: segments.slice(index + 1)
      }
    };
  }
  if (segment.startsWith("rc")) {
    const returnChainIndex = Number.parseInt(segment.slice(2));
    if (Number.isNaN(returnChainIndex)) {
      throw new Error(`Invalid return chain index in path: ${path}`);
    }
    return {
      liveApiPath: `${liveApiPath} return_chains ${returnChainIndex}`,
      targetType: "return-chain",
      remainingSegments: []
    };
  }
  if (segment.startsWith("c")) {
    const chainIndex = Number.parseInt(segment.slice(1));
    if (Number.isNaN(chainIndex)) {
      throw new Error(`Invalid chain index in path: ${path}`);
    }
    return {
      liveApiPath: `${liveApiPath} chains ${chainIndex}`,
      targetType: "chain",
      remainingSegments: []
    };
  }
  throw new Error(`Invalid chain segment in path: ${path}`);
}

function resolvePathToLiveApi(path) {
  if (!path || typeof path !== "string") {
    throw new Error("Path must be a non-empty string");
  }
  const segments = path.split("/");
  const firstSegment = assertDefined(segments[0], "first path segment");
  if (segments.length === 0 || firstSegment === "") {
    throw new Error(`Invalid path: ${path}`);
  }
  let liveApiPath = parseTrackSegment(firstSegment, path);
  if (segments.length === 1) {
    throw new Error(`Path must include at least a device index: ${path}`);
  }
  let targetType = "device";
  for (let i = 1; i < segments.length; i++) {
    const segment = segments[i];
    if (segment.startsWith("d")) {
      const deviceIndex = Number.parseInt(segment.slice(1));
      if (Number.isNaN(deviceIndex)) {
        throw new Error(`Invalid device index in path: ${path}`);
      }
      liveApiPath += ` devices ${deviceIndex}`;
      targetType = "device";
    } else {
      const result = parseChainSegment(segment, path, liveApiPath, segments, i);
      if (result.earlyReturn) {
        return result.earlyReturn;
      }
      liveApiPath = result.liveApiPath;
      targetType = result.targetType;
    }
  }
  return {
    liveApiPath: liveApiPath,
    targetType: targetType,
    remainingSegments: []
  };
}

function extractDevicePath(liveApiPath) {
  let prefix;
  const regularMatch = liveApiPath.match(/^live_set tracks (\d+)/);
  const returnMatch = liveApiPath.match(/^live_set return_tracks (\d+)/);
  const masterMatch = liveApiPath.match(/^live_set master_track/);
  if (regularMatch) {
    prefix = `t${regularMatch[1]}`;
  } else if (returnMatch) {
    prefix = `rt${returnMatch[1]}`;
  } else if (masterMatch) {
    prefix = "mt";
  } else {
    return null;
  }
  const parts = [ prefix ];
  const pattern = /(devices|(?:return_)?chains) (\d+)/g;
  let match;
  while ((match = pattern.exec(liveApiPath)) !== null) {
    const type = match[1];
    const index = match[2];
    if (type === "devices") {
      parts.push(`d${index}`);
    } else if (type === "return_chains") {
      parts.push(`rc${index}`);
    } else {
      parts.push(`c${index}`);
    }
  }
  return parts.join("/");
}

function buildChainPath(devicePath, chainIndex) {
  return `${devicePath}/c${chainIndex}`;
}

function buildReturnChainPath(devicePath, returnChainIndex) {
  return `${devicePath}/rc${returnChainIndex}`;
}

function resolveTrack(segment) {
  if (segment === "mt") {
    return LiveAPI.from("live_set master_track");
  }
  if (segment.startsWith("rt")) {
    const returnIndex = Number.parseInt(segment.slice(2));
    return LiveAPI.from(`live_set return_tracks ${returnIndex}`);
  }
  if (segment.startsWith("t")) {
    const trackIndex = Number.parseInt(segment.slice(1));
    return LiveAPI.from(`live_set tracks ${trackIndex}`);
  }
  throw new Error(`Invalid track segment: ${segment}`);
}

function resolveDrumPadContainer(path) {
  const resolved = resolvePathToLiveApi(path);
  if (resolved.targetType !== "drum-pad") {
    return LiveAPI.from(resolved.liveApiPath);
  }
  const drumPadNote = resolved.drumPadNote;
  const {remainingSegments: remainingSegments} = resolved;
  const result = resolveDrumPadFromPath(resolved.liveApiPath, drumPadNote, remainingSegments);
  if (result.target) {
    return result.target;
  }
  if (result.targetType === "chain") {
    const device = LiveAPI.from(resolved.liveApiPath);
    if (!device.exists()) {
      return null;
    }
    const targetInNote = drumPadNote === "*" ? -1 : noteNameToMidi(drumPadNote);
    if (targetInNote == null) {
      return null;
    }
    let chainIndex = 0;
    if (remainingSegments.length > 0) {
      const chainSegment = assertDefined(remainingSegments[0], "chain segment");
      chainIndex = chainSegment.startsWith("c") ? Number.parseInt(chainSegment.slice(1)) : Number.parseInt(chainSegment);
    }
    if (Number.isNaN(chainIndex) || chainIndex < 0) {
      return null;
    }
    const allChains = device.getChildren("chains");
    const matchingChains = allChains.filter(chain => chain.getProperty("in_note") === targetInNote);
    if (chainIndex >= matchingChains.length) {
      autoCreateDrumPadChains(device, targetInNote, chainIndex, matchingChains.length);
    }
    const resultAfter = resolveDrumPadFromPath(resolved.liveApiPath, drumPadNote, remainingSegments);
    return resultAfter.target;
  }
  return null;
}

function resolveContainer(path) {
  const segments = path.split("/");
  if (segments.length === 1) return resolveTrack(assertDefined(segments[0], "track segment"));
  if (segments.some(s => s.startsWith("p"))) return resolveDrumPadContainer(path);
  return resolveContainerWithAutoCreate(segments, path);
}

function resolveInsertionPath(path) {
  if (!path || typeof path !== "string") {
    throw new Error("Path must be a non-empty string");
  }
  const segments = path.split("/");
  if (segments.length === 0 || segments[0] === "") {
    throw new Error(`Invalid path: ${path}`);
  }
  const lastSegment = assertDefined(segments.at(-1), "last path segment");
  const hasPosition = lastSegment.startsWith("d");
  if (hasPosition) {
    const position = Number.parseInt(lastSegment.slice(1));
    if (Number.isNaN(position) || position < 0) {
      throw new Error(`Invalid device position in path: ${path}`);
    }
    const containerPath = segments.slice(0, -1).join("/");
    const container2 = resolveContainer(containerPath);
    return {
      container: container2,
      position: position
    };
  }
  const container = resolveContainer(path);
  return {
    container: container,
    position: null
  };
}

function validateDeviceName(deviceName) {
  if (ALL_VALID_DEVICES.includes(deviceName)) {
    return;
  }
  const validList = `Instruments: ${VALID_DEVICES.instruments.join(", ")} | MIDI Effects: ${VALID_DEVICES.midiEffects.join(", ")} | Audio Effects: ${VALID_DEVICES.audioEffects.join(", ")}`;
  throw new Error(`createDevice failed: invalid deviceName "${deviceName}". Valid devices - ${validList}`);
}

function createDevice({deviceName: deviceName, path: path} = {}, _context = {}) {
  if (deviceName == null) {
    return VALID_DEVICES;
  }
  validateDeviceName(deviceName);
  if (path == null) {
    throw new Error("createDevice failed: path is required when creating a device");
  }
  return createDeviceAtPath(deviceName, path);
}

function createDeviceAtPath(deviceName, path) {
  const {container: container, position: position} = resolveInsertionPath(path);
  if (!container?.exists()) {
    throw new Error(`createDevice failed: container at path "${path}" does not exist`);
  }
  const deviceCount = container.getChildren("devices").length;
  const effectivePosition = position === 0 && deviceCount === 0 ? null : position;
  const result = effectivePosition != null ? container.call("insert_device", deviceName, effectivePosition) : container.call("insert_device", deviceName);
  const rawId = result[1];
  const id = rawId ? String(rawId) : null;
  const device = id ? LiveAPI.from(`id ${id}`) : null;
  if (!id || !device?.exists()) {
    const positionDesc = position != null ? `position ${position}` : "end";
    throw new Error(`createDevice failed: could not insert "${deviceName}" at ${positionDesc} in path "${path}"`);
  }
  return {
    id: id,
    deviceIndex: device.deviceIndex
  };
}

const PARAM_STATE_MAP = {
  0: "active",
  1: "inactive",
  2: "disabled"
};

const AUTOMATION_STATE_MAP = {
  0: "none",
  1: "active",
  2: "overridden"
};

const LABEL_PATTERNS = [ {
  regex: /^([\d.]+)\s*kHz$/,
  unit: "Hz",
  multiplier: 1e3
}, {
  regex: /^([\d.]+)\s*Hz$/,
  unit: "Hz",
  multiplier: 1
}, {
  regex: /^([\d.]+)\s*s$/,
  unit: "ms",
  multiplier: 1e3
}, {
  regex: /^([\d.]+)\s*ms$/,
  unit: "ms",
  multiplier: 1
}, {
  regex: /^([\d.-]+)\s*dB$/,
  unit: "dB",
  multiplier: 1
}, {
  regex: /^(-?inf)\s*dB$/,
  unit: "dB",
  fixedValue: -70
}, {
  regex: /^([\d.-]+)\s*%$/,
  unit: "%",
  multiplier: 1
}, {
  regex: /^([+-]?\d+)\s*st$/,
  unit: "semitones",
  multiplier: 1
}, {
  regex: /^([A-G][#b]?-?\d+)$/,
  unit: "note",
  isNoteName: true
}, {
  regex: /^(\d+)([LR])$/,
  unit: "pan",
  isPan: true
}, {
  regex: /^(C)$/,
  unit: "pan",
  fixedValue: 0
} ];

function formatParamName(paramApi) {
  const name = paramApi.getProperty("name");
  const originalName = paramApi.getProperty("original_name");
  return originalName !== name ? `${name} (${originalName})` : name;
}

function parseLabel(label) {
  if (!label || typeof label !== "string") {
    return {
      value: null,
      unit: null
    };
  }
  for (const pattern of LABEL_PATTERNS) {
    const match = label.match(pattern.regex);
    if (!match) continue;
    if (pattern.fixedValue !== void 0) {
      return {
        value: pattern.fixedValue,
        unit: pattern.unit
      };
    }
    if (pattern.isNoteName) {
      return {
        value: match[1],
        unit: "note"
      };
    }
    if (pattern.isPan) {
      const num = Number.parseInt(match[1]);
      const dir = match[2];
      return {
        value: num,
        unit: "pan",
        direction: dir
      };
    }
    return {
      value: Number.parseFloat(match[1]) * (pattern.multiplier ?? 1),
      unit: pattern.unit
    };
  }
  const numMatch = label.match(/^([\d.-]+)/);
  if (numMatch) {
    return {
      value: Number.parseFloat(numMatch[1]),
      unit: null
    };
  }
  return {
    value: null,
    unit: null
  };
}

function isPanLabel(label) {
  if (!label || typeof label !== "string") return false;
  return /^(\d+[LR]|C)$/.test(label);
}

function isDivisionLabel(label) {
  return typeof label === "string" && /^1\/\d+$/.test(label);
}

function buildDivisionParamResult(paramApi, name, valueLabel, rawMin, rawMax) {
  const minInt = Math.ceil(Math.min(rawMin, rawMax));
  const maxInt = Math.floor(Math.max(rawMin, rawMax));
  const options = [];
  for (let i = minInt; i <= maxInt; i++) {
    const label = paramApi.call("str_for_value", i);
    options.push(typeof label === "number" ? String(label) : label);
  }
  return {
    id: paramApi.id,
    name: name,
    value: typeof valueLabel === "number" ? String(valueLabel) : valueLabel,
    options: options
  };
}

function normalizePan(label, maxPanValue) {
  if (label === "C") return 0;
  const match = label.match(/^(\d+)([LR])$/);
  if (!match) return 0;
  const num = Number.parseInt(match[1]);
  const dir = match[2];
  return dir === "L" ? -num / maxPanValue : num / maxPanValue;
}

function extractMaxPanValue(label) {
  const match = label.match(/^(\d+)[LR]$/);
  return match ? Number.parseInt(match[1]) : 50;
}

function addStateFlags(result, paramApi, state, automationState) {
  const isEnabled = paramApi.getProperty("is_enabled") > 0;
  if (!isEnabled) result.enabled = false;
  if (state && state !== "active") result.state = state;
  if (automationState && automationState !== "none") {
    result.automation = automationState;
  }
}

function readParameterBasic(paramApi) {
  const name = formatParamName(paramApi);
  return {
    id: paramApi.id,
    name: name
  };
}

function readParameter(paramApi) {
  const name = formatParamName(paramApi);
  const stateIdx = paramApi.getProperty("state");
  const automationIdx = paramApi.getProperty("automation_state");
  const state = PARAM_STATE_MAP[stateIdx];
  const automationState = AUTOMATION_STATE_MAP[automationIdx];
  if (paramApi.getProperty("is_quantized") > 0) {
    const valueItems = paramApi.get("value_items");
    const valueIdx = paramApi.getProperty("value");
    const result2 = {
      id: paramApi.id,
      name: name,
      value: valueItems[valueIdx],
      options: valueItems
    };
    addStateFlags(result2, paramApi, state, automationState);
    return result2;
  }
  const rawValue = paramApi.getProperty("value");
  const rawMin = paramApi.getProperty("min");
  const rawMax = paramApi.getProperty("max");
  const valueLabel = paramApi.call("str_for_value", rawValue);
  const minLabel = paramApi.call("str_for_value", rawMin);
  const maxLabel = paramApi.call("str_for_value", rawMax);
  if (isDivisionLabel(valueLabel) || isDivisionLabel(minLabel)) {
    const result2 = buildDivisionParamResult(paramApi, name, valueLabel, rawMin, rawMax);
    addStateFlags(result2, paramApi, state, automationState);
    return result2;
  }
  const valueParsed = parseLabel(valueLabel);
  const minParsed = parseLabel(minLabel);
  const maxParsed = parseLabel(maxLabel);
  const unit = valueParsed.unit ?? minParsed.unit ?? maxParsed.unit;
  if (unit === "pan") {
    const maxPanValue = extractMaxPanValue(maxLabel) || extractMaxPanValue(minLabel) || 50;
    const result2 = {
      id: paramApi.id,
      name: name,
      value: normalizePan(valueLabel, maxPanValue),
      min: -1,
      max: 1,
      unit: "pan"
    };
    addStateFlags(result2, paramApi, state, automationState);
    return result2;
  }
  const result = {
    id: paramApi.id,
    name: name,
    value: valueParsed.value ?? paramApi.getProperty("display_value") ?? rawValue,
    min: minParsed.value ?? rawMin,
    max: maxParsed.value ?? rawMax
  };
  if (unit) result.unit = unit;
  addStateFlags(result, paramApi, state, automationState);
  return result;
}

function buildChainInfo(chain, options = {}) {
  const {path: path, devices: devices} = options;
  const chainInfo = {
    id: chain.id
  };
  if (path) {
    chainInfo.path = path;
  }
  chainInfo.type = chain.type;
  chainInfo.name = chain.getProperty("name");
  const color = chain.getColor();
  if (color) {
    chainInfo.color = color;
  }
  if (chain.type === "DrumChain") {
    const outNote = chain.getProperty("out_note");
    if (outNote != null) {
      const noteName = midiToNoteName(outNote);
      if (noteName != null) {
        chainInfo.mappedPitch = noteName;
      }
    }
    const chokeGroup = chain.getProperty("choke_group");
    if (chokeGroup > 0) {
      chainInfo.chokeGroup = chokeGroup;
    }
  }
  const chainState = computeState(chain);
  if (chainState !== STATE.ACTIVE) {
    chainInfo.state = chainState;
  }
  if (devices !== void 0) {
    chainInfo.devices = devices;
  }
  return chainInfo;
}

function computeState(liveObject, category = "regular") {
  if (category === "master") {
    return STATE.ACTIVE;
  }
  const isMuted = liveObject.getProperty("mute") > 0;
  const isSoloed = liveObject.getProperty("solo") > 0;
  const isMutedViaSolo = liveObject.getProperty("muted_via_solo") > 0;
  if (isMuted && isSoloed) {
    return STATE.MUTED_AND_SOLOED;
  }
  if (isSoloed) {
    return STATE.SOLOED;
  }
  if (isMuted && isMutedViaSolo) {
    return STATE.MUTED_ALSO_VIA_SOLO;
  }
  if (isMutedViaSolo) {
    return STATE.MUTED_VIA_SOLO;
  }
  if (isMuted) {
    return STATE.MUTED;
  }
  return STATE.ACTIVE;
}

function isInstrumentDevice(deviceType) {
  return deviceType.startsWith(DEVICE_TYPE.INSTRUMENT) || deviceType.startsWith(DEVICE_TYPE.INSTRUMENT_RACK) || deviceType.startsWith(DEVICE_TYPE.DRUM_RACK);
}

function hasInstrumentInDevices(devices) {
  if (!devices || devices.length === 0) {
    return false;
  }
  for (const device of devices) {
    if (isInstrumentDevice(device.type)) {
      return true;
    }
    if (device.chains) {
      for (const chain of device.chains) {
        if (chain.devices && hasInstrumentInDevices(chain.devices)) {
          return true;
        }
      }
    }
  }
  return false;
}

function buildDrumChainPath(parentPath, inNote, indexWithinNote) {
  if (inNote === -1) {
    return `${parentPath}/p*/${indexWithinNote}`;
  }
  const noteName = midiToNoteName(inNote);
  if (noteName == null) {
    return `${parentPath}/p*/${indexWithinNote}`;
  }
  return `${parentPath}/p${noteName}/${indexWithinNote}`;
}

function processDrumRackChain(chain, inNote, indexWithinNote, options) {
  const {includeDrumPads: includeDrumPads, includeChains: includeChains, depth: depth, maxDepth: maxDepth, readDeviceFn: readDeviceFn, parentPath: parentPath} = options;
  const chainPath = parentPath ? buildDrumChainPath(parentPath, inNote, indexWithinNote) : null;
  const chainDevices = chain.getChildren("devices");
  const processedDevices = chainDevices.map((chainDevice, deviceIndex) => {
    const devicePath = chainPath ? `${chainPath}/${deviceIndex}` : null;
    return readDeviceFn(chainDevice, {
      includeChains: includeDrumPads && includeChains,
      includeDrumPads: includeDrumPads && includeChains,
      depth: depth + 1,
      maxDepth: maxDepth,
      parentPath: devicePath
    });
  });
  const chainInfo = buildChainInfo(chain, {
    path: chainPath,
    devices: processedDevices
  });
  chainInfo._inNote = inNote;
  chainInfo._hasInstrument = hasInstrumentInDevices(processedDevices);
  return chainInfo;
}

function groupChainsByNote(chains) {
  const noteGroups = new Map;
  for (const chain of chains) {
    const inNote = chain.getProperty("in_note");
    const group = noteGroups.get(inNote);
    if (group) {
      group.push(chain);
    } else {
      noteGroups.set(inNote, [ chain ]);
    }
  }
  return noteGroups;
}

function buildDrumPadFromChains(inNote, processedChains) {
  const firstChain = assertDefined(processedChains[0], "first chain");
  const isCatchAll = inNote === -1;
  const drumPadInfo = {
    note: inNote,
    pitch: isCatchAll ? "*" : midiToNoteName(inNote),
    name: firstChain.name
  };
  const states = new Set(processedChains.map(c => c.state).filter(s => s !== void 0));
  if (states.has(STATE.SOLOED)) {
    drumPadInfo.state = STATE.SOLOED;
  } else if (states.has(STATE.MUTED)) {
    drumPadInfo.state = STATE.MUTED;
  }
  const anyHasInstrument = processedChains.some(c => c._hasInstrument);
  if (!anyHasInstrument) {
    drumPadInfo.hasInstrument = false;
  }
  return drumPadInfo;
}

function updateDrumPadSoloStates(processedDrumPads) {
  const hasSoloedDrumPad = processedDrumPads.some(drumPadInfo => drumPadInfo.state === STATE.SOLOED);
  if (!hasSoloedDrumPad) {
    return;
  }
  for (const drumPadInfo of processedDrumPads) {
    if (drumPadInfo.state === STATE.SOLOED) ; else if (drumPadInfo.state === STATE.MUTED) {
      drumPadInfo.state = STATE.MUTED_ALSO_VIA_SOLO;
    } else {
      drumPadInfo.state ??= STATE.MUTED_VIA_SOLO;
    }
  }
}

function processDrumPads(device, deviceInfo, includeChains, includeDrumPads, depth, maxDepth, readDeviceFn) {
  const chains = device.getChildren("chains");
  const parentPath = extractDevicePath(device.path);
  const noteGroups = groupChainsByNote(chains);
  const processedDrumPads = [];
  for (const [inNote, chainsForNote] of noteGroups) {
    const processedChains = chainsForNote.map((chain, indexWithinNote) => processDrumRackChain(chain, inNote, indexWithinNote, {
      includeDrumPads: includeDrumPads,
      includeChains: includeChains,
      depth: depth,
      maxDepth: maxDepth,
      readDeviceFn: readDeviceFn,
      parentPath: parentPath
    }));
    const drumPadInfo = buildDrumPadFromChains(inNote, processedChains);
    if (includeDrumPads && includeChains) {
      drumPadInfo.chains = processedChains.map(({_inNote: _inNote, _hasInstrument: _hasInstrument, ...chainInfo}) => chainInfo);
    }
    drumPadInfo._processedChains = processedChains;
    processedDrumPads.push(drumPadInfo);
  }
  processedDrumPads.sort((a, b) => {
    const aNote = a.note;
    const bNote = b.note;
    if (aNote === -1 && bNote === -1) return 0;
    if (aNote === -1) return 1;
    if (bNote === -1) return -1;
    return aNote - bNote;
  });
  updateDrumPadSoloStates(processedDrumPads);
  if (includeDrumPads) {
    deviceInfo.drumPads = processedDrumPads.map(({_processedChains: _processedChains, ...drumPadInfo}) => drumPadInfo);
  }
  deviceInfo._processedDrumPads = processedDrumPads;
}

function isRedundantDeviceClassName(deviceType, className) {
  if (deviceType === DEVICE_TYPE.INSTRUMENT_RACK) {
    return className === "Instrument Rack";
  }
  if (deviceType === DEVICE_TYPE.DRUM_RACK) {
    return className === "Drum Rack";
  }
  if (deviceType === DEVICE_TYPE.AUDIO_EFFECT_RACK) {
    return className === "Audio Effect Rack";
  }
  if (deviceType === DEVICE_TYPE.MIDI_EFFECT_RACK) {
    return className === "MIDI Effect Rack";
  }
  return false;
}

function processRegularChains(device, deviceInfo, includeChains, includeDrumPads, depth, maxDepth, readDeviceFn, devicePath) {
  const chains = device.getChildren("chains");
  const hasSoloedChain = chains.some(chain => chain.getProperty("solo") > 0);
  if (includeChains) {
    deviceInfo.chains = chains.map((chain, index) => {
      const chainPath = devicePath ? buildChainPath(devicePath, index) : null;
      const devices = chain.getChildren("devices").map((chainDevice, deviceIndex) => {
        const nestedDevicePath = chainPath ? `${chainPath}/${deviceIndex}` : null;
        return readDeviceFn(chainDevice, {
          includeChains: includeChains,
          includeDrumPads: includeDrumPads,
          depth: depth + 1,
          maxDepth: maxDepth,
          parentPath: nestedDevicePath
        });
      });
      return buildChainInfo(chain, {
        path: chainPath,
        devices: devices
      });
    });
  }
  if (hasSoloedChain) {
    deviceInfo.hasSoloedChain = hasSoloedChain;
  }
}

function processDeviceChains(device, deviceInfo, deviceType, options) {
  const {includeChains: includeChains, includeReturnChains: includeReturnChains, includeDrumPads: includeDrumPads, depth: depth, maxDepth: maxDepth, readDeviceFn: readDeviceFn, devicePath: devicePath} = options;
  const isRack = deviceType.includes("rack");
  if (!isRack) {
    return;
  }
  if (includeChains || includeDrumPads) {
    if (deviceType === DEVICE_TYPE.DRUM_RACK) {
      processDrumPads(device, deviceInfo, includeChains, includeDrumPads, depth, maxDepth, readDeviceFn);
    } else {
      processRegularChains(device, deviceInfo, includeChains, includeDrumPads, depth, maxDepth, readDeviceFn, devicePath);
    }
  }
  if (includeReturnChains) {
    processReturnChains(device, deviceInfo, includeChains, includeReturnChains, depth, maxDepth, readDeviceFn, devicePath);
  }
}

function processReturnChains(device, deviceInfo, includeChains, includeReturnChains, depth, maxDepth, readDeviceFn, devicePath) {
  const returnChains = device.getChildren("return_chains");
  if (returnChains.length === 0) return;
  deviceInfo.returnChains = returnChains.map((chain, index) => {
    const chainPath = devicePath ? buildReturnChainPath(devicePath, index) : null;
    const devices = chain.getChildren("devices").map((d, deviceIndex) => {
      const nestedDevicePath = chainPath ? `${chainPath}/${deviceIndex}` : null;
      return readDeviceFn(d, {
        includeChains: includeChains,
        includeReturnChains: includeReturnChains,
        depth: depth + 1,
        maxDepth: maxDepth,
        parentPath: nestedDevicePath
      });
    });
    return buildChainInfo(chain, {
      path: chainPath,
      devices: devices
    });
  });
}

function readMacroVariations(device) {
  const canHaveChains = device.getProperty("can_have_chains");
  if (!canHaveChains) {
    return {};
  }
  const result = {};
  const variationCount = device.getProperty("variation_count");
  if (variationCount) {
    result.variations = {
      count: variationCount,
      selected: device.getProperty("selected_variation_index")
    };
  }
  const visibleMacroCount = device.getProperty("visible_macro_count");
  if (visibleMacroCount > 0) {
    result.macros = {
      count: visibleMacroCount,
      hasMappings: device.getProperty("has_macro_mappings") > 0
    };
  }
  return result;
}

function readABCompare(device) {
  const canCompareAB = device.getProperty("can_compare_ab");
  if (!canCompareAB) {
    return {};
  }
  const isUsingB = device.getProperty("is_using_compare_preset_b") > 0;
  return {
    abCompare: isUsingB ? "b" : "a"
  };
}

function readDeviceParameters(device, options = {}) {
  const {includeValues: includeValues = false, search: search} = options;
  let parameters = device.getChildren("parameters");
  if (search) {
    const searchLower = search.toLowerCase().trim();
    parameters = parameters.filter(p => {
      const name = p.getProperty("name");
      return name.toLowerCase().includes(searchLower);
    });
  }
  return parameters.map(includeValues ? readParameter : readParameterBasic);
}

function getDeviceType(device) {
  const typeValue = device.getProperty("type");
  const canHaveChains = device.getProperty("can_have_chains");
  const canHaveDrumPads = device.getProperty("can_have_drum_pads");
  if (typeValue === LIVE_API_DEVICE_TYPE_INSTRUMENT) {
    if (canHaveDrumPads) {
      return DEVICE_TYPE.DRUM_RACK;
    }
    if (canHaveChains) {
      return DEVICE_TYPE.INSTRUMENT_RACK;
    }
    return DEVICE_TYPE.INSTRUMENT;
  } else if (typeValue === LIVE_API_DEVICE_TYPE_AUDIO_EFFECT) {
    if (canHaveChains) {
      return DEVICE_TYPE.AUDIO_EFFECT_RACK;
    }
    return DEVICE_TYPE.AUDIO_EFFECT;
  } else if (typeValue === LIVE_API_DEVICE_TYPE_MIDI_EFFECT) {
    if (canHaveChains) {
      return DEVICE_TYPE.MIDI_EFFECT_RACK;
    }
    return DEVICE_TYPE.MIDI_EFFECT;
  }
  return "unknown";
}

function cleanupInternalDrumPads(obj) {
  if (!obj || typeof obj !== "object") {
    return obj;
  }
  if (Array.isArray(obj)) {
    return obj.map(cleanupInternalDrumPads);
  }
  const deviceObj = obj;
  const {_processedDrumPads: _processedDrumPads, chains: chains, ...rest} = deviceObj;
  const result = {
    ...rest
  };
  if (Array.isArray(chains)) {
    result.chains = chains.map(chain => {
      if (typeof chain === "object" && "devices" in chain && chain.devices) {
        return {
          ...chain,
          devices: cleanupInternalDrumPads(chain.devices)
        };
      }
      return chain;
    });
  }
  return result;
}

function getDrumMap(devices) {
  function findDrumRacksInDevices(deviceList) {
    const drumRacks2 = [];
    for (const device of deviceList) {
      if (device.type.startsWith(DEVICE_TYPE.DRUM_RACK) && device._processedDrumPads) {
        drumRacks2.push(device);
      }
      if (device.chains) {
        for (const chain of device.chains) {
          if (chain.devices) {
            drumRacks2.push(...findDrumRacksInDevices(chain.devices));
          }
        }
      }
    }
    return drumRacks2;
  }
  const drumRacks = findDrumRacksInDevices(devices);
  if (drumRacks.length === 0) {
    return null;
  }
  const drumMap = {};
  const firstDrumRack = assertDefined(drumRacks[0], "first drum rack");
  const drumPads = firstDrumRack._processedDrumPads ?? [];
  for (const drumPad of drumPads) {
    if (drumPad.hasInstrument !== false) {
      const noteName = drumPad.pitch;
      drumMap[noteName] = drumPad.name;
    }
  }
  return Object.keys(drumMap).length > 0 ? drumMap : {};
}

function readDevice$1(device, options = {}) {
  const {includeChains: includeChains = true, includeReturnChains: includeReturnChains = false, includeDrumPads: includeDrumPads = false, includeParams: includeParams = false, includeParamValues: includeParamValues = false, paramSearch: paramSearch, depth: depth = 0, maxDepth: maxDepth = 4, parentPath: parentPath} = options;
  if (depth > maxDepth) {
    warn(`Maximum recursion depth (${maxDepth}) exceeded`);
    return {};
  }
  const deviceType = getDeviceType(device);
  const className = device.getProperty("class_display_name");
  const userDisplayName = device.getProperty("name");
  const isRedundant = isRedundantDeviceClassName(deviceType, className);
  const path = parentPath ?? extractDevicePath(device.path);
  const deviceInfo = {
    id: device.id,
    ...path && {
      path: path
    },
    type: isRedundant ? deviceType : `${deviceType}: ${className}`
  };
  if (userDisplayName !== className) {
    deviceInfo.name = userDisplayName;
  }
  const isActive = device.getProperty("is_active") > 0;
  if (!isActive) {
    deviceInfo.deactivated = true;
  }
  const deviceView = LiveAPI.from(`${device.path} view`);
  if (deviceView.exists() && deviceView.getProperty("is_collapsed") > 0) {
    deviceInfo.collapsed = true;
  }
  Object.assign(deviceInfo, readMacroVariations(device));
  Object.assign(deviceInfo, readABCompare(device));
  Object.assign(deviceInfo, readSimplerSample(device, className));
  processDeviceChains(device, deviceInfo, deviceType, {
    includeChains: includeChains,
    includeReturnChains: includeReturnChains,
    includeDrumPads: includeDrumPads,
    depth: depth,
    maxDepth: maxDepth,
    readDeviceFn: readDevice$1,
    devicePath: path ?? void 0
  });
  if (includeParams) {
    deviceInfo.parameters = readDeviceParameters(device, {
      includeValues: includeParamValues,
      search: paramSearch
    });
  }
  return deviceInfo;
}

function readSimplerSample(device, className) {
  if (className !== DEVICE_CLASS.SIMPLER) {
    return {};
  }
  if (device.getProperty("multi_sample_mode") > 0) {
    return {
      multisample: true
    };
  }
  const samples = device.getChildren("sample");
  if (samples.length === 0) {
    return {};
  }
  const firstSample = assertDefined(samples[0], "first sample");
  const samplePath = firstSample.getProperty("file_path");
  return samplePath ? {
    sample: samplePath
  } : {};
}

function readDevice({deviceId: deviceId, path: path, include: include = [ "chains" ], paramSearch: paramSearch}, _context = {}) {
  validateExclusiveParams(deviceId, path, "deviceId", "path");
  const includeChains = include.includes("*") || include.includes("chains");
  const includeReturnChains = include.includes("*") || include.includes("return-chains");
  const includeDrumPads = include.includes("*") || include.includes("drum-pads");
  const includeParamValues = include.includes("*") || include.includes("param-values");
  const includeParams = includeParamValues || include.includes("params");
  const readOptions = {
    includeChains: includeChains,
    includeReturnChains: includeReturnChains,
    includeDrumPads: includeDrumPads,
    includeParams: includeParams,
    includeParamValues: includeParamValues,
    paramSearch: paramSearch
  };
  if (deviceId) {
    return readDeviceById(deviceId, readOptions);
  }
  if (!path) {
    throw new Error("Either deviceId or path must be provided");
  }
  const resolved = resolvePathToLiveApi(path);
  switch (resolved.targetType) {
   case "device":
    return readDeviceByLiveApiPath(resolved.liveApiPath, readOptions);

   case "chain":
   case "return-chain":
    return readChain(resolved.liveApiPath, path, readOptions);

   case "drum-pad":
    return readDrumPadByPath(resolved.liveApiPath, resolved.drumPadNote, resolved.remainingSegments, path, readOptions);
  }
}

function readDeviceById(deviceId, options) {
  const device = LiveAPI.from(`id ${deviceId}`);
  if (!device.exists()) {
    throw new Error(`Device with ID ${deviceId} not found`);
  }
  const deviceInfo = readDevice$1(device, options);
  return cleanupInternalDrumPads(deviceInfo);
}

function readDeviceByLiveApiPath(liveApiPath, options) {
  const device = LiveAPI.from(liveApiPath);
  if (!device.exists()) {
    throw new Error(`Device not found at path: ${liveApiPath}`);
  }
  const deviceInfo = readDevice$1(device, options);
  return cleanupInternalDrumPads(deviceInfo);
}

function readChain(liveApiPath, path, options) {
  const chain = LiveAPI.from(liveApiPath);
  if (!chain.exists()) {
    throw new Error(`Chain not found at path: ${path}`);
  }
  const devices = chain.getChildren("devices").map(device => {
    const deviceInfo = readDevice$1(device, options);
    return cleanupInternalDrumPads(deviceInfo);
  });
  return buildChainInfo(chain, {
    path: path,
    devices: devices
  });
}

function readDrumPadByPath(liveApiPath, drumPadNote, remainingSegments, fullPath, options) {
  const device = LiveAPI.from(liveApiPath);
  if (!device.exists()) {
    throw new Error(`Device not found at path: ${liveApiPath}`);
  }
  const drumPads = device.getChildren("drum_pads");
  const targetMidiNote = noteNameToMidi(drumPadNote);
  if (targetMidiNote == null) {
    throw new Error(`Invalid drum pad note name: ${drumPadNote}`);
  }
  const pad = drumPads.find(p => p.getProperty("note") === targetMidiNote);
  if (!pad) {
    throw new Error(`Drum pad ${drumPadNote} not found`);
  }
  if (remainingSegments.length > 0) {
    return readDrumPadNestedTarget(pad, remainingSegments, fullPath, options);
  }
  return buildDrumPadInfo(pad, fullPath, options);
}

function readDrumPadNestedTarget(pad, remainingSegments, fullPath, options) {
  const chains = pad.getChildren("chains");
  const chainSegment = assertDefined(remainingSegments[0], "chain segment");
  const chainIndex = Number.parseInt(chainSegment.slice(1));
  if (Number.isNaN(chainIndex) || chainIndex < 0 || chainIndex >= chains.length) {
    throw new Error(`Invalid chain index in path: ${fullPath}`);
  }
  const chain = assertDefined(chains[chainIndex], `chain at index ${chainIndex}`);
  if (remainingSegments.length === 1) {
    return readDrumPadChain(chain, fullPath, options);
  }
  const deviceSegment = assertDefined(remainingSegments[1], "device segment");
  const deviceIndex = Number.parseInt(deviceSegment.slice(1));
  const devices = chain.getChildren("devices");
  if (Number.isNaN(deviceIndex) || deviceIndex < 0 || deviceIndex >= devices.length) {
    throw new Error(`Invalid device index in path: ${fullPath}`);
  }
  const device = assertDefined(devices[deviceIndex], `device at index ${deviceIndex}`);
  const deviceInfo = readDevice$1(device, {
    ...options,
    parentPath: fullPath
  });
  return cleanupInternalDrumPads(deviceInfo);
}

function readDrumPadChain(chain, path, options) {
  const devices = chain.getChildren("devices").map((device, index) => {
    const devicePath = `${path}/d${index}`;
    const deviceInfo = readDevice$1(device, {
      ...options,
      parentPath: devicePath
    });
    return cleanupInternalDrumPads(deviceInfo);
  });
  return buildChainInfo(chain, {
    path: path,
    devices: devices
  });
}

function buildDrumPadInfo(pad, path, options) {
  const midiNote = pad.getProperty("note");
  const noteName = midiToNoteName(midiNote);
  if (noteName == null) {
    throw new Error(`Invalid MIDI note from drum pad: ${midiNote}`);
  }
  const isMuted = pad.getProperty("mute") > 0;
  const isSoloed = pad.getProperty("solo") > 0;
  const drumPadInfo = {
    id: pad.id,
    path: path,
    name: pad.getProperty("name"),
    note: midiNote,
    pitch: noteName
  };
  if (isSoloed) {
    drumPadInfo.state = STATE.SOLOED;
  } else if (isMuted) {
    drumPadInfo.state = STATE.MUTED;
  }
  if (options.includeChains || options.includeDrumPads) {
    const chains = pad.getChildren("chains");
    drumPadInfo.chains = chains.map((chain, chainIndex) => {
      const chainPath = `${path}/c${chainIndex}`;
      const devices = chain.getChildren("devices").map((device, deviceIndex) => {
        const devicePath = `${chainPath}/d${deviceIndex}`;
        const deviceInfo = readDevice$1(device, {
          ...options,
          parentPath: devicePath
        });
        return cleanupInternalDrumPads(deviceInfo);
      });
      return buildChainInfo(chain, {
        path: chainPath,
        devices: devices
      });
    });
  }
  return drumPadInfo;
}

function parseDrumPadNoteFromPath(path) {
  const match = path.match(/\/p([A-G][#b]?\d+|\*)(?:\/|$)/);
  return match ? match[1] ?? null : null;
}

function moveDeviceToPath(device, toPath) {
  const {container: container, position: position} = resolveInsertionPath(toPath);
  if (!container?.exists()) {
    warn(`move target at path "${toPath}" does not exist`);
    return;
  }
  const liveSet = LiveAPI.from("live_set");
  const deviceId = device.id.startsWith("id ") ? device.id : `id ${device.id}`;
  const containerId = container.id.startsWith("id ") ? container.id : `id ${container.id}`;
  liveSet.call("move_device", deviceId, containerId, position ?? 0);
}

function moveDrumChainToPath(chain, toPath, moveEntirePad) {
  const targetNote = parseDrumPadNoteFromPath(toPath);
  if (targetNote == null) {
    warn(`toPath "${toPath}" is not a drum pad path`);
    return;
  }
  const targetInNote = targetNote === "*" ? -1 : noteNameToMidi(targetNote);
  if (targetInNote == null) {
    warn(`invalid note "${targetNote}" in toPath`);
    return;
  }
  if (moveEntirePad) {
    const sourceInNote = chain.getProperty("in_note");
    const drumRackPath = chain.path.replace(/ chains \d+$/, "");
    const drumRack = LiveAPI.from(drumRackPath);
    const allChains = drumRack.getChildren("chains");
    for (const c of allChains) {
      if (c.getProperty("in_note") === sourceInNote) {
        c.set("in_note", targetInNote);
      }
    }
  } else {
    chain.set("in_note", targetInNote);
  }
}

function updateCollapsedState(device, collapsed) {
  const deviceView = LiveAPI.from(`${device.path} view`);
  if (deviceView.exists()) {
    deviceView.set("is_collapsed", collapsed ? 1 : 0);
  }
}

function setParamValues(device, paramsJson) {
  const paramValues = JSON.parse(paramsJson);
  for (const [paramId, inputValue] of Object.entries(paramValues)) {
    const param = resolveParamForDevice(device, paramId);
    if (!param?.exists()) {
      warn(`updateDevice: param "${paramId}" not found on device`);
      continue;
    }
    setParamValue(param, inputValue);
  }
}

function resolveParamForDevice(device, paramId) {
  const match = paramId.match(/parameters (\d+)$/);
  if (match) {
    return LiveAPI.from(`${device.path} parameters ${match[1]}`);
  }
  return LiveAPI.from(paramId);
}

function setParamValue(param, inputValue) {
  const isQuantized = param.getProperty("is_quantized") > 0;
  if (isQuantized && typeof inputValue === "string") {
    const valueItems = param.get("value_items");
    const index = valueItems.indexOf(inputValue);
    if (index === -1) {
      warn(`updateDevice: "${inputValue}" is not valid. Options: ${valueItems.join(", ")}`);
      return;
    }
    param.set("value", index);
    return;
  }
  if (typeof inputValue === "string" && isValidNoteName(inputValue)) {
    const midi = noteNameToMidi(inputValue);
    if (midi == null) {
      warn(`updateDevice: invalid note name "${inputValue}"`);
      return;
    }
    param.set("value", midi);
    return;
  }
  const currentValue = param.getProperty("value");
  const currentLabel = param.call("str_for_value", currentValue);
  if (isPanLabel(currentLabel)) {
    const min = param.getProperty("min");
    const max = param.getProperty("max");
    const numValue = inputValue;
    const internalValue = (numValue + 1) / 2 * (max - min) + min;
    param.set("value", internalValue);
    return;
  }
  const minLabel = param.call("str_for_value", param.getProperty("min"));
  if (isDivisionLabel(currentLabel) || isDivisionLabel(minLabel)) {
    const rawValue = findDivisionRawValue(param, inputValue);
    if (rawValue != null) {
      param.set("value", rawValue);
    } else {
      warn(`updateDevice: "${inputValue}" is not a valid division option`);
    }
    return;
  }
  param.set("display_value", inputValue);
}

function findDivisionRawValue(param, inputValue) {
  const min = param.getProperty("min");
  const max = param.getProperty("max");
  const minInt = Math.ceil(Math.min(min, max));
  const maxInt = Math.floor(Math.max(min, max));
  const targetLabel = typeof inputValue === "number" ? String(inputValue) : inputValue;
  for (let i = minInt; i <= maxInt; i++) {
    const label = param.call("str_for_value", i);
    const labelStr = typeof label === "number" ? String(label) : label;
    if (labelStr === targetLabel) {
      return i;
    }
  }
  return null;
}

function updateMacroVariation(device, action, index) {
  const canHaveChains = device.getProperty("can_have_chains");
  if (!canHaveChains) {
    warn("updateDevice: macro variations only available on rack devices");
    return;
  }
  if (!validateMacroVariationParams(action, index)) {
    return;
  }
  warnIfIndexIgnored(action, index);
  if (!setVariationIndex(device, action, index)) {
    return;
  }
  executeMacroVariationAction(device, action);
}

function validateMacroVariationParams(action, index) {
  if (index != null && action == null) {
    warn("updateDevice: macroVariationIndex requires macroVariation 'load' or 'delete'");
    return false;
  }
  if ((action === "load" || action === "delete") && index == null) {
    warn(`updateDevice: macroVariation '${action}' requires macroVariationIndex`);
    return false;
  }
  return true;
}

function warnIfIndexIgnored(action, index) {
  if (index == null) {
    return;
  }
  if (action === "create") {
    warn("updateDevice: macroVariationIndex ignored for 'create' (variations always appended)");
  } else if (action === "revert") {
    warn("updateDevice: macroVariationIndex ignored for 'revert'");
  } else if (action === "randomize") {
    warn("updateDevice: macroVariationIndex ignored for 'randomize'");
  }
}

function setVariationIndex(device, action, index) {
  if (action !== "load" && action !== "delete" || index == null) {
    return true;
  }
  const variationCount = device.getProperty("variation_count");
  if (index >= variationCount) {
    warn(`updateDevice: variation index ${index} out of range (${variationCount} available)`);
    return false;
  }
  device.set("selected_variation_index", index);
  return true;
}

function executeMacroVariationAction(device, action) {
  switch (action) {
   case "create":
    device.call("store_variation");
    break;

   case "load":
    device.call("recall_selected_variation");
    break;

   case "revert":
    device.call("recall_last_used_variation");
    break;

   case "delete":
    device.call("delete_selected_variation");
    break;

   case "randomize":
    device.call("randomize_macros");
    break;
  }
}

function updateMacroCount(device, targetCount) {
  const canHaveChains = device.getProperty("can_have_chains");
  if (!canHaveChains) {
    warn("updateDevice: macro count only available on rack devices");
    return;
  }
  let effectiveTarget = targetCount;
  if (targetCount % 2 !== 0) {
    effectiveTarget = Math.min(targetCount + 1, 16);
    warn(`updateDevice: macro count rounded from ${targetCount} to ${effectiveTarget} (macros come in pairs)`);
  }
  const currentCount = device.getProperty("visible_macro_count");
  const diff = effectiveTarget - currentCount;
  const pairCount = Math.abs(diff) / 2;
  if (diff > 0) {
    for (let i = 0; i < pairCount; i++) {
      device.call("add_macro");
    }
  } else if (diff < 0) {
    for (let i = 0; i < pairCount; i++) {
      device.call("remove_macro");
    }
  }
}

function updateABCompare(device, action) {
  const canCompareAB = device.getProperty("can_compare_ab");
  if (!canCompareAB) {
    warn("updateDevice: A/B Compare not available on this device");
    return;
  }
  switch (action) {
   case "a":
    device.set("is_using_compare_preset_b", 0);
    break;

   case "b":
    device.set("is_using_compare_preset_b", 1);
    break;

   case "save":
    device.call("save_preset_to_compare_ab_slot");
    break;
  }
}

function isValidUpdateType(type) {
  return type.endsWith("Device") || type.endsWith("Chain") || type === "DrumPad";
}

function isDeviceType(type) {
  return type.endsWith("Device");
}

function isRackDevice(type) {
  return type === "RackDevice";
}

function isChainType(type) {
  return type.endsWith("Chain");
}

function warnIfSet(paramName, value, type) {
  if (value != null) {
    warn(`updateDevice: '${paramName}' not applicable to ${type}`);
  }
}

const RACK_TYPE_INSTRUMENT = "instrument-rack";

const RACK_TYPE_TO_DEVICE_NAME = {
  "audio-effect-rack": "Audio Effect Rack",
  "midi-effect-rack": "MIDI Effect Rack",
  [RACK_TYPE_INSTRUMENT]: "Instrument Rack"
};

function wrapDevicesInRack({ids: ids, path: path, toPath: toPath, name: name}) {
  const items = parseCommaSeparatedIds(ids ?? path);
  const isIdBased = ids != null;
  const devices = resolveDevices(items, isIdBased);
  if (devices.length === 0) {
    warn("wrapInRack: no devices found");
    return null;
  }
  const rackType = determineRackType(devices);
  if (rackType == null) {
    return null;
  }
  if (rackType === RACK_TYPE_INSTRUMENT) {
    return wrapInstrumentsInRack(devices, toPath, name);
  }
  const {container: container, position: position} = toPath ? resolveInsertionPath(toPath) : getDeviceInsertionPoint(assertDefined(devices[0], "first device"));
  if (!container?.exists()) {
    warn("wrapInRack: target container does not exist");
    return null;
  }
  const rackName = RACK_TYPE_TO_DEVICE_NAME[rackType];
  const rackId = container.call("insert_device", rackName, position ?? 0);
  const rack = LiveAPI.from(rackId);
  if (name) {
    rack.set("name", name);
  }
  const liveSet = LiveAPI.from("live_set");
  for (let i = 0; i < devices.length; i++) {
    const device = assertDefined(devices[i], `device at index ${i}`);
    const currentChainCount = rack.getChildren("chains").length;
    if (i >= currentChainCount) {
      const chainsNeeded = i + 1 - currentChainCount;
      for (let j = 0; j < chainsNeeded; j++) {
        const result = rack.call("insert_chain");
        if (!Array.isArray(result) || result[0] !== "id") {
          warn(`wrapInRack: failed to create chain ${j + 1}/${chainsNeeded}`);
        }
      }
    }
    const chainPath = `${rack.path} chains ${i}`;
    const chainContainer = LiveAPI.from(chainPath);
    const deviceId = device.id.startsWith("id ") ? device.id : `id ${device.id}`;
    const chainId = chainContainer.id.startsWith("id ") ? chainContainer.id : `id ${chainContainer.id}`;
    liveSet.call("move_device", deviceId, chainId, 0);
  }
  return {
    id: rack.id,
    type: rackType,
    deviceCount: devices.length
  };
}

function resolveDevices(items, isIdBased) {
  const devices = [];
  for (const item of items) {
    const device = isIdBased ? LiveAPI.from(item) : resolveDeviceFromPath(item);
    if (device?.exists()) {
      const type = device.type;
      if (type.endsWith("Device")) {
        devices.push(device);
      } else {
        warn(`wrapInRack: "${item}" is not a device (type: ${type})`);
      }
    } else {
      warn(`wrapInRack: device not found at "${item}"`);
    }
  }
  return devices;
}

function resolveDeviceFromPath(path) {
  const resolved = resolveInsertionPath(path);
  if (!resolved.container) {
    return null;
  }
  if (resolved.position != null) {
    const devicePath = `${resolved.container.path} devices ${resolved.position}`;
    return LiveAPI.from(devicePath);
  }
  return resolved.container;
}

function determineRackType(devices) {
  const types = new Set;
  for (const device of devices) {
    const deviceType = device.getProperty("type");
    types.add(deviceType);
  }
  if (types.has(LIVE_API_DEVICE_TYPE_INSTRUMENT)) {
    return RACK_TYPE_INSTRUMENT;
  }
  if (types.has(LIVE_API_DEVICE_TYPE_AUDIO_EFFECT) && types.has(LIVE_API_DEVICE_TYPE_MIDI_EFFECT)) {
    warn("wrapInRack: cannot mix MIDI and Audio effects in one rack");
    return null;
  }
  if (types.has(LIVE_API_DEVICE_TYPE_AUDIO_EFFECT)) {
    return "audio-effect-rack";
  }
  if (types.has(LIVE_API_DEVICE_TYPE_MIDI_EFFECT)) {
    return "midi-effect-rack";
  }
  warn("wrapInRack: no valid effect devices found");
  return null;
}

function getDeviceInsertionPoint(device) {
  const parentPath = device.path.replace(/ devices \d+$/, "");
  const container = LiveAPI.from(parentPath);
  const match = device.path.match(/ devices (\d+)$/);
  const position = match ? Number.parseInt(match[1]) : 0;
  return {
    container: container,
    position: position
  };
}

function wrapInstrumentsInRack(devices, toPath, name) {
  const liveSet = LiveAPI.from("live_set");
  const firstDevice = assertDefined(devices[0], "first device");
  const {container: sourceContainer, position: devicePosition} = getDeviceInsertionPoint(firstDevice);
  const tempTrackId = liveSet.call("create_midi_track", -1);
  const tempTrack = LiveAPI.from(tempTrackId);
  const tempTrackIndex = tempTrack.trackIndex;
  try {
    const tempTrackIdForMove = formatId(tempTrack.id);
    for (const device of devices) {
      liveSet.call("move_device", formatId(device.id), tempTrackIdForMove, 0);
    }
    const {container: container, position: position} = toPath ? resolveInsertionPath(toPath) : {
      container: sourceContainer,
      position: devicePosition
    };
    if (!container?.exists()) {
      throw new Error(`wrapInRack: target container does not exist`);
    }
    const rackId = container.call("insert_device", "Instrument Rack", position ?? 0);
    const rack = LiveAPI.from(rackId);
    if (name) {
      rack.set("name", name);
    }
    for (let i = devices.length - 1; i >= 0; i--) {
      rack.call("insert_chain");
      const chainIndex = rack.getChildren("chains").length - 1;
      const chain = LiveAPI.from(`${rack.path} chains ${chainIndex}`);
      const tempDevice = LiveAPI.from(`${tempTrack.path} devices 0`);
      liveSet.call("move_device", formatId(tempDevice.id), formatId(chain.id), 0);
    }
    liveSet.call("delete_track", tempTrackIndex);
    return {
      id: rack.id,
      type: RACK_TYPE_INSTRUMENT,
      deviceCount: devices.length
    };
  } catch (error) {
    try {
      liveSet.call("delete_track", tempTrackIndex);
    } catch {}
    throw error;
  }
}

function formatId(id) {
  return id.startsWith("id ") ? id : `id ${id}`;
}

function updateDevice({ids: ids, path: path, toPath: toPath, name: name, collapsed: collapsed, params: params, macroVariation: macroVariation, macroVariationIndex: macroVariationIndex, macroCount: macroCount, abCompare: abCompare, mute: mute, solo: solo, color: color, chokeGroup: chokeGroup, mappedPitch: mappedPitch, wrapInRack: wrapInRack}, _context = {}) {
  validateExclusiveParams(ids, path, "ids", "path");
  if (wrapInRack) {
    return wrapDevicesInRack({
      ids: ids,
      path: path,
      toPath: toPath,
      name: name
    });
  }
  const updateOptions = {
    toPath: toPath,
    name: name,
    collapsed: collapsed,
    params: params,
    macroVariation: macroVariation,
    macroVariationIndex: macroVariationIndex,
    macroCount: macroCount,
    abCompare: abCompare,
    mute: mute,
    solo: solo,
    color: color,
    chokeGroup: chokeGroup,
    mappedPitch: mappedPitch
  };
  if (path) {
    return updateMultipleTargets(parseCommaSeparatedIds(path), resolvePathToTargetSafe, "path", updateOptions);
  }
  return updateMultipleTargets(parseCommaSeparatedIds(ids), resolveIdToTarget, "id", updateOptions);
}

function updateMultipleTargets(items, resolveItem, itemType, updateOptions) {
  const results = [];
  for (const item of items) {
    const resolved = resolveItem(item);
    if (!resolved) {
      warn(`updateDevice: target not found at ${itemType} "${item}"`);
      continue;
    }
    const optionsWithMetadata = {
      ...updateOptions,
      isDrumPadPath: resolved.isDrumPadPath
    };
    const result = updateTarget(resolved.target, optionsWithMetadata);
    if (result) {
      results.push(result);
    }
  }
  return unwrapSingleResult(results);
}

function resolveIdToTarget(id) {
  const target = LiveAPI.from(id);
  return target.exists() ? {
    target: target
  } : null;
}

function resolvePathToTargetSafe(path) {
  try {
    return resolvePathToTarget(path);
  } catch (e) {
    warn(`updateDevice: ${errorMessage(e)}`);
    return null;
  }
}

function resolvePathToTarget(path) {
  const resolved = resolvePathToLiveApi(path);
  switch (resolved.targetType) {
   case "device":
   case "chain":
   case "return-chain":
    {
      const target = resolveTargetFromPath(resolved.liveApiPath);
      return target ? {
        target: target
      } : null;
    }

   case "drum-pad":
    {
      const drumPadNote = resolved.drumPadNote;
      const {remainingSegments: remainingSegments} = resolved;
      const drumPadResult = resolveDrumPadFromPath(resolved.liveApiPath, drumPadNote, remainingSegments);
      if (!drumPadResult.target) {
        return null;
      }
      const hasExplicitChainIndex = remainingSegments.length > 0 && remainingSegments[0].startsWith("c");
      return {
        target: drumPadResult.target,
        isDrumPadPath: !hasExplicitChainIndex
      };
    }
  }
}

function resolveTargetFromPath(liveApiPath) {
  const target = LiveAPI.from(liveApiPath);
  return target.exists() ? target : null;
}

function updateTarget(target, options) {
  const type = target.type;
  if (!isValidUpdateType(type)) {
    warn(`cannot update ${type} objects`);
    return null;
  }
  if (options.toPath != null) {
    if (isDeviceType(type)) {
      moveDeviceToPath(target, options.toPath);
    } else if (type === "DrumChain") {
      moveDrumChainToPath(target, options.toPath, Boolean(options.isDrumPadPath));
    } else {
      warn(`cannot move ${type}`);
    }
  }
  if (options.name != null) {
    if (type === "DrumPad") {
      warn("updateDevice: 'name' is read-only for DrumPad");
    } else {
      target.set("name", options.name);
    }
  }
  if (isDeviceType(type)) {
    updateDeviceProperties(target, type, options);
  } else {
    updateNonDeviceProperties(target, type, options);
  }
  return {
    id: target.id
  };
}

function updateDeviceProperties(target, type, options) {
  const {collapsed: collapsed, params: params, macroVariation: macroVariation, macroVariationIndex: macroVariationIndex, macroCount: macroCount, abCompare: abCompare, mute: mute, solo: solo, color: color, chokeGroup: chokeGroup, mappedPitch: mappedPitch} = options;
  if (collapsed != null) {
    updateCollapsedState(target, collapsed);
  }
  if (params != null) {
    setParamValues(target, params);
  }
  if (abCompare != null) {
    updateABCompare(target, abCompare);
  }
  if (isRackDevice(type)) {
    if (macroVariation != null || macroVariationIndex != null) {
      updateMacroVariation(target, macroVariation, macroVariationIndex);
    }
    if (macroCount != null) {
      updateMacroCount(target, macroCount);
    }
  } else {
    warnIfSet("macroVariation", macroVariation, type);
    warnIfSet("macroVariationIndex", macroVariationIndex, type);
    warnIfSet("macroCount", macroCount, type);
  }
  warnIfSet("mute", mute, type);
  warnIfSet("solo", solo, type);
  warnIfSet("color", color, type);
  warnIfSet("chokeGroup", chokeGroup, type);
  warnIfSet("mappedPitch", mappedPitch, type);
}

function updateNonDeviceProperties(target, type, options) {
  const {collapsed: collapsed, params: params, macroVariation: macroVariation, macroVariationIndex: macroVariationIndex, macroCount: macroCount, abCompare: abCompare, mute: mute, solo: solo, color: color, chokeGroup: chokeGroup, mappedPitch: mappedPitch} = options;
  warnIfSet("collapsed", collapsed, type);
  warnIfSet("params", params, type);
  warnIfSet("macroVariation", macroVariation, type);
  warnIfSet("macroVariationIndex", macroVariationIndex, type);
  warnIfSet("macroCount", macroCount, type);
  warnIfSet("abCompare", abCompare, type);
  if (mute != null) {
    target.set("mute", mute ? 1 : 0);
  }
  if (solo != null) {
    target.set("solo", solo ? 1 : 0);
  }
  if (isChainType(type)) {
    if (color != null) {
      target.setColor(color);
    }
  } else {
    warnIfSet("color", color, type);
  }
  if (type === "DrumChain") {
    if (chokeGroup != null) {
      target.set("choke_group", chokeGroup);
    }
    if (mappedPitch != null) {
      const midiNote = noteNameToMidi(mappedPitch);
      if (midiNote != null) {
        target.set("out_note", midiNote);
      } else {
        warn(`updateDevice: invalid note name "${mappedPitch}"`);
      }
    }
  } else {
    warnIfSet("chokeGroup", chokeGroup, type);
    warnIfSet("mappedPitch", mappedPitch, type);
  }
}

function readScene(args = {}, _context = {}) {
  const {sceneIndex: sceneIndex, sceneId: sceneId} = args;
  if (sceneId == null && sceneIndex == null) {
    throw new Error("Either sceneId or sceneIndex must be provided");
  }
  const {includeClips: includeClips, includeColor: includeColor} = parseIncludeArray(args.include, READ_SCENE_DEFAULTS);
  const liveSet = LiveAPI.from(`live_set`);
  let scene;
  let resolvedSceneIndex = sceneIndex;
  if (sceneId != null) {
    scene = validateIdType(sceneId, "scene", "readScene");
    resolvedSceneIndex = scene.sceneIndex;
  } else {
    scene = LiveAPI.from(`live_set scenes ${sceneIndex}`);
  }
  if (!scene.exists()) {
    throw new Error(`readScene: sceneIndex ${sceneIndex} does not exist`);
  }
  const isTempoEnabled = scene.getProperty("tempo_enabled") > 0;
  const isTimeSignatureEnabled = scene.getProperty("time_signature_enabled") > 0;
  const sceneName = scene.getProperty("name");
  const sceneNum = resolvedSceneIndex;
  const result = {
    id: scene.id,
    name: sceneName ? `${sceneName} (${sceneNum + 1})` : `${sceneNum + 1}`,
    sceneIndex: resolvedSceneIndex,
    ...includeColor && {
      color: scene.getColor()
    }
  };
  if (isTempoEnabled) {
    result.tempo = scene.getProperty("tempo");
  }
  if (isTimeSignatureEnabled) {
    result.timeSignature = scene.timeSignature;
  }
  const isTriggered = scene.getProperty("is_triggered") > 0;
  if (isTriggered) {
    result.triggered = true;
  }
  if (includeClips) {
    result.clips = liveSet.getChildIds("tracks").map((_trackId, trackIndex) => readClip({
      trackIndex: trackIndex,
      sceneIndex: resolvedSceneIndex,
      include: args.include
    })).filter(clip => clip.id != null);
  } else {
    result.clipCount = liveSet.getChildIds("tracks").map((_trackId, trackIndex) => readClip({
      trackIndex: trackIndex,
      sceneIndex: resolvedSceneIndex,
      include: []
    })).filter(clip => clip.id != null).length;
  }
  return result;
}

function processCurrentRouting(track, category, isGroup, canBeArmed) {
  if (category === "master") {
    return {
      inputRoutingType: null,
      inputRoutingChannel: null,
      outputRoutingType: null,
      outputRoutingChannel: null
    };
  }
  const result = {};
  if (!isGroup && category === "regular") {
    const inputType = track.getProperty("input_routing_type");
    result.inputRoutingType = inputType ? {
      name: inputType.display_name,
      inputId: String(inputType.identifier)
    } : null;
    const inputChannel = track.getProperty("input_routing_channel");
    result.inputRoutingChannel = inputChannel ? {
      name: inputChannel.display_name,
      inputId: String(inputChannel.identifier)
    } : null;
  } else if (category === "return") {
    result.inputRoutingType = null;
    result.inputRoutingChannel = null;
  }
  const outputType = track.getProperty("output_routing_type");
  result.outputRoutingType = outputType ? {
    name: outputType.display_name,
    outputId: String(outputType.identifier)
  } : null;
  const outputChannel = track.getProperty("output_routing_channel");
  result.outputRoutingChannel = outputChannel ? {
    name: outputChannel.display_name,
    outputId: String(outputChannel.identifier)
  } : null;
  if (canBeArmed) {
    const monitoringStateValue = track.getProperty("current_monitoring_state");
    result.monitoringState = {
      [LIVE_API_MONITORING_STATE_IN]: MONITORING_STATE.IN,
      [LIVE_API_MONITORING_STATE_AUTO]: MONITORING_STATE.AUTO,
      [LIVE_API_MONITORING_STATE_OFF]: MONITORING_STATE.OFF
    }[monitoringStateValue] ?? "unknown";
  }
  return result;
}

function processAvailableRouting(track, category, isGroup) {
  if (category === "master") {
    return {
      availableInputRoutingTypes: [],
      availableInputRoutingChannels: [],
      availableOutputRoutingTypes: [],
      availableOutputRoutingChannels: []
    };
  }
  const result = {};
  if (!isGroup && category === "regular") {
    const availableInputTypes = track.getProperty("available_input_routing_types") ?? [];
    result.availableInputRoutingTypes = availableInputTypes.map(type => ({
      name: type.display_name,
      inputId: String(type.identifier)
    }));
    const availableInputChannels = track.getProperty("available_input_routing_channels") ?? [];
    result.availableInputRoutingChannels = availableInputChannels.map(ch => ({
      name: ch.display_name,
      inputId: String(ch.identifier)
    }));
  } else if (category === "return") {
    result.availableInputRoutingTypes = [];
    result.availableInputRoutingChannels = [];
  }
  const availableOutputTypes = track.getProperty("available_output_routing_types") ?? [];
  result.availableOutputRoutingTypes = availableOutputTypes.map(type => ({
    name: type.display_name,
    outputId: String(type.identifier)
  }));
  const availableOutputChannels = track.getProperty("available_output_routing_channels") ?? [];
  result.availableOutputRoutingChannels = availableOutputChannels.map(ch => ({
    name: ch.display_name,
    outputId: String(ch.identifier)
  }));
  return result;
}

function readSessionClips(track, trackIndex, include) {
  return track.getChildIds("clip_slots").map((_clipSlotId, sceneIndex) => readClip({
    trackIndex: trackIndex,
    sceneIndex: sceneIndex,
    ...include && {
      include: include
    }
  })).filter(clip => clip.id != null);
}

function countSessionClips(track, trackIndex) {
  return track.getChildIds("clip_slots").map((_clipSlotId, sceneIndex) => {
    const clip = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex} clip`);
    return clip.exists() ? clip : null;
  }).filter(Boolean).length;
}

function readArrangementClips(track, include) {
  return track.getChildIds("arrangement_clips").map(clipId => readClip({
    clipId: clipId,
    ...include && {
      include: include
    }
  })).filter(clip => clip.id != null);
}

function countArrangementClips(track) {
  return track.getChildIds("arrangement_clips").length;
}

function readTrackMinimal({trackIndex: trackIndex, includeFlags: includeFlags}) {
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  if (!track.exists()) {
    throw new Error(`readTrack: trackIndex ${trackIndex} does not exist`);
  }
  const isMidiTrack = track.getProperty("has_midi_input") > 0;
  const result = {
    id: track.id,
    type: isMidiTrack ? "midi" : "audio",
    trackIndex: trackIndex
  };
  if (includeFlags.includeSessionClips || includeFlags.includeAllClips) {
    result.sessionClips = readSessionClips(track, trackIndex);
  } else {
    result.sessionClipCount = countSessionClips(track, trackIndex);
  }
  const isGroup = track.getProperty("is_foldable") > 0;
  if (isGroup) {
    if (includeFlags.includeArrangementClips || includeFlags.includeAllClips) {
      result.arrangementClips = [];
    } else {
      result.arrangementClipCount = 0;
    }
  } else if (includeFlags.includeArrangementClips || includeFlags.includeAllClips) {
    result.arrangementClips = readArrangementClips(track);
  } else {
    result.arrangementClipCount = countArrangementClips(track);
  }
  return result;
}

function handleNonExistentTrack(category, trackIndex) {
  const indexType = category === "return" ? "returnTrackIndex" : "trackIndex";
  throw new Error(`readTrack: ${indexType} ${trackIndex} does not exist`);
}

function addOptionalBooleanProperties(result, track, canBeArmed) {
  const isArmed = canBeArmed ? track.getProperty("arm") > 0 : false;
  if (isArmed) {
    result.isArmed = isArmed;
  }
  const isGroup = track.getProperty("is_foldable") > 0;
  if (isGroup) {
    result.isGroup = isGroup;
  }
  const isGroupMember = track.getProperty("is_grouped") > 0;
  if (isGroupMember) {
    result.isGroupMember = isGroupMember;
  }
}

function addCategoryIndex(result, category, trackIndex) {
  if (category === "regular") {
    result.trackIndex = trackIndex;
  } else if (category === "return") {
    result.returnTrackIndex = trackIndex;
  }
}

function cleanupDeviceChains(result) {
  if (result.midiEffects) {
    result.midiEffects = cleanupInternalDrumPads(result.midiEffects);
  }
  if (result.instrument) {
    result.instrument = cleanupInternalDrumPads(result.instrument);
  }
  if (result.audioEffects) {
    result.audioEffects = cleanupInternalDrumPads(result.audioEffects);
  }
}

function addSlotIndices(result, track, category) {
  if (category !== "regular") {
    return;
  }
  const playingSlotIndex = track.getProperty("playing_slot_index");
  if (playingSlotIndex >= 0) {
    result.playingSlotIndex = playingSlotIndex;
  }
  const firedSlotIndex = track.getProperty("fired_slot_index");
  if (firedSlotIndex >= 0) {
    result.firedSlotIndex = firedSlotIndex;
  }
}

function addStateIfNotDefault(result, track, category) {
  const trackState = computeState(track, category);
  if (trackState !== STATE.ACTIVE) {
    result.state = trackState;
  }
}

function addRoutingInfo(result, track, category, isGroup, canBeArmed, includeRoutings, includeAvailableRoutings) {
  if (includeRoutings) {
    Object.assign(result, processCurrentRouting(track, category, isGroup, canBeArmed));
  }
  if (includeAvailableRoutings) {
    Object.assign(result, processAvailableRouting(track, category, isGroup));
  }
}

function addProducerPalHostInfo(result, isProducerPalHost) {
  if (isProducerPalHost) {
    result.hasProducerPalDevice = true;
    result.producerPalVersion = VERSION;
  }
}

function readMixerProperties(track, returnTrackNames) {
  const mixer = LiveAPI.from(track.path + " mixer_device");
  if (!mixer.exists()) {
    return {};
  }
  const result = {};
  const volume = LiveAPI.from(mixer.path + " volume");
  if (volume.exists()) {
    result.gainDb = volume.getProperty("display_value");
  }
  const panningMode = mixer.getProperty("panning_mode");
  const isSplitMode = panningMode === 1;
  result.panningMode = isSplitMode ? "split" : "stereo";
  if (isSplitMode) {
    const leftSplit = LiveAPI.from(mixer.path + " left_split_stereo");
    const rightSplit = LiveAPI.from(mixer.path + " right_split_stereo");
    if (leftSplit.exists()) {
      result.leftPan = leftSplit.getProperty("value");
    }
    if (rightSplit.exists()) {
      result.rightPan = rightSplit.getProperty("value");
    }
  } else {
    const panning = LiveAPI.from(mixer.path + " panning");
    if (panning.exists()) {
      result.pan = panning.getProperty("value");
    }
  }
  const sends = mixer.getChildren("sends");
  if (sends.length > 0) {
    let names = returnTrackNames;
    if (!names) {
      const liveSet = LiveAPI.from("live_set");
      const returnTrackIds = liveSet.getChildIds("return_tracks");
      names = returnTrackIds.map((_, idx) => {
        const rt = LiveAPI.from(`live_set return_tracks ${idx}`);
        return rt.getProperty("name");
      });
    }
    if (sends.length !== names.length) {
      warn(`Send count (${sends.length}) doesn't match return track count (${names.length})`);
    }
    result.sends = sends.map((send, i) => ({
      gainDb: send.getProperty("display_value"),
      return: names[i] ?? `Return ${i + 1}`
    }));
  }
  return result;
}

function getHostTrackIndex() {
  try {
    const device = LiveAPI.from("this_device");
    return device.trackIndex;
  } catch {
    return null;
  }
}

function categorizeDevices(devices, includeDrumPads = false, includeRackChains = true, includeReturnChains = false) {
  const midiEffects = [];
  const instruments = [];
  const audioEffects = [];
  for (const device of devices) {
    const processedDevice = readDevice$1(device, {
      includeChains: includeRackChains,
      includeReturnChains: includeReturnChains,
      includeDrumPads: includeDrumPads
    });
    const deviceType = processedDevice.type;
    if (deviceType.startsWith(DEVICE_TYPE.MIDI_EFFECT) || deviceType.startsWith(DEVICE_TYPE.MIDI_EFFECT_RACK)) {
      midiEffects.push(processedDevice);
    } else if (deviceType.startsWith(DEVICE_TYPE.INSTRUMENT) || deviceType.startsWith(DEVICE_TYPE.INSTRUMENT_RACK) || deviceType.startsWith(DEVICE_TYPE.DRUM_RACK)) {
      instruments.push(processedDevice);
    } else if (deviceType.startsWith(DEVICE_TYPE.AUDIO_EFFECT) || deviceType.startsWith(DEVICE_TYPE.AUDIO_EFFECT_RACK)) {
      audioEffects.push(processedDevice);
    }
  }
  if (instruments.length > 1) {
    warn(`Track has ${instruments.length} instruments, which is unusual. Expected 0 or 1.`);
  }
  return {
    midiEffects: midiEffects,
    instrument: instruments.length > 0 ? instruments[0] ?? null : null,
    audioEffects: audioEffects
  };
}

function stripChains(device) {
  const {chains: _chains, ...rest} = device;
  return rest;
}

function readTrack(args = {}, _context = {}) {
  const {trackIndex: trackIndex, trackId: trackId, category: category = "regular", returnTrackNames: returnTrackNames} = args;
  if (trackId == null && trackIndex == null && category !== "master") {
    throw new Error("Either trackId or trackIndex must be provided");
  }
  let track;
  let resolvedTrackIndex = trackIndex;
  let resolvedCategory = category;
  if (trackId != null) {
    track = validateIdType(trackId, "track", "readTrack");
    resolvedCategory = track.category ?? "regular";
    resolvedTrackIndex = track.trackIndex ?? track.returnTrackIndex ?? null;
  } else {
    let trackPath;
    if (category === "regular") {
      trackPath = `live_set tracks ${trackIndex}`;
    } else if (category === "return") {
      trackPath = `live_set return_tracks ${trackIndex}`;
    } else if (category === "master") {
      trackPath = "live_set master_track";
    } else {
      throw new Error(`Invalid category: ${category}. Must be "regular", "return", or "master".`);
    }
    track = LiveAPI.from(trackPath);
  }
  return readTrackGeneric({
    track: track,
    trackIndex: resolvedCategory === "master" ? null : resolvedTrackIndex ?? null,
    category: resolvedCategory,
    include: args.include,
    returnTrackNames: returnTrackNames
  });
}

function processSessionClips(track, category, trackIndex, includeSessionClips, include) {
  if (category !== "regular") {
    return includeSessionClips ? {
      sessionClips: []
    } : {
      sessionClipCount: 0
    };
  }
  if (includeSessionClips) {
    return {
      sessionClips: readSessionClips(track, trackIndex, include)
    };
  }
  return {
    sessionClipCount: countSessionClips(track, trackIndex)
  };
}

function processArrangementClips(track, isGroup, category, includeArrangementClips, include) {
  if (isGroup || category === "return" || category === "master") {
    return includeArrangementClips ? {
      arrangementClips: []
    } : {
      arrangementClipCount: 0
    };
  }
  if (includeArrangementClips) {
    return {
      arrangementClips: readArrangementClips(track, include)
    };
  }
  return {
    arrangementClipCount: countArrangementClips(track)
  };
}

function processDevices(categorizedDevices, config) {
  const {includeMidiEffects: includeMidiEffects, includeInstruments: includeInstruments, includeAudioEffects: includeAudioEffects, includeDrumMaps: includeDrumMaps, includeRackChains: includeRackChains, isProducerPalHost: isProducerPalHost} = config;
  const result = {};
  const shouldFetchChainsForDrumMaps = includeDrumMaps && !includeRackChains;
  if (includeMidiEffects) {
    result.midiEffects = shouldFetchChainsForDrumMaps ? categorizedDevices.midiEffects.map(stripChains) : categorizedDevices.midiEffects;
  }
  if (includeInstruments && !(isProducerPalHost && categorizedDevices.instrument === null)) {
    result.instrument = shouldFetchChainsForDrumMaps && categorizedDevices.instrument ? stripChains(categorizedDevices.instrument) : categorizedDevices.instrument;
  }
  if (includeAudioEffects) {
    result.audioEffects = shouldFetchChainsForDrumMaps ? categorizedDevices.audioEffects.map(stripChains) : categorizedDevices.audioEffects;
  }
  if (includeDrumMaps) {
    const allDevices = [ ...categorizedDevices.midiEffects, ...categorizedDevices.instrument ? [ categorizedDevices.instrument ] : [], ...categorizedDevices.audioEffects ];
    const drumMap = getDrumMap(allDevices);
    if (drumMap != null) {
      result.drumMap = drumMap;
    }
  }
  return result;
}

function readTrackGeneric({track: track, trackIndex: trackIndex, category: category = "regular", include: include, returnTrackNames: returnTrackNames}) {
  const {includeDrumPads: includeDrumPads, includeDrumMaps: includeDrumMaps, includeRackChains: includeRackChains, includeReturnChains: includeReturnChains, includeMidiEffects: includeMidiEffects, includeInstruments: includeInstruments, includeAudioEffects: includeAudioEffects, includeRoutings: includeRoutings, includeAvailableRoutings: includeAvailableRoutings, includeSessionClips: includeSessionClips, includeArrangementClips: includeArrangementClips, includeColor: includeColor, includeMixer: includeMixer} = parseIncludeArray(include, READ_TRACK_DEFAULTS);
  if (!track.exists()) {
    return handleNonExistentTrack(category, trackIndex);
  }
  const groupId = track.get("group_track")[1];
  const isMidiTrack = track.getProperty("has_midi_input") > 0;
  const isProducerPalHost = category === "regular" && trackIndex === getHostTrackIndex();
  const trackDevices = track.getChildren("devices");
  const canBeArmed = track.getProperty("can_be_armed") > 0;
  const isGroup = track.getProperty("is_foldable") > 0;
  const result = {
    id: track.id,
    type: isMidiTrack ? "midi" : "audio",
    name: track.getProperty("name"),
    ...includeColor && {
      color: track.getColor()
    },
    arrangementFollower: track.getProperty("back_to_arranger") === 0
  };
  addOptionalBooleanProperties(result, track, canBeArmed);
  if (includeMixer) {
    Object.assign(result, readMixerProperties(track, returnTrackNames));
  }
  if (groupId) {
    result.groupId = String(groupId);
  }
  addCategoryIndex(result, category, trackIndex);
  Object.assign(result, processSessionClips(track, category, trackIndex, includeSessionClips, include));
  Object.assign(result, processArrangementClips(track, isGroup, category, includeArrangementClips, include));
  const shouldFetchChainsForDrumMaps = includeDrumMaps && !includeRackChains;
  const categorizedDevices = categorizeDevices(trackDevices, includeDrumPads, shouldFetchChainsForDrumMaps ? true : includeRackChains, includeReturnChains);
  const deviceResults = processDevices(categorizedDevices, {
    includeMidiEffects: includeMidiEffects,
    includeInstruments: includeInstruments,
    includeAudioEffects: includeAudioEffects,
    includeDrumMaps: includeDrumMaps,
    includeRackChains: includeRackChains,
    isProducerPalHost: isProducerPalHost
  });
  Object.assign(result, deviceResults);
  cleanupDeviceChains(result);
  addSlotIndices(result, track, category);
  addStateIfNotDefault(result, track, category);
  addRoutingInfo(result, track, category, isGroup, canBeArmed, includeRoutings, includeAvailableRoutings);
  addProducerPalHostInfo(result, isProducerPalHost);
  return result;
}

function readLiveSet(args = {}, _context = {}) {
  const includeFlags = parseIncludeArray(args.include, READ_SONG_DEFAULTS);
  const includeArray = includeArrayFromFlags(includeFlags);
  const liveSet = LiveAPI.from("live_set");
  const trackIds = liveSet.getChildIds("tracks");
  const returnTrackIds = liveSet.getChildIds("return_tracks");
  const sceneIds = liveSet.getChildIds("scenes");
  const returnTrackNames = returnTrackIds.map((_, idx) => {
    const rt = LiveAPI.from(`live_set return_tracks ${idx}`);
    return rt.getProperty("name");
  });
  const liveSetName = liveSet.getProperty("name");
  const result = {
    id: liveSet.id,
    ...liveSetName ? {
      name: liveSetName
    } : {},
    tempo: liveSet.getProperty("tempo"),
    timeSignature: liveSet.timeSignature
  };
  if (includeFlags.includeScenes) {
    result.scenes = sceneIds.map((_sceneId, sceneIndex) => readScene({
      sceneIndex: sceneIndex,
      include: includeArray
    }));
  } else {
    result.sceneCount = sceneIds.length;
  }
  const isPlaying = liveSet.getProperty("is_playing") > 0;
  if (isPlaying) {
    result.isPlaying = isPlaying;
  }
  if (includeFlags.includeRegularTracks) {
    result.tracks = trackIds.map((_trackId, trackIndex) => readTrack({
      trackIndex: trackIndex,
      include: includeArray,
      returnTrackNames: returnTrackNames
    }));
  } else if (includeFlags.includeSessionClips || includeFlags.includeArrangementClips) {
    result.tracks = trackIds.map((_trackId, trackIndex) => readTrackMinimal({
      trackIndex: trackIndex,
      includeFlags: includeFlags
    }));
  }
  if (includeFlags.includeReturnTracks) {
    result.returnTracks = returnTrackIds.map((_returnTrackId, returnTrackIndex) => {
      const returnTrack = LiveAPI.from(`live_set return_tracks ${returnTrackIndex}`);
      return readTrackGeneric({
        track: returnTrack,
        trackIndex: returnTrackIndex,
        category: "return",
        include: includeArray,
        returnTrackNames: returnTrackNames
      });
    });
  }
  if (includeFlags.includeMasterTrack) {
    const masterTrack = LiveAPI.from("live_set master_track");
    result.masterTrack = readTrackGeneric({
      track: masterTrack,
      trackIndex: null,
      category: "master",
      include: includeArray,
      returnTrackNames: returnTrackNames
    });
  }
  const scaleEnabled = liveSet.getProperty("scale_mode") > 0;
  if (scaleEnabled) {
    const scaleName = liveSet.getProperty("scale_name");
    const rootNote = liveSet.getProperty("root_note");
    const scaleRoot = PITCH_CLASS_NAMES[rootNote];
    result.scale = `${scaleRoot} ${String(scaleName)}`;
    const scaleIntervals = liveSet.getProperty("scale_intervals");
    result.scalePitches = intervalsToPitchClasses(scaleIntervals, rootNote).join(",");
  }
  if (includeFlags.includeLocators) {
    const timeSigNumerator = liveSet.getProperty("signature_numerator");
    const timeSigDenominator = liveSet.getProperty("signature_denominator");
    result.locators = readLocators(liveSet, timeSigNumerator, timeSigDenominator);
  }
  return result;
}

const VALID_PITCH_CLASS_NAMES_LOWERCASE = VALID_PITCH_CLASS_NAMES.map(name => name.toLowerCase());

const VALID_SCALE_NAMES_LOWERCASE = VALID_SCALE_NAMES.map(name => name.toLowerCase());

function extendSongIfNeeded(liveSet, targetBeats, context) {
  const songLength = liveSet.get("song_length")[0];
  if (targetBeats <= songLength) {
    return null;
  }
  const trackIds = liveSet.getChildIds("tracks");
  let selectedTrack = null;
  let isMidiTrack = false;
  for (const trackId of trackIds) {
    const track = LiveAPI.from(trackId);
    if (track.getProperty("has_midi_input") > 0) {
      selectedTrack = track;
      isMidiTrack = true;
      break;
    }
    selectedTrack ??= track;
  }
  if (!selectedTrack) {
    throw new Error(`Cannot create locator past song end: no tracks available to extend song`);
  }
  if (isMidiTrack) {
    const tempClipResult = selectedTrack.call("create_midi_clip", targetBeats, 1);
    const tempClip = LiveAPI.from(tempClipResult);
    return {
      track: selectedTrack,
      clipId: tempClip.id,
      isMidiTrack: true
    };
  }
  if (!context.silenceWavPath) {
    throw new Error(`Cannot create locator past song end: no MIDI tracks and silenceWavPath not available`);
  }
  const {clip: sessionClip, slot: slot} = createAudioClipInSession(selectedTrack, 1, context.silenceWavPath);
  const arrangementClipResult = selectedTrack.call("duplicate_clip_to_arrangement", `id ${sessionClip.id}`, targetBeats);
  const arrangementClip = LiveAPI.from(arrangementClipResult);
  return {
    track: selectedTrack,
    clipId: arrangementClip.id,
    isMidiTrack: false,
    slot: slot
  };
}

function cleanupTempClip(tempClipInfo) {
  if (!tempClipInfo) {
    return;
  }
  const {track: track, clipId: clipId, isMidiTrack: isMidiTrack, slot: slot} = tempClipInfo;
  track.call("delete_clip", `id ${clipId}`);
  if (!isMidiTrack && slot) {
    slot.call("delete_clip");
  }
}

function parseScale(scaleString) {
  const trimmed = scaleString.trim();
  const parts = trimmed.split(/\s+/);
  if (parts.length < 2) {
    throw new Error(`Scale must be in format 'Root ScaleName' (e.g., 'C Major'), got: ${scaleString}`);
  }
  const scaleRoot = parts[0];
  const scaleNameParts = parts.slice(1);
  const scaleName = scaleNameParts.join(" ");
  const scaleRootLower = scaleRoot.toLowerCase();
  const scaleNameLower = scaleName.toLowerCase();
  const scaleRootIndex = VALID_PITCH_CLASS_NAMES_LOWERCASE.indexOf(scaleRootLower);
  if (scaleRootIndex === -1) {
    throw new Error(`Invalid scale root '${scaleRoot}'. Valid roots: ${VALID_PITCH_CLASS_NAMES.join(", ")}`);
  }
  const scaleNameIndex = VALID_SCALE_NAMES_LOWERCASE.indexOf(scaleNameLower);
  if (scaleNameIndex === -1) {
    throw new Error(`Invalid scale name '${scaleName}'. Valid scales: ${VALID_SCALE_NAMES.join(", ")}`);
  }
  return {
    scaleRoot: VALID_PITCH_CLASS_NAMES[scaleRootIndex],
    scaleName: VALID_SCALE_NAMES[scaleNameIndex]
  };
}

function applyTempo(liveSet, tempo, result) {
  if (tempo < 20 || tempo > 999) {
    warn("tempo must be between 20.0 and 999.0 BPM");
    return;
  }
  liveSet.set("tempo", tempo);
  result.tempo = tempo;
}

function applyScale(liveSet, scale, result) {
  if (scale === "") {
    liveSet.set("scale_mode", 0);
    result.scale = "";
    return;
  }
  const {scaleRoot: scaleRoot, scaleName: scaleName} = parseScale(scale);
  const scaleRootNumber = pitchClassToNumber(scaleRoot);
  if (scaleRootNumber == null) {
    warn(`invalid scale root: ${scaleRoot}`);
    return;
  }
  liveSet.set("root_note", scaleRootNumber);
  liveSet.set("scale_name", scaleName);
  liveSet.set("scale_mode", 1);
  result.scale = `${scaleRoot} ${scaleName}`;
}

const sleep = ms => new Promise(resolve => new Task(resolve).schedule(ms));

async function waitUntil(predicate, {pollingInterval: pollingInterval = 10, maxRetries: maxRetries = 10} = {}) {
  for (let i = 0; i < maxRetries; i++) {
    if (predicate()) {
      return true;
    }
    await sleep(pollingInterval);
  }
  return false;
}

function stopPlaybackIfNeeded(liveSet) {
  const isPlaying = liveSet.getProperty("is_playing") > 0;
  if (isPlaying) {
    liveSet.call("stop_playing");
    warn("Playback stopped to modify locators");
    return true;
  }
  return false;
}

async function waitForPlayheadPosition(liveSet, targetBeats) {
  const success = await waitUntil(() => Math.abs(liveSet.getProperty("current_song_time") - targetBeats) < .001, {
    pollingInterval: 10,
    maxRetries: 10
  });
  if (!success) {
    warn(`Playhead position did not reach target ${targetBeats} after waiting`);
  }
}

async function deleteLocator(liveSet, {locatorId: locatorId, locatorTime: locatorTime, locatorName: locatorName, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator}) {
  if (locatorId == null && locatorTime == null && locatorName == null) {
    warn("delete requires locatorId, locatorTime, or locatorName");
    return {
      operation: "skipped",
      reason: "missing_identifier"
    };
  }
  if (locatorId == null && locatorTime == null && locatorName != null) {
    const matches = findLocatorsByName(liveSet, locatorName);
    if (matches.length === 0) {
      warn(`No locators found with name: ${locatorName}, skipping delete`);
      return {
        operation: "skipped",
        reason: "no_locators_found",
        name: locatorName
      };
    }
    stopPlaybackIfNeeded(liveSet);
    const times = matches.map(m => m.time).sort((a, b) => b - a);
    for (const time of times) {
      liveSet.set("current_song_time", time);
      await waitForPlayheadPosition(liveSet, time);
      liveSet.call("set_or_delete_cue");
    }
    return {
      operation: "deleted",
      count: matches.length,
      name: locatorName
    };
  }
  let timeInBeats = 0;
  if (locatorId != null) {
    const found = findLocator(liveSet, {
      locatorId: locatorId
    });
    if (!found) {
      warn(`Locator not found: ${locatorId}, skipping delete`);
      return {
        operation: "skipped",
        reason: "locator_not_found",
        id: locatorId
      };
    }
    timeInBeats = found.locator.getProperty("time");
  } else {
    timeInBeats = barBeatToAbletonBeats(locatorTime, timeSigNumerator, timeSigDenominator);
    const found = findLocator(liveSet, {
      timeInBeats: timeInBeats
    });
    if (!found) {
      warn(`No locator found at position: ${locatorTime}, skipping delete`);
      return {
        operation: "skipped",
        reason: "locator_not_found",
        time: locatorTime
      };
    }
  }
  stopPlaybackIfNeeded(liveSet);
  liveSet.set("current_song_time", timeInBeats);
  await waitForPlayheadPosition(liveSet, timeInBeats);
  liveSet.call("set_or_delete_cue");
  return {
    operation: "deleted",
    ...locatorId != null && {
      id: locatorId
    },
    ...locatorTime != null && {
      time: locatorTime
    }
  };
}

function renameLocator(liveSet, {locatorId: locatorId, locatorTime: locatorTime, locatorName: locatorName, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator}) {
  if (locatorName == null) {
    warn("locatorName is required for rename operation");
    return {
      operation: "skipped",
      reason: "missing_locatorName"
    };
  }
  if (locatorId == null && locatorTime == null) {
    warn("rename requires locatorId or locatorTime");
    return {
      operation: "skipped",
      reason: "missing_identifier"
    };
  }
  let found;
  if (locatorId != null) {
    found = findLocator(liveSet, {
      locatorId: locatorId
    });
    if (!found) {
      warn(`locator not found: ${locatorId}`);
      return {
        operation: "skipped",
        reason: "locator_not_found",
        id: locatorId
      };
    }
  } else {
    const timeInBeats = barBeatToAbletonBeats(locatorTime, timeSigNumerator, timeSigDenominator);
    found = findLocator(liveSet, {
      timeInBeats: timeInBeats
    });
    if (!found) {
      warn(`no locator found at position: ${locatorTime}`);
      return {
        operation: "skipped",
        reason: "locator_not_found",
        time: locatorTime
      };
    }
  }
  found.locator.set("name", locatorName);
  return {
    operation: "renamed",
    id: getLocatorId(found.index),
    name: locatorName
  };
}

async function updateLiveSet({tempo: tempo, timeSignature: timeSignature, scale: scale, locatorOperation: locatorOperation, locatorId: locatorId, locatorTime: locatorTime, locatorName: locatorName, arrangementFollower: arrangementFollower} = {}, context = {}) {
  const liveSet = LiveAPI.from("live_set");
  const result = {
    id: liveSet.id
  };
  if (tempo != null) {
    applyTempo(liveSet, tempo, result);
  }
  if (timeSignature != null) {
    const parsed = parseTimeSignature(timeSignature);
    liveSet.set("signature_numerator", parsed.numerator);
    liveSet.set("signature_denominator", parsed.denominator);
    result.timeSignature = `${parsed.numerator}/${parsed.denominator}`;
  }
  if (scale != null) {
    applyScale(liveSet, scale, result);
    result.$meta ??= [];
    result.$meta.push("Scale applied to selected clips and defaults for new clips.");
  }
  if (arrangementFollower != null) {
    liveSet.set("back_to_arranger", arrangementFollower ? 0 : 1);
    result.arrangementFollower = arrangementFollower;
  }
  const shouldIncludeScalePitches = scale != null && scale !== "";
  if (shouldIncludeScalePitches) {
    const rootNote = liveSet.getProperty("root_note");
    const scaleIntervals = liveSet.getProperty("scale_intervals");
    result.scalePitches = intervalsToPitchClasses(scaleIntervals, rootNote);
  }
  if (locatorOperation != null) {
    const locatorResult = await handleLocatorOperation(liveSet, {
      locatorOperation: locatorOperation,
      locatorId: locatorId,
      locatorTime: locatorTime,
      locatorName: locatorName
    }, context);
    result.locator = locatorResult;
  }
  return result;
}

async function handleLocatorOperation(liveSet, {locatorOperation: locatorOperation, locatorId: locatorId, locatorTime: locatorTime, locatorName: locatorName}, context) {
  const timeSigNumerator = liveSet.getProperty("signature_numerator");
  const timeSigDenominator = liveSet.getProperty("signature_denominator");
  switch (locatorOperation) {
   case "create":
    return await createLocator(liveSet, {
      locatorTime: locatorTime,
      locatorName: locatorName,
      timeSigNumerator: timeSigNumerator,
      timeSigDenominator: timeSigDenominator
    }, context);

   case "delete":
    return await deleteLocator(liveSet, {
      locatorId: locatorId,
      locatorTime: locatorTime,
      locatorName: locatorName,
      timeSigNumerator: timeSigNumerator,
      timeSigDenominator: timeSigDenominator
    });

   case "rename":
    return renameLocator(liveSet, {
      locatorId: locatorId,
      locatorTime: locatorTime,
      locatorName: locatorName,
      timeSigNumerator: timeSigNumerator,
      timeSigDenominator: timeSigDenominator
    });

   default:
    throw new Error(`Unknown locator operation: ${locatorOperation}`);
  }
}

async function createLocator(liveSet, {locatorTime: locatorTime, locatorName: locatorName, timeSigNumerator: timeSigNumerator, timeSigDenominator: timeSigDenominator}, context) {
  if (locatorTime == null) {
    warn("locatorTime is required for create operation");
    return {
      operation: "skipped",
      reason: "missing_locatorTime"
    };
  }
  const targetBeats = barBeatToAbletonBeats(locatorTime, timeSigNumerator, timeSigDenominator);
  const existing = findLocator(liveSet, {
    timeInBeats: targetBeats
  });
  if (existing) {
    warn(`Locator already exists at ${locatorTime} (id: ${getLocatorId(existing.index)}), skipping create`);
    return {
      operation: "skipped",
      reason: "locator_exists",
      time: locatorTime,
      existingId: getLocatorId(existing.index)
    };
  }
  stopPlaybackIfNeeded(liveSet);
  const tempClipInfo = extendSongIfNeeded(liveSet, targetBeats, context);
  liveSet.set("current_song_time", targetBeats);
  await waitForPlayheadPosition(liveSet, targetBeats);
  liveSet.call("set_or_delete_cue");
  cleanupTempClip(tempClipInfo);
  const found = findLocator(liveSet, {
    timeInBeats: targetBeats
  });
  if (found && locatorName != null) {
    found.locator.set("name", locatorName);
  }
  return {
    operation: "created",
    time: locatorTime,
    ...locatorName != null && {
      name: locatorName
    },
    ...found && {
      id: getLocatorId(found.index)
    }
  };
}

const PATH_SUPPORTED_TYPES = new Set([ "device", "drum-pad" ]);

function deleteObject({ids: ids, path: path, type: type}, _context = {}) {
  if (!type) {
    throw new Error("delete failed: type is required");
  }
  if (![ "track", "scene", "clip", "device", "drum-pad" ].includes(type)) {
    throw new Error(`delete failed: type must be one of "track", "scene", "clip", "device", or "drum-pad"`);
  }
  if (path && !PATH_SUPPORTED_TYPES.has(type)) {
    warn(`delete: path parameter is only valid for types "device" or "drum-pad", ignoring paths`);
  }
  const objectIds = ids ? parseCommaSeparatedIds(ids) : [];
  if (path && PATH_SUPPORTED_TYPES.has(type)) {
    const paths = parseCommaSeparatedIds(path);
    const pathIds = resolvePathsToIds(paths, type);
    objectIds.push(...pathIds);
  }
  if (objectIds.length === 0) {
    throw new Error("delete failed: ids or path is required");
  }
  const deletedObjects = [];
  const objectsToDelete = validateIdTypes(objectIds, type, "delete", {
    skipInvalid: true
  }).map(object => ({
    id: object.id,
    object: object
  }));
  if (type === "track" || type === "scene") {
    objectsToDelete.sort((a, b) => {
      const pathRegex = type === "track" ? /live_set (?:return_)?tracks (\d+)/ : /live_set scenes (\d+)/;
      const indexA = Number(a.object.path.match(pathRegex)?.[1]);
      const indexB = Number(b.object.path.match(pathRegex)?.[1]);
      return indexB - indexA;
    });
  }
  for (const {id: id, object: object} of objectsToDelete) {
    deleteObjectByType(type, id, object);
    deletedObjects.push({
      id: id,
      type: type,
      deleted: true
    });
  }
  return unwrapSingleResult(deletedObjects);
}

function deleteTrackObject(id, object) {
  const returnMatch = object.path.match(/live_set return_tracks (\d+)/);
  if (returnMatch) {
    const returnTrackIndex = Number(returnMatch[1]);
    const liveSet2 = LiveAPI.from("live_set");
    liveSet2.call("delete_return_track", returnTrackIndex);
    return;
  }
  const trackIndex = Number(object.path.match(/live_set tracks (\d+)/)?.[1]);
  if (Number.isNaN(trackIndex)) {
    throw new Error(`delete failed: no track index for id "${id}" (path="${object.path}")`);
  }
  const hostTrackIndex = getHostTrackIndex();
  if (trackIndex === hostTrackIndex) {
    throw new Error("delete failed: cannot delete track hosting the Producer Pal device");
  }
  const liveSet = LiveAPI.from("live_set");
  liveSet.call("delete_track", trackIndex);
}

function deleteSceneObject(id, object) {
  const sceneIndex = Number(object.path.match(/live_set scenes (\d+)/)?.[1]);
  if (Number.isNaN(sceneIndex)) {
    throw new Error(`delete failed: no scene index for id "${id}" (path="${object.path}")`);
  }
  const liveSet = LiveAPI.from("live_set");
  liveSet.call("delete_scene", sceneIndex);
}

function deleteClipObject(id, object) {
  const trackIndex = object.path.match(/live_set tracks (\d+)/)?.[1];
  if (!trackIndex) {
    throw new Error(`delete failed: no track index for id "${id}" (path="${object.path}")`);
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  track.call("delete_clip", `id ${object.id}`);
}

function deleteDeviceObject(id, object) {
  const deviceMatches = [ ...object.path.matchAll(/devices (\d+)/g) ];
  if (deviceMatches.length === 0) {
    throw new Error(`delete failed: could not find device index in path "${object.path}"`);
  }
  const lastMatch = deviceMatches.at(-1);
  const deviceIndex = Number(lastMatch[1]);
  const parentPath = object.path.substring(0, lastMatch.index).trim();
  if (!parentPath) {
    throw new Error(`delete failed: could not extract parent path from device "${id}" (path="${object.path}")`);
  }
  const parent = LiveAPI.from(parentPath);
  parent.call("delete_device", deviceIndex);
}

function deleteDrumPadObject(_id, object) {
  const drumPad = LiveAPI.from(`id ${object.id}`);
  drumPad.call("delete_all_chains");
}

function deleteObjectByType(type, id, object) {
  if (type === "track") {
    deleteTrackObject(id, object);
  } else if (type === "scene") {
    deleteSceneObject(id, object);
  } else if (type === "clip") {
    deleteClipObject(id, object);
  } else if (type === "device") {
    deleteDeviceObject(id, object);
  } else if (type === "drum-pad") {
    deleteDrumPadObject(id, object);
  }
}

function resolvePathsToIds(paths, type) {
  const ids = [];
  for (const targetPath of paths) {
    try {
      const resolved = resolvePathToLiveApi(targetPath);
      const resolvedId = resolvePathToId(resolved, targetPath, type);
      if (resolvedId) {
        ids.push(resolvedId);
      }
    } catch (e) {
      warn(`delete: ${errorMessage(e)}`);
    }
  }
  return ids;
}

function resolvePathToId(resolved, targetPath, type) {
  if (type === "drum-pad") {
    if (resolved.targetType !== "drum-pad") {
      warn(`delete: path "${targetPath}" resolves to ${resolved.targetType}, not drum-pad`);
      return null;
    }
    const result = resolveDrumPadFromPath(resolved.liveApiPath, resolved.drumPadNote, []);
    if (!result.target) {
      warn(`delete: drum-pad at path "${targetPath}" does not exist`);
      return null;
    }
    return result.target.id;
  }
  if (type === "device") {
    if (resolved.targetType === "device") {
      const target = LiveAPI.from(resolved.liveApiPath);
      if (!target.exists()) {
        warn(`delete: device at path "${targetPath}" does not exist`);
        return null;
      }
      return target.id;
    }
    if (resolved.targetType === "drum-pad" && resolved.remainingSegments.length >= 2) {
      const result = resolveDrumPadFromPath(resolved.liveApiPath, resolved.drumPadNote, resolved.remainingSegments);
      if (!result.target || result.targetType !== "device") {
        warn(`delete: device at path "${targetPath}" does not exist`);
        return null;
      }
      return result.target.id;
    }
    warn(`delete: path "${targetPath}" resolves to ${resolved.targetType}, not device`);
    return null;
  }
  return null;
}

function parseArrangementLength(arrangementLength, timeSigNumerator, timeSigDenominator) {
  try {
    const arrangementLengthBeats = barBeatDurationToAbletonBeats(arrangementLength, timeSigNumerator, timeSigDenominator);
    if (arrangementLengthBeats <= 0) {
      throw new Error(`duplicate failed: arrangementLength must be positive, got "${arrangementLength}"`);
    }
    return arrangementLengthBeats;
  } catch (error) {
    const msg = errorMessage(error);
    if (msg.includes("Invalid bar:beat duration format")) {
      throw new Error(`duplicate failed: ${msg}`);
    }
    if (msg.includes("must be 0 or greater")) {
      throw new Error(`duplicate failed: arrangementLength ${msg.replace("in duration ", "")}`);
    }
    throw error;
  }
}

function getMinimalClipInfo(clip, omitFields = []) {
  const isArrangementClip = clip.getProperty("is_arrangement_clip") > 0;
  if (isArrangementClip) {
    const trackIndex2 = clip.trackIndex;
    if (trackIndex2 == null) {
      throw new Error(`getMinimalClipInfo failed: could not determine trackIndex for clip (path="${clip.path}")`);
    }
    const arrangementStartBeats = clip.getProperty("start_time");
    const liveSet = LiveAPI.from("live_set");
    const timeSigNum = liveSet.getProperty("signature_numerator");
    const timeSigDenom = liveSet.getProperty("signature_denominator");
    const arrangementStart = abletonBeatsToBarBeat(arrangementStartBeats, timeSigNum, timeSigDenom);
    const result2 = {
      id: clip.id
    };
    if (!omitFields.includes("trackIndex")) {
      result2.trackIndex = trackIndex2;
    }
    if (!omitFields.includes("arrangementStart")) {
      result2.arrangementStart = arrangementStart;
    }
    return result2;
  }
  const trackIndex = clip.trackIndex;
  const sceneIndex = clip.sceneIndex;
  if (trackIndex == null || sceneIndex == null) {
    throw new Error(`getMinimalClipInfo failed: could not determine trackIndex/sceneIndex for clip (path="${clip.path}")`);
  }
  const result = {
    id: clip.id
  };
  if (!omitFields.includes("trackIndex")) {
    result.trackIndex = trackIndex;
  }
  if (!omitFields.includes("sceneIndex")) {
    result.sceneIndex = sceneIndex;
  }
  return result;
}

function createClipsForLength(sourceClip, track, arrangementStartBeats, arrangementLengthBeats, name, omitFields = [], context = {}) {
  const sourceClipLength = sourceClip.getProperty("length");
  const isMidiClip = sourceClip.getProperty("is_midi_clip") === 1;
  const duplicatedClips = [];
  if (arrangementLengthBeats < sourceClipLength) {
    if (!isMidiClip && !context.silenceWavPath) {
      warn("silenceWavPath missing in context - audio clip shortening may fail");
    }
    const {holdingClipId: holdingClipId} = createShortenedClipInHolding(sourceClip, track, arrangementLengthBeats, context.holdingAreaStartBeats, isMidiClip, context);
    const newClip = moveClipFromHolding(holdingClipId, track, arrangementStartBeats);
    if (name != null) newClip.set("name", name);
    duplicatedClips.push(getMinimalClipInfo(newClip, omitFields));
  } else {
    const newClipResult = track.call("duplicate_clip_to_arrangement", `id ${sourceClip.id}`, arrangementStartBeats);
    const newClip = LiveAPI.from(newClipResult);
    const newClipId = newClip.id;
    if (arrangementLengthBeats > sourceClipLength) {
      lengthenClipAndCollectInfo(sourceClip, track, newClipId, arrangementLengthBeats, name, omitFields, context, duplicatedClips);
    } else {
      if (name != null) newClip.set("name", name);
      duplicatedClips.push(getMinimalClipInfo(newClip, omitFields));
    }
  }
  return duplicatedClips;
}

function lengthenClipAndCollectInfo(sourceClip, track, newClipId, targetBeats, name, omitFields, context, duplicatedClips) {
  const timeSigNum = sourceClip.getProperty("signature_numerator");
  const timeSigDenom = sourceClip.getProperty("signature_denominator");
  const beatsPerBar = 4 * (timeSigNum / timeSigDenom);
  const bars = Math.floor(targetBeats / beatsPerBar);
  const remainingBeats = targetBeats - bars * beatsPerBar;
  const arrangementLengthBarBeat = `${bars}:${remainingBeats.toFixed(3)}`;
  const updateResult = updateClip({
    ids: newClipId,
    arrangementLength: arrangementLengthBarBeat,
    name: name
  }, context);
  const clipResults = Array.isArray(updateResult) ? updateResult : [ updateResult ];
  const arrangementClipIds = track.getChildIds("arrangement_clips");
  for (const clipObj of clipResults) {
    const clipLiveAPI = arrangementClipIds.map(id => LiveAPI.from(id)).find(c => c.id === clipObj.id);
    if (clipLiveAPI) {
      duplicatedClips.push(getMinimalClipInfo(clipLiveAPI, omitFields));
    }
  }
}

function duplicateClipSlot(sourceTrackIndex, sourceSceneIndex, toTrackIndex, toSceneIndex, name) {
  const sourceClipSlot = LiveAPI.from(`live_set tracks ${sourceTrackIndex} clip_slots ${sourceSceneIndex}`);
  if (!sourceClipSlot.exists()) {
    throw new Error(`duplicate failed: source clip slot at track ${sourceTrackIndex}, scene ${sourceSceneIndex} does not exist`);
  }
  if (!sourceClipSlot.getProperty("has_clip")) {
    throw new Error(`duplicate failed: no clip in source clip slot at track ${sourceTrackIndex}, scene ${sourceSceneIndex}`);
  }
  const destClipSlot = LiveAPI.from(`live_set tracks ${toTrackIndex} clip_slots ${toSceneIndex}`);
  if (!destClipSlot.exists()) {
    throw new Error(`duplicate failed: destination clip slot at track ${toTrackIndex}, scene ${toSceneIndex} does not exist`);
  }
  sourceClipSlot.call("duplicate_clip_to", `id ${destClipSlot.id}`);
  const newClip = LiveAPI.from(`live_set tracks ${toTrackIndex} clip_slots ${toSceneIndex} clip`);
  if (name != null) {
    newClip.set("name", name);
  }
  return getMinimalClipInfo(newClip);
}

function duplicateClipToArrangement(clipId, arrangementStartBeats, name, arrangementLength, _songTimeSigNumerator = 4, _songTimeSigDenominator = 4, context = {}) {
  const clip = LiveAPI.from(clipId);
  if (!clip.exists()) {
    throw new Error(`duplicate failed: no clip exists for clipId "${clipId}"`);
  }
  const trackIndex = clip.trackIndex;
  if (trackIndex == null) {
    throw new Error(`duplicate failed: no track index for clipId "${clipId}" (path=${clip.path})`);
  }
  const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
  const duplicatedClips = [];
  if (arrangementLength != null) {
    const clipTimeSigNumerator = clip.getProperty("signature_numerator");
    const clipTimeSigDenominator = clip.getProperty("signature_denominator");
    const arrangementLengthBeats = parseArrangementLength(arrangementLength, clipTimeSigNumerator, clipTimeSigDenominator);
    const clipsCreated = createClipsForLength(clip, track, arrangementStartBeats, arrangementLengthBeats, name, [ "trackIndex" ], context);
    duplicatedClips.push(...clipsCreated);
  } else {
    const newClipResult = track.call("duplicate_clip_to_arrangement", `id ${clip.id}`, arrangementStartBeats);
    const newClip = LiveAPI.from(newClipResult);
    newClip.setAll({
      name: name
    });
    duplicatedClips.push(getMinimalClipInfo(newClip));
  }
  if (duplicatedClips.length === 1) {
    return duplicatedClips[0];
  }
  return {
    trackIndex: trackIndex,
    clips: duplicatedClips
  };
}

function duplicateClipWithPositions(destination, object, id, name, toTrackIndex, toSceneIndex, arrangementStart, arrangementLocatorId, arrangementLocatorName, arrangementLength, context) {
  const createdObjects = [];
  if (destination === "session") {
    const sceneIndices = parseSceneIndexList$1(toSceneIndex);
    const trackIndex = object.trackIndex;
    const sourceSceneIndex = object.sceneIndex;
    if (trackIndex == null || sourceSceneIndex == null) {
      throw new Error(`unsupported duplicate operation: cannot duplicate arrangement clips to the session (source clip id="${id}" path="${object.path}") `);
    }
    for (let i = 0; i < sceneIndices.length; i++) {
      const objectName = buildIndexedName(name, sceneIndices.length, i);
      const result = duplicateClipSlot(trackIndex, sourceSceneIndex, toTrackIndex ?? trackIndex, sceneIndices[i], objectName);
      createdObjects.push(result);
    }
  } else {
    const liveSet = LiveAPI.from("live_set");
    const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
    const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
    const positionsInBeats = resolveClipArrangementPositions(liveSet, arrangementStart, arrangementLocatorId, arrangementLocatorName, songTimeSigNumerator, songTimeSigDenominator);
    for (let i = 0; i < positionsInBeats.length; i++) {
      const objectName = buildIndexedName(name, positionsInBeats.length, i);
      const result = duplicateClipToArrangement(id, positionsInBeats[i], objectName, arrangementLength, songTimeSigNumerator, songTimeSigDenominator, context);
      createdObjects.push(result);
    }
  }
  return createdObjects;
}

function resolveClipArrangementPositions(liveSet, arrangementStart, arrangementLocatorId, arrangementLocatorName, timeSigNumerator, timeSigDenominator) {
  if (arrangementLocatorId != null || arrangementLocatorName != null) {
    const locatorBeats = resolveLocatorToBeats$1(liveSet, {
      locatorId: arrangementLocatorId,
      locatorName: arrangementLocatorName
    }, "duplicate");
    return [ locatorBeats ];
  }
  const positions = parseArrangementStartList(arrangementStart);
  return positions.map(pos => barBeatToAbletonBeats(pos, timeSigNumerator, timeSigDenominator));
}

function duplicateDevice(device, toPath, name, count = 1) {
  if (count > 1) {
    warn("count parameter ignored for device duplication (only single copy supported)");
  }
  const trackIndex = extractRegularTrackIndex(device.path);
  if (trackIndex == null) {
    throw new Error("duplicate failed: cannot duplicate devices on return/master tracks");
  }
  const devicePathWithinTrack = extractDevicePathWithinTrack(device.path);
  const liveSet = LiveAPI.from("live_set");
  liveSet.call("duplicate_track", trackIndex);
  const tempTrackIndex = trackIndex + 1;
  const tempDevicePath = `live_set tracks ${tempTrackIndex} ${devicePathWithinTrack}`;
  const tempDevice = LiveAPI.from(tempDevicePath);
  if (!tempDevice.exists()) {
    liveSet.call("delete_track", tempTrackIndex);
    throw new Error(`duplicate failed: device not found in duplicated track at path "${tempDevicePath}"`);
  }
  const destination = toPath ?? calculateDefaultDestination(device.path, trackIndex);
  const adjustedDestination = adjustTrackIndicesForTempTrack(destination, trackIndex);
  moveDeviceToPath(tempDevice, adjustedDestination);
  if (name) {
    tempDevice.set("name", name);
  }
  const deviceId = tempDevice.id;
  const currentTempTrackIndex = recalculateTempTrackIndex(tempTrackIndex);
  liveSet.call("delete_track", currentTempTrackIndex);
  return {
    id: deviceId
  };
}

function extractRegularTrackIndex(devicePath) {
  const match = devicePath.match(/^live_set tracks (\d+)/);
  return match ? Number.parseInt(match[1]) : null;
}

function extractDevicePathWithinTrack(devicePath) {
  const match = devicePath.match(/^live_set (?:tracks \d+|return_tracks \d+|master_track) (.+)$/);
  if (!match) {
    throw new Error(`duplicate failed: cannot extract device path from "${devicePath}"`);
  }
  return match[1];
}

function calculateDefaultDestination(devicePath, trackIndex) {
  const simplifiedPath = extractDevicePath(devicePath);
  if (!simplifiedPath) {
    return `t${trackIndex}`;
  }
  const segments = simplifiedPath.split("/");
  const lastSegment = segments.at(-1);
  if (lastSegment?.startsWith("d")) {
    const deviceIndex = Number.parseInt(lastSegment.slice(1));
    segments[segments.length - 1] = `d${deviceIndex + 1}`;
    return segments.join("/");
  }
  return simplifiedPath;
}

function adjustTrackIndicesForTempTrack(toPath, sourceTrackIndex) {
  const match = toPath.match(/^t(\d+)/);
  if (!match) {
    return toPath;
  }
  const destTrackIndex = Number.parseInt(match[1]);
  if (destTrackIndex > sourceTrackIndex) {
    return toPath.replace(/^t\d+/, `t${destTrackIndex + 1}`);
  }
  return toPath;
}

function recalculateTempTrackIndex(originalTempTrackIndex) {
  return originalTempTrackIndex;
}

function generateObjectName(baseName, count, index) {
  if (baseName == null) {
    return;
  }
  if (count === 1) {
    return baseName;
  }
  if (index === 0) {
    return baseName;
  }
  return `${baseName} ${index + 1}`;
}

function determineTargetView(destination, type) {
  if (destination === "arrangement") {
    return "arrangement";
  }
  if (destination === "session" || type === "track" || type === "scene") {
    return "session";
  }
  return null;
}

function switchViewIfRequested(switchView, destination, type) {
  if (!switchView) {
    return;
  }
  const targetView = determineTargetView(destination, type);
  if (targetView) {
    select({
      view: targetView
    });
  }
}

function configureSourceTrackInput(sourceTrack, sourceTrackName) {
  const currentArm = sourceTrack.getProperty("arm");
  sourceTrack.set("arm", 1);
  if (currentArm !== 1) {
    warn(`routeToSource: Armed the source track`);
  }
  const currentInputType = sourceTrack.getProperty("input_routing_type");
  const currentInputName = currentInputType?.display_name;
  if (currentInputName !== "No Input") {
    const sourceInputTypes = sourceTrack.getProperty("available_input_routing_types");
    const noInput = sourceInputTypes?.find(type => type.display_name === "No Input");
    if (noInput) {
      sourceTrack.setProperty("input_routing_type", {
        identifier: noInput.identifier
      });
      warn(`Changed track "${sourceTrackName}" input routing from "${currentInputName}" to "No Input"`);
    } else {
      warn(`Tried to change track "${sourceTrackName}" input routing from "${currentInputName}" to "No Input" but could not find "No Input"`);
    }
  }
}

function findRoutingOptionForDuplicateNames(sourceTrack, sourceTrackName, availableTypes) {
  const matchingOptions = availableTypes.filter(type => type.display_name === sourceTrackName);
  if (matchingOptions.length <= 1) {
    return matchingOptions[0];
  }
  const liveSet = LiveAPI.from("live_set");
  const allTrackIds = liveSet.getChildIds("tracks");
  const tracksWithSameName = allTrackIds.map((trackId, index) => {
    const track = LiveAPI.from(trackId);
    return {
      index: index,
      id: track.id,
      name: track.getProperty("name")
    };
  }).filter(track => track.name === sourceTrackName);
  tracksWithSameName.sort((a, b) => {
    const idA = Number.parseInt(a.id);
    const idB = Number.parseInt(b.id);
    return idA - idB;
  });
  const sourcePosition = tracksWithSameName.findIndex(track => track.id === sourceTrack.id);
  if (sourcePosition === -1) {
    warn(`Could not find source track in duplicate name list for "${sourceTrackName}"`);
    return;
  }
  return matchingOptions[sourcePosition];
}

function findSourceRouting(sourceTrack, sourceTrackName, availableTypes) {
  const matchingNames = availableTypes?.filter(type => type.display_name === sourceTrackName) ?? [];
  if (matchingNames.length > 1) {
    const sourceRouting = findRoutingOptionForDuplicateNames(sourceTrack, sourceTrackName, availableTypes);
    if (!sourceRouting) {
      warn(`Could not route to "${sourceTrackName}" due to duplicate track names. Consider renaming tracks to have unique names.`);
    }
    return sourceRouting;
  }
  return matchingNames[0];
}

function applyOutputRouting(newTrack, sourceTrackName, availableTypes, sourceTrack) {
  const sourceRouting = findSourceRouting(sourceTrack, sourceTrackName, availableTypes);
  if (sourceRouting) {
    newTrack.setProperty("output_routing_type", {
      identifier: sourceRouting.identifier
    });
  } else {
    const matchingNames = availableTypes?.filter(type => type.display_name === sourceTrackName) ?? [];
    if (matchingNames.length === 0) {
      warn(`Could not find track "${sourceTrackName}" in routing options`);
    }
  }
}

function configureRouting(newTrack, sourceTrackIndex) {
  const sourceTrack = LiveAPI.from(`live_set tracks ${sourceTrackIndex}`);
  const sourceTrackName = sourceTrack.getProperty("name");
  configureSourceTrackInput(sourceTrack, sourceTrackName);
  const availableTypes = newTrack.getProperty("available_output_routing_types");
  applyOutputRouting(newTrack, sourceTrackName, availableTypes, sourceTrack);
}

function forEachClipInScene(sceneIndex, trackIds, callback) {
  for (let trackIndex = 0; trackIndex < trackIds.length; trackIndex++) {
    const clipSlot = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${sceneIndex}`);
    if (clipSlot.exists() && clipSlot.getProperty("has_clip")) {
      const clip = LiveAPI.from(`${clipSlot.path} clip`);
      if (clip.exists()) {
        callback(clip, clipSlot, trackIndex);
      }
    }
  }
}

function removeHostTrackDevice(trackIndex, withoutDevices, newTrack) {
  const hostTrackIndex = getHostTrackIndex();
  if (trackIndex === hostTrackIndex && withoutDevices !== true) {
    try {
      const thisDevice = LiveAPI.from("this_device");
      const thisDevicePath = thisDevice.path;
      const deviceIndexMatch = thisDevicePath.match(/devices (\d+)/);
      if (deviceIndexMatch) {
        newTrack.call("delete_device", Number.parseInt(deviceIndexMatch[1] ?? ""));
        warn("Removed Producer Pal device from duplicated track - the device cannot be duplicated");
      }
    } catch {
      warn("Could not check for Producer Pal device in duplicated track");
    }
  }
}

function deleteAllDevices(newTrack) {
  const deviceCount = newTrack.getChildIds("devices").length;
  for (let i = deviceCount - 1; i >= 0; i--) {
    newTrack.call("delete_device", i);
  }
}

function processClipsForDuplication(newTrack, withoutClips) {
  const duplicatedClips = [];
  if (withoutClips === true) {
    deleteSessionClips(newTrack);
    deleteArrangementClips(newTrack);
  } else {
    collectSessionClips(newTrack, duplicatedClips);
    collectArrangementClips(newTrack, duplicatedClips);
  }
  return duplicatedClips;
}

function deleteSessionClips(newTrack) {
  const sessionClipSlotIds = newTrack.getChildIds("clip_slots");
  for (const clipSlotId of sessionClipSlotIds) {
    const clipSlot = LiveAPI.from(clipSlotId);
    if (clipSlot.getProperty("has_clip")) {
      clipSlot.call("delete_clip");
    }
  }
}

function deleteArrangementClips(newTrack) {
  const arrangementClipIds = newTrack.getChildIds("arrangement_clips");
  for (const clipId of arrangementClipIds) {
    newTrack.call("delete_clip", clipId);
  }
}

function collectSessionClips(newTrack, duplicatedClips) {
  const sessionClipSlotIds = newTrack.getChildIds("clip_slots");
  for (const clipSlotId of sessionClipSlotIds) {
    const clipSlot = LiveAPI.from(clipSlotId);
    if (clipSlot.getProperty("has_clip")) {
      const clip = LiveAPI.from(`${clipSlot.path} clip`);
      duplicatedClips.push(getMinimalClipInfo(clip, [ "trackIndex" ]));
    }
  }
}

function collectArrangementClips(newTrack, duplicatedClips) {
  const arrangementClipIds = newTrack.getChildIds("arrangement_clips");
  for (const clipId of arrangementClipIds) {
    const clip = LiveAPI.from(clipId);
    if (clip.exists()) {
      duplicatedClips.push(getMinimalClipInfo(clip, [ "trackIndex" ]));
    }
  }
}

function duplicateTrack(trackIndex, name, withoutClips, withoutDevices, routeToSource, sourceTrackIndex) {
  const liveSet = LiveAPI.from("live_set");
  liveSet.call("duplicate_track", trackIndex);
  const newTrackIndex = trackIndex + 1;
  const newTrack = LiveAPI.from(`live_set tracks ${newTrackIndex}`);
  if (name != null) {
    newTrack.set("name", name);
  }
  removeHostTrackDevice(trackIndex, withoutDevices, newTrack);
  if (withoutDevices === true) {
    deleteAllDevices(newTrack);
  }
  const duplicatedClips = processClipsForDuplication(newTrack, withoutClips);
  if (routeToSource) configureRouting(newTrack, sourceTrackIndex);
  return {
    id: newTrack.id,
    trackIndex: newTrackIndex,
    clips: duplicatedClips
  };
}

function duplicateScene(sceneIndex, name, withoutClips) {
  const liveSet = LiveAPI.from("live_set");
  liveSet.call("duplicate_scene", sceneIndex);
  const newSceneIndex = sceneIndex + 1;
  const newScene = LiveAPI.from(`live_set scenes ${newSceneIndex}`);
  if (name != null) {
    newScene.set("name", name);
  }
  const duplicatedClips = [];
  const trackIds = liveSet.getChildIds("tracks");
  if (withoutClips === true) {
    forEachClipInScene(newSceneIndex, trackIds, (_clip, clipSlot) => {
      clipSlot.call("delete_clip");
    });
  } else {
    forEachClipInScene(newSceneIndex, trackIds, clip => {
      duplicatedClips.push(getMinimalClipInfo(clip, [ "sceneIndex" ]));
    });
  }
  return {
    id: newScene.id,
    sceneIndex: newSceneIndex,
    clips: duplicatedClips
  };
}

function calculateSceneLength(sceneIndex) {
  const liveSet = LiveAPI.from("live_set");
  const trackIds = liveSet.getChildIds("tracks");
  let maxLength = 4;
  forEachClipInScene(sceneIndex, trackIds, clip => {
    const clipLength = clip.getProperty("length");
    maxLength = Math.max(maxLength, clipLength);
  });
  return maxLength;
}

function assignNamesToClips(clips, name) {
  for (const clipInfo of clips) {
    clipInfo.name = name;
  }
}

function duplicateSceneToArrangement(sceneId, arrangementStartBeats, name, withoutClips, arrangementLength, songTimeSigNumerator = 4, songTimeSigDenominator = 4, context = {}) {
  const scene = LiveAPI.from(sceneId);
  if (!scene.exists()) {
    throw new Error(`duplicate failed: scene with id "${sceneId}" does not exist`);
  }
  const sceneIndex = scene.sceneIndex;
  if (sceneIndex == null) {
    throw new Error(`duplicate failed: no scene index for id "${sceneId}" (path="${scene.path}")`);
  }
  const liveSet = LiveAPI.from("live_set");
  const trackIds = liveSet.getChildIds("tracks");
  const duplicatedClips = [];
  if (withoutClips !== true) {
    let arrangementLengthBeats;
    if (arrangementLength != null) {
      arrangementLengthBeats = parseArrangementLength(arrangementLength, songTimeSigNumerator, songTimeSigDenominator);
    } else {
      arrangementLengthBeats = calculateSceneLength(sceneIndex);
    }
    forEachClipInScene(sceneIndex, trackIds, (clip, _clipSlot, trackIndex) => {
      const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
      const clipsForTrack = createClipsForLength(clip, track, arrangementStartBeats, arrangementLengthBeats, name, [ "arrangementStart" ], context);
      if (name != null) {
        assignNamesToClips(clipsForTrack, name);
      }
      duplicatedClips.push(...clipsForTrack);
    });
  }
  return {
    arrangementStart: abletonBeatsToBarBeat(arrangementStartBeats, songTimeSigNumerator, songTimeSigDenominator),
    clips: duplicatedClips
  };
}

function resolveArrangementPosition(liveSet, arrangementStart, arrangementLocatorId, arrangementLocatorName, timeSigNumerator, timeSigDenominator) {
  if (arrangementLocatorId != null || arrangementLocatorName != null) {
    return resolveLocatorToBeats$1(liveSet, {
      locatorId: arrangementLocatorId,
      locatorName: arrangementLocatorName
    }, "duplicate");
  }
  return barBeatToAbletonBeats(arrangementStart, timeSigNumerator, timeSigDenominator);
}

function validateBasicInputs(type, id, count) {
  if (!type) {
    throw new Error("duplicate failed: type is required");
  }
  const validTypes = [ "track", "scene", "clip", "device" ];
  if (!validTypes.includes(type)) {
    throw new Error(`duplicate failed: type must be one of ${validTypes.join(", ")}`);
  }
  if (!id) {
    throw new Error("duplicate failed: id is required");
  }
  if (count < 1) {
    throw new Error("duplicate failed: count must be at least 1");
  }
}

function validateAndConfigureRouteToSource(type, routeToSource, withoutClips, withoutDevices) {
  if (!routeToSource) {
    return {
      withoutClips: withoutClips,
      withoutDevices: withoutDevices
    };
  }
  if (type !== "track") {
    throw new Error("duplicate failed: routeToSource is only supported for type 'track'");
  }
  if (withoutClips === false) {
    warn("routeToSource requires withoutClips=true, ignoring user-provided withoutClips=false");
  }
  if (withoutDevices === false) {
    warn("routeToSource requires withoutDevices=true, ignoring user-provided withoutDevices=false");
  }
  return {
    withoutClips: true,
    withoutDevices: true
  };
}

function validateClipParameters(type, destination, toTrackIndex, toSceneIndex) {
  if (type !== "clip") {
    return;
  }
  if (!destination) {
    throw new Error("duplicate failed: destination is required for type 'clip'");
  }
  if (![ "session", "arrangement" ].includes(destination)) {
    throw new Error("duplicate failed: destination must be 'session' or 'arrangement'");
  }
  if (destination === "session") {
    if (toTrackIndex == null) {
      throw new Error("duplicate failed: toTrackIndex is required for session clips");
    }
    if (toSceneIndex == null || toSceneIndex.trim() === "") {
      throw new Error("duplicate failed: toSceneIndex is required for session clips");
    }
  }
}

function validateDestinationParameter(type, destination) {
  if (destination == null) {
    return;
  }
  if (type === "track" && destination === "arrangement") {
    throw new Error("duplicate failed: tracks cannot be duplicated to arrangement (use destination='session' or omit destination parameter)");
  }
}

function validateArrangementParameters(destination, arrangementStart, arrangementLocatorId, arrangementLocatorName) {
  if (destination !== "arrangement") {
    return;
  }
  const hasStart = arrangementStart != null && arrangementStart.trim() !== "";
  const hasLocatorId = arrangementLocatorId != null;
  const hasLocatorName = arrangementLocatorName != null;
  const positionCount = [ hasStart, hasLocatorId, hasLocatorName ].filter(Boolean).length;
  if (positionCount === 0) {
    throw new Error("duplicate failed: arrangementStart, arrangementLocatorId, or arrangementLocatorName is required when destination is 'arrangement'");
  }
  if (positionCount > 1) {
    throw new Error("duplicate failed: arrangementStart, arrangementLocatorId, and arrangementLocatorName are mutually exclusive");
  }
}

function duplicate({type: type, id: id, count: count = 1, destination: destination, arrangementStart: arrangementStart, arrangementLocatorId: arrangementLocatorId, arrangementLocatorName: arrangementLocatorName, arrangementLength: arrangementLength, name: name, withoutClips: withoutClips, withoutDevices: withoutDevices, routeToSource: routeToSource, switchView: switchView, toTrackIndex: toTrackIndex, toSceneIndex: toSceneIndex, toPath: toPath}, context = {}) {
  validateBasicInputs(type, id, count);
  const routeToSourceConfig = validateAndConfigureRouteToSource(type, routeToSource, withoutClips, withoutDevices);
  withoutClips = routeToSourceConfig.withoutClips;
  withoutDevices = routeToSourceConfig.withoutDevices;
  const object = validateIdType(id, type, "duplicate");
  validateClipParameters(type, destination, toTrackIndex, toSceneIndex);
  validateDestinationParameter(type, destination);
  validateArrangementParameters(destination, arrangementStart, arrangementLocatorId, arrangementLocatorName);
  if (type === "device") {
    return duplicateDevice(object, toPath, name, count);
  }
  const createdObjects = type === "clip" ? duplicateClipWithPositions(destination, object, id, name, toTrackIndex, toSceneIndex, arrangementStart, arrangementLocatorId, arrangementLocatorName, arrangementLength, context) : duplicateTrackOrSceneWithCount(type, destination, object, id, count, name, {
    arrangementStart: arrangementStart,
    arrangementLocatorId: arrangementLocatorId,
    arrangementLocatorName: arrangementLocatorName,
    arrangementLength: arrangementLength,
    withoutClips: withoutClips,
    withoutDevices: withoutDevices,
    routeToSource: routeToSource
  }, context);
  switchViewIfRequested(switchView, destination, type);
  if (createdObjects.length === 1) {
    return createdObjects[0];
  }
  return createdObjects;
}

function duplicateTrackOrSceneWithCount(type, destination, object, id, count, name, params, context) {
  const createdObjects = [];
  const {arrangementStart: arrangementStart, arrangementLocatorId: arrangementLocatorId, arrangementLocatorName: arrangementLocatorName, arrangementLength: arrangementLength, withoutClips: withoutClips, withoutDevices: withoutDevices, routeToSource: routeToSource} = params;
  for (let i = 0; i < count; i++) {
    const objectName = generateObjectName(name, count, i);
    const newObjectMetadata = performDuplication(type, destination, object, id, i, objectName, {
      arrangementStart: arrangementStart,
      arrangementLocatorId: arrangementLocatorId,
      arrangementLocatorName: arrangementLocatorName,
      arrangementLength: arrangementLength,
      withoutClips: withoutClips,
      withoutDevices: withoutDevices,
      routeToSource: routeToSource
    }, context);
    if (newObjectMetadata != null) {
      createdObjects.push(newObjectMetadata);
    }
  }
  return createdObjects;
}

function duplicateSceneToArrangementView(object, id, i, objectName, arrangementStart, arrangementLocatorId, arrangementLocatorName, arrangementLength, withoutClips, context) {
  const liveSet = LiveAPI.from("live_set");
  const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
  const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
  const baseArrangementStartBeats = resolveArrangementPosition(liveSet, arrangementStart, arrangementLocatorId, arrangementLocatorName, songTimeSigNumerator, songTimeSigDenominator);
  const sceneIndex = object.sceneIndex;
  if (sceneIndex == null) {
    throw new Error(`duplicate failed: no scene index for id "${id}" (path="${object.path}")`);
  }
  const sceneLength = calculateSceneLength(sceneIndex);
  const actualArrangementStartBeats = baseArrangementStartBeats + i * sceneLength;
  return duplicateSceneToArrangement(id, actualArrangementStartBeats, objectName, withoutClips, arrangementLength, songTimeSigNumerator, songTimeSigDenominator, context);
}

function duplicateTrackOrSceneToSession(type, object, id, i, objectName, withoutClips, withoutDevices, routeToSource) {
  if (type === "track") {
    const trackIndex = object.trackIndex;
    if (trackIndex == null) {
      throw new Error(`duplicate failed: no track index for id "${id}" (path="${object.path}")`);
    }
    const actualTrackIndex = trackIndex + i;
    return duplicateTrack(actualTrackIndex, objectName, withoutClips, withoutDevices, routeToSource, trackIndex);
  } else if (type === "scene") {
    const sceneIndex = object.sceneIndex;
    if (sceneIndex == null) {
      throw new Error(`duplicate failed: no scene index for id "${id}" (path="${object.path}")`);
    }
    const actualSceneIndex = sceneIndex + i;
    return duplicateScene(actualSceneIndex, objectName, withoutClips);
  }
}

function performDuplication(type, destination, object, id, i, objectName, params, context) {
  const {arrangementStart: arrangementStart, arrangementLocatorId: arrangementLocatorId, arrangementLocatorName: arrangementLocatorName, arrangementLength: arrangementLength, withoutClips: withoutClips, withoutDevices: withoutDevices, routeToSource: routeToSource} = params;
  if (destination === "arrangement") {
    return duplicateSceneToArrangementView(object, id, i, objectName, arrangementStart, arrangementLocatorId, arrangementLocatorName, arrangementLength, withoutClips, context);
  }
  return duplicateTrackOrSceneToSession(type, object, id, i, objectName, withoutClips, withoutDevices, routeToSource);
}

function parseTransposeValues(transposeValues, transposeMin, transposeMax) {
  if (transposeValues == null) {
    return null;
  }
  const transposeValuesArray = parseCommaSeparatedFloats(transposeValues);
  if (transposeValuesArray.length === 0) {
    throw new Error("transposeValues must contain at least one valid number");
  }
  if (transposeMin != null || transposeMax != null) {
    warn("transposeValues ignores transposeMin/transposeMax");
  }
  return transposeValuesArray;
}

function getClipIds(clipIds, arrangementTrackIndex, arrangementStart, arrangementLength) {
  if (clipIds) {
    return parseCommaSeparatedIds(clipIds);
  }
  if (arrangementTrackIndex == null) {
    throw new Error("transformClips failed: clipIds or arrangementTrackIndex is required");
  }
  const trackIndices = parseCommaSeparatedIndices(arrangementTrackIndex);
  const liveSet = LiveAPI.from("live_set");
  const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
  const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
  let arrangementStartBeats = 0;
  let arrangementEndBeats = Infinity;
  if (arrangementStart != null) {
    arrangementStartBeats = barBeatToAbletonBeats(arrangementStart, songTimeSigNumerator, songTimeSigDenominator);
  }
  if (arrangementLength != null) {
    const arrangementLengthBeats = barBeatDurationToAbletonBeats(arrangementLength, songTimeSigNumerator, songTimeSigDenominator);
    if (arrangementLengthBeats <= 0) {
      throw new Error("arrangementLength must be greater than 0");
    }
    arrangementEndBeats = arrangementStartBeats + arrangementLengthBeats;
  }
  const result = [];
  for (const trackIndex of trackIndices) {
    const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
    if (!track.exists()) {
      throw new Error(`transformClips failed: track ${trackIndex} not found`);
    }
    const trackClipIds = track.getChildIds("arrangement_clips");
    for (const clipId of trackClipIds) {
      const clip = LiveAPI.from(clipId);
      const clipStartTime = clip.getProperty("start_time");
      if (clipStartTime >= arrangementStartBeats && clipStartTime < arrangementEndBeats) {
        result.push(clipId);
      }
    }
  }
  return result;
}

function createSeededRNG(seed) {
  let state = seed;
  return function() {
    state |= 0;
    state = state + 1831565813 | 0;
    let t = Math.imul(state ^ state >>> 15, 1 | state);
    t = t + Math.imul(t ^ t >>> 7, 61 | t) ^ t;
    return ((t ^ t >>> 14) >>> 0) / 4294967296;
  };
}

function randomInRange(min, max, rng) {
  return min + rng() * (max - min);
}

function applyAudioPitchShift(clip, transposeOffset) {
  const currentPitchCoarse = clip.getProperty("pitch_coarse");
  const currentPitchFine = clip.getProperty("pitch_fine");
  const currentPitch = currentPitchCoarse + currentPitchFine / 100;
  const newPitch = currentPitch + transposeOffset;
  const pitchCoarse = Math.floor(newPitch);
  const pitchFine = Math.round((newPitch - pitchCoarse) * 100);
  clip.set("pitch_coarse", pitchCoarse);
  clip.set("pitch_fine", pitchFine);
}

function applyAudioParams(clip, {gainDbMin: gainDbMin, gainDbMax: gainDbMax, transposeMin: transposeMin, transposeMax: transposeMax, transposeValuesArray: transposeValuesArray}, rng) {
  if (gainDbMin != null && gainDbMax != null) {
    const currentLiveGain = clip.getProperty("gain");
    const currentGainDb = liveGainToDb(currentLiveGain);
    const gainDbOffset = randomInRange(gainDbMin, gainDbMax, rng);
    const newGainDb = Math.max(-70, Math.min(24, currentGainDb + gainDbOffset));
    const newLiveGain = dbToLiveGain(newGainDb);
    clip.set("gain", newLiveGain);
  }
  if (transposeValuesArray != null) {
    const transposeOffset = transposeValuesArray[Math.floor(rng() * transposeValuesArray.length)];
    applyAudioPitchShift(clip, transposeOffset);
  } else if (transposeMin != null && transposeMax != null) {
    const transposeOffset = randomInRange(transposeMin, transposeMax, rng);
    applyAudioPitchShift(clip, transposeOffset);
  }
}

function applyVelocityOffset(note, velocityMin, velocityMax, rng) {
  if (velocityMin == null || velocityMax == null) {
    return;
  }
  const velocityOffset = Math.round(randomInRange(velocityMin, velocityMax, rng));
  note.velocity = Math.max(1, Math.min(127, note.velocity + velocityOffset));
}

function applyTranspose(note, transposeParams, rng) {
  const {transposeValuesArray: transposeValuesArray, transposeMin: transposeMin, transposeMax: transposeMax} = transposeParams;
  if (transposeValuesArray != null) {
    const transposeOffset = transposeValuesArray[Math.floor(rng() * transposeValuesArray.length)];
    note.pitch = Math.max(0, Math.min(127, note.pitch + Math.round(transposeOffset)));
  } else if (transposeMin != null && transposeMax != null) {
    const transposeOffset = Math.round(randomInRange(transposeMin, transposeMax, rng));
    note.pitch = Math.max(0, Math.min(127, note.pitch + transposeOffset));
  }
}

function applyDurationMultiplier(note, durationMin, durationMax, rng) {
  if (durationMin == null || durationMax == null) {
    return;
  }
  const durationMultiplier = randomInRange(durationMin, durationMax, rng);
  note.duration = note.duration * durationMultiplier;
}

function applyVelocityDeviation(note, velocityRange) {
  if (velocityRange == null) {
    return;
  }
  const currentDeviation = note.velocity_deviation ?? 0;
  note.velocity_deviation = Math.max(-127, Math.min(127, currentDeviation + velocityRange));
}

function applyProbabilityOffset(note, probability) {
  if (probability == null) {
    return;
  }
  const currentProbability = note.probability ?? 1;
  note.probability = Math.max(0, Math.min(1, currentProbability + probability));
}

function applyMidiParams(clip, {velocityMin: velocityMin, velocityMax: velocityMax, transposeMin: transposeMin, transposeMax: transposeMax, transposeValuesArray: transposeValuesArray, durationMin: durationMin, durationMax: durationMax, velocityRange: velocityRange, probability: probability}, rng) {
  const lengthBeats = clip.getProperty("length");
  const notesDictionary = clip.call("get_notes_extended", 0, 128, 0, lengthBeats);
  const notesData = JSON.parse(notesDictionary);
  const notes = notesData.notes;
  if (notes.length > 0) {
    for (const note of notes) {
      applyVelocityOffset(note, velocityMin, velocityMax, rng);
      applyTranspose(note, {
        transposeValuesArray: transposeValuesArray,
        transposeMin: transposeMin,
        transposeMax: transposeMax
      }, rng);
      applyDurationMultiplier(note, durationMin, durationMax, rng);
      applyVelocityDeviation(note, velocityRange);
      applyProbabilityOffset(note, probability);
    }
    clip.call("apply_note_modifications", JSON.stringify({
      notes: notes
    }));
  }
}

function hasAudioTransformParams(gainDbMin, gainDbMax, transposeMin, transposeMax, transposeValues) {
  return gainDbMin != null || gainDbMax != null || transposeMin != null || transposeMax != null || transposeValues != null;
}

function hasMidiTransformParams(velocityMin, velocityMax, transposeMin, transposeMax, transposeValues, durationMin, durationMax, velocityRange, probability) {
  return velocityMin != null || velocityMax != null || transposeMin != null || transposeMax != null || transposeValues != null || durationMin != null || durationMax != null || velocityRange != null || probability != null;
}

function applyAudioTransformIfNeeded(clip, audioParams, rng, warnings) {
  const isAudioClip = clip.getProperty("is_audio_clip") > 0;
  if (!isAudioClip) {
    if (!warnings.has("audio-params-midi-clip")) {
      warn("audio parameters ignored for MIDI clips");
      warnings.add("audio-params-midi-clip");
    }
    return;
  }
  applyAudioParams(clip, audioParams, rng);
}

function applyMidiTransformIfNeeded(clip, midiParams, rng, warnings) {
  const isMidiClip = clip.getProperty("is_midi_clip") === 1;
  if (!isMidiClip) {
    if (!warnings.has("midi-params-audio-clip")) {
      warn("MIDI parameters ignored for audio clips");
      warnings.add("midi-params-audio-clip");
    }
    return;
  }
  applyMidiParams(clip, midiParams, rng);
}

function applyParameterTransforms(clips, {gainDbMin: gainDbMin, gainDbMax: gainDbMax, transposeMin: transposeMin, transposeMax: transposeMax, transposeValues: transposeValues, transposeValuesArray: transposeValuesArray, velocityMin: velocityMin, velocityMax: velocityMax, durationMin: durationMin, durationMax: durationMax, velocityRange: velocityRange, probability: probability}, rng, warnings) {
  const hasAudioParams = hasAudioTransformParams(gainDbMin, gainDbMax, transposeMin, transposeMax, transposeValues);
  const hasMidiParams = hasMidiTransformParams(velocityMin, velocityMax, transposeMin, transposeMax, transposeValues, durationMin, durationMax, velocityRange, probability);
  for (const clip of clips) {
    if (hasAudioParams) {
      applyAudioTransformIfNeeded(clip, {
        gainDbMin: gainDbMin,
        gainDbMax: gainDbMax,
        transposeMin: transposeMin,
        transposeMax: transposeMax,
        transposeValuesArray: transposeValuesArray
      }, rng, warnings);
    }
    if (hasMidiParams) {
      applyMidiTransformIfNeeded(clip, {
        velocityMin: velocityMin,
        velocityMax: velocityMax,
        transposeMin: transposeMin,
        transposeMax: transposeMax,
        transposeValuesArray: transposeValuesArray,
        durationMin: durationMin,
        durationMax: durationMax,
        velocityRange: velocityRange,
        probability: probability
      }, rng, warnings);
    }
  }
}

function performShuffling(arrangementClips, clips, warnings, rng, context) {
  if (arrangementClips.length === 0) {
    if (!warnings.has("shuffle-no-arrangement")) {
      warn("shuffleOrder requires arrangement clips");
      warnings.add("shuffle-no-arrangement");
    }
    return;
  }
  if (arrangementClips.length <= 1) {
    return;
  }
  const sortedClips = [ ...arrangementClips ].sort((a, b) => a.getProperty("start_time") - b.getProperty("start_time"));
  const gaps = [];
  for (let i = 0; i < sortedClips.length - 1; i++) {
    const currentClip = sortedClips[i];
    const nextClip = sortedClips[i + 1];
    const clipEnd = currentClip.getProperty("start_time") + currentClip.getProperty("length");
    const nextStart = nextClip.getProperty("start_time");
    gaps.push(nextStart - clipEnd);
  }
  const shuffledClips = shuffleArray(sortedClips, rng);
  const firstSortedClip = sortedClips[0];
  const startPosition = firstSortedClip.getProperty("start_time");
  let currentPos = startPosition;
  const targetPositions = shuffledClips.map((clip, i) => {
    const pos = currentPos;
    currentPos += clip.getProperty("length");
    if (i < gaps.length) currentPos += gaps[i];
    return pos;
  });
  const seenTrackIndices = new Set;
  const holdingPositions = shuffledClips.map((clip, index) => {
    const trackIndex = clip.trackIndex;
    if (trackIndex != null) {
      seenTrackIndices.add(trackIndex);
    }
    const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
    const holdingPos = context.holdingAreaStartBeats + index * 100;
    const result = track.call("duplicate_clip_to_arrangement", clip.id, holdingPos);
    const tempClip = LiveAPI.from(result);
    if (!tempClip.exists()) {
      throw new Error(`Failed to duplicate clip ${clip.id} during shuffle`);
    }
    track.call("delete_clip", clip.id);
    return {
      tempClip: tempClip,
      track: track,
      targetPosition: targetPositions[index]
    };
  });
  for (const {tempClip: tempClip, track: track, targetPosition: targetPosition} of holdingPositions) {
    const finalResult = track.call("duplicate_clip_to_arrangement", tempClip.id, targetPosition);
    const finalClip = LiveAPI.from(finalResult);
    if (!finalClip.exists()) {
      throw new Error(`Failed to move clip ${tempClip.id} from holding during shuffle`);
    }
    track.call("delete_clip", tempClip.id);
  }
  const allFreshClips = [];
  for (const trackIndex of seenTrackIndices) {
    const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
    const freshClipIds = track.getChildIds("arrangement_clips");
    allFreshClips.push(...freshClipIds.map(id => LiveAPI.from(id)));
  }
  clips.length = 0;
  clips.push(...allFreshClips);
}

function shuffleArray(array, rng) {
  const shuffled = [ ...array ];
  for (let i = shuffled.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    const temp = shuffled[i];
    shuffled[i] = shuffled[j];
    shuffled[j] = temp;
  }
  return shuffled;
}

function iterateSlicePositions(sourceClip, sliceBeats, currentStartTime, currentEndTime, sliceHandler) {
  const clipStartMarker = sourceClip.getProperty("start_marker");
  let currentSlicePosition = currentStartTime + sliceBeats;
  let currentContentOffset = sliceBeats;
  while (currentSlicePosition < currentEndTime - .001) {
    const sliceLengthNeeded = Math.min(sliceBeats, currentEndTime - currentSlicePosition);
    const sliceContentStart = clipStartMarker + currentContentOffset;
    const sliceContentEnd = sliceContentStart + sliceLengthNeeded;
    sliceHandler(sliceContentStart, sliceContentEnd, currentSlicePosition);
    currentSlicePosition += sliceBeats;
    currentContentOffset += sliceBeats;
  }
}

function sliceUnloopedMidiContent(sourceClip, track, sliceBeats, currentStartTime, currentEndTime) {
  iterateSlicePositions(sourceClip, sliceBeats, currentStartTime, currentEndTime, (sliceContentStart, sliceContentEnd, slicePosition) => {
    const duplicateResult = track.call("duplicate_clip_to_arrangement", sourceClip.id, slicePosition);
    const sliceClip = LiveAPI.from(duplicateResult);
    if (!sliceClip.exists()) {
      throw new Error(`Failed to duplicate clip ${sourceClip.id} for MIDI slice at ${slicePosition}`);
    }
    setClipMarkersWithLoopingWorkaround(sliceClip, {
      startMarker: sliceContentStart,
      endMarker: sliceContentEnd
    });
  });
}

function sliceUnloopedAudioContent(sourceClip, track, sliceBeats, currentStartTime, currentEndTime, _context) {
  iterateSlicePositions(sourceClip, sliceBeats, currentStartTime, currentEndTime, (sliceContentStart, sliceContentEnd, slicePosition) => {
    revealAudioContentAtPosition(sourceClip, track, sliceContentStart, sliceContentEnd, slicePosition);
  });
}

function prepareSliceParams(slice, arrangementClips, warnings) {
  if (slice == null) {
    return null;
  }
  if (arrangementClips.length === 0) {
    if (!warnings.has("slice-no-arrangement")) {
      warn("slice requires arrangement clips");
      warnings.add("slice-no-arrangement");
    }
    return null;
  }
  const liveSet = LiveAPI.from("live_set");
  const songTimeSigNumerator = liveSet.getProperty("signature_numerator");
  const songTimeSigDenominator = liveSet.getProperty("signature_denominator");
  const sliceBeats = barBeatDurationToAbletonBeats(slice, songTimeSigNumerator, songTimeSigDenominator);
  if (sliceBeats <= 0) {
    throw new Error("slice must be greater than 0");
  }
  return sliceBeats;
}

function performSlicing(arrangementClips, sliceBeats, clips, _warnings, slice, _context) {
  const holdingAreaStart = _context.holdingAreaStartBeats;
  let totalSlicesCreated = 0;
  const slicedClipRanges = new Map;
  for (const clip of arrangementClips) {
    const isMidiClip = clip.getProperty("is_midi_clip") === 1;
    const isLooping = clip.getProperty("looping") > 0;
    const currentStartTime = clip.getProperty("start_time");
    const currentEndTime = clip.getProperty("end_time");
    const currentArrangementLength = currentEndTime - currentStartTime;
    if (currentArrangementLength < sliceBeats) {
      continue;
    }
    const sliceCount = Math.ceil(currentArrangementLength / sliceBeats);
    if (totalSlicesCreated + sliceCount > MAX_SLICES) {
      throw new Error(`Slicing at ${slice} would create ${sliceCount} slices for a ${currentArrangementLength}-beat clip. Maximum ${MAX_SLICES} slices total. Use a longer slice duration.`);
    }
    const trackIndex = clip.trackIndex;
    if (trackIndex == null) {
      throw new Error(`transformClips failed: could not determine trackIndex for clip ${clip.id}`);
    }
    const track = LiveAPI.from(`live_set tracks ${trackIndex}`);
    const originalClipId = clip.id;
    slicedClipRanges.set(originalClipId, {
      trackIndex: trackIndex,
      startTime: currentStartTime,
      endTime: currentEndTime
    });
    const {holdingClipId: holdingClipId} = createShortenedClipInHolding(clip, track, sliceBeats, holdingAreaStart, isMidiClip, _context);
    const holdingClip = LiveAPI.from(holdingClipId);
    if (!holdingClip.exists()) {
      throw new Error(`Failed to create holding clip for ${originalClipId} during slicing`);
    }
    track.call("delete_clip", originalClipId);
    const movedClip = moveClipFromHolding(holdingClipId, track, currentStartTime);
    const remainingLength = currentArrangementLength - sliceBeats;
    if (remainingLength > 0) {
      if (isLooping) {
        tileClipToRange(movedClip, track, currentStartTime + sliceBeats, remainingLength, holdingAreaStart, _context, {
          adjustPreRoll: true,
          tileLength: sliceBeats
        });
      } else if (isMidiClip) {
        sliceUnloopedMidiContent(movedClip, track, sliceBeats, currentStartTime, currentEndTime);
      } else {
        sliceUnloopedAudioContent(movedClip, track, sliceBeats, currentStartTime, currentEndTime);
      }
    }
    totalSlicesCreated += sliceCount;
  }
  for (const [oldClipId, range] of slicedClipRanges) {
    const track = LiveAPI.from(`live_set tracks ${range.trackIndex}`);
    const trackClipIds = track.getChildIds("arrangement_clips");
    const EPSILON = .001;
    const freshClips = trackClipIds.map(id => LiveAPI.from(id)).filter(c => {
      const clipStart = c.getProperty("start_time");
      return clipStart >= range.startTime - EPSILON && clipStart < range.endTime - EPSILON;
    });
    const staleIndex = clips.findIndex(c => c.id === oldClipId);
    if (staleIndex !== -1) {
      clips.splice(staleIndex, 1, ...freshClips);
    }
  }
}

function transformClips({clipIds: clipIds, arrangementTrackIndex: arrangementTrackIndex, arrangementStart: arrangementStart, arrangementLength: arrangementLength, slice: slice, shuffleOrder: shuffleOrder, gainDbMin: gainDbMin, gainDbMax: gainDbMax, transposeMin: transposeMin, transposeMax: transposeMax, transposeValues: transposeValues, velocityMin: velocityMin, velocityMax: velocityMax, durationMin: durationMin, durationMax: durationMax, velocityRange: velocityRange, probability: probability, seed: seed} = {}, context = {}) {
  const actualSeed = seed ?? Date.now();
  const rng = createSeededRNG(actualSeed);
  const transposeValuesArray = parseTransposeValues(transposeValues, transposeMin, transposeMax);
  const clipIdArray = getClipIds(clipIds, arrangementTrackIndex, arrangementStart, arrangementLength);
  if (clipIdArray.length === 0) {
    warn("no clips found in arrangement range");
    return {
      clipIds: [],
      seed: actualSeed
    };
  }
  const clips = validateIdTypes(clipIdArray, "clip", "transformClips", {
    skipInvalid: true
  });
  if (clips.length === 0) {
    warn("no valid clips found");
    return {
      clipIds: [],
      seed: actualSeed
    };
  }
  const warnings = new Set;
  const arrangementClips = clips.filter(clip => clip.getProperty("is_arrangement_clip") > 0);
  const sliceBeats = prepareSliceParams(slice, arrangementClips, warnings);
  if (slice != null && sliceBeats != null && arrangementClips.length > 0) {
    performSlicing(arrangementClips, sliceBeats, clips, warnings, slice, context);
    const freshArrangementClips = clips.filter(clip => clip.getProperty("is_arrangement_clip") > 0);
    arrangementClips.length = 0;
    arrangementClips.push(...freshArrangementClips);
  }
  if (shuffleOrder) {
    performShuffling(arrangementClips, clips, warnings, rng, context);
  }
  applyParameterTransforms(clips, {
    gainDbMin: gainDbMin,
    gainDbMax: gainDbMax,
    transposeMin: transposeMin,
    transposeMax: transposeMax,
    transposeValues: transposeValues,
    transposeValuesArray: transposeValuesArray,
    velocityMin: velocityMin,
    velocityMax: velocityMax,
    durationMin: durationMin,
    durationMax: durationMax,
    velocityRange: velocityRange,
    probability: probability
  }, rng, warnings);
  const affectedClipIds = clips.map(clip => clip.id);
  return {
    clipIds: affectedClipIds,
    seed: actualSeed
  };
}

function loadItem({uri: uri, trackId: trackId, position: position}) {
  const browser = LiveAPI.from("live_set browser");
  if (!browser.exists()) {
    throw new Error("Browser not available in this Live version");
  }
  const item = findItemByUri(browser, uri);
  if (!item) {
    throw new Error(`Browser item not found: ${uri}`);
  }
  if (!item.is_loadable) {
    throw new Error(`Item is not loadable: ${item.name}`);
  }
  const view = LiveAPI.from("live_set view");
  let targetTrackId = trackId;
  if (!targetTrackId) {
    targetTrackId = view.getProperty("selected_track");
  }
  const track = LiveAPI.from(targetTrackId);
  if (!track.exists()) {
    throw new Error(`Track not found: ${targetTrackId}`);
  }
  if (position && item.is_device) {
    const selectedDevice = track.getProperty("view.selected_device");
    if (selectedDevice) {
      const selectedDeviceApi = LiveAPI.from(selectedDevice);
      const deviceIndex = selectedDeviceApi.deviceIndex;
      if (deviceIndex != null) {
        if (position === "replace") {
          selectedDeviceApi.call("canonical_parent.delete_device", deviceIndex);
        } else if (position === "before") {
          warn("before/after positioning not directly supported; item will be appended to device chain");
        }
      }
    }
  }
  browser.call("load_item", item);
  return {
    loaded: true,
    uri: uri,
    trackId: targetTrackId,
    message: `Loaded ${item.name}`
  };
}

function findItemByUri(browser, uri) {
  const categories = [ "audio_effects", "clips", "current_project", "drums", "instruments", "midi_effects", "packs", "plugins", "samples", "sounds", "user_library" ];
  for (const category of categories) {
    const rootItem = browser.getProperty(category);
    if (rootItem) {
      const found = searchItemByUri(rootItem, uri);
      if (found) {
        return found;
      }
    }
  }
  const legacyLibs = browser.getProperty("legacy_libraries");
  if (legacyLibs) {
    for (const lib of legacyLibs) {
      const found = searchItemByUri(lib, uri);
      if (found) {
        return found;
      }
    }
  }
  const userFolders = browser.getProperty("user_folders");
  if (userFolders) {
    for (const folder of userFolders) {
      const found = searchItemByUri(folder, uri);
      if (found) {
        return found;
      }
    }
  }
  return null;
}

function searchItemByUri(item, uri) {
  if (item.uri === uri) {
    return item;
  }
  if (item.is_folder) {
    const iterator = item.iter_children();
    let child = iterator.next();
    while (child) {
      const found = searchItemByUri(child, uri);
      if (found) {
        return found;
      }
      child = iterator.next();
    }
  }
  return null;
}

const MAX_ITEMS = 1e3;

const DEFAULT_MAX_DEPTH = 2;

function readBrowser({category: category = "user_library", path: path, search: search, maxDepth: maxDepth = DEFAULT_MAX_DEPTH} = {}) {
  const browser = LiveAPI.from("live_set browser");
  if (!browser.exists()) {
    throw new Error("Browser not available in this Live version");
  }
  const rootItem = browser.getProperty(category);
  if (!rootItem) {
    throw new Error(`Browser category "${category}" not found`);
  }
  let currentItem = rootItem;
  if (path) {
    const pathParts = path.split("/").filter(p => p.length > 0);
    for (const part of pathParts) {
      const found = findChildByName(currentItem, part);
      if (!found) {
        throw new Error(`Path not found: ${path} (stopped at "${part}")`);
      }
      currentItem = found;
    }
  }
  const items = [];
  const limitReached = {
    value: false
  };
  const searchLower = search ? search.toLowerCase() : null;
  collectItems(currentItem, items, limitReached, searchLower, maxDepth, 0);
  if (limitReached.value) {
    warn(`Stopped scanning browser at ${MAX_ITEMS} items. Use search or path to narrow results.`);
  }
  return {
    category: `${category}${path ? `/${path}` : ""}`,
    items: items,
    limitReached: limitReached.value
  };
}

function findChildByName(parent, name) {
  const nameLower = name.toLowerCase();
  const iterator = parent.iter_children();
  let child = iterator.next();
  while (child) {
    if (child.name.toLowerCase() === nameLower) {
      return child;
    }
    child = iterator.next();
  }
  return null;
}

function collectItems(item, results, limitReached, searchLower, maxDepth, currentDepth) {
  if (limitReached.value) {
    return;
  }
  const iterator = item.iter_children();
  let child = iterator.next();
  while (child) {
    if (results.length >= MAX_ITEMS) {
      limitReached.value = true;
      return;
    }
    const matchesSearch = !searchLower || child.name.toLowerCase().includes(searchLower);
    if (matchesSearch) {
      const itemInfo = {
        name: child.name,
        uri: child.uri,
        isFolder: child.is_folder,
        isLoadable: child.is_loadable
      };
      if (child.is_folder && currentDepth < maxDepth) {
        const childItems = [];
        collectItems(child, childItems, limitReached, searchLower, maxDepth, currentDepth + 1);
        if (childItems.length > 0) {
          itemInfo.children = childItems;
        }
      }
      results.push(itemInfo);
    } else if (child.is_folder && currentDepth < maxDepth) {
      collectItems(child, results, limitReached, searchLower, maxDepth, currentDepth + 1);
    }
    child = iterator.next();
  }
}

const MAX_SAMPLE_FILES = 1e3;

const AUDIO_EXTENSIONS = new Set([ ".wav", ".aiff", ".aif", ".aifc", ".flac", ".ogg", ".mp3", ".m4a" ]);

function readSamples({search: search} = {}, context = {}) {
  if (!context.sampleFolder) {
    throw new Error("A sample folder must first be selected in the Setup tab of the Producer Pal Max for Live device");
  }
  let sampleFolder = context.sampleFolder;
  if (!sampleFolder.endsWith("/")) {
    sampleFolder = `${sampleFolder}/`;
  }
  const samples = [];
  const limitReached = {
    value: false
  };
  const searchLower = search ? search.toLowerCase() : null;
  scanFolder(sampleFolder, sampleFolder, samples, limitReached, searchLower);
  if (limitReached.value) {
    warn(`Stopped scanning for samples at ${MAX_SAMPLE_FILES} files. Consider using a smaller sample folder.`);
  }
  return {
    sampleFolder: sampleFolder,
    samples: samples
  };
}

function scanFolder(dirPath, baseFolder, results, limitReached, searchLower) {
  const f = new Folder(dirPath);
  while (!f.end) {
    if (results.length >= MAX_SAMPLE_FILES) {
      limitReached.value = true;
      f.close();
      return;
    }
    const filepath = `${f.pathname}${f.filename}`;
    if (f.filetype === "fold") {
      scanFolder(`${filepath}/`, baseFolder, results, limitReached, searchLower);
    } else if (AUDIO_EXTENSIONS.has(f.extension.toLowerCase())) {
      const relativePath = filepath.substring(baseFolder.length);
      if (!searchLower || relativePath.toLowerCase().includes(searchLower)) {
        results.push(relativePath);
      }
    }
    f.next();
  }
  f.close();
}

function captureScene({sceneIndex: sceneIndex, name: name} = {}) {
  const liveSet = LiveAPI.from("live_set");
  const appView = LiveAPI.from("live_set view");
  if (sceneIndex != null) {
    const scene = LiveAPI.from(`live_set scenes ${sceneIndex}`);
    appView.set("selected_scene", `id ${scene.id}`);
  }
  const selectedScene = LiveAPI.from("live_set view selected_scene");
  const selectedSceneIndex = Number.parseInt(selectedScene.path.match(/live_set scenes (\d+)/)?.[1] ?? "");
  if (Number.isNaN(selectedSceneIndex)) {
    throw new Error(`capture-scene failed: couldn't determine selected scene index`);
  }
  liveSet.call("capture_and_insert_scene");
  const newSceneIndex = selectedSceneIndex + 1;
  const newScene = LiveAPI.from(`live_set scenes ${newSceneIndex}`);
  if (name != null) {
    newScene.set("name", name);
  }
  const clips = [];
  const trackIds = liveSet.getChildIds("tracks");
  for (let trackIndex = 0; trackIndex < trackIds.length; trackIndex++) {
    const clip = LiveAPI.from(`live_set tracks ${trackIndex} clip_slots ${newSceneIndex} clip`);
    if (clip.exists()) {
      clips.push({
        id: clip.id,
        trackIndex: trackIndex
      });
    }
  }
  return {
    id: newScene.id,
    sceneIndex: newSceneIndex,
    clips: clips
  };
}

function applyTempoProperty(scene, tempo) {
  if (tempo === -1) {
    scene.set("tempo_enabled", false);
  } else if (tempo != null) {
    scene.set("tempo", tempo);
    scene.set("tempo_enabled", true);
  }
}

function applyTimeSignatureProperty(scene, timeSignature) {
  if (timeSignature === "disabled") {
    scene.set("time_signature_enabled", false);
  } else if (timeSignature != null) {
    const parsed = parseTimeSignature(timeSignature);
    scene.set("time_signature_numerator", parsed.numerator);
    scene.set("time_signature_denominator", parsed.denominator);
    scene.set("time_signature_enabled", true);
  }
}

function createScene({sceneIndex: sceneIndex, count: count = 1, capture: capture = false, name: name, color: color, tempo: tempo, timeSignature: timeSignature, switchView: switchView} = {}, _context = {}) {
  if (capture) {
    const result = captureScene({
      sceneIndex: sceneIndex,
      name: name
    });
    applyCaptureProperties(result, {
      color: color,
      tempo: tempo,
      timeSignature: timeSignature
    });
    if (switchView) {
      select({
        view: "session"
      });
    }
    return result;
  }
  validateCreateSceneArgs(sceneIndex, count);
  const validatedSceneIndex = sceneIndex;
  const liveSet = LiveAPI.from("live_set");
  ensureSceneCountForIndex(liveSet, validatedSceneIndex);
  const createdScenes = [];
  let currentIndex = validatedSceneIndex;
  for (let i = 0; i < count; i++) {
    const sceneResult = createSingleScene(liveSet, currentIndex, i, count, name, color, tempo, timeSignature);
    createdScenes.push(sceneResult);
    currentIndex++;
  }
  if (switchView) {
    select({
      view: "session"
    });
  }
  return count === 1 ? createdScenes[0] : createdScenes;
}

function applySceneProperties(scene, props) {
  const {color: color, tempo: tempo, timeSignature: timeSignature} = props;
  if (color != null) {
    scene.setColor(color);
  }
  applyTempoProperty(scene, tempo);
  applyTimeSignatureProperty(scene, timeSignature);
}

function buildSceneName(name, index, count) {
  if (name == null) {
    return;
  }
  if (count === 1 || index === 0) {
    return name;
  }
  return `${name} ${index + 1}`;
}

function validateCreateSceneArgs(sceneIndex, count) {
  if (sceneIndex == null) {
    throw new Error("createScene failed: sceneIndex is required");
  }
  if (count < 1) {
    throw new Error("createScene failed: count must be at least 1");
  }
  if (sceneIndex + count > MAX_AUTO_CREATED_SCENES) {
    throw new Error(`createScene failed: creating ${count} scenes at index ${sceneIndex} would exceed the maximum allowed scenes (${MAX_AUTO_CREATED_SCENES})`);
  }
}

function ensureSceneCountForIndex(liveSet, sceneIndex) {
  const currentSceneCount = liveSet.getChildIds("scenes").length;
  if (sceneIndex > currentSceneCount) {
    const scenesToPad = sceneIndex - currentSceneCount;
    for (let i = 0; i < scenesToPad; i++) {
      liveSet.call("create_scene", -1);
    }
  }
}

function applyCaptureProperties(result, props) {
  const {color: color, tempo: tempo, timeSignature: timeSignature} = props;
  if (color != null || tempo != null || timeSignature != null) {
    const scene = LiveAPI.from(`live_set scenes ${result.sceneIndex}`);
    applySceneProperties(scene, {
      color: color,
      tempo: tempo,
      timeSignature: timeSignature
    });
  }
}

function createSingleScene(liveSet, sceneIndex, creationIndex, count, name, color, tempo, timeSignature) {
  liveSet.call("create_scene", sceneIndex);
  const scene = LiveAPI.from(`live_set scenes ${sceneIndex}`);
  const sceneName = buildSceneName(name, creationIndex, count);
  if (sceneName != null) {
    scene.set("name", sceneName);
  }
  applySceneProperties(scene, {
    color: color,
    tempo: tempo,
    timeSignature: timeSignature
  });
  return {
    id: scene.id,
    sceneIndex: sceneIndex
  };
}

function updateScene({ids: ids, name: name, color: color, tempo: tempo, timeSignature: timeSignature} = {}, _context = {}) {
  if (!ids) {
    throw new Error("updateScene failed: ids is required");
  }
  const sceneIds = parseCommaSeparatedIds(ids);
  const scenes = validateIdTypes(sceneIds, "scene", "updateScene", {
    skipInvalid: true
  });
  const updatedScenes = [];
  for (const scene of scenes) {
    if (name != null) {
      scene.set("name", name);
    }
    if (color != null) {
      scene.setColor(color);
      verifyColorQuantization(scene, color);
    }
    applyTempoProperty(scene, tempo);
    applyTimeSignatureProperty(scene, timeSignature);
    updatedScenes.push({
      id: scene.id
    });
  }
  return unwrapSingleResult(updatedScenes);
}

function createSingleTrack(liveSet, type, currentIndex) {
  let result;
  if (type === "return") {
    result = liveSet.call("create_return_track");
  } else if (type === "midi") {
    result = liveSet.call("create_midi_track", currentIndex);
  } else {
    result = liveSet.call("create_audio_track", currentIndex);
  }
  return assertDefined(result[1], "track id from result");
}

function buildTrackName(baseName, count, index, parsedNames = null) {
  if (baseName == null) return;
  if (parsedNames != null) {
    if (index < parsedNames.length) {
      return parsedNames[index];
    }
    const lastName = parsedNames.at(-1);
    const fallbackIndex = index - parsedNames.length + 2;
    return `${lastName} ${fallbackIndex}`;
  }
  return buildIndexedName(baseName, count, index);
}

function getColorForIndex(color, index, parsedColors) {
  if (color == null) return;
  if (parsedColors == null) return color;
  return parsedColors[index % parsedColors.length];
}

function parseCommaSeparated(value, count) {
  if (count <= 1 || !value?.includes(",")) {
    return null;
  }
  return value.split(",").map(v => v.trim());
}

function validateTrackCreation(count, type, trackIndex, effectiveTrackIndex) {
  if (count < 1) {
    throw new Error("createTrack failed: count must be at least 1");
  }
  if (type === "return" && trackIndex != null) {
    warn("createTrack: trackIndex is ignored for return tracks (always added at end)");
  }
  if (type !== "return" && effectiveTrackIndex >= 0 && effectiveTrackIndex + count > MAX_AUTO_CREATED_TRACKS) {
    throw new Error(`createTrack failed: creating ${count} tracks at index ${effectiveTrackIndex} would exceed the maximum allowed tracks (${MAX_AUTO_CREATED_TRACKS})`);
  }
}

function calculateResultIndex(type, effectiveTrackIndex, baseTrackCount, loopIndex) {
  if (type === "return" || effectiveTrackIndex === -1) {
    return baseTrackCount + loopIndex;
  }
  return effectiveTrackIndex + loopIndex;
}

function getBaseTrackCount(liveSet, type, effectiveTrackIndex) {
  if (type === "return") {
    return liveSet.getChildIds("return_tracks").length;
  }
  if (effectiveTrackIndex === -1) {
    return liveSet.getChildIds("tracks").length;
  }
  return 0;
}

function createTrack({trackIndex: trackIndex, count: count = 1, name: name, color: color, type: type = "midi", mute: mute, solo: solo, arm: arm} = {}, _context = {}) {
  const effectiveTrackIndex = trackIndex ?? -1;
  validateTrackCreation(count, type, trackIndex, effectiveTrackIndex);
  const liveSet = LiveAPI.from("live_set");
  const baseTrackCount = getBaseTrackCount(liveSet, type, effectiveTrackIndex);
  const createdTracks = [];
  let currentIndex = effectiveTrackIndex;
  const parsedNames = parseCommaSeparated(name, count);
  const parsedColors = parseCommaSeparated(color, count);
  for (let i = 0; i < count; i++) {
    const trackId = createSingleTrack(liveSet, type, currentIndex);
    const track = LiveAPI.from(`id ${trackId}`);
    track.setAll({
      name: buildTrackName(name, count, i, parsedNames),
      color: getColorForIndex(color, i, parsedColors),
      mute: mute,
      solo: solo,
      arm: arm
    });
    const resultIndex = calculateResultIndex(type, effectiveTrackIndex, baseTrackCount, i);
    createdTracks.push(type === "return" ? {
      id: trackId,
      returnTrackIndex: resultIndex
    } : {
      id: trackId,
      trackIndex: resultIndex
    });
    if (type !== "return" && effectiveTrackIndex !== -1) {
      currentIndex++;
    }
  }
  return count === 1 ? assertDefined(createdTracks[0], "created track") : createdTracks;
}

function applyRoutingProperties(track, params) {
  const {inputRoutingTypeId: inputRoutingTypeId, inputRoutingChannelId: inputRoutingChannelId, outputRoutingTypeId: outputRoutingTypeId, outputRoutingChannelId: outputRoutingChannelId} = params;
  if (inputRoutingTypeId != null) {
    track.setProperty("input_routing_type", {
      identifier: Number(inputRoutingTypeId)
    });
  }
  if (inputRoutingChannelId != null) {
    track.setProperty("input_routing_channel", {
      identifier: Number(inputRoutingChannelId)
    });
  }
  if (outputRoutingTypeId != null) {
    track.setProperty("output_routing_type", {
      identifier: Number(outputRoutingTypeId)
    });
  }
  if (outputRoutingChannelId != null) {
    track.setProperty("output_routing_channel", {
      identifier: Number(outputRoutingChannelId)
    });
  }
}

function applyMonitoringState(track, monitoringState) {
  if (monitoringState == null) {
    return;
  }
  const monitoringValue = {
    [MONITORING_STATE.IN]: LIVE_API_MONITORING_STATE_IN,
    [MONITORING_STATE.AUTO]: LIVE_API_MONITORING_STATE_AUTO,
    [MONITORING_STATE.OFF]: LIVE_API_MONITORING_STATE_OFF
  }[monitoringState];
  if (monitoringValue === void 0) {
    warn(`invalid monitoring state "${monitoringState}". Must be one of: ${Object.values(MONITORING_STATE).join(", ")}`);
    return;
  }
  track.set("current_monitoring_state", monitoringValue);
}

function applySendProperties(track, sendGainDb, sendReturn) {
  if (sendGainDb != null !== (sendReturn != null)) {
    warn("sendGainDb and sendReturn must both be specified");
    return;
  }
  if (sendGainDb == null) {
    return;
  }
  const mixer = LiveAPI.from(track.path + " mixer_device");
  if (!mixer.exists()) {
    warn(`track ${track.id} has no mixer device`);
    return;
  }
  const sends = mixer.getChildren("sends");
  if (sends.length === 0) {
    warn(`track ${track.id} has no sends`);
    return;
  }
  const liveSet = LiveAPI.from("live_set");
  const returnTrackIds = liveSet.getChildIds("return_tracks");
  let sendIndex = -1;
  for (let i = 0; i < returnTrackIds.length; i++) {
    const rt = LiveAPI.from(`live_set return_tracks ${i}`);
    const name = rt.getProperty("name");
    if (name === sendReturn || name.startsWith(sendReturn + "-")) {
      sendIndex = i;
      break;
    }
  }
  if (sendIndex === -1) {
    warn(`no return track found matching "${sendReturn}"`);
    return;
  }
  if (sendIndex >= sends.length) {
    warn(`send ${sendIndex} doesn't exist on track ${track.id}`);
    return;
  }
  assertDefined(sends[sendIndex], `send at index ${sendIndex}`).set("display_value", sendGainDb);
}

function applyStereoPan(mixer, pan, leftPan, rightPan) {
  if (pan != null) {
    const panning = LiveAPI.from(mixer.path + " panning");
    if (panning.exists()) {
      panning.set("value", pan);
    }
  }
  if (leftPan != null || rightPan != null) {
    warn("updateTrack: leftPan and rightPan have no effect in stereo panning mode. Set panningMode to 'split' or use 'pan' instead.");
  }
}

function applySplitPan(mixer, pan, leftPan, rightPan) {
  if (leftPan != null) {
    const leftSplit = LiveAPI.from(mixer.path + " left_split_stereo");
    if (leftSplit.exists()) {
      leftSplit.set("value", leftPan);
    }
  }
  if (rightPan != null) {
    const rightSplit = LiveAPI.from(mixer.path + " right_split_stereo");
    if (rightSplit.exists()) {
      rightSplit.set("value", rightPan);
    }
  }
  if (pan != null) {
    warn("updateTrack: pan has no effect in split panning mode. Set panningMode to 'stereo' or use leftPan/rightPan instead.");
  }
}

function applyMixerProperties(track, params) {
  const {gainDb: gainDb, pan: pan, panningMode: panningMode, leftPan: leftPan, rightPan: rightPan} = params;
  const mixer = LiveAPI.from(track.path + " mixer_device");
  if (!mixer.exists()) {
    return;
  }
  if (gainDb != null) {
    const volume = LiveAPI.from(mixer.path + " volume");
    if (volume.exists()) {
      volume.set("display_value", gainDb);
    }
  }
  const currentMode = mixer.getProperty("panning_mode");
  const currentIsSplit = currentMode === 1;
  if (panningMode != null) {
    const newMode = panningMode === "split" ? 1 : 0;
    mixer.set("panning_mode", newMode);
  }
  const effectiveMode = panningMode ?? (currentIsSplit ? "split" : "stereo");
  if (effectiveMode === "stereo") {
    applyStereoPan(mixer, pan, leftPan, rightPan);
  } else {
    applySplitPan(mixer, pan, leftPan, rightPan);
  }
}

function updateTrack({ids: ids, name: name, color: color, gainDb: gainDb, pan: pan, panningMode: panningMode, leftPan: leftPan, rightPan: rightPan, mute: mute, solo: solo, arm: arm, inputRoutingTypeId: inputRoutingTypeId, inputRoutingChannelId: inputRoutingChannelId, outputRoutingTypeId: outputRoutingTypeId, outputRoutingChannelId: outputRoutingChannelId, monitoringState: monitoringState, arrangementFollower: arrangementFollower, sendGainDb: sendGainDb, sendReturn: sendReturn}, _context = {}) {
  if (!ids) {
    throw new Error("updateTrack failed: ids is required");
  }
  const trackIds = parseCommaSeparatedIds(ids);
  const tracks = validateIdTypes(trackIds, "track", "updateTrack", {
    skipInvalid: true
  });
  const updatedTracks = [];
  for (const track of tracks) {
    track.setAll({
      name: name,
      color: color,
      mute: mute,
      solo: solo,
      arm: arm
    });
    if (color != null) {
      verifyColorQuantization(track, color);
    }
    if (gainDb != null || pan != null || panningMode != null || leftPan != null || rightPan != null) {
      applyMixerProperties(track, {
        gainDb: gainDb,
        pan: pan,
        panningMode: panningMode,
        leftPan: leftPan,
        rightPan: rightPan
      });
    }
    applyRoutingProperties(track, {
      inputRoutingTypeId: inputRoutingTypeId,
      inputRoutingChannelId: inputRoutingChannelId,
      outputRoutingTypeId: outputRoutingTypeId,
      outputRoutingChannelId: outputRoutingChannelId
    });
    if (arrangementFollower != null) {
      track.set("back_to_arranger", arrangementFollower ? 0 : 1);
    }
    applyMonitoringState(track, monitoringState);
    applySendProperties(track, sendGainDb, sendReturn);
    updatedTracks.push({
      id: track.id
    });
  }
  return unwrapSingleResult(updatedTracks);
}

const skills$1 = `# Producer Pal Skills\n\nYou can now compose music in Ableton Live using Producer Pal tools and the bar|beat notation system.\n\n## Time in Ableton Live\n\n- **Positions** use bar|beat where both bar and beat must be 1 or higher (1|1 = first beat, 2|3.5 = bar 2 beat 3.5)\n- **Durations** in beats (4 = 4 beats, 2.5 = 2.5 beats, 3/4 = 0.75 beats)\n- Fractional beats supported\n\n## MIDI Notation\n\nPitches: C3, C#3, Db3, F#2, Bb4 (range: C0-B8, middle C = C3)\nFormat: pitch(es) bar|beat\n\n## Examples\n\n### Melodies and Bass Lines\n\`\`\`\nC3 1|1\nD3 1|2\nE3 1|3\nF3 1|4\nG3 2|1\nA3 2|2\nB3 2|3\nC4 2|4\n\`\`\`\n\n### Sustained Chord Progressions (4/4 time)\nSet duration with t (t4 = 4 beats, t2.5 = 2.5 beats).\nUse t4 for full-bar chords in 4/4 (t3 in 3/4, t6 in 6/8):\n\`\`\`\nt4\nC3 E3 G3 1|1\nD3 F3 A3 2|1\nE3 G3 B3 3|1\nF3 A3 C4 4|1\n\`\`\`\n\n\n### Drum Patterns (plan one bar at a time)\nAfter bar|beat, use commas for additional beats in the same bar (no bar| prefix):\n\`\`\`\n// bar 1\nC1 1|1,3              # kick on bar 1, beats 1 and 3\nD1 1|2,4              # snare on bar 1, beats 2 and 4\nGb1 1|1.5,2.5,3.5,4.5 # hats on bar 1, off-beats\n// bar 2\nC1 2|1,2,3,4          # kick on bar 2, beats 1, 2, 3, and 4\nD1 2|2,4              # snare on bar 2, beats 2 and 4\nGb1 2|1.5,2.5,3.5,4.5 # hats on bar 2, off-beats\n\`\`\`\n\n## Rules\n- Use only the notation features shown in the examples above\n- Set clip lengths explicitly (use bar:beat durations like 4:0 for 4 bars)\n- To remove notes from a clip, delete the clip and create a new one\n- Always call ppal-read-live-set before creating or updating anything\n- If the user references a track, get its trackIndex and id - never guess\n`;

function buildInstructions$1(context) {
  const projectNotes = context?.projectNotes;
  return "Do this now to complete Producer Pal initialization:\n" + [ "* Summarize the Live Set", ...projectNotes?.content ? [ `* Summarize the project notes${projectNotes.writable ? ", and mention you can update the project notes" : ""}` ] : [], "* Say the messagesForUser", "* Ask what they'd like to create" ].join("\n");
}

const skills = `# Producer Pal Skills\n\nYou can now compose music in Ableton Live using Producer Pal tools and the bar|beat notation system.\n\n## Time in Ableton Live\n\n- Positions: bar|beat where both bar and beat must be 1 or higher (1|1 = first beat, 2|3.5 = bar 2 beat 3.5, 1|2+1/3 = bar 1 beat 2 and a third)\n- Durations: beats (2.5, 3/4, /4 = 1/4) or bar:beat (1:2 = 1 bar + 2 beats, 4:0 = 4 bars)\n- Fractional beats: decimals (2.5), fractions (5/2), or mixed numbers (2+1/3) for both positions and durations\n- Fraction shortcut: numerator defaults to 1 when omitted (/4 = 1/4, /3 = 1/3)\n\n## MIDI Syntax\n\nCreate MIDI clips using the bar|beat notation syntax:\n\n\`[v0-127] [t<duration>] [p0-1] note(s) bar|beat\`\n\n- Notes emit at time positions (bar|beat)\n  - time positions are relative to clip start\n  - \`|beat\` reuses current bar\n  - beat can be a comma-separated (no whitespace) list or repeat pattern\n  - **Repeat patterns**: \`{beat}x{times}[@{step}]\` generates sequences (step optional, uses duration)\n    - \`1|1x4@1\` → beats 1,2,3,4 (explicit step)\n    - \`t0.5 1|1x4\` → beats 1, 1.5, 2, 2.5 (step = duration)\n    - \`1|1x3@1/3\` or \`1|1x3@/3\` → triplets at 1, 4/3, 5/3 (explicit step)\n    - \`t1/3 1|1x3\` or \`t/3 1|1x3\` → triplets at 1, 4/3, 5/3 (step = duration)\n    - \`1|1x16@1/4\` or \`1|1x16@/4\` → full bar of 16ths (explicit step)\n    - \`t1/4 1|1x16\` or \`t/4 1|1x16\` → full bar of 16ths (step = duration)\n- v<velocity>: Note intensity from 0-127 (default: v100)\n  - Single value: v100 (all notes at velocity 100)\n  - Random range: v80-120 (each note gets random velocity between 80-120)\n  - Use ranges for humanization, natural dynamics, and groove feel\n  - \`v0\` deletes earlier notes at same pitch/time (**deletes until disabled** with non-zero v)\n- t<duration>: Note length (default: 1.0)\n  - Beat-only: t2.5 (2.5 beats), t3/4 (0.75 beats), t/4 (0.25 beats), t2+3/4 (2 and three-quarter beats)\n  - Bar:beat: t2:1.5 (2 bars + 1.5 beats), t1:/4 (1 bar + 0.25 beats), t1:2+1/3 (1 bar + 2 and a third beats)\n- p<chance>: Probability from 0.0 to 1.0 (default: 1.0 = always)\n- Notes: C0-B8 with # or b (C3 = middle C)\n- Parameters (v/t/p) and pitch persist until changed\n- copying bars:\n  - **Bar copying MERGES** - target bars keep existing notes; use v0 to remove unwanted notes\n  - @N= copies previous bar to N; @N=M copies bar M; @N-M=P copies bar P to range N-M\n  - @N-M= copies previous bar to range N-M; @N-M=P copies bar P to range N-M\n  - @N-M=P-Q tiles bars P-Q across range N-M (repeating multi-bar patterns)\n  - @clear clears the copy buffer for advanced layering use cases\n  - Bar copying copies note events with their frozen parameters, not current state\n  - After \`@2=1\`, your current v/t/p settings remain unchanged\n\n## Audio Clips\nAudio clip properties are always included in \`ppal-read-clip\` results: \`sampleFile\`,\n\`gainDb\`, \`pitchShift\`, \`sampleLength\`, \`sampleRate\`.\n\n**Understanding audio parameters:**\n- \`gainDb\`: Decibels (0 dB = unity, -6 dB = half volume, +12 dB = 4x volume)\n- \`pitchShift\`: Semitones (e.g., -2.5 = down 2.5 semitones)\n- These parameters are ignored when updating MIDI clips (no error)\n\n## Examples\n\n\`\`\`\nC3 E3 G3 1|1 // chord at bar 1 beat 1\nC3 E3 G3 1|1,2,3,4 // same chord on every beat\nC1 1|1x4@1 // kick on every beat (explicit step)\nt1 C1 1|1x4 // same as above (step = duration)\nC1 1|1,2,3,4 // same as above (comma-separated beats)\nC1 1|1 |2 |3 |4 // same as above (pitch persistence)\nv100 C3 1|1 D3 |2.5 // C at beat 1, D at beat 2.5\nt0.25 C3 1|1.75 // 16th note at beat 1.75\nt1/3 C3 1|1x3 // triplet eighth notes (step = duration)\nt/3 C3 1|1x3 // same as above (numerator defaults to 1)\nt1/3 C3 1|1,4/3,5/3 // same as above (fractional notation)\nt1/4 Gb1 1|1x16 // full bar of 16th note hi-hats (step = duration)\nt/4 Gb1 1|1x16 // same as above (numerator defaults to 1)\nt1+1/4 C3 D3 E3 1|1,1+1/3,1+2/3 // mixed numbers for natural musician notation\nC3 D3 1|1 v0 C3 1|1 // delete earlier C3 (D3 remains)\nC3 E3 G3 1|1,2,3,4 v0 C3 E3 G3 1|2 // delete chord at beat 2 only\nC3 D3 1|1 @2=1 v0 D3 2|1 // bar copy then delete D3 from bar 2\nv90-110 C1 1|1,3 D1 |2,4 // humanized drum pattern\nv60-80 Gb1 1|1.5,2.5,3.5,4.5 // natural hi-hat feel\np0.5 C1 1|1,2,3,4 // 50% chance each kick plays\np1.0 D1 1|2,4 // back to 100% - snare always plays\n\`\`\`\n\n## Techniques\n\n### Repeating Patterns\n\nUse repeat syntax (\`x{times}[@{step}]\`), copy features, and pitch persistence:\n- **Repeat syntax**: Best for regular subdivisions (16ths, triplets, every beat)\n  - \`t1 C1 1|1x4\` for kicks on every beat (step = duration)\n  - \`t0.5 Gb1 1|1x8\` for eighth notes (step = duration)\n  - \`t1/3 C3 1|1x3\` or \`t/3 C3 1|1x3\` for triplets (step = duration)\n  - Step is optional - omit @step to use current duration\n  - Explicit step still works: \`C1 1|1x4@1\`, \`Gb1 1|1x8@0.5\`, \`C3 1|1x3@1/3\` or \`C3 1|1x3@/3\`\n- **Bar copy**: Best for multi-bar patterns and complex rhythms\n- Within each bar, group by instrument to leverage pitch persistence for multiple time positions\n- Use shorthand beat lists for irregular patterns\n- Think it through: Complete the full bar first, then copy\n\n\`\`\`\nC1 1|1,3 D1 |2,4 // bar 1\n@2-3=1           // bar 1 -> 2,3\nC1 4|1,3.5 D1 |4 // bar 4\n@5-7=1           // bar 1 -> 5,6,7\n@8=4             // bar 4 -> 8\n\`\`\`\n\n### Repeats with Variations\n\nCopy foundation to **all bars** (including variation bars), then modify:\n\n\`\`\`\nC1 1|1,3 D1 |2,4               // bar 1 foundation\nGb1 |1.5,2.5,3.5,4.5\n@2-16=1                        // copy to ALL bars, not just 2-8\nv0 Gb1 9|4.5 v100              // remove hat from bar 9\nC1 |3.5                        // add extra kick to bar 9\nv0 C1 13|3 v100 D1 |3          // replace kick with snare in bar 13\n\`\`\`\n\n**Common mistake:** Copying to bars 2-8, then writing \`C1 9|3.5\` expecting bar 9 to have the foundation. Bar 9 is empty - you get one lonely kick, not a variation.\n\n### Multi-bar phrases\n\nUse cross-bar beat lists then tile the range:\n\n\`\`\`\n// 2-bar syncopated phrase\nC1 1|1,3.5,5,7.5,8 // kick pattern across bars 1-2\nD1 1|4,6           // snare accents across bars 1-2\n@3-8=1-2           // tile 2-bar phrase across bars 3-8 (3 complete tiles)\n\`\`\`\n\n### v0 Deletion State Machine\n\nv0 enters deletion mode - removes notes at that pitch until you set a non-zero velocity:\n\n\`\`\`\nv100 C3 1|1 v0 C3 1|1        // deletes the C3 at 1|1\nv100 C3 2|1 v0 C3 1|1 C3 2|1 // deletes BOTH C3s (still in deletion mode)\nv100 C3 3|1 v0 C3 1|1 v80    // exit deletion mode with v80\nC3 4|1                       // this C3 is NOT deleted (v80 still active)\n\`\`\`\n\n## Working with Ableton Live\n\n**Views and Playback:**\n- Session View: Jam, try ideas, build scenes\n  - Use auto:"play-scene" when generating scenes one clip at a time\n    - Warn the user about seemingly random clip restarts as you finish each clip when auto-playing scenes\n- Arrangement View: Structure songs on a timeline\n  - Session clips override Arrangement playback\n  - Tracks auto-follow Arrangement when you play with "play-arrangement"\n\n**Creating Music:**\n- Check for instruments before creating MIDI clips\n- Place notes with musical timing - not just on the beat\n- Clip length sets playback region; noteCount shows notes within that region\n- Use velocity dynamics (pp=40, p=60, mf=80, f=100, ff=120) for expression\n- Keep fills rhythmic with space - accent key hits, avoid machine-gun density\n- Keep scenes' harmonic rhythm in sync across tracks\n- Beat numbers beyond the time signature wrap to the next bar (e.g., in 4/4, 1|5 wraps to 2|1)\n  - In comma-separated beat lists like \`1|1,5\`, the 5 wraps to 2|1 (not obvious!)\n  - Be explicit when crossing bars: use \`C1 1|1 2|1\` instead of \`C1 1|1,5\`\n  - Careful with bar copying - wrapping can cause unintended overlaps\n- Bass needs monophonic lines, one note at a time\n\n**Layering Multiple MIDI Tracks on One Instrument:**\n- When user says "layer another track/pattern onto [track/instrument name]", duplicate the track with routeToSource=true\n- Other patterns to recognize: "add a layer to [track]", "add a polyrhythm to [track]", "route another track to [instrument]"\n- Use cases: polyrhythms with different clip lengths, complex drums from simple parts, evolving phasing patterns\n- After duplicating, the new track controls the same instrument as the original\n\n**Staying in Sync:**\n- Set clip lengths explicitly to keep clips in sync\n- After user rearranges anything in Live, call ppal-read-live-set to resync\n\n### Device Paths\n\nSlash-separated segments: \`t\`=track, \`rt\`=return, \`mt\`=master, \`d\`=device, \`c\`=chain, \`rc\`=return chain, \`p\`=drum pad\n\n- \`t0/d0\` = first device on first track\n- \`rt0/d0\` = first device on Return A\n- \`mt/d0\` = first device on master track\n- \`t0/d0/c0/d0\` = first device in rack's first chain\n- \`t0/d0/rc0/d0\` = first device in rack's return chain\n- \`t0/d0/pC1/d0\` = first device in Drum Rack's C1 pad\n\n### Arrangement Clips\n\n\`arrangementStart\` moves clips in the timeline. \`arrangementLength\` expands or reduces visible playback region.\n\nNote: Any operation that moves a clip causes the clip ID to change.\nMost operations return the new IDs.\nRe-read the Set or Track to see the new IDs.\n\n#### Lengthening Clips\n\nProducer Pal duplicates and tiles the clip to fill the requested length\n(creates multiple clips in arrangement). This differs from Live's native behavior but achieves\nthe same playback result.\n\n#### Moving Multiple Clips in Arrangement\n\nWhen moving multiple clips to new arrangement positions (e.g., "move all clips forward by 1 bar"):\n\n1. **Process clips in reverse order** - start with the clip that has the latest \`arrangementStart\` time and work backwards\n2. This prevents earlier clips from overwriting later clips during sequential \`ppal-update-clip\` calls\n3. Sort clips by \`arrangementStart\` descending before updating\n\nExample sequence (move three clips forward one bar):\n- Clip at bar 5 → move to bar 6 (call update-clip)\n- Clip at bar 4 → move to bar 5 (call update-clip)\n- Clip at bar 3 → move to bar 4 (call update-clip)\n`;

function buildInstructions(context) {
  const projectNotes = context?.projectNotes;
  return "Do this now to complete Producer Pal initialization:\n" + [ "* Call ppal-read-live-set _with no arguments_ to sync with the state of Ableton Live", "* Summarize the Live Set (if ppal-read-live-set fails, say the error and summarize what you can, don't try again)", ...projectNotes?.content ? [ `* Summarize the project notes, ${projectNotes.writable ? "mention you can update the project notes, " : ""}and verify you will follow instructions in project notes (if any).` ] : [], "* Say the messagesForUser, ask what's next, wait for input" ].join("\n");
}

function connect(_params = {}, context = {}) {
  const liveSet = LiveAPI.from("live_set");
  const liveApp = LiveAPI.from("live_app");
  const trackIds = liveSet.getChildIds("tracks");
  const sceneIds = liveSet.getChildIds("scenes");
  const abletonLiveVersion = liveApp.call("get_version_string");
  const liveSetName = liveSet.getProperty("name");
  const liveSetInfo = {
    ...liveSetName ? {
      name: liveSetName
    } : {},
    trackCount: trackIds.length,
    sceneCount: sceneIds.length,
    tempo: liveSet.getProperty("tempo"),
    timeSignature: liveSet.timeSignature
  };
  const result = {
    connected: true,
    producerPalVersion: VERSION,
    abletonLiveVersion: abletonLiveVersion,
    liveSet: liveSetInfo
  };
  const scaleMode = liveSet.getProperty("scale_mode");
  const scaleEnabled = scaleMode > 0;
  if (scaleEnabled) {
    const scaleName = liveSet.getProperty("scale_name");
    const rootNote = liveSet.getProperty("root_note");
    const scaleRoot = PITCH_CLASS_NAMES[rootNote];
    result.liveSet.scale = `${scaleRoot} ${scaleName}`;
  }
  const messages = [ `Producer Pal ${VERSION} connected to Ableton Live ${abletonLiveVersion}`, "Tell me if you rearrange things so I stay in sync.", "Save often! I make mistakes." ];
  let foundAnyInstrument = false;
  for (const trackId of trackIds) {
    const track = LiveAPI.from(trackId);
    if (track.getProperty("has_midi_input") > 0) {
      for (const device of track.getChildren("devices")) {
        const deviceType = device.getProperty("type");
        if (deviceType === LIVE_API_DEVICE_TYPE_INSTRUMENT) {
          foundAnyInstrument = true;
          break;
        }
      }
      if (foundAnyInstrument) {
        break;
      }
    }
  }
  if (!foundAnyInstrument) {
    messages.push(`No instruments found.\nTo create music with MIDI clips, you need instruments (Wavetable, Operator, Drum Rack, etc).\nAsk me to add an instrument, or add one yourself and I can compose MIDI patterns.`);
  }
  if (context.smallModelMode) {
    result.$skills = skills$1;
    result.$instructions = buildInstructions$1(context);
  } else {
    result.$skills = skills;
    result.$instructions = buildInstructions(context);
  }
  result.messagesForUser = messages.map(msg => `* ${msg}`).join("\n");
  if (context.projectNotes?.enabled && context.projectNotes.content) {
    result.projectNotes = context.projectNotes.content;
  }
  return result;
}

function memory({action: action, content: content} = {}, context = {}) {
  if (!action) {
    throw new Error("Action is required");
  }
  if (action !== "read" && action !== "write") {
    throw new Error("Action must be 'read' or 'write'");
  }
  const projectNotes = context.projectNotes;
  if (!projectNotes) {
    return {
      enabled: false
    };
  }
  if (action === "read") {
    if (!projectNotes.enabled) {
      return {
        enabled: false
      };
    }
    return {
      enabled: true,
      writable: projectNotes.writable,
      content: projectNotes.content
    };
  }
  if (!projectNotes.enabled) {
    throw new Error("Project context is disabled");
  }
  if (!projectNotes.writable) {
    throw new Error("AI updates are disabled - enable 'Allow AI updates' in settings to let AI modify project context");
  }
  if (!content) {
    throw new Error("Content required for write action");
  }
  projectNotes.content = content;
  outlet(0, "updatenotes", content);
  return {
    enabled: true,
    writable: projectNotes.writable,
    content: projectNotes.content
  };
}

outlets = 2;

setoutletassist(0, "tool call results");

setoutletassist(1, "tool call warnings");

const context = {
  projectNotes: {
    enabled: false,
    writable: false,
    content: ""
  },
  smallModelMode: false,
  sampleFolder: null
};

function initHoldingArea() {
  const liveSet = LiveAPI.from("live_set");
  context.holdingAreaStartBeats = liveSet.get("song_length")[0];
}

const tools = {
  "ppal-connect": args => connect(args, context),
  "ppal-read-live-set": args => readLiveSet(args, context),
  "ppal-update-live-set": args => updateLiveSet(args, context),
  "ppal-create-track": args => createTrack(args, context),
  "ppal-read-track": args => readTrack(args, context),
  "ppal-update-track": args => updateTrack(args, context),
  "ppal-create-scene": args => createScene(args, context),
  "ppal-read-scene": args => readScene(args, context),
  "ppal-update-scene": args => updateScene(args, context),
  "ppal-create-clip": args => createClip(args, context),
  "ppal-read-clip": args => readClip(args, context),
  "ppal-update-clip": args => {
    initHoldingArea();
    return updateClip(args, context);
  },
  "ppal-transform-clips": args => {
    initHoldingArea();
    return transformClips(args, context);
  },
  "ppal-create-device": args => createDevice(args, context),
  "ppal-read-device": args => readDevice(args, context),
  "ppal-update-device": args => updateDevice(args, context),
  "ppal-playback": args => playback(args, context),
  "ppal-select": args => select(args, context),
  "ppal-delete": args => deleteObject(args, context),
  "ppal-duplicate": args => {
    initHoldingArea();
    return duplicate(args, context);
  },
  "ppal-memory": args => memory(args, context),
  "ppal-read-samples": args => readSamples(args, context),
  "ppal-read-browser": args => readBrowser(args),
  "ppal-load-item": args => loadItem(args)
};

{
  tools["ppal-raw-live-api"] = args => rawLiveApi(args, context);
}

function callTool(toolName, args) {
  const tool = tools[toolName];
  if (!tool) {
    throw new Error(`Unknown tool: ${toolName}`);
  }
  return tool(args);
}

let isCompactOutputEnabled = true;

function compactOutput(enabled) {
  isCompactOutputEnabled = Boolean(enabled);
}

function smallModelMode(enabled) {
  context.smallModelMode = Boolean(enabled);
}

function projectNotesEnabled(enabled) {
  context.projectNotes.enabled = Boolean(enabled);
}

function projectNotesWritable(writable) {
  context.projectNotes.writable = Boolean(writable);
}

function projectNotes(content) {
  const value = content === "bang" ? "" : String(content ?? "");
  context.projectNotes.content = value;
}

function sampleFolder(path) {
  const value = path === "bang" ? "" : String(path ?? "");
  context.sampleFolder = value;
}

function sendResponse(requestId, result) {
  const jsonString = JSON.stringify(result);
  const totalChunks = Math.ceil(jsonString.length / MAX_CHUNK_SIZE);
  if (totalChunks > MAX_CHUNKS) {
    const errorResult = formatErrorResponse(`Response too large: ${jsonString.length} bytes would require ${totalChunks} chunks (max ${MAX_CHUNKS})`);
    outlet(0, "mcp_response", requestId, JSON.stringify(errorResult), MAX_ERROR_DELIMITER);
    return;
  }
  const chunks = [];
  for (let i = 0; i < jsonString.length; i += MAX_CHUNK_SIZE) {
    chunks.push(jsonString.slice(i, i + MAX_CHUNK_SIZE));
  }
  outlet(0, "mcp_response", requestId, ...chunks, MAX_ERROR_DELIMITER);
}

async function mcp_request(requestId, tool, argsJSON, contextJSON) {
  let result;
  try {
    const args = JSON.parse(argsJSON);
    if (contextJSON != null) {
      try {
        const incomingContext = JSON.parse(contextJSON);
        Object.assign(context, incomingContext);
      } catch (contextError) {
        const message = contextError instanceof Error ? contextError.message : String(contextError);
        warn(`Failed to parse contextJSON: ${message}`);
      }
    }
    try {
      const output = await callTool(tool, args);
      result = formatSuccessResponse(isCompactOutputEnabled ? toCompactJSLiteral(output) : output);
    } catch (toolError) {
      const message = toolError instanceof Error ? toolError.message : String(toolError);
      result = formatErrorResponse(`Error executing tool '${tool}': ${message}`);
    }
  } catch (error) {
    const message = error instanceof Error ? error.message : String(error);
    result = formatErrorResponse(`Error parsing tool call request: ${message}`);
  }
  sendResponse(requestId, result);
}

const now = () => (new Date).toLocaleString("sv-SE");

log(`[${now()}] Producer Pal ${VERSION} Live API adapter ready`);

outlet(0, "started");
