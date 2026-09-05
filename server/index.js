'use strict';
require('dotenv').config();
const express = require('express');
const cors = require('cors');
const fs = require('fs');
const path = require('path');
const crypto = require('crypto');
const { GoogleGenAI } = require('@google/genai');

// ─── Bootstrap ────────────────────────────────────────────────────────────────
const app = express();
app.use(cors());
app.use(express.json());

const logicPath = path.join(__dirname, 'decision_logic.json');
const logicData = JSON.parse(fs.readFileSync(logicPath, 'utf8'));

const ai = new GoogleGenAI({ apiKey: process.env.GEMINI_API_KEY });

// ─── In-memory cache (survives the process, resets on restart) ────────────────
const summaryCache = new Map();

function cacheKey(eligibilityResults, actionChecklist) {
  const stable = JSON.stringify({ eligibilityResults, actionChecklist });
  return crypto.createHash('sha256').update(stable).digest('hex').slice(0, 16);
}

// ─── Rules Engine ─────────────────────────────────────────────────────────────
/**
 * evaluateRules()
 * Single source of truth for eligibility. Reads from decision_logic.json.
 * Returns matched rule results (plain_language + source).
 */
function evaluateRules(answers) {
  const matched = [];
  const rules = logicData.eligibility_rules;
  const mb = answers.medical_board_status || '';
  const echs = answers.echs_enrolled || answers.echs_status || '';
  const discharge = answers.discharge_status || '';

  // Rule: ECHS basic eligibility
  if (
    discharge !== 'Still serving' &&
    (echs === 'No' || echs === 'Not sure' || echs === "I don't know")
  ) {
    matched.push(rules.find(r => r.rule_id === 'echs_basic_eligibility').result);
  }

  // Rule: No action started yet → starting point guidance
  if (mb === "No, haven't started" || mb === "No, I haven't") {
    matched.push(rules.find(r => r.rule_id === 'no_action_yet').result);
  }

  // Rule: Disability pension threshold (board in progress or beyond)
  if (
    mb !== '' &&
    mb !== "No, haven't started" &&
    mb !== "No, I haven't"
  ) {
    matched.push(rules.find(r => r.rule_id === 'disability_pension_basic_threshold').result);
  }

  // Rule: Presumption of soundness (board rejected or claim rejected)
  if (
    mb.includes('not attributable') ||
    mb.includes('constitutional') ||
    mb === 'Claim rejected by PCDA(Pension)' ||
    mb === 'Already appealed and rejected again'
  ) {
    matched.push(rules.find(r => r.rule_id === 'presumption_of_soundness').result);
  }

  // Rule: Unreasoned board rejection
  if (
    mb.includes('not attributable') ||
    mb.includes('constitutional') ||
    mb.includes('lifestyle')
  ) {
    matched.push(rules.find(r => r.rule_id === 'unreasoned_board_rejection').result);
  }

  // Rule: Administrative override of board
  if (mb === 'Claim rejected by PCDA(Pension)') {
    matched.push(rules.find(r => r.rule_id === 'administrative_override_of_board').result);
  }

  // Deduplicate by eligible_for label (safety net)
  const seen = new Set();
  return matched.filter(r => {
    if (seen.has(r.eligible_for)) return false;
    seen.add(r.eligible_for);
    return true;
  });
}

// ─── Checklist Builder ────────────────────────────────────────────────────────
function getChecklist(answers) {
  const mb = answers.medical_board_status || '';
  const templates = logicData.action_checklist_templates;

  if (mb === "No, haven't started" || mb === "No, I haven't") {
    return templates.not_started;
  }
  if (mb === 'Already appealed and rejected again') {
    return templates.already_appealed;
  }
  if (
    mb.includes('not attributable') ||
    mb.includes('constitutional') ||
    mb === 'Claim rejected by PCDA(Pension)'
  ) {
    return templates.rejected_unreasoned;
  }
  // Default: mix of not_started + rejected guidance
  return [...templates.not_started.slice(0, 3), ...templates.rejected_unreasoned.slice(0, 2)];
}

// ─── Free-text Extraction (optional, separate from rules engine) ──────────────
/**
 * extractFactsFromStory()
 * Uses Gemini to pull structured facts out of the veteran's free-text story.
 * Output is ONLY used for display / context. It NEVER feeds back into evaluateRules().
 */
async function extractFactsFromStory(storyText) {
  if (!storyText || storyText.trim().length < 20) return null;
  try {
    const prompt = `You are a factual extraction assistant. Read the following personal account written by an Indian ex-serviceman. Extract ONLY facts explicitly stated in the text. Do not infer, speculate, or add information not present. Return a JSON object with these keys (leave a key as null if not mentioned): incident_dates, posting_or_unit, witnesses, symptom_description, other_details.

Account:
"${storyText.trim()}"

Return only valid JSON.`;

    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
    });
    const raw = response.text.replace(/```json|```/g, '').trim();
    return JSON.parse(raw);
  } catch {
    return null; // Non-fatal — never block the main response
  }
}

// ─── Gemini Summary Generator ─────────────────────────────────────────────────
/**
 * generateSummary()
 * Calls Gemini AFTER evaluateRules() has run.
 * Provides rules output as fixed context. LLM only rephrases — never decides.
 */
async function generateSummary(eligibilityResults, actionChecklist) {
  const key = cacheKey(eligibilityResults, actionChecklist);
  if (summaryCache.has(key)) {
    return summaryCache.get(key);
  }

  const rulesContext = eligibilityResults
    .map((r, i) => `${i + 1}. ${r.plain_language}\n   Source: ${r.source}`)
    .join('\n\n');

  const checklistContext = actionChecklist.map((c, i) => `${i + 1}. ${typeof c === 'string' ? c : c.title + (c.desc ? ': ' + c.desc : '')}`).join('\n');

  const prompt = `You are a compassionate assistant helping Indian ex-servicemen understand their rights around disability pensions and mental health care.

Below is the ONLY factual information you are allowed to use. Do NOT add new facts, eligibility claims, legal interpretations, or legal advice beyond what is explicitly stated below.

--- ELIGIBILITY FINDINGS (from rules engine) ---
${rulesContext}

--- ACTION STEPS ---
${checklistContext}

---

Task: Write a warm, plain-language summary paragraph (150–200 words) for a veteran who may be experiencing trauma and may not have legal or medical literacy. Summarize and rephrase ONLY the information provided above. If you are unsure whether something is stated in the provided context, omit it rather than guess. Use a respectful, calm, and supportive tone. Do not use legal jargon. Return plain text only — no markdown, no bullet points, no headings.`;

  try {
    const response = await ai.models.generateContent({
      model: 'gemini-3.6-flash',
      contents: prompt,
      config: {
        temperature: 0.4,
        maxOutputTokens: 400,
      }
    });
    const summaryText = response.text.trim();
    summaryCache.set(key, summaryText);
    return summaryText;
  } catch (err) {
    console.error('[generateSummary] Gemini call failed:', err.message);
    return null; // Graceful fallback — caller handles null
  }
}

// ─── Routes ───────────────────────────────────────────────────────────────────
app.get('/api/questions', (req, res) => {
  const questions = logicData.intake_questions.map(q => ({
    id: q.id,
    text: q.prompt,
    type: q.type === 'single_select' ? 'single_choice' : q.type,
    options: q.options || null,
    placeholder: q.placeholder || null,
  }));
  res.json({ questions });
});

app.post('/api/analyze', async (req, res) => {
  const answers = req.body;

  // 1. Run the deterministic rules engine — single source of truth
  const eligibility_results = evaluateRules(answers);

  // 2. Build action checklist from templates
  const action_checklist = getChecklist(answers);

  // 3. Extract structured facts from free-text story (separate, non-authoritative)
  const extracted_facts = await extractFactsFromStory(answers.free_text_story || answers.situation_description);

  // 4. Generate warm summary via Gemini (rephrases rules output ONLY)
  //    Wrapped in try/catch at the caller level too — never fails the request
  let summary_text = null;
  if (eligibility_results.length > 0) {
    summary_text = await generateSummary(eligibility_results, action_checklist);
  }

  // 5. Return structured results + LLM summary as additive field
  res.json({
    eligibility_results,  // Structured rules engine output — source of truth
    action_checklist,     // Deterministic checklist from templates
    extracted_facts,      // LLM-extracted facts from free-text (informational only)
    summary_text,         // LLM-generated warm summary (null if Gemini fails)
  });
});

// ─── Start ────────────────────────────────────────────────────────────────────
const PORT = process.env.PORT || 3000;
app.listen(PORT, () => {
  console.log(`Backend running on http://localhost:${PORT}`);
  if (!process.env.GEMINI_API_KEY) {
    console.warn('[WARN] GEMINI_API_KEY is not set — summary_text will always be null.');
  }
});
