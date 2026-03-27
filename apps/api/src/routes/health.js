/**
 * Health check endpoint — reports system status
 * Monitors Redis, Supabase, WhatsApp, and overall API health
 */

const express = require('express');
const supabase = require('../models/supabase');
const router = express.Router();

// Get health status
router.get('/', async (req, res, next) => {
  try {
    const health = {
      status: 'ok',
      timestamp: new Date().toISOString(),
      uptime: process.uptime(),
      checks: {
        supabase: { status: 'checking' },
        redis: { status: 'checking' },
        whatsapp: { status: 'checking' }
      }
    };

    // Check Supabase
    try {
      const { data, error } = await supabase
        .from('tenants')
        .select('id')
        .limit(1);
      
      health.checks.supabase = {
        status: error ? 'unhealthy' : 'ok',
        message: error ? error.message : 'Connected',
        responseTime: `${Date.now()}`
      };
    } catch (err) {
      health.checks.supabase = { status: 'unhealthy', message: err.message };
    }

    // Check Redis (via global reminderQueue if available)
    try {
      if (global.reminderQueue && global.reminderQueue.client) {
        const ping = await global.reminderQueue.client.ping();
        health.checks.redis = {
          status: ping === 'PONG' ? 'ok' : 'unhealthy',
          message: ping === 'PONG' ? 'Connected' : 'No PONG response'
        };
      } else if (global.queueAvailable === false) {
        health.checks.redis = {
          status: 'unhealthy',
          message: 'Queue disabled after repeated errors'
        };
      } else {
        health.checks.redis = { status: 'ok', message: 'Not required for this deployment' };
      }
    } catch (err) {
      health.checks.redis = {
        status: 'unhealthy',
        message: err.message
      };
    }

    // Check WhatsApp
    try {
      const whatsappEnabled = process.env.WHATSAPP_ENABLED !== 'false';
      if (!whatsappEnabled) {
        health.checks.whatsapp = {
          status: 'disabled',
          message: 'Disabled via WHATSAPP_ENABLED=false'
        };
      } else if (global.whatsappClient) {
        const state = global.whatsappClient.info?.me ? 'ok' : 'connecting';
        health.checks.whatsapp = {
          status: state,
          message: state === 'ok' 
            ? `Connected as ${global.whatsappClient.info.me.user}` 
            : 'Client initializing or not connected'
        };
      } else {
        health.checks.whatsapp = {
          status: 'unhealthy',
          message: 'WhatsApp client not initialized'
        };
      }
    } catch (err) {
      health.checks.whatsapp = {
        status: 'unhealthy',
        message: err.message
      };
    }

    // Determine overall health status
    const unhealthyChecks = Object.values(health.checks).filter(c => c.status === 'unhealthy');
    if (unhealthyChecks.length > 0) {
      health.status = 'degraded';
    }

    res.status(health.status === 'ok' ? 200 : 503).json(health);
  } catch (err) {
    next(err);
  }
});

module.exports = router;
