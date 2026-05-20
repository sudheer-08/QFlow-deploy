const fs = require('fs');
const file = 'apps/web/src/pages/BookAppointmentPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Replace remaining selected.slot
content = content.replace(/const selectedSlot = selected\.slot/g, "const selectedSlot = null");
content = content.replace(/slotTime: selected\.slot/g, "slotTime: null");

fs.writeFileSync(file, content);
console.log('Cleaned up selected.slot');
