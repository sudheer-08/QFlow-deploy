const fs = require('fs');
const file = 'apps/web/src/pages/BookAppointmentPage.jsx';
let content = fs.readFileSync(file, 'utf8');

// Change tracking logic to match the queue tracker
content = content.replace(/\\/track-appointment\\\/\$\{booking\.trackerToken\}/, '/track/');

fs.writeFileSync(file, content);
console.log('Fixed navigation in BookAppointment');
