require("dotenv").config();

const fs = require("fs").promises;
const path = require('path');
const express = require('express');
const app = express();
app.use(express.raw({ type: 'text/plain' }));
app.use(express.urlencoded({ limit: '50mb' }));
const crypto = require('crypto');
const fetch = require('node-fetch');
var instances = {}
const FILE_COOKIE = "./storage/cookies.json";
const PATH_DOWNLOAD = './downloads'


app.post("/code", async (req, res) => {
  try {
    const wait = req.query?.wait != 'false'
    const code = req.body.toString();
    const result = await main(code, wait)
    res.send(result);
  } catch (error) {
    console.error(error);
    res.send(error.message);
  }
});

const port = 3000;
app.listen(port, () => {
  console.log(`Servidor rodando na porta ${port}`);
});

async function runCode(code, pageId) {
  const fullCode = `
  const browser = instances['${pageId}'].browser;
  const page = instances['${pageId}'].page;
  (async () => {${code}})()
`;
  const result = await eval(fullCode);
  return result
}

async function startBrowser() {
  await createDirectory(path.join(__dirname, 'storage'));
  await createDirectory(path.join(__dirname, 'downloads'));

  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  const browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ["--no-sandbox"],
    timeout: 10000,
    headless: false,
    //userDataDir: "./storage/user_data",
  });

  return browser
}

async function main(code, wait) {
  const browser = await startBrowser()
  const page = await browser.newPage();
  const pageId = crypto.randomUUID()
  instances[pageId] = {
    browser,
    page
  };

  try {
    await setPageDefauts(page);

    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://www.bling.com.br/inicio#/");

    await checkLogin(page);

    // Verifica se estamos na tela inicial do bling
    await page.waitForSelector("#perfilPanel > div:nth-child(1) > div > a > h3", {
      timeout: 0,
    });

    // Salva sessao
    await storeCookies(page);

    if (!wait) {
      runCode(code, pageId).then(result => {
        page.close()
        browser.close()
        delete instances[pageId]
      });
      return true
    }

    const result = await runCode(code, pageId);
    page.close()
    browser.close()
    delete instances[pageId]
    return result;
  } catch (error) {
    page.close()
    browser.close()
    delete instances[pageId]
    return error.message;
  }
};

async function loadCookies(pageProps) {
  try {
    // Verifica se o arquivo existe
    await fs.access(FILE_COOKIE);

    // Lê o arquivo se ele existir
    const cookiesString = await fs.readFile(FILE_COOKIE, "utf-8");

    const session = await pageProps.target().createCDPSession();
    const parsed = JSON.parse(cookiesString);
    await session.send("Network.setCookies", {
      cookies: parsed,
    });
    await session.detach();
  } catch (err) {
    if (err.code === "ENOENT") {
      console.log("Arquivo não encontrado.");
    } else {
      console.error("Erro ao ler o arquivo:", err);
    }
  }
}

async function storeCookies(pageProps) {
  const session = await pageProps.target().createCDPSession();
  const resp = await session.send("Network.getAllCookies");
  await session.detach();
  await fs.writeFile(FILE_COOKIE, JSON.stringify(resp.cookies, null, 2));
}

async function createDirectory(dirPath) {
  try {
    await fs.mkdir(dirPath, { recursive: true });
    console.log(`Diretório criado: ${dirPath}`);
  } catch (error) {
    console.error(`Erro ao criar diretório: ${error.message}`);
  }
}

async function setPageDefauts(pageProps) {
  await loadCookies(pageProps);

  const client = await pageProps.target().createCDPSession()
  await client.send('Page.setDownloadBehavior', {
    behavior: 'allow',
    downloadPath: PATH_DOWNLOAD,
  })
}

async function checkLogin(pageProps) {
  try {
    console.log(pageProps.url())
    await pageProps.waitForSelector("#username", { timeout: 5000 });
    const emailSelector = "#username";
    const inputEmail = await pageProps.waitForSelector(emailSelector);
    console.log(process.env.USERNAME);
    await inputEmail.type(process.env.USERNAME);
    const passwordSelector =
      "#login > div > div.login-content.u-flex.u-flex-col.u-items-center > div > div.password-container.u-self-stretch > div > input";
    const inputPassword = await pageProps.waitForSelector(passwordSelector);
    await inputPassword.type(process.env.PASSWORD);
    (await pageProps.waitForSelector(".login-button")).click();
  } catch (error) {
    console.log(error)
  }
}


const getLatestFile = async (dir) => {
  const files = await fs.readdir(dir);
  const fileStats = await Promise.all(
    files.map(async (file) => {
      const filePath = path.join(dir, file);
      const stat = await fs.stat(filePath);
      return { file, time: stat.mtime.getTime() };
    })
  );
  // Ordena os arquivos por tempo de modificação (o mais recente primeiro)
  return fileStats.sort((a, b) => b.time - a.time)[0]?.file;
};