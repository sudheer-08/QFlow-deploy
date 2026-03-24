const Groq = require('groq-sdk');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });

// ─── Classify patient symptoms using Groq (free AI) ──
// Returns: { priority: 'routine'|'moderate'|'critical', summary: string }
const classifySymptoms = async (symptoms) => {
  try {
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',  // Free model on Groq
      max_tokens: 150,
      messages: [
        {
          role: 'system',
          content: `You are a medical triage assistant. 
          Classify patient symptoms into one of three priority levels:
          - critical: life-threatening, severe pain, chest pain, difficulty breathing, stroke symptoms
          - moderate: significant discomfort, fever above 102F, moderate pain, infection signs
          - routine: mild symptoms, follow-up visits, minor issues, prescription refills
          
          Respond ONLY with valid JSON in this exact format:
          {"priority": "routine|moderate|critical", "summary": "one sentence max 15 words"}`
        },
        {
          role: 'user',
          content: `Patient symptoms: ${symptoms}`
        }
      ]
    });

    const text = response.choices[0]?.message?.content || '';
    const parsed = JSON.parse(text);

    return {
      priority: parsed.priority || 'routine',
      summary: parsed.summary || symptoms.substring(0, 50)
    };

  } catch (err) {
    // If AI fails, don't crash the registration — just use defaults
    console.error('AI triage error:', err.message);
    return {
      priority: 'routine',
      summary: symptoms?.substring(0, 50) || 'Symptoms not classified'
    };
  }
};

module.exports = { classifySymptoms };
