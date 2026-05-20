const fs = require('fs');
const file = 'apps/web/src/pages/BookAppointmentPage.jsx';
let content = fs.readFileSync(file, 'utf8');

const correctFooter = 
      <footer className="ba-footer">
        {step === 0 && (
          <button
            className={\a-cta \\}
            onClick={() => selected.visitType && setStep(1)}
            disabled={!selected.visitType}
          >
            Next • Choose Doctor & Date
          </button>
        )}

        {step === 1 && (
          <button
            className={\a-cta \\}
            onClick={() => {
              if (!selectedDoctorIdIsValid) return
              if (!hasValidDoctorId(selected.doctorId) && hasValidDoctorId(resolvedDoctorId)) {
                setSelected(prev => ({ ...prev, doctorId: resolvedDoctorId }))
              }
              setStep(isReschedule ? 4 : 3)
            }}
            disabled={!selectedDoctorIdIsValid}
          >
            {isReschedule ? 'Next • Confirm' : 'Next • Enter Details'}
          </button>
        )}

        {step === 3 && (
          <button
            className={\a-cta \\}
            onClick={() => {
              const err = validateDetailsStep()
              if (err) {
                setFormError(err)
                return
              }
              setFormError('')
              setStep(4)
            }}
          >
            Next • Review & Book
          </button>
        )}

        {step === 4 && (
          <button
            className="ba-cta"
            onClick={() => {
              bookMutation.mutate()
            }}
            disabled={bookMutation.isPending}
          >
            {bookMutation.isPending ? (isReschedule ? 'Rescheduling...' : 'Booking...') : (isReschedule ? 'Confirm Reschedule' : 'Confirm Appointment')}
          </button>
        )}
      </footer>
;

const regex = /<footer className="ba-footer">[\s\S]*?<\/footer>/m;
content = content.replace(regex, correctFooter);

fs.writeFileSync(file, content);
console.log('Done');
