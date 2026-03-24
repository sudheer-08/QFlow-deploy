const CLINIC_TIMEZONE = process.env.CLINIC_TIMEZONE || 'Asia/Kolkata';

const pad2 = (value) => String(value).padStart(2, '0');

const getDatePartsInTimezone = (date = new Date()) => {
  const formatter = new Intl.DateTimeFormat('en-CA', {
    timeZone: CLINIC_TIMEZONE,
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    second: '2-digit',
    hour12: false
  });

  const parts = formatter.formatToParts(date).reduce((acc, part) => {
    acc[part.type] = part.value;
    return acc;
  }, {});

  return {
    year: parts.year,
    month: parts.month,
    day: parts.day,
    hour: parts.hour,
    minute: parts.minute,
    second: parts.second
  };
};

const getLocalDateString = (date = new Date()) => {
  const { year, month, day } = getDatePartsInTimezone(date);
  return `${year}-${month}-${day}`;
};

const getDayBounds = (dateString) => {
  const safeDate = typeof dateString === 'string' ? dateString : getLocalDateString();
  return {
    start: `${safeDate}T00:00:00`,
    end: `${safeDate}T23:59:59`
  };
};

const getNowInTimezoneDate = () => {
  const { year, month, day, hour, minute, second } = getDatePartsInTimezone(new Date());
  return new Date(`${year}-${month}-${day}T${pad2(hour)}:${pad2(minute)}:${pad2(second)}`);
};

module.exports = {
  CLINIC_TIMEZONE,
  getLocalDateString,
  getDayBounds,
  getNowInTimezoneDate
};
