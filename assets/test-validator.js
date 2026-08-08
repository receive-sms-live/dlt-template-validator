const { validateTemplate, analyzeEncoding, checkMetadata } = require("./validator.js");

function printResult(name, r) {
  console.log("=== " + name + " ===");
  r.checks.forEach((c) => console.log((c.pass ? "PASS " : "FAIL ") + c.label));
  console.log("valid:", r.valid, " variableCount:", r.variableCount, " extracted:", r.extractedVars);
  console.log("encoding:", r.encoding.encoding, " segments:", r.encoding.segments, " units:", r.encoding.unitCount);
  console.log();
}

let fail = 0;
function assert(cond, msg) {
  if (!cond) {
    console.error("ASSERTION FAILED: " + msg);
    fail++;
  }
}

// --- Case 1: user's VALID example ---
const template1 = "Dear [VARIABLE], your verification code is [VARIABLE]. Do not share it with anyone.";
const msgValid = "Dear Rahul, your verification code is 583921. Do not share it with anyone.";
const r1 = validateTemplate(template1, msgValid);
printResult("Case 1: expected VALID", r1);
assert(r1.valid === true, "Case 1 should be VALID");
assert(r1.variableCount === 2, "Case 1 should detect 2 variables");
assert(r1.encoding.encoding === "GSM-7", "Case 1 should be GSM-7");
assert(r1.encoding.segments === 1, "Case 1 should be 1 segment");

// --- Case 2: user's MISMATCH example ---
const msgMismatch = "Hello Rahul, your OTP code is 583921.";
const r2 = validateTemplate(template1, msgMismatch);
printResult("Case 2: expected MISMATCH", r2);
assert(r2.valid === false, "Case 2 should be MISMATCH");
assert(r2.checks[0].pass === false, "Case 2 fixed text check should fail");
assert(r2.checks[1].pass === false, "Case 2 additional text check should fail");
assert(r2.checks[2].pass === false, "Case 2 structure check should fail");

// --- Case 3: trailing extra text appended after an otherwise-matching template ---
const template3 = "Dear [VARIABLE], your OTP is [VARIABLE]. Valid for 10 minutes.";
const msgTrailing = "Dear Priya, your OTP is 4521. Valid for 10 minutes. Reply STOP to unsubscribe.";
const r3 = validateTemplate(template3, msgTrailing);
printResult("Case 3: trailing extra text", r3);
assert(r3.valid === false, "Case 3 should be MISMATCH (extra trailing text)");

// --- Case 4: typed variable tags, correct usage ---
const template4 = "Your OTP is {#numeric#}. Valid till {#var#}.";
const msg4 = "Your OTP is 7788. Valid till 10:45 PM.";
const r4 = validateTemplate(template4, msg4);
printResult("Case 4: typed tags, valid", r4);
assert(r4.valid === true, "Case 4 should be VALID");

// --- Case 5: typed variable tag violated (alpha where numeric expected) ---
const msg5 = "Your OTP is ABCD. Valid till 10:45 PM.";
const r5 = validateTemplate(template4, msg5);
printResult("Case 5: typed tag violated", r5);
assert(r5.valid === false, "Case 5 should be INVALID (numeric type violated)");
assert(r5.typeViolations.length === 1, "Case 5 should report exactly 1 type violation");

// --- Case 6: Unicode / non-GSM message (e.g. Hindi text or emoji) ---
const encUnicode = analyzeEncoding("आपका OTP 1234 है");
console.log("Case 6 (Unicode):", encUnicode);
assert(encUnicode.encoding === "Unicode (UCS-2)", "Case 6 should detect Unicode");

// --- Case 7: long GSM-7 message spanning multiple segments ---
const longMsg = "A".repeat(200);
const encLong = analyzeEncoding(longMsg);
console.log("Case 7 (long GSM-7):", encLong);
assert(encLong.segments === Math.ceil(200 / 153), "Case 7 segment math should use 153/part rule");

// --- Case 8: metadata format checks ---
const meta = checkMetadata("1234567890123456789", "AXBANK-T", "9876543210");
console.log("Case 8 (metadata):", meta);
assert(meta.peId.plausible === true, "Case 8 PE ID should look plausible");
assert(meta.header.plausible === true, "Case 8 header should look plausible");

// --- Case 9: official bare #tag# notation (TRAI Annexure-I style) ---
const template9 = "Track your order at #url#. Delivery OTP: #numeric#.";
const msg9ok = "Track your order at https://example.in/t/88213. Delivery OTP: 4521.";
const r9ok = validateTemplate(template9, msg9ok);
printResult("Case 9a: bare #tag# notation, valid", r9ok);
assert(r9ok.valid === true, "Case 9a should be VALID with bare #tag# notation");

const msg9bad = "Track your order at https://example.in/t/88213. Delivery OTP: ABCD.";
const r9bad = validateTemplate(template9, msg9bad);
printResult("Case 9b: bare #tag# notation, type violated", r9bad);
assert(r9bad.valid === false, "Case 9b should be INVALID (numeric type violated)");

console.log(fail === 0 ? "\nALL ASSERTIONS PASSED" : "\n" + fail + " ASSERTION(S) FAILED");
process.exit(fail === 0 ? 0 : 1);
