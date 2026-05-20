const fs = require('fs');
const file = 'apps/api/src/routes/appointments.js';
let content = fs.readFileSync(file, 'utf8');

const newInsertionLogic = \
    // 3. Create the booking (Queue system)
    const { data: appointment, error: apptError } = await supabase.from('bookings').insert({
      tenant_id: clinic_id,
      doctor_id: doctor_id,
      patient_id: patientIdToBook,
      appointment_time: appointment_time,
      status: 'scheduled',
      source: 'web',
      visit_type: visit_type,
      patient_name_cache: cleanPatientName,
      patient_phone_cache: cleanPhone,
    }).select('id, token_number').single();

    if (apptError) throw apptError;

    const appointmentId = appointment.id;
    io.to(\\\queue:\:\\\\).emit('queue:state_change');

    res.status(201).json({
      message: 'Appointment booked successfully',
      appointmentId: appointmentId,
      patientId: patientIdToBook,
      trackerToken: appointmentId, 
      clinicName: doctorRecord.tenants?.name,
      doctorName: doctorRecord.name,
      date: appointment_time,
      estimatedTime: 'To be calculated on check-in',
      consultationFee: slotSettings?.consultation_fee || 0
    });
\;

const regex = /\/\/ 3\. Create the appointment[\s\S]*?res\.status\(201\)\.json\(\{[\s\S]*?\}\);/m;
content = content.replace(regex, newInsertionLogic);

fs.writeFileSync(file, content);
console.log('appointments.js fixed');
