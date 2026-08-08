/*!
 * India SMS DLT Template Validator — core engine
 * Pure logic (template parsing, matching, encoding/segment calculation) is
 * environment-agnostic so it can be unit-tested under Node and also run
 * directly in the browser with zero build step.
 */
(function (root, factory) {
  if (typeof module !== "undefined" && module.exports) {
    module.exports = factory();
  } else {
    root.DLTValidator = factory();
  }
})(typeof self !== "undefined" ? self : this, function () {
  "use strict";

  // ---------------------------------------------------------------------
  // Variable token types (aligned with TRAI's mandatory variable
  // pre-tagging direction — typed {#type#} tags — plus the classic
  // bracket [VARIABLE] style still used on most operator DLT portals).
  // ---------------------------------------------------------------------
  // TRAI's official Annexure-I (Direction dated 18 Nov 2025) defines six
  // approved variable tags: #numeric#, #url#, #urlott#, #cbn#, #email#,
  // #alphanumeric# (also written "#number#"). Most operator/CPaaS DLT
  // portals render the same tags wrapped in curly braces, {#numeric#} etc.
  // — both notations are accepted here. A few legacy/looser tags some
  // portals still show (var, alpha, ename) are kept for backward
  // compatibility with older registered templates.
  var TYPE_PATTERNS = {
    number: { re: "\\d+", label: "numeric", test: function (v) { return /^\d+$/.test(v); } },
    numeric: { re: "\\d+", label: "numeric", test: function (v) { return /^\d+$/.test(v); } },
    alpha: { re: "[A-Za-z]+", label: "alphabetic", test: function (v) { return /^[A-Za-z]+$/.test(v); } },
    alphanumeric: { re: "[A-Za-z0-9]+", label: "alphanumeric", test: function (v) { return /^[A-Za-z0-9]+$/.test(v); } },
    var: { re: "[\\s\\S]+?", label: "generic (untyped — no longer accepted for new templates)", test: function () { return true; } },
    url: { re: "\\S+", label: "URL", test: function (v) { return /^\S+$/.test(v); } },
    urlott: { re: "\\S+", label: "OTT/APK link", test: function (v) { return /^\S+$/.test(v); } },
    email: { re: "\\S+@\\S+\\.\\S+", label: "email address", test: function (v) { return /^[^\s@]+@[^\s@]+\.[^\s@]+$/.test(v); } },
    cbn: { re: "\\d{3,14}", label: "callback number", test: function (v) { return /^\d{3,14}$/.test(v); } },
    ename: { re: "[A-Za-z ]+", label: "entity name", test: function (v) { return /^[A-Za-z ]+$/.test(v); } },
  };

  var TOKEN_RE = /\[([^\[\]]+)\]|\{#([a-zA-Z]+)#\}|#([a-zA-Z]+)#/g;

  function escapeRegex(str) {
    return str.replace(/[.*+?^${}()|[\]\\]/g, "\\$&");
  }

  // Split a template string into an ordered list of fixed/variable segments.
  function parseTemplate(template) {
    var segments = [];
    var lastIndex = 0;
    var m;
    var count = 0;
    TOKEN_RE.lastIndex = 0;
    while ((m = TOKEN_RE.exec(template)) !== null) {
      if (m.index > lastIndex) {
        segments.push({ type: "fixed", text: template.slice(lastIndex, m.index) });
      }
      var typedContent = m[2] || m[3];
      var varType = "var";
      if (typedContent && TYPE_PATTERNS[typedContent.toLowerCase()]) {
        varType = typedContent.toLowerCase();
      }
      segments.push({ type: "var", raw: m[0], varType: varType });
      count++;
      lastIndex = TOKEN_RE.lastIndex;
    }
    if (lastIndex < template.length) {
      segments.push({ type: "fixed", text: template.slice(lastIndex) });
    }
    return { segments: segments, variableCount: count };
  }

  // Structural matching always uses a generic non-greedy capture group for
  // every variable slot, regardless of its declared {#type#}. This keeps
  // "does the message follow the registered template's shape" (structure)
  // strictly separate from "does each variable's value match its declared
  // type" (a compliance check applied afterwards) — otherwise a single
  // wrong-type value would make the whole message look structurally
  // unrelated to the template, which is confusing and wrong.
  function buildRegex(segments) {
    var pattern = "^";
    segments.forEach(function (seg) {
      if (seg.type === "fixed") {
        pattern += escapeRegex(seg.text);
      } else {
        pattern += "(" + TYPE_PATTERNS.var.re + ")";
      }
    });
    pattern += "$";
    return new RegExp(pattern);
  }

  function fixedSegmentsOf(segments) {
    return segments
      .filter(function (s) { return s.type === "fixed" && s.text.length > 0; })
      .map(function (s) { return s.text; });
  }

  // In-order substring presence check (each fixed chunk must appear,
  // in sequence, without going backwards through the message).
  function checkFixedTextPresence(message, fixedTexts) {
    var cursor = 0;
    var missing = [];
    var spans = [];
    for (var i = 0; i < fixedTexts.length; i++) {
      var text = fixedTexts[i];
      var idx = message.indexOf(text, cursor);
      if (idx === -1) {
        missing.push(text);
      } else {
        spans.push({ text: text, start: idx, end: idx + text.length });
        cursor = idx + text.length;
      }
    }
    return { ok: missing.length === 0, missing: missing, spans: spans, endCursor: cursor };
  }

  // Heuristic "extra / unexpected text" detector. If any fixed chunk is
  // missing we can no longer trust the structure, so we flag conservatively.
  // If every fixed chunk is present in order, we additionally check for
  // leading text before the first fixed chunk (when the template *starts*
  // with fixed text) and trailing text after the last one (when the
  // template *ends* with fixed text) — the two spots most real-world abuse
  // (e.g. promo text appended after an OTP) shows up.
  function estimateAdditionalText(message, segments, presence) {
    if (!presence.ok) return { hasExtra: true, reason: "structure-broken" };
    if (presence.spans.length === 0) return { hasExtra: false, reason: "no-fixed-anchors" };

    var firstSeg = segments[0];
    var lastSeg = segments[segments.length - 1];
    var firstSpan = presence.spans[0];
    var lastSpan = presence.spans[presence.spans.length - 1];

    if (firstSeg.type === "fixed" && firstSpan.start !== 0) {
      return { hasExtra: true, reason: "leading-text" };
    }
    if (lastSeg.type === "fixed") {
      var trailing = message.slice(lastSpan.end);
      if (trailing.length > 0) {
        return { hasExtra: true, reason: "trailing-text" };
      }
    }
    return { hasExtra: false, reason: null };
  }

  // ---------------------------------------------------------------------
  // SMS encoding + segment estimation (3GPP TS 23.038 GSM 7-bit default
  // alphabet + extension table; UCS-2 fallback for any other character).
  // ---------------------------------------------------------------------
  var GSM_BASIC =
    "@£$¥èéùìòÇ\nØø\rÅåΔ_ΦΓΛΩΠΨΣΘΞÆæßÉ !\"#¤%&'()*+,-./0123456789:;<=>?¡ABCDEFGHIJKLMNOPQRSTUVWXYZÄÖÑÜ§¿abcdefghijklmnopqrstuvwxyzäöñüà";
  var GSM_EXTENDED = "^{}\\[~]|€";

  function analyzeEncoding(message) {
    var septets = 0;
    var isGsm = true;
    var nonGsmChars = [];
    var chars = Array.from(message);
    for (var i = 0; i < chars.length; i++) {
      var ch = chars[i];
      if (GSM_BASIC.indexOf(ch) !== -1) {
        septets += 1;
      } else if (GSM_EXTENDED.indexOf(ch) !== -1) {
        septets += 2;
      } else {
        isGsm = false;
        if (nonGsmChars.indexOf(ch) === -1) nonGsmChars.push(ch);
      }
    }
    if (isGsm) {
      var segs = septets <= 160 ? 1 : Math.ceil(septets / 153);
      return { encoding: "GSM-7", charCount: chars.length, unitCount: septets, segments: segs, nonGsmChars: [] };
    }
    var segsU = chars.length <= 70 ? 1 : Math.ceil(chars.length / 67);
    return { encoding: "Unicode (UCS-2)", charCount: chars.length, unitCount: chars.length, segments: segsU, nonGsmChars: nonGsmChars };
  }

  // ---------------------------------------------------------------------
  // Main entry point
  // ---------------------------------------------------------------------
  function validateTemplate(template, message) {
    template = (template || "").replace(/\r\n/g, "\n");
    message = (message || "").replace(/\r\n/g, "\n");

    var parsed = parseTemplate(template);
    var segments = parsed.segments;
    var variableCount = parsed.variableCount;
    var regex = buildRegex(segments);
    var match = message.match(regex);
    var encodingInfo = analyzeEncoding(message);

    var checks = [];
    var valid = false;
    var extractedVars = [];
    var typeViolations = [];

    if (match) {
      extractedVars = match.slice(1);
      valid = true;

      checks.push({ pass: true, label: "Template structure matched" });
      checks.push({
        pass: true,
        label: variableCount + " variable field" + (variableCount === 1 ? "" : "s") + " detected",
      });
      checks.push({ pass: true, label: "Fixed text unchanged" });

      var varIndex = 0;
      segments.forEach(function (seg) {
        if (seg.type === "var") {
          var val = extractedVars[varIndex];
          var t = TYPE_PATTERNS[seg.varType];
          if (seg.varType !== "var" && t && !t.test(val)) {
            typeViolations.push({ index: varIndex + 1, expectedType: t.label, value: val });
          }
          varIndex++;
        }
      });

      if (typeViolations.length > 0) {
        valid = false;
        checks.push({
          pass: false,
          label:
            "Variable type mismatch (" +
            typeViolations.length +
            " field" +
            (typeViolations.length === 1 ? "" : "s") +
            " don't match the declared {#type#})",
        });
      }
    } else {
      var fixedTexts = fixedSegmentsOf(segments);
      var presence = checkFixedTextPresence(message, fixedTexts);
      checks.push({
        pass: presence.ok,
        label: presence.ok ? "Fixed template text matches" : "Fixed template text doesn't match",
      });

      var extra = estimateAdditionalText(message, segments, presence);
      checks.push({
        pass: !extra.hasExtra,
        label: extra.hasExtra ? "Additional text detected" : "No additional text detected",
      });

      var structureOk = presence.ok && !extra.hasExtra;
      checks.push({
        pass: structureOk,
        label: structureOk ? "Registered content structure unchanged" : "Registered content structure changed",
      });
    }

    return {
      valid: valid,
      matched: !!match,
      checks: checks,
      variableCount: variableCount,
      extractedVars: extractedVars,
      typeViolations: typeViolations,
      encoding: encodingInfo,
      segments: segments,
    };
  }

  // ---------------------------------------------------------------------
  // Light, non-authoritative format checks for optional DLT metadata.
  // These do NOT verify against the live TRAI/operator DLT registry
  // (no public API exists for that) — they only flag obviously malformed
  // values before you paste them into your API payload.
  // ---------------------------------------------------------------------
  function checkMetadata(peId, header, contentTemplateId) {
    var out = {};
    if (peId) {
      out.peId = { value: peId, plausible: /^\d{10,20}$/.test(peId.trim()) };
    }
    if (header) {
      var h = header.trim();
      out.header = { value: h, plausible: /^[A-Za-z0-9-]{4,12}$/.test(h) };
    }
    if (contentTemplateId) {
      out.contentTemplateId = { value: contentTemplateId, plausible: /^\d{8,20}$/.test(contentTemplateId.trim()) };
    }
    return out;
  }

  return {
    parseTemplate: parseTemplate,
    buildRegex: buildRegex,
    analyzeEncoding: analyzeEncoding,
    validateTemplate: validateTemplate,
    checkMetadata: checkMetadata,
    TYPE_PATTERNS: TYPE_PATTERNS,
  };
});
