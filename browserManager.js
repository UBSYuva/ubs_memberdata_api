const puppeteer = require('puppeteer-core');
const chromium = require('@sparticuz/chromium');

let browser = null;

async function getBrowser() {
    if (browser && browser.isConnected()) {
        return browser;
    }

    const isProduction = process.env.NODE_ENV === 'production';
    browser = await puppeteer.launch({
        args: isProduction ? chromium.args : ['--no-sandbox', '--disable-setuid-sandbox'],
        defaultViewport: chromium.defaultViewport,
        executablePath: isProduction ? await chromium.executablePath() : undefined,
        headless: isProduction ? chromium.headless : 'new',
        channel: isProduction ? undefined : 'chrome',
    });

    browser.on('disconnected', () => {
        browser = null;
    });

    return browser;
}

async function closeBrowser() {
    if (browser) {
        await browser.close();
        browser = null;
    }
}

module.exports = {
    getBrowser,
    closeBrowser
};
