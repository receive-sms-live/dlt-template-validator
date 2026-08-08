/*! India SMS DLT Template Validator — UI wiring (uses window.DLTValidator) */
(function () {
  "use strict";

  var EXAMPLES = {
    valid: {
      template: "Dear [VARIABLE], your verification code is [VARIABLE]. Do not share it with anyone.",
      message: "Dear Rahul, your verification code is 583921. Do not share it with anyone.",
    },
    mismatch: {
      template: "Dear [VARIABLE], your verification code is [VARIABLE]. Do not share it with anyone.",
      message: "Hello Rahul, your OTP code is 583921.",
    },
    typed: {
      template: "Your OTP is {#numeric#} for order {#alphanumeric#}. Track at {#url#}.",
      message: "Your OTP is 4521 for order TXN88213. Track at https://trk.in/x9k2.",
    },
  };

  function el(id) { return document.getElementById(id); }

  function renderChecks(list, checks) {
    list.innerHTML = "";
    checks.forEach(function (c) {
      var li = document.createElement("li");
      li.className = c.info ? "info" : (c.pass ? "pass" : "fail");
      var mark = document.createElement("span");
      mark.className = "mark";
      mark.textContent = c.info ? "ℹ" : (c.pass ? "✓" : "✗");
      var text = document.createElement("span");
      text.textContent = c.label;
      li.appendChild(mark);
      li.appendChild(text);
      list.appendChild(li);
    });
  }

  function statBlock(num, label) {
    var d = document.createElement("div");
    d.className = "stat";
    var n = document.createElement("div");
    n.className = "num";
    n.textContent = num;
    var l = document.createElement("div");
    l.className = "label";
    l.textContent = label;
    d.appendChild(n);
    d.appendChild(l);
    return d;
  }

  function run() {
    var template = el("template-input").value;
    var message = el("message-input").value;
    var peId = el("pe-id").value;
    var header = el("header-id").value;
    var ctId = el("content-template-id").value;

    if (!template.trim() || !message.trim()) {
      el("result-panel").hidden = false;
      el("result-banner").className = "result-banner invalid";
      el("result-banner").textContent = "Enter both the registered template and the actual message.";
      el("checklist").innerHTML = "";
      el("stat-grid").innerHTML = "";
      el("meta-note").hidden = true;
      return;
    }

    var result = window.DLTValidator.validateTemplate(template, message);
    var meta = window.DLTValidator.checkMetadata(peId, header, ctId);

    var checks = result.checks.slice();
    checks.push({ info: true, pass: true, label: "SMS encoding: " + result.encoding.encoding });
    checks.push({
      info: true,
      pass: true,
      label:
        "Estimated SMS segments: " +
        result.encoding.segments +
        " (" +
        result.encoding.unitCount +
        (result.encoding.encoding === "GSM-7" ? " septets" : " characters") +
        ")",
    });

    renderChecks(el("checklist"), checks);

    var panel = el("result-panel");
    panel.hidden = false;
    var banner = el("result-banner");
    banner.className = "result-banner " + (result.valid ? "valid" : "invalid");
    banner.textContent = "Result: " + (result.valid ? "VALID" : "TEMPLATE MISMATCH");

    var stats = el("stat-grid");
    stats.innerHTML = "";
    stats.appendChild(statBlock(result.variableCount, "Variables in template"));
    stats.appendChild(statBlock(result.encoding.encoding, "Encoding"));
    stats.appendChild(statBlock(result.encoding.segments, "SMS segment(s)"));
    stats.appendChild(statBlock(result.encoding.unitCount, result.encoding.encoding === "GSM-7" ? "Septets used" : "Characters used"));

    if (result.matched && result.extractedVars.length) {
      var varsWrap = el("extracted-vars");
      varsWrap.innerHTML = "<strong>Detected variable values:</strong> " +
        result.extractedVars.map(function (v, i) { return "#" + (i + 1) + " “" + v + "”"; }).join(", ");
      varsWrap.hidden = false;
    } else {
      el("extracted-vars").hidden = true;
    }

    var noteLines = [];
    if (meta.peId) noteLines.push("PE ID format " + (meta.peId.plausible ? "looks plausible" : "looks unusual for a DLT PE ID (expected 10–20 digits)"));
    if (meta.header) noteLines.push("Header/Sender ID format " + (meta.header.plausible ? "looks plausible" : "looks unusual (most operators expect ~6 characters, optionally with a category suffix)"));
    if (meta.contentTemplateId) noteLines.push("Content Template ID format " + (meta.contentTemplateId.plausible ? "looks plausible" : "looks unusual for a DLT template ID (expected 8–20 digits)"));

    if (result.typeViolations && result.typeViolations.length) {
      result.typeViolations.forEach(function (v) {
        noteLines.push("Variable #" + v.index + " value “" + v.value + "” does not look " + v.expectedType + " as declared in the template.");
      });
    }

    var noteEl = el("meta-note");
    if (noteLines.length) {
      noteEl.hidden = false;
      noteEl.innerHTML = "<strong>Notes:</strong><br>" + noteLines.join("<br>") +
        "<br><span class=\"source-note\">These are basic format checks only — this tool does not connect to the live TRAI/operator DLT registry, so it cannot confirm your PE ID, Header or Content Template ID are actually registered.</span>";
    } else {
      noteEl.hidden = false;
      noteEl.innerHTML = "<span class=\"source-note\">This tool checks template structure, variable typing and SMS encoding client-side only. It does not connect to the live TRAI/operator DLT registry — always confirm PE ID / Header / Content Template ID against your DLT portal before sending.</span>";
    }

    panel.scrollIntoView({ behavior: "smooth", block: "nearest" });
  }

  function loadExample(kind) {
    var ex = EXAMPLES[kind];
    if (!ex) return;
    el("template-input").value = ex.template;
    el("message-input").value = ex.message;
    run();
  }

  document.addEventListener("DOMContentLoaded", function () {
    el("validate-btn").addEventListener("click", run);
    var validBtn = el("example-valid");
    var mismatchBtn = el("example-mismatch");
    var typedBtn = el("example-typed");
    if (validBtn) validBtn.addEventListener("click", function () { loadExample("valid"); });
    if (mismatchBtn) mismatchBtn.addEventListener("click", function () { loadExample("mismatch"); });
    if (typedBtn) typedBtn.addEventListener("click", function () { loadExample("typed"); });
  });
})();
