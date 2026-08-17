const express = require("express"); //cria o servidor e os endpoints da API
const { execFile } = require("child_process"); //executa o arquivo Python;
const util = require("util"); //permite usar execFile com async e await
const path = require("path"); //monta os caminhos das pastas corretamente
const fs = require("fs"); //lê e escreve arquivos

const execFileAsync = util.promisify(execFile); //espera o python

const app = express();

app.use(express.json());
app.use(express.static(path.join(__dirname, "web"))); //manda os arquivos do site

const MEDICOES_PATH = path.join(__dirname, "data", "medicoes.json"); //historico
const CONFIG_PATH = path.join(__dirname, "data", "config.json"); //config de 1 valor
const PYTHON_SCRIPT = path.join(__dirname, "python", "classify.py"); //IA

const PYTHON_BIN = process.env.PYTHON_BIN || "python"; //executa python sozinho

const DEFAULT_CONFIG = { valueCount: 1 };

function lerMedicoes() { //lê o historico 
    if (!fs.existsSync(MEDICOES_PATH)) {
        return [];
    }

    return JSON.parse(fs.readFileSync(MEDICOES_PATH, "utf-8"));
}

function salvarMedicoes(medicoes) { //salva as amostras
    fs.writeFileSync(
        MEDICOES_PATH,
        JSON.stringify(medicoes, null, 2)//formatação
    );
}

function lerConfig() {
    if (!fs.existsSync(CONFIG_PATH)) {
        return { valueCount: 1 };
    }

    try {
        const config = JSON.parse(
            fs.readFileSync(CONFIG_PATH, "utf-8")
        );

        return {
            valueCount:
                Number.isInteger(config.valueCount) && config.valueCount > 0
                    ? config.valueCount
                    : 1
        };
    }
    catch (erro) {
        console.log("Erro ao ler config.json:", erro.message);
        return { valueCount: 1 };
    }
}


function amostraValida(sample, quantidadeEsperada) { //verifica se recebeu na formatação certa
    return (
        Array.isArray(sample) &&
        sample.length === quantidadeEsperada &&
        sample.every(
            valor => typeof valor === "number" && !Number.isNaN(valor)
        )
    );
}

async function classificarAmostra(sample) { //comunicação com python 
    let stdout;

    try {
        ({ stdout } = await execFileAsync(
            PYTHON_BIN,
            [PYTHON_SCRIPT, JSON.stringify(sample)] // executa python 
        ));
    }
    catch (erro) { //erro de rodar o python 
        const mensagem = erro.stderr?.trim() || erro.message;
        const erroIA = new Error("Falha ao executar a IA");
        erroIA.payload = {
            error: "Falha ao executar a IA",
            detalhes: mensagem
        };
        erroIA.status = 500;
        throw erroIA;
    }

    let resultado;

    try {
        resultado = JSON.parse(stdout); //trasnforma em js
    }
    catch {
        const erroIA = new Error("Resposta invalida da IA");
        erroIA.payload = {
            error: "Resposta invalida da IA",
            resposta: stdout
        };
        erroIA.status = 500;
        throw erroIA; // erro de entrega do python
    }

    if (resultado.error) {
        const erroIA = new Error(resultado.error);
        erroIA.payload = resultado;
        erroIA.status = 400;
        throw erroIA; //erro de entrada no python 
    }

    return resultado; //volta nojson chamado 
}

app.get("/config", (req, res) => {
    res.json(lerConfig());
});

app.post("/medicoes", async (req, res) => {
    const { valueCount } = lerConfig();
    const { sample } = req.body;

    if (!amostraValida(sample, valueCount)) {
        return res.status(400).json({
            error: `sample deve ser um array com exatamente ${valueCount} numero(s)`
        });
    }

    try {
        const { classification, probabilities } =
            await classificarAmostra(sample);

        const medicoes = lerMedicoes();

        const medicao = {
            id: Date.now(),
            sample,
            classification,
            probabilities,
            createdAt: new Date().toISOString()
        };

        medicoes.push(medicao);
        salvarMedicoes(medicoes);

        res.status(201).json(medicao);
    }
    catch (erro) {
        res.status(erro.status || 500).json(
            erro.payload || { error: erro.message }
        );
    }
});

app.post("/classificar", async (req, res) => {
    const { valueCount } = lerConfig();
    const { sample } = req.body;

    if (!amostraValida(sample, valueCount)) {
        return res.status(400).json({
            error: `sample deve ser um array com exatamente ${valueCount} numero(s)`
        });
    }

    try {
        const resultado = await classificarAmostra(sample);
        res.json(resultado);
    }
    catch (erro) {
        res.status(erro.status || 500).json(
            erro.payload || { error: erro.message }
        );
    }
});
app.get("/medicoes", (req, res) => {
    res.json(lerMedicoes());
});

const PORT = process.env.PORT || 3000;

app.listen(PORT, () => {
    console.log(`Servidor rodando em http://localhost:${PORT}`);
});
