
const originalConsole = { ...console };

const debug = process.env.NODE_ENV !== 'production';

// 自定义颜色
const colors = {
    reset: "\x1b[0m",
    red: "\x1b[31m",
    yellow: "\x1b[33m",
    cyan: "\x1b[36m",
    grey: "\x1b[38;5;250m",
    white: "\x1b[37m",
    green: "\x1b[32m"
};

function getCurrentTimestamp(name) {
    const now = new Date();
    return `[${now.toISOString().replace("T", " ").slice(0, 19)} ${name}]`; // YYYY-MM-DD HH:mm:ss
}

console.error = (...args) => {
    originalConsole.error(colors.red, getCurrentTimestamp("ERROR"), ...args, colors.reset);
};

console.warn = (...args) => {
    originalConsole.warn(colors.yellow, getCurrentTimestamp("WARN"), ...args, colors.reset);
};

console.info = (...args) => {
    originalConsole.info(colors.green, getCurrentTimestamp("INFO"), ...args, colors.reset);
};

console.debug = (...args) => {
    if (debug)
        originalConsole.debug(colors.cyan, getCurrentTimestamp("DEBUG"), ...args, colors.reset);
}

console.log = (...args) => {
    if (debug)
        originalConsole.log(colors.grey, getCurrentTimestamp("LOG"), ...args, colors.reset);
}