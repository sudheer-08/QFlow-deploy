const fs = require('fs');
const file = 'apps/web/src/pages/BookAppointmentPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// 1. Remove step 2 (Pick a Time Slot) display
content = content.replace(/\{!rescheduleError && step === 2 && renderStepTwo\(\)\}/, '');
content = content.replace(/const renderStepTwo = \(\) => \([\s\S]*?<\/section>\s*\n  \)/m, '');
content = content.replace(/const renderSlotGrid = [\s\S]*?<\/div>\s*\n  \)/m, '');

// 2. Adjust footer steps
content = content.replace(/setStep\(2\)/g, 'setStep(3)'); // Step 1 next goes to step 3
content = content.replace(/onClick=\{\(\) => setStep\(3\)\}/, 'onClick={() => setStep(4)}'); // From step 3 to step 4
content = content.replace(/\{step === 2 && \([\s\S]*?\}\)/m, ''); // Remove step 2 footer
content = content.replace(/\{step === 3 && !isReschedule && \(/, '{step === 3 && !isReschedule && (');

// 3. Change 'Time' rendering in step four
content = content.replace(/\['Time', selected\.slot\]/, "['Time', 'Will be assigned automatically']");

// 4. Change payload
content = content.replace(/appointment_time: selectedSlot,/g, "appointment_time: new Date(selected.date).toISOString(),");

fs.writeFileSync(file, content);
console.log('Done!');
