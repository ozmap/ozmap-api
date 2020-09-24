const {createLogger, format, transports} = require('winston');
const {colorize, ms, combine, timestamp, printf, errors} = format;
const DailyRotateFile = require('winston-daily-rotate-file');

const myFormat = printf(({metadata, message, ms, label, timestamp}) => {
    label = label || (metadata && metadata.label);

    if (typeof message === 'object') {
        message = JSON.stringify(message);
    }

    return `${timestamp}${label ? ` [ ${label} ] ` : ' '} ${message} ${ms}`;
});

const myFormat2 = printf(({metadata, message, ms, label, timestamp}) => {
    let d = new Date(timestamp);
    var time = new Date().toLocaleString("pt-BR", {timeZone: "America/Sao_Paulo"});

    return `${time} - ${message}`;
});

let combination = [timestamp(), ms(), errors(), myFormat];

let transport_methods = [
];

if(process.env.LOG_TO_FILE) {
    var transport_daily = new (transports.DailyRotateFile)({
        filename: 'application-%DATE%.log',
        datePattern: 'YYYY-MM-DD-HH',
        zippedArchive: true,
        maxSize: '5m',
        prepend: true,
        format: combine(myFormat2),
        maxFiles: '14d',
        level: process.env.FILE_LOG_LEVEL || 'info'
    });
    transport_methods.push(transport_daily);
}



transport_methods.push(new transports.Console({format: combine(colorize({all: true})), level: process.env.LOG_LEVEL}));

const logger = createLogger({
    exitOnError: false,
    format: combine(...combination),
    transports: transport_methods
});
if(transport_daily) {
    transport_daily.on('new', (new_file_name) => {
        logger.file_name = new_file_name;
    });
}

module.exports = (label) => logger.child({label});