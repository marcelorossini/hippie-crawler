require("dotenv").config();

const fs = require("fs").promises;
const path = require('path');
const express = require('express');
const app = express();
app.use(express.raw({ type: 'text/plain' }));
app.use(express.urlencoded({limit: '50mb'}));


const FILE_COOKIE = "./storage/cookies.json";
let page = null;
let browser = null;

app.post("/code", async (req, res) => {
  try {
    console.log(req.body)
    const code = req.body.toString(); 
    const result = await main(code)
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

async function runCode(code) {
  const fullCode = `
  (async () => {${code}})()
`;
  const result = await eval(fullCode);
  return result
}

async function main(code) {
  await createDirectory(path.join(__dirname, 'storage'));

  const puppeteer = require("puppeteer-extra");
  const StealthPlugin = require("puppeteer-extra-plugin-stealth");
  puppeteer.use(StealthPlugin());

  browser = await puppeteer.launch({
    executablePath: '/usr/bin/chromium-browser',
    args: ["--no-sandbox"],
    timeout: 10000,
    headless: false,
    userDataDir: "./storage/user_data",
  });

  try {

    page = await browser.newPage();
    await page.setUserAgent(
      "Mozilla/5.0 (X11; Fedora; Linux x86_64; rv:126.0) Gecko/20100101 Firefox/126.0"
    );
    await loadCookies();
  
    await page.setViewport({ width: 1920, height: 1080 });
    await page.goto("https://www.bling.com.br/inicio#/");
  
    try {
      await page.waitForSelector("#username", { timeout: 5000 });
      const emailSelector = "#username";
      const inputEmail = await page.waitForSelector(emailSelector);
      console.log(process.env.USERNAME);
      await inputEmail.type(process.env.USERNAME);
      const passwordSelector =
        "#login > div > div.login-content.u-flex.u-flex-col.u-items-center > div > div.password-container.u-self-stretch > div > input";
      const inputPassword = await page.waitForSelector(passwordSelector);
      await inputPassword.type(process.env.PASSWORD);
      (await page.waitForSelector(".login-button")).click();
    } catch (error) { }
  
    // Verifica se estamos na tela inicial do bling
    await page.waitForSelector("#perfilPanel > div:nth-child(1) > div > a > h3", {
      timeout: 0,
    });
  
    // Salva sessao
    await storeCookies();
  
    const result = await runCode(code);
  
    browser.close()
    return result;
  } catch (error) {
    browser.close()
    return error.message;
  }
};

async function loadCookies() {
  try {
    // Verifica se o arquivo existe
    await fs.access(FILE_COOKIE);

    // Lê o arquivo se ele existir
    const cookiesString = await fs.readFile(FILE_COOKIE, "utf-8");

    const session = await page.target().createCDPSession();
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

async function storeCookies() {
  const session = await page.target().createCDPSession();
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