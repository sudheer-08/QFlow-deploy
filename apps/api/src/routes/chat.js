const router = require('express').Router();
const supabase = require('../models/supabase');
const Groq = require('groq-sdk');
const rateLimit = require('express-rate-limit');
const { isNonEmptyString } = require('../utils/validation');
const { authenticate } = require('../middleware/auth');

const groq = new Groq({ apiKey: process.env.GROQ_API_KEY });
const chatLimiter = rateLimit({
  windowMs: 60 * 1000,
  max: Number(process.env.CHAT_RATE_LIMIT_PER_MIN || 20),
  standardHeaders: true,
  legacyHeaders: false
});

router.use(authenticate);

// ─── POST /api/chat ───────────────────────────────────
router.post('/', chatLimiter, async (req, res) => {
  try {
    const { message, history = [] } = req.body;
    if (!isNonEmptyString(message, 1000)) {
      return res.status(400).json({ error: 'message is required' });
    }

    if (!process.env.GROQ_API_KEY) {
      return res.status(503).json({ error: 'AI service unavailable', reply: 'AI assistant is currently unavailable.' });
    }

    const today = new Date().toISOString().split('T')[0];

    // 1. Fetch live clinic data to give AI real context
    const { data: clinics } = await supabase
      .from('tenants')
      .select('id, name, subdomain, address, city, specialization, rating, open_time, close_time, lat, lng')
      .eq('is_active', true);

    // 2. Get live queue counts for each clinic
    const clinicsWithQueue = await Promise.all(
      (clinics || []).map(async (clinic) => {
        const { count } = await supabase
          .from('queue_entries')
          .select('*', { count: 'exact', head: true })
          .eq('tenant_id', clinic.id)
          .eq('status', 'waiting')
          .gte('registered_at', `${today}T00:00:00`);

        return {
          name: clinic.name,
          area: clinic.address,
          city: clinic.city,
          specialization: clinic.specialization,
          rating: clinic.rating,
          openTime: clinic.open_time?.slice(0, 5),
          closeTime: clinic.close_time?.slice(0, 5),
          waitingPatients: count || 0,
          estimatedWaitMins: (count || 0) * 8,
          bookingUrl: `${process.env.FRONTEND_URL}/clinic/${clinic.subdomain}`
        };
      })
    );

    // 3. Get current time for open/closed status
    const now = new Date();
    const currentTime = now.getHours() * 60 + now.getMinutes();

    const clinicsWithStatus = clinicsWithQueue.map(c => {
      const [openH, openM] = (c.openTime || '09:00').split(':').map(Number);
      const [closeH, closeM] = (c.closeTime || '20:00').split(':').map(Number);
      const isOpen = currentTime >= openH * 60 + openM && currentTime <= closeH * 60 + closeM;
      return { ...c, isOpen };
    });

    // Sort by waiting patients
    const sortedByWait = [...clinicsWithStatus].sort((a, b) => a.waitingPatients - b.waitingPatients);
    const sortedByRating = [...clinicsWithStatus].sort((a, b) => b.rating - a.rating);

    // 4. Build system prompt with live data
    const systemPrompt = `You are QFlow's helpful AI assistant for finding dental clinics in Chandigarh, Mohali and Panchkula (Tricity area).

You have access to LIVE real-time data about all clinics right now (${new Date().toLocaleTimeString('en-IN')}):

LIVE CLINIC DATA:
${clinicsWithStatus.map((c, i) => `
${i + 1}. ${c.name}
   - Location: ${c.area}, ${c.city}
   - Specialization: ${c.specialization}
   - Status: ${c.isOpen ? '🟢 OPEN' : '🔴 CLOSED'}
   - Timings: ${c.openTime} - ${c.closeTime}
   - Waiting right now: ${c.waitingPatients} patients
   - Estimated wait: ${c.estimatedWaitMins} minutes
   - Rating: ⭐ ${c.rating}/5
   - Book here: ${c.bookingUrl}
`).join('')}

SHORTEST WAIT RIGHT NOW: ${sortedByWait[0]?.name} (${sortedByWait[0]?.waitingPatients} waiting, ~${sortedByWait[0]?.estimatedWaitMins} mins)
TOP RATED: ${sortedByRating[0]?.name} (⭐ ${sortedByRating[0]?.rating})
OPEN CLINICS: ${clinicsWithStatus.filter(c => c.isOpen).length} out of ${clinicsWithStatus.length}

YOUR ROLE:
- Help patients find the best clinic for their needs
- Give specific recommendations with wait times and ratings
- Always include the booking URL when recommending a clinic
- Be friendly, concise and helpful
- Answer in 2-3 sentences max unless asked for more detail
- If asked about symptoms, give basic advice but recommend seeing a doctor
- You can suggest which doctor type to see based on symptoms`;

    // 5. Build conversation history for Groq
    const messages = [
      { role: 'system', content: systemPrompt },
      ...history.slice(-6).map(h => ({
        role: h.role,
        content: h.content
      })),
      { role: 'user', content: message }
    ];

    // 6. Call Groq AI
    const response = await groq.chat.completions.create({
      model: 'llama-3.3-70b-versatile',
      max_tokens: 300,
      temperature: 0.7,
      messages
    });

    const reply = response.choices[0]?.message?.content || 'Sorry, I could not process that. Please try again.';

    res.json({ reply, clinicsCount: clinicsWithStatus.length });

  } catch (err) {
    console.error('Chat error:', err);
    res.status(500).json({ error: 'Chat failed', reply: 'Sorry, I am having trouble right now. Please try again in a moment.' });
  }
});

module.exports = router;
